import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DB, User, Notification, Formation, Role } from "./types";
import { emptyDB, defaultEniaContent } from "./seed";
import {
  hashPassword, verifyPassword, passwordStrong,
  getLockState, registerFailure, clearFailures, formatDuration,
} from "./auth";
import { supabase, isSupabaseConfigured } from "./supabase/client";
import {
  getCurrentProfile,
  signOut,
  bootstrapFirstSuperadmin,
  updatePassword,
} from "./supabase/auth";
import { writeAudit } from "./supabase/audit";
import { sanitizeJsonPayload } from "./validation/jsonPayload";

const DB_KEY = "sn_db_v2";
const SESSION_KEY = "sn_session_v2";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const useSb = isSupabaseConfigured && import.meta.env.VITE_USE_SUPABASE !== "false";

interface StoredSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

function migrateDB(parsed: DB): DB {
  const fresh = defaultEniaContent();
  if (!parsed.enia) parsed.enia = fresh;
  // Migration champs ENIA manquants
  if (!parsed.enia.fraisScolaires) parsed.enia.fraisScolaires = [];
  if (!parsed.enia.pieces) parsed.enia.pieces = [];
  if (!parsed.enia.bourseAvantages) parsed.enia.bourseAvantages = fresh.bourseAvantages;
  if (!parsed.enia.bourseHighlights) parsed.enia.bourseHighlights = fresh.bourseHighlights;
  if (!parsed.enia.partenaires) parsed.enia.partenaires = [];
  if (!parsed.invoices) parsed.invoices = [];
  if (!parsed.paymentSchedules) parsed.paymentSchedules = [];
  if (!parsed.teacherHours) parsed.teacherHours = [];
  if (!parsed.teacherPayments) parsed.teacherPayments = [];
  if (!parsed.submissions) parsed.submissions = [];
  if (!parsed.fileActivities) parsed.fileActivities = [];
  if (!parsed.advantages) parsed.advantages = [];
  if (!parsed.partners) parsed.partners = [];
  if (!parsed.announcements) parsed.announcements = [];
  if (!parsed.settings.formations) {
    parsed.settings.formations = {
      informatique: { titre: "GÉNIE INFORMATIQUE", description: "" },
      industriel: { titre: "GÉNIE INDUSTRIEL", description: "" },
    };
  }
  if (!parsed.settings.frais) {
    parsed.settings.frais = { inscription: 0, informatique: [], industriel: [] };
  }
  if (!parsed.settings.preInscription) {
    parsed.settings.preInscription = { enabled: true, title: "Pré-inscription en ligne", description: "" };
  }
  if (!parsed.settings.contact) {
    parsed.settings.contact = { email: "", adresse: "" };
  }
  // Normalise les utilisateurs sans champ actif
  parsed.users = (parsed.users || []).map((u: any) => ({ ...u, actif: u.actif !== false }));
  return parsed;
}

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version && parsed.settings) return migrateDB(parsed);
    }
  } catch { /* ignore */ }
  const fresh = emptyDB([]);
  try { localStorage.setItem(DB_KEY, JSON.stringify(fresh)); } catch { /* quota */ }
  return fresh;
}

function loadSession(db: DB): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s || typeof s !== "object") return null;
    if (Date.now() > s.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
    const u = db.users.find((x) => x.id === s.userId);
    if (!u) { sessionStorage.removeItem(SESSION_KEY); return null; }
    if (u.actif === false) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return u;
  } catch { return null; }
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; error: string; locked?: boolean; remainingMs?: number };

interface StoreCtxType {
  db: DB;
  user: User | null;
  hasSuperAdmin: boolean;
  login: (username: string, password: string, requestedGroup?: "admin" | Role) => Promise<LoginResult>;
  logout: () => void;
  createFirstAdmin: (data: { name: string; username: string; email: string; password: string }) => Promise<{ ok: boolean; error?: string; user?: User }>;
  changePassword: (userId: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  update: (fn: (db: DB) => DB) => void;
  nextStudentId: () => string;
  nextCertNumber: () => string;
  notify: (toId: string, title: string, body: string, type?: string) => void;
  log: (action: string) => void;
  modulesOf: (f: Formation) => DB["modules"];
  computeAmount: (f: Formation, moduleCount: number, includeRegistration?: boolean) => number;
  calculatePricingBreakdown: (f: Formation, moduleCount: number) => {
    registrationFee: number;
    moduleTotal: number;
    total: number;
    installment1: number;
    installment2: number;
  };
  userName: (id: string) => string;
  studentOf: (userId: string) => DB["students"][number] | undefined;
  teacherOf: (userId: string) => DB["teachers"][number] | undefined;
}

const StoreCtx = createContext<StoreCtxType>(null!);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const [user, setUser] = useState<User | null>(() => loadSession(db));
  const sbActive = useSb;

  // Sauvegarde locale de sécurité en continu (filet de secours et mise en cache)
  useEffect(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* quota */ }
  }, [db]);

  // Si le compte de l'utilisateur est désactivé ou supprimé pendant la session, on le déconnecte.
  useEffect(() => {
    if (!user) return;
    const still = db.users.find((u) => u.id === user.id);
    if (!still || still.actif === false) persistSession(null);
    else if (still !== user) setUser(still);
  }, [db.users, user]);

  // Expiration périodique de la session.
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw) as StoredSession;
        if (Date.now() > s.expiresAt) persistSession(null);
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // Synchronise les données Supabase : vitrine publique (sans session) + gestion privée (si authentifié)
  useEffect(() => {
    if (!sbActive) return;

    // 1. Données publiques : toujours chargées pour les visiteurs du site
    const syncPublicData = async () => {
      try {
        const [formationsRes, modulesRes, chaptersRes, siteSettingsRes] = await Promise.all([
          supabase.from("formations").select("*"),
          supabase.from("modules").select("*").order("numero", { ascending: true }),
          supabase.from("chapters").select("*").order("ordre", { ascending: true }),
          supabase.from("site_settings").select("data").eq("id", "default").maybeSingle(),
        ]);

        const formationById = new Map((formationsRes.data || []).map((f: any) => [f.id, f.code]));
        const chaptersByModule = new Map<string, any[]>();
        (chaptersRes.data || []).forEach((c: any) => {
          const arr = chaptersByModule.get(c.module_id) || [];
          arr.push({ id: c.id, titre: c.titre, contenu: c.contenu || "" });
          chaptersByModule.set(c.module_id, arr);
        });

        const remoteSettings = siteSettingsRes?.data?.data || null;

        setDb((prev) => {
          const loadedModules = (modulesRes.data && modulesRes.data.length > 0)
            ? modulesRes.data.map((m: any) => {
                const chs = chaptersByModule.get(m.id) || [];
                const notionsList = chs.length > 0
                  ? chs.map((c) => c.titre)
                  : (Array.isArray(m.notions) && m.notions.length > 0 ? m.notions : []);
                return {
                  id: m.id,
                  formation: (formationById.get(m.formation_id) || "informatique") as Formation,
                  numero: m.numero,
                  titre: m.titre,
                  icon: m.icon || "code",
                  notions: notionsList,
                  description: m.description || "",
                  duree: m.duree || "",
                  supports: m.supports || "",
                  infosSupp: m.infos_supp || "",
                  image: m.image_url || "",
                  chapitres: chs,
                };
              })
            : prev.modules;

          return {
            ...prev,
            settings: remoteSettings?.settings ? { ...prev.settings, ...remoteSettings.settings } : prev.settings,
            advantages: remoteSettings?.advantages || prev.advantages,
            partners: remoteSettings?.partners || prev.partners,
            announcements: remoteSettings?.announcements || prev.announcements,
            enia: remoteSettings?.enia || prev.enia,
            modules: loadedModules,
          };
        });
      } catch (err) {
        console.warn("Erreur chargement vitrine publique Supabase:", err);
      }
    };

    // 2. Données privées : chargées uniquement si session active
    const syncPrivateData = async (sessionUser: any) => {
      try {
        const [
          profilesRes, formationsRes,
          studentsRes, studentModulesRes,
          teachersRes, teacherModulesRes, coursesRes,
          scheduleRes, attendanceRes, invoicesRes, paymentsRes,
          testsRes, resultsRes, gradesRes, notificationsRes,
          certificatesRes, scholarshipsRes,
          registrationsRes, registrationModulesRes,
          schedulesRes,
          archivedRegistrationsRes
        ] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("formations").select("*"),
          supabase.from("students").select("*"),
          supabase.from("student_modules").select("*"),
          supabase.from("teachers").select("*"),
          supabase.from("teacher_modules").select("*"),
          supabase.from("courses").select("*, files:course_files(*)"),
          supabase.from("schedule").select("*"),
          supabase.from("attendance").select("*"),
          supabase.from("invoices").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("tests").select("*, questions(*)"),
          supabase.from("test_results").select("*, answers:test_answers(*)"),
          supabase.from("grades").select("*"),
          supabase.from("notifications").select("*"),
          supabase.from("certificates").select("*, modules:certificate_modules(*)"),
          supabase.from("scholarships").select("*"),
          supabase.from("registrations").select("*").order("created_at", { ascending: false }),
          supabase.from("registration_modules").select("*"),
          supabase.from("payment_schedules").select("*"),
          supabase.from("archived_registrations").select("*").order("archived_at", { ascending: false }),
        ]);

        const updatedUsers: User[] = (!profilesRes.error && profilesRes.data ? profilesRes.data : []).map((p: any) => ({
          id: p.id,
          username: p.username,
          password: "",
          role: p.role as Role,
          name: p.name,
          email: p.email,
          phone: p.phone,
          actif: p.active,
          createdAt: p.created_at?.slice(0, 10) || ""
        }));

        if (sessionUser && updatedUsers.length > 0) {
          setUser((currentUser) => {
            if (!currentUser) {
              const me = updatedUsers.find((u) => u.id === sessionUser.id);
              if (me) {
                persistSession(me);
                return me;
              }
            }
            return currentUser;
          });
        }

        const formationById = new Map((formationsRes.data || []).map((f: any) => [f.id, f.code]));
        const regModulesByRegId = new Map<string, string[]>();
        (registrationModulesRes.data || []).forEach((rm: any) => {
          const arr = regModulesByRegId.get(rm.registration_id) || [];
          arr.push(rm.module_id);
          regModulesByRegId.set(rm.registration_id, arr);
        });

        // Mappage et cycle de vie automatique des préinscriptions
        const rawRegs = (registrationsRes.data || []).map((r: any) => ({
          id: r.id,
          nom: r.nom,
          prenom: r.prenom,
          telephone: r.telephone,
          whatsapp: r.whatsapp,
          email: r.email || "",
          niveau: r.niveau || "",
          formation: (formationById.get(r.formation_id) || "informatique") as Formation,
          modules: regModulesByRegId.get(r.id) || [],
          date: r.date || r.created_at?.slice(0, 10) || "",
          statut: r.statut as any,
          createdAt: r.created_at || r.date,
        }));

        const existingArchives = (archivedRegistrationsRes?.data || []).map((a: any) => ({
          id: a.id,
          originalId: a.original_id,
          nom: a.nom,
          prenom: a.prenom,
          email: a.email || "",
          telephone: a.telephone || "",
          formation: a.formation,
          statut: a.statut,
          archiveReason: a.archive_reason,
          date: a.created_at?.slice(0, 10) || "",
          archivedAt: a.archived_at ? new Date(a.archived_at).toLocaleString("fr-FR") : "",
          modules: a.details?.modules || [],
          whatsapp: a.details?.whatsapp || a.telephone || "",
          niveau: a.details?.niveau || "",
        }));

        const nowMs = Date.now();
        const activeRegs: any[] = [];
        const newlyArchived: any[] = [];

        rawRegs.forEach((r) => {
          const regDateMs = new Date(r.createdAt || r.date).getTime();
          const ageDays = isNaN(regDateMs) ? 0 : (nowMs - regDateMs) / (1000 * 60 * 60 * 24);

          if (r.statut === "en_attente" && ageDays > 7) {
            newlyArchived.push({
              ...r,
              archiveReason: "Délai de traitement dépassé (> 7 jours)",
              archivedAt: new Date().toLocaleString("fr-FR"),
            });
          } else if ((r.statut === "confirmee" || r.statut === "refusee") && ageDays > 2) {
            newlyArchived.push({
              ...r,
              archiveReason: "Archivage opérationnel post-traitement (> 2 jours)",
              archivedAt: new Date().toLocaleString("fr-FR"),
            });
          } else {
            activeRegs.push(r);
          }
        });

        if (newlyArchived.length > 0) {
          newlyArchived.forEach((na) => {
            supabase.from("archived_registrations").insert({
              original_id: na.id,
              nom: na.nom,
              prenom: na.prenom,
              email: na.email,
              telephone: na.telephone,
              formation: na.formation,
              statut: na.statut,
              archive_reason: na.archiveReason,
              created_at: na.createdAt || new Date().toISOString(),
              details: { whatsapp: na.whatsapp, niveau: na.niveau, modules: na.modules }
            }).then().catch(() => {});
          });
        }

        setDb((prev) => ({
          ...prev,
          users: updatedUsers.length > 0 ? updatedUsers : prev.users,
          students: (studentsRes.data && studentsRes.data.length > 0 ? studentsRes.data : prev.students).map((s: any) => {
            const mods = (studentModulesRes.data || [])
              .filter((sm: any) => sm.student_id === s.id)
              .map((sm: any) => sm.module_id);
            return {
              id: s.id, nom: s.nom, prenom: s.prenom, dateNaissance: s.date_naissance || "",
              sexe: s.sexe, telephone: s.telephone, whatsapp: s.whatsapp, email: s.email,
              adresse: s.adresse, niveau: s.niveau, formation: (formationById.get(s.formation_id) || s.formation || "informatique") as Formation,
              modules: mods.length > 0 ? mods : s.modules || [], dateInscription: s.date_inscription || "", statutPaiement: "impaye", statut: s.statut, userId: s.user_id,
              photo: s.photo_url || s.photo || "",
            };
          }),
          teachers: (teachersRes.data && teachersRes.data.length > 0 ? teachersRes.data : prev.teachers).map((t: any) => {
            const mods = (teacherModulesRes.data || [])
              .filter((tm: any) => tm.teacher_id === t.id)
              .map((tm: any) => tm.module_id);
            return {
              id: t.id, nom: t.nom, prenom: t.prenom, specialite: t.specialite, email: t.email,
              phone: t.phone, modules: mods.length > 0 ? mods : t.modules || [], userId: t.user_id, photo: t.photo_url || t.photo,
              tarifHoraire: Number(t.tarif_horaire || t.tarifHoraire || 0), heuresPrevues: Number(t.heures_prevues || t.heuresPrevues || 0),
              typeContrat: t.type_contrat || t.typeContrat || "vacataire", diplomes: t.diplomes || "", infosPro: t.infos_pro || "",
              formations: t.formations || [], actif: t.actif
            };
          }),
          courses: (coursesRes.data && coursesRes.data.length > 0 ? coursesRes.data : prev.courses).map((c: any) => ({
            id: c.id, titre: c.titre, description: c.description || "", moduleId: c.module_id || c.moduleId,
            teacherId: c.teacher_id || c.teacherId, type: c.type as any, date: c.date_publication?.slice(0, 10) || c.date || "",
            audience: c.audience as any, publie: c.publie, content: c.content || "",
            files: (c.files || []).map((f: any) => ({ id: f.id, nom: f.nom, taille: f.taille, type: f.type, url: f.url }))
          })),
          schedule: (() => {
            const capitalizeDay = (d: string) => {
              if (!d) return "Lundi";
              const clean = d.trim().toLowerCase();
              return clean.charAt(0).toUpperCase() + clean.slice(1);
            };
            const remoteSlots = (!scheduleRes.error && scheduleRes.data ? scheduleRes.data : []).map((s: any) => ({
              id: s.id,
              jour: capitalizeDay(s.jour) as any,
              heureDebut: s.heure_debut,
              heureFin: s.heure_fin,
              date: s.date || undefined,
              moduleId: s.module_id,
              teacherId: s.teacher_id,
              salle: s.salle || "",
              formation: (formationById.get(s.formation_id) || "informatique") as Formation,
            }));
            const merged = [...remoteSlots];
            (prev.schedule || []).forEach((localSlot: any) => {
              const locJour = capitalizeDay(localSlot.jour);
              const exists = merged.some((rs) =>
                rs.id === localSlot.id ||
                (capitalizeDay(rs.jour) === locJour && rs.heureDebut === localSlot.heureDebut && rs.heureFin === localSlot.heureFin)
              );
              if (!exists) {
                merged.push({ ...localSlot, jour: locJour });
              }
            });
            return merged;
          })(),
          attendance: (attendanceRes.data || []).map((a: any) => ({
            id: a.id, studentId: a.student_id, date: a.date, moduleId: a.module_id,
            statut: a.statut as any, heure: a.heure, salle: a.salle, teacherId: a.teacher_id
          })),
          invoices: (invoicesRes.data || []).map((i: any) => ({
            id: i.id, studentId: i.student_id, type: i.type as any, libelle: i.libelle, montant: Number(i.montant), date: i.date, dueDate: i.due_date || undefined, createdBy: i.created_by || undefined
          })),
          payments: (paymentsRes.data || []).map((p: any) => ({
            id: p.id, studentId: p.student_id, invoiceId: p.invoice_id, type: p.type as any, libelle: p.libelle,
            montant: Number(p.montant), date: p.date, heure: p.heure, mode: p.mode, reference: p.reference, observation: p.observation,
            createdBy: p.created_by, createdByName: p.created_by_name
          })),
          paymentSchedules: (schedulesRes.data || []).map((s: any) => ({
            id: s.id,
            studentId: s.student_id,
            invoiceId: s.invoice_id || undefined,
            installmentNumber: Number(s.installment_number),
            label: s.label,
            amount: Number(s.amount),
            paidAmount: Number(s.paid_amount || 0),
            dueDate: s.due_date,
            status: s.status as any,
          })),
          tests: (testsRes.data || []).map((t: any) => ({
            id: t.id, titre: t.titre, moduleId: t.module_id, chapitreId: t.chapitre_id || undefined,
            teacherId: t.teacher_id, questions: t.questions || [], date: t.date?.slice(0, 10) || "",
            duree: t.duree, bareme: Number(t.bareme || 20), dateDebut: t.date_debut, dateFin: t.date_fin,
            difficulte: t.difficulte, tentatives: t.tentatives, afficherCorrections: t.afficher_corrections,
            validationRequise: t.validation_requise,
          })),
          results: (resultsRes.data || []).map((r: any) => ({ id: r.id, testId: r.test_id, studentId: r.student_id, note: Number(r.note), pourcentage: Number(r.pourcentage), date: r.date?.slice(0, 10) || "", heure: r.heure, valide: r.valide, statut: r.statut })),
          grades: (gradesRes.data || []).map((g: any) => ({ id: g.id, studentId: g.student_id, moduleId: g.module_id, note: Number(g.note), appreciation: g.appreciation || "", date: g.date })),
          notifications: (notificationsRes.data || []).map((n: any) => ({ id: n.id, toId: n.user_id || "all", title: n.title, body: n.body, date: n.created_at?.slice(0, 10) || "", lu: n.read, type: n.type })),
          certificates: (certificatesRes.data || []).map((c: any) => ({ id: c.id, studentId: c.student_id, numero: c.numero, formation: (formationById.get(c.formation_id) || "informatique") as Formation, modules: (c.modules || []).map((x: any) => x.module_id), periode: c.periode, resultat: c.resultat, note: Number(c.note), date: c.date })),
          scholarships: (scholarshipsRes.data || []).map((s: any) => ({ id: s.id, studentId: s.student_id, statut: s.statut, date: s.date })),
          registrations: activeRegs,
          archivedRegistrations: [...newlyArchived, ...existingArchives],
        }));
      } catch (err) {
        console.warn("Erreur chargement données privées Supabase:", err);
      }
    };

    const syncAll = async () => {
      // 1. Toujours synchroniser les données publiques du site
      await syncPublicData();

      // 2. Si authentifié, synchroniser les données privées
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await syncPrivateData(session.user);
      }
    };

    syncAll();
    window.addEventListener("sentinelles:supabase-refresh", syncAll);

    // Abonnement temps réel : écoute continue des mises à jour Supabase
    const channel = supabase
      .channel("realtime-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, () => syncPublicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => syncPublicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () => syncPublicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "formations" }, () => syncPublicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_schedules" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_modules" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "teachers" }, () => syncAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => syncAll())
      .subscribe();

    return () => {
      window.removeEventListener("sentinelles:supabase-refresh", syncAll);
      channel.unsubscribe();
    };
  }, [sbActive, user?.id]);

  const update = (fn: (d: DB) => DB) => {
    setDb((currentDb) => {
      const next = fn(currentDb);
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(next));
      } catch { /* quota */ }

      if (sbActive) {
        if (
          next.settings !== currentDb.settings ||
          next.advantages !== currentDb.advantages ||
          next.partners !== currentDb.partners ||
          next.announcements !== currentDb.announcements ||
          next.enia !== currentDb.enia
        ) {
          supabase.from("site_settings").upsert({
            id: "default",
            data: sanitizeJsonPayload({
              settings: next.settings,
              advantages: next.advantages,
              partners: next.partners,
              announcements: next.announcements,
              enia: next.enia,
            }),
            updated_at: new Date().toISOString(),
          }).then().catch((e) => console.warn("Auto-sync site_settings error:", e));
        }
      }

      return next;
    });
  };

  const persistSession = (u: User | null) => {
    setUser(u);
    try {
      if (u) {
        const s: StoredSession = { userId: u.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch { /* ignore */ }
  };

  const [sbHasAdmin, setSbHasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (sbActive) {
      (async () => {
        try {
          const { data } = await supabase.rpc("has_any_superadmin");
          if (typeof data === "boolean") setSbHasAdmin(data);
        } catch { /* ignore */ }
      })();
    }
  }, [sbActive]);

  const hasSuperAdmin = useMemo(() => {
    if (sbActive && sbHasAdmin !== null) return sbHasAdmin;
    return db.users.some((u) => u.role === "superadmin");
  }, [db.users, sbActive, sbHasAdmin]);

  const login: StoreCtxType["login"] = async (username, password, requestedGroup) => {
    const uname = (username || "").trim();
    if (!uname || !password) return { ok: false, error: "Veuillez renseigner votre identifiant et votre mot de passe." };

    if (sbActive) {
      try {
        let email = uname;
        if (uname.toLowerCase() === "fredich") {
          email = "fredichfoundou09@gmail.com";
        } else if (!email.includes("@")) {
          // Résolution de l'identifiant pour Supabase Auth via RPC sécurisée
          const { data: rpcEmail } = await supabase.rpc("get_email_by_username", { p_username: uname });
          if (rpcEmail) {
            email = rpcEmail;
          } else {
            const { data } = await supabase.from("profiles").select("email").eq("username", uname.toLowerCase()).maybeSingle();
            if (data?.email) {
              email = data.email;
            }
          }
        }

        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) {
          // Si Supabase échoue mais que l'utilisateur existe dans db.users (ex: compte local)
          const localUser = db.users.find((u) => u.username.toLowerCase() === uname.toLowerCase());
          if (localUser && localUser.actif !== false) {
            const ok = await verifyPassword(password, localUser.password);
            if (ok) {
              persistSession(localUser);
              setUser(localUser);
              return { ok: true, user: localUser };
            }
          }
          if (authErr.message?.toLowerCase().includes("email not confirmed")) {
            return { ok: false, error: "Email en cours de confirmation. Réactualisez la page et réessayez." };
          }
          if (authErr.message?.toLowerCase().includes("invalid login credentials")) {
            return { ok: false, error: "Identifiant ou mot de passe incorrect." };
          }
          return { ok: false, error: authErr.message };
        }

        const profile = await getCurrentProfile();
        if (!profile || !profile.active) {
          await supabase.auth.signOut();
          return { ok: false, error: "Compte inactif ou suspendu." };
        }

        if (requestedGroup) {
          const r = profile.role as string;
          const inAdminGroup = r === "superadmin" || r === "admin" || r === "partner_admin";
          const inPartnerGroup = r === "partner" || r === "partner_admin";
          const groupOk =
            (requestedGroup === "admin" && inAdminGroup) ||
            (requestedGroup === "teacher" && r === "teacher") ||
            (requestedGroup === "student" && r === "student") ||
            (requestedGroup === ("partner" as any) && inPartnerGroup);
          if (!groupOk) {
            await supabase.auth.signOut();
            return { ok: false, error: "Ce compte n'est pas autorisé pour cet espace. Sélectionnez le bon profil." };
          }
        }

        const mappedUser: User = {
          id: profile.id, username: profile.username, password: "", role: profile.role,
          name: profile.name, email: profile.email || "", phone: profile.phone || "",
          actif: profile.active, createdAt: profile.created_at?.slice(0, 10) || ""
        };

        persistSession(mappedUser);
        setUser(mappedUser);
        await writeAudit({ action: "LOGIN", entity_type: "profiles", entity_id: profile.id, description: `Connexion ${profile.username}` });
        return { ok: true, user: mappedUser };
      } catch (err: any) {
        return { ok: false, error: err.message || "Erreur de connexion" };
      }
    } else {
      // Anti brute-force local
      const lock = getLockState(uname);
      if (lock.locked) {
        return { ok: false, locked: true, remainingMs: lock.remainingMs, error: `Trop de tentatives. Réessayez dans ${formatDuration(lock.remainingMs)}.` };
      }

      const found = db.users.find((u) => u.username.toLowerCase() === uname.toLowerCase());
      if (!found) {
        const f = registerFailure(uname);
        return { ok: false, locked: f.locked, remainingMs: f.remainingMs, error: "Identifiants incorrects." };
      }
      if (found.actif === false) {
        const f = registerFailure(uname);
        return { ok: false, locked: f.locked, remainingMs: f.remainingMs, error: "Identifiants incorrects." };
      }

      const ok = await verifyPassword(password, found.password);
      if (!ok) {
        const f = registerFailure(uname);
        return { ok: false, locked: f.locked, remainingMs: f.remainingMs, error: f.locked ? `Trop de tentatives. Verrouillé ${formatDuration(f.remainingMs)}.` : `Identifiants incorrects (${f.attempts} tentative${f.attempts > 1 ? "s" : ""}).` };
      }

      if (requestedGroup) {
        const r = found.role as string;
        const inAdminGroup = r === "superadmin" || r === "admin" || r === "partner_admin";
        const inPartnerGroup = r === "partner" || r === "partner_admin";
        const groupOk =
          (requestedGroup === "admin" && inAdminGroup) ||
          (requestedGroup === "teacher" && r === "teacher") ||
          (requestedGroup === "student" && r === "student") ||
          (requestedGroup === ("partner" as any) && inPartnerGroup);
        if (!groupOk) {
          return { ok: false, error: "Ce compte n'est pas autorisé pour cet espace. Sélectionnez le bon profil." };
        }
      }

      clearFailures(uname);
      persistSession(found);
      return { ok: true, user: found };
    }
  };

  const logout = async () => {
    if (sbActive) {
      if (user) {
        await writeAudit({ action: "LOGOUT", entity_type: "profiles", entity_id: user.id, description: `Déconnexion ${user.username}` });
      }
      await signOut();
    }
    persistSession(null);
    try { sessionStorage.clear(); } catch { /* ignore */ }
  };

  const createFirstAdmin: StoreCtxType["createFirstAdmin"] = async ({ name, username, email, password }) => {
    const uname = (username || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(uname)) {
      return { ok: false, error: "Identifiant invalide (3 à 32 caractères, lettres/chiffres/. _ -)." };
    }
    if (!passwordStrong(password)) {
      return { ok: false, error: "Mot de passe insuffisant. Respectez les 6 critères de sécurité." };
    }

    if (sbActive) {
      try {
        const p = await bootstrapFirstSuperadmin({ email, password, name, username });
        const mappedUser: User = {
          id: p!.id, username: p!.username, password: "", role: p!.role,
          name: p!.name, email: p!.email || "", phone: p!.phone || "",
          actif: p!.active, createdAt: p!.created_at?.slice(0, 10) || ""
        };
        persistSession(mappedUser);
        setUser(mappedUser);
        setSbHasAdmin(true);
        return { ok: true, user: mappedUser };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    } else {
      if (db.users.some((u) => u.role === "superadmin")) {
        return { ok: false, error: "Un Administrateur Supérieur existe déjà. Cette procédure n'est plus disponible." };
      }
      if (db.users.some((u) => u.username.toLowerCase() === uname)) {
        return { ok: false, error: "Cet identifiant est déjà utilisé." };
      }
      const hash = await hashPassword(password);
      const admin: User = {
        id: `u-admin-${Date.now().toString(36)}`,
        username: uname, password: hash, role: "superadmin",
        name: (name || "").trim() || "Administrateur Supérieur",
        email: (email || "").trim(),
        createdAt: new Date().toISOString().slice(0, 10),
        actif: true,
      };
      setDb((d) => ({
        ...d,
        users: [...d.users, admin],
        log: [{ id: `LOG-${Date.now()}`, date: new Date().toISOString().slice(0, 10), user: admin.name, action: "Création du premier compte Administrateur Supérieur" }, ...d.log],
      }));
      persistSession(admin);
      return { ok: true, user: admin };
    }
  };

  const changePassword: StoreCtxType["changePassword"] = async (userId, newPassword) => {
    if (!passwordStrong(newPassword)) return { ok: false, error: "Mot de passe insuffisant." };
    
    if (sbActive) {
      try {
        await updatePassword(newPassword);
        await writeAudit({ action: "PASSWORD_CHANGE", entity_type: "profiles", entity_id: userId, description: "Modification mot de passe utilisateur" });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    } else {
      const hash = await hashPassword(newPassword);
      setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === userId ? { ...u, password: hash } : u)) }));
      return { ok: true };
    }
  };

  const nextStudentId = () => {
    const year = new Date().getFullYear();
    const max = db.students.reduce((acc, s) => {
      const m = s.id.match(/SN-(\d{4})-(\d+)/);
      if (m && m[1] === String(year)) return Math.max(acc, parseInt(m[2], 10));
      return acc;
    }, 0);
    return `SN-${year}-${String(max + 1).padStart(5, "0")}`;
  };

  const nextCertNumber = () => `SN-CERT-${new Date().getFullYear()}-${String(db.certificates.length + 1).padStart(4, "0")}`;

  const notify = (toId: string, title: string, body: string, type = "info") => {
    const n: Notification = {
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toId, title, body,
      date: new Date().toISOString().slice(0, 10),
      lu: false, type,
    };
    update((d) => ({ ...d, notifications: [n, ...d.notifications] }));
  };

  const log = (action: string) => {
    update((d) => ({
      ...d,
      log: [
        { id: `LOG-${Date.now()}`, date: new Date().toISOString().slice(0, 10), user: user?.name ?? "Système", action },
        ...d.log,
      ].slice(0, 300),
    }));
  };

  const modulesOf = (f: Formation) => db.modules.filter((m) => m.formation === f);

  const computeAmount = (f: Formation, moduleCount: number, includeRegistration: boolean = true) => {
    const regFee = Number(db.settings.frais?.inscription || 5000);
    let moduleTotal = 0;

    if (f === "informatique") {
      // Règle officielle Audit Section 5 : 3 500 FCFA par module
      moduleTotal = Math.max(0, moduleCount) * 3500;
    } else if (f === "industriel") {
      // Règle officielle Audit Section 5 : forfaits 3 mod = 5000, 6 mod = 10000, 12 mod = 20000
      if (moduleCount <= 0) {
        moduleTotal = 0;
      } else if (moduleCount <= 3) {
        moduleTotal = 5000;
      } else if (moduleCount <= 6) {
        moduleTotal = 10000;
      } else if (moduleCount <= 12) {
        moduleTotal = 20000;
      } else {
        moduleTotal = Math.round((20000 / 12) * moduleCount);
      }
    } else {
      moduleTotal = Math.max(0, moduleCount) * 3500;
    }

    return includeRegistration ? regFee + moduleTotal : moduleTotal;
  };

  const calculatePricingBreakdown = (f: Formation, moduleCount: number) => {
    const regFee = Number(db.settings.frais?.inscription || 5000);
    const moduleTotal = computeAmount(f, moduleCount, false);
    const total = regFee + moduleTotal;
    const installment1 = regFee + Math.round(moduleTotal / 2);
    const installment2 = total - installment1;
    return {
      registrationFee: regFee,
      moduleTotal,
      total,
      installment1,
      installment2,
    };
  };

  const userName = (id: string) => {
    if (id === "all_students") return "Tous les apprenants";
    if (id === "all_teachers") return "Tous les enseignants";
    return db.users.find((u) => u.id === id)?.name ?? "Système";
  };
  const studentOf = (userId: string) => db.students.find((s) => s.userId === userId);
  const teacherOf = (userId: string) => db.teachers.find((t) => t.userId === userId);

  const value = useMemo(
    () => ({
      db, user, hasSuperAdmin,
      login, logout, createFirstAdmin, changePassword,
      update, nextStudentId, nextCertNumber, notify, log,
      modulesOf, computeAmount, calculatePricingBreakdown, userName, studentOf, teacherOf,
    }),
    [db, user, hasSuperAdmin]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);
