import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Users, Search, PlusCircle, Eye, EyeOff, Pencil, UserCircle2, Phone, Mail, MapPin, CalendarDays,
  GraduationCap, ShieldCheck, Trash2, CheckCircle2, XCircle, KeyRound, Clock, Wallet, BadgeDollarSign, Timer, MessageCircle, Download,
  Table2, LayoutGrid, Printer, CreditCard, ExternalLink, ArrowRight, Archive, FileSpreadsheet,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import {
  Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Textarea, Stat, uid, today,
  formationLabel, money, moduleIcon, readImage,
} from "@/lib/ui";
import { Student, Formation, User, Role, DB } from "@/lib/types";
import { AppRole } from "@/lib/supabase/auth";
import { PARTNER_SCOPES } from "@/types/rbac";
import { resolveFormationId } from "@/lib/supabase/formations";
import { hashPassword, generateTempPassword, passwordStrong, checkPassword } from "@/lib/auth";
import { toastMsg } from "@/lib/toast";
import { invokeCreateUser } from "@/lib/supabase/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { financialSummary, statusLabel } from "@/lib/finance";
import { teacherFinanceSummary } from "@/lib/teacher";
// lib/access importé via Operations uniquement

/* ---------- helpers ---------- */
function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Génère un compte utilisateur en mode local (fallback sans Supabase).
 * En mode Supabase (isSupabaseConfigured === true), NE PAS appeler cette fonction :
 * utiliser à la place invokeCreateUser() qui stocke les credentials côté serveur.
 */
export async function makeAccount(db: DB, student: Student, role: "student" | "teacher" = "student"): Promise<{ users: User[]; student: Student; tempPassword: string }> {
  const base = `${student.prenom}.${student.nom}`.toLowerCase();
  let username = slugify(base) || `user${Math.floor(Math.random() * 10000)}`;
  let i = 1;
  const taken = new Set(db.users.map((u: User) => u.username));
  while (taken.has(username)) username = `${slugify(base)}${i++}`;
  const userId = `u-${username}`;
  const tempPassword = generateTempPassword();
  // En mode local uniquement : hashage PBKDF2 côté client.
  const hash = await hashPassword(tempPassword);
  const user: User = {
    id: userId, username,
    password: hash, // Stocké uniquement en localStorage (mode local hors Supabase)
    role,
    name: `${student.prenom} ${student.nom}`, email: student.email, phone: student.telephone,
    linkedId: student.id, createdAt: today(), actif: true,
  };
  return { users: [...db.users, user], student: { ...student, userId }, tempPassword };
}

/* ================= STUDENTS ================= */
const emptyStudent = (): Omit<Student, "id"> => ({
  nom: "", prenom: "", dateNaissance: "", sexe: "M", telephone: "", whatsapp: "", email: "",
  adresse: "", niveau: "", formation: "informatique", modules: [], dateInscription: today(),
  statutPaiement: "impaye", statut: "actif",
});

export function StudentsPage() {
  const { db, user, update, nextStudentId, notify, log, computeAmount } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"tous" | Formation>("tous");
  const [fPay, setFPay] = useState("");
  const [fActif, setFActif] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [printingBadge, setPrintingBadge] = useState<Student | null>(null);
  const [form, setForm] = useState<any>(emptyStudent());
  const [createdCreds, setCreatedCreds] = useState<{
    nom: string;
    identifiant: string;
    motDePasse: string;
    phone?: string;
    totalAmount?: number;
    inscAmount?: number;
    tranche1?: number;
    tranche2?: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [showArchives, setShowArchives] = useState(false);

  // Ouverture automatique depuis la barre de recherche globale
  useEffect(() => {
    const studentId = searchParams.get("id");
    if (studentId) {
      const found = db.students.find((s) => s.id === studentId);
      if (found) {
        setViewing(found);
      }
    }
  }, [searchParams, db.students]);

  const filtered = db.students.filter((s) => {
    const matchQ = `${s.nom} ${s.prenom} ${s.id}`.toLowerCase().includes(q.toLowerCase());
    const matchT = tab === "tous" || s.formation === tab;
    if (!matchQ || !matchT) return false;
    if (fPay) {
      const st = financialSummary(db, s.id).statut;
      if (st !== fPay) return false;
    }
    if (fActif === "actif" && s.actif === false) return false;
    if (fActif === "inactif" && s.actif !== false) return false;
    return true;
  });

  const exportStudentsCSV = () => {
    const headers = ["N° Apprenant", "Nom", "Prénom", "Formation", "Téléphone", "WhatsApp", "Email", "Modules", "Paiement", "Statut Compte"];
    const rows = filtered.map((s) => {
      const fin = financialSummary(db, s.id);
      return [
        s.id,
        s.nom,
        s.prenom,
        formationLabel(s.formation),
        s.telephone || "",
        s.whatsapp || "",
        s.email || "",
        s.modules.length,
        fin.statut,
        s.actif !== false ? "Actif" : "Inactif",
      ];
    });
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apprenants_sentinelles_${today()}.csv`;
    a.click();
    toastMsg.success("Export apprenants CSV téléchargé ✓");
  };

  const toggleActiveStudent = async (s: Student) => {
    const newStatus = s.actif === false ? true : false;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("students").update({ actif: newStatus }).eq("id", s.id);
        toastMsg.success(newStatus ? "Apprenant réactivé ✓" : "Apprenant désactivé ✓");
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur statut apprenant", err.message);
        return;
      }
    }
    update((d) => ({
      ...d,
      students: d.students.map((x) => (x.id === s.id ? { ...x, actif: newStatus } : x)),
    }));
  };

  const save = async () => {
    if (!form.nom || !form.prenom) return;
    if (editing) {
      if (isSupabaseConfigured) {
        try {
          const resolvedFormationId = await resolveFormationId(form.formation);
          await supabase.from("students").update({
            formation_id: resolvedFormationId,
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
            whatsapp: form.whatsapp,
            email: form.email || null,
            adresse: form.adresse || null,
            niveau: form.niveau || null,
            sexe: form.sexe || null,
            photo_url: form.photo || null,
          }).eq("id", editing.id);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          toastMsg.success("Apprenant mis à jour côté serveur ✓");
        } catch (err: any) {
          toastMsg.error("Erreur mise à jour", err.message);
        }
      }
      update((d) => ({ ...d, students: d.students.map((s) => (s.id === editing.id ? { ...s, ...form } : s)) }));
      log(`Apprenant modifié : ${form.nom} ${form.prenom}`);
    } else {
      const montant = computeAmount(form.formation, form.modules.length);
      const insc = db.settings.frais.inscription;
      const baseUname = slugify(`${form.prenom}.${form.nom}`) || `user${Math.floor(Math.random() * 10000)}`;
      let uname = baseUname;
      let i = 1;
      while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
      const tempPassword = generateTempPassword();

      if (isSupabaseConfigured) {
        try {
          const email = form.email || `${uname}@sentinelles.local`;
          const resolvedFormationId = await resolveFormationId(form.formation);
          const res = await invokeCreateUser({
            email,
            password: tempPassword,
            username: uname,
            name: `${form.prenom} ${form.nom}`,
            role: "student",
            student: {
              formation_id: resolvedFormationId,
              nom: form.nom, prenom: form.prenom, telephone: form.telephone, whatsapp: form.whatsapp,
              email, adresse: form.adresse, niveau: form.niveau, sexe: form.sexe,
              photo_url: form.photo || null,
            },
            module_ids: form.modules,
            frais: {
              inscription: insc,
              formation: montant,
              libelle: `Formation — ${form.modules.length} module(s) (${formationLabel(form.formation)})`,
            },
          });

          // Génération garantie des factures en base pour l'apprenant
          let createdStudentId = res?.student_id;
          if (!createdStudentId && res?.user_id) {
            const { data: stRow } = await supabase.from("students").select("id").eq("user_id", res.user_id).maybeSingle();
            createdStudentId = stRow?.id;
          }
          if (!createdStudentId) {
            const { data: stRow } = await supabase.from("students").select("id").eq("nom", form.nom).eq("prenom", form.prenom).order("id", { ascending: false }).limit(1).maybeSingle();
            createdStudentId = stRow?.id;
          }

          if (createdStudentId) {
            const { data: existingInvs } = await supabase.from("invoices").select("type").eq("student_id", createdStudentId);
            const hasInsc = existingInvs?.some((i: any) => i.type === "inscription");
            const hasForm = existingInvs?.some((i: any) => i.type === "formation");
            const newInvs: any[] = [];
            if (!hasInsc && insc > 0) {
              newInvs.push({
                student_id: createdStudentId,
                type: "inscription",
                libelle: "Frais d'inscription",
                montant: insc,
                date: today(),
                created_by: user?.id || null,
              });
            }
            if (!hasForm && montant > 0) {
              newInvs.push({
                student_id: createdStudentId,
                type: "formation",
                libelle: `Formation — ${form.modules.length} module(s) (${formationLabel(form.formation)})`,
                montant: montant,
                date: today(),
                created_by: user?.id || null,
              });
            }
            if (newInvs.length > 0) {
              const { error: invErr } = await supabase.from("invoices").insert(newInvs);
              if (invErr) {
                console.warn("Erreur insertion factures:", invErr);
              } else {
                log(`Factures créées pour ${form.nom} ${form.prenom} (${createdStudentId}) : ${money(montant + insc)}`);
              }
            }

            if (montant > 0) {
              try {
                await supabase.rpc("generate_student_payment_schedule", {
                  p_student_id: createdStudentId,
                  p_tuition_total: montant,
                  p_start_date: today(),
                });
              } catch (schErr: any) {
                console.warn("Échéancier auto notice:", schErr.message);
              }
            }
          }
          
          setCreatedCreds({
            nom: `${form.prenom} ${form.nom}`,
            identifiant: uname,
            motDePasse: tempPassword,
            phone: form.whatsapp || form.telephone,
            totalAmount: montant + insc,
            inscAmount: insc,
            tranche1: Math.round(montant / 2),
            tranche2: montant - Math.round(montant / 2),
          });
          toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
          toastMsg.success("Apprenant inscrit avec facturation et échéancier automatique ✓");
          if (montant + insc > 0) {
            toastMsg.info(`Factures générées : ${money(montant + insc)} (2 tranches configurées)`);
          }
          log(`Apprenant inscrit (Supabase) : ${form.nom} ${form.prenom} — compte ${uname}`);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          
        } catch (err: any) {
          toastMsg.error("Erreur lors de la création", (err as Error).message);
          return;
        }
      } else {
        const id = nextStudentId();
        const { users, student } = await makeAccount(db, { ...form, id } as Student);
        update((d) => ({
          ...d, users,
          students: [{ ...student, id, statutPaiement: "impaye" as const }, ...d.students],
          invoices: [
            ...(insc > 0 ? [{ id: uid("INV"), studentId: id, type: "inscription" as const, libelle: "Frais d'inscription", montant: insc, date: today() }] : []),
            ...(montant > 0 ? [{ id: uid("INV"), studentId: id, type: "formation" as const, libelle: `Formation — ${form.modules.length} module(s) (${formationLabel(form.formation)})`, montant, date: today() }] : []),
            ...d.invoices,
          ],
          notifications: [{ id: uid("NTF"), toId: student.userId!, title: "Bienvenue !", body: `Votre compte a été créé. Identifiant : ${uname}. Un mot de passe temporaire vous a été communiqué par l'administration.`, date: today(), lu: false, type: "inscription" }, ...d.notifications],
        }));
        notify("all", "Nouvel apprenant inscrit", `${form.nom} ${form.prenom} — ${formationLabel(form.formation)} • À facturer : ${money(montant + insc)}`, "inscription");
        log(`Apprenant inscrit : ${form.nom} ${form.prenom} (${id}) — compte ${uname} — à facturer ${money(montant + insc)}`);
        setCreatedCreds({
          nom: `${form.prenom} ${form.nom}`,
          identifiant: uname,
          motDePasse: tempPassword,
          phone: form.whatsapp || form.telephone,
        });
        toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
        toastMsg.info(`Factures générées : ${money(montant + insc)}`);
      }
    }
    setCreating(false); setEditing(null);
  };

  const confirmRegistration = async (regId: string) => {
    const reg = db.registrations.find((r) => r.id === regId);
    if (!reg) return;

    const baseUname = slugify(`${reg.prenom}.${reg.nom}`) || `user${Math.floor(Math.random() * 10000)}`;
    let uname = baseUname;
    let i = 1;
    while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
    const tempPassword = generateTempPassword();

    const montant = computeAmount(reg.formation, reg.modules.length);
    const insc = db.settings.frais.inscription;

    if (isSupabaseConfigured) {
      try {
        const resolvedFormationId = await resolveFormationId(reg.formation);
        const email = reg.email ? reg.email.trim() : `${uname}@sentinelles.local`;
        const res = await invokeCreateUser({
          email,
          password: tempPassword,
          username: uname,
          name: `${reg.prenom} ${reg.nom}`,
          role: "student",
          student: {
            formation_id: resolvedFormationId,
            nom: reg.nom, prenom: reg.prenom, telephone: reg.telephone, whatsapp: reg.whatsapp,
            email: email, niveau: reg.niveau
          },
          module_ids: reg.modules,
          frais: {
            inscription: insc,
            formation: montant,
            libelle: `Formation — ${reg.modules.length} module(s) (${formationLabel(reg.formation)})`,
          },
        });

        const confirmedUname = res?.username || uname;

        // Génération garantie des factures en base pour l'apprenant confirmé
        let confirmedStudentId = res?.student_id;
        if (!confirmedStudentId && res?.user_id) {
          const { data: stRow } = await supabase.from("students").select("id").eq("user_id", res.user_id).maybeSingle();
          confirmedStudentId = stRow?.id;
        }
        if (!confirmedStudentId) {
          const { data: stRow } = await supabase.from("students").select("id").eq("nom", reg.nom).eq("prenom", reg.prenom).order("id", { ascending: false }).limit(1).maybeSingle();
          confirmedStudentId = stRow?.id;
        }

        if (confirmedStudentId) {
          const { data: existingInvs } = await supabase.from("invoices").select("type").eq("student_id", confirmedStudentId);
          const hasInsc = existingInvs?.some((i: any) => i.type === "inscription");
          const hasForm = existingInvs?.some((i: any) => i.type === "formation");
          const newInvs: any[] = [];
          if (!hasInsc && insc > 0) {
            newInvs.push({
              student_id: confirmedStudentId,
              type: "inscription",
              libelle: "Frais d'inscription",
              montant: insc,
              date: today(),
              created_by: user?.id || null,
            });
          }
          if (!hasForm && montant > 0) {
            newInvs.push({
              student_id: confirmedStudentId,
              type: "formation",
              libelle: `Formation — ${reg.modules.length} module(s) (${formationLabel(reg.formation)})`,
              montant: montant,
              date: today(),
              created_by: user?.id || null,
            });
          }
          if (newInvs.length > 0) {
            const { error: invErr } = await supabase.from("invoices").insert(newInvs);
            if (invErr) {
              console.warn("Erreur insertion factures confirmation:", invErr);
            } else {
              log(`Factures créées suite confirmation pour ${reg.nom} ${reg.prenom} (${confirmedStudentId}) : ${money(montant + insc)}`);
            }
          }

          if (montant > 0) {
            try {
              await supabase.rpc("generate_student_payment_schedule", {
                p_student_id: confirmedStudentId,
                p_tuition_total: montant,
                p_start_date: today(),
              });
            } catch (schErr: any) {
              console.warn("Échéancier auto notice:", schErr.message);
            }
          }
        }
        
        await supabase.from("registrations").update({ statut: "confirmee", updated_at: new Date().toISOString() }).eq("id", regId);

        update((d) => ({
          ...d,
          registrations: d.registrations.map((r) => (r.id === regId ? { ...r, statut: "confirmee" as const } : r))
        }));

        setCreatedCreds({
          nom: `${reg.prenom} ${reg.nom}`,
          identifiant: confirmedUname,
          motDePasse: tempPassword,
          phone: reg.whatsapp || reg.telephone,
          totalAmount: montant + insc,
          inscAmount: insc,
          tranche1: Math.round(montant / 2),
          tranche2: montant - Math.round(montant / 2),
        });
        toastMsg.credentials({ nom: `${reg.prenom} ${reg.nom}`, identifiant: confirmedUname, motDePasse: tempPassword });
        toastMsg.success(res?.is_existing ? "Apprenant associé au compte existant et confirmé ✓" : "Inscription confirmée et compte apprenant activé ✓");
        if (montant + insc > 0) {
          toastMsg.info(`Factures générées : ${money(montant + insc)} (2 tranches configurées)`);
        }
        log(`Pré-inscription confirmée (Supabase) : ${reg.nom} ${reg.prenom} — compte ${confirmedUname}`);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));

      } catch (err: any) {
        toastMsg.error("Erreur lors de la confirmation", (err as Error).message);
      }
    } else {
      const id = nextStudentId();
      const student: Student = { ...emptyStudent(), id, nom: reg.nom, prenom: reg.prenom, telephone: reg.telephone, whatsapp: reg.whatsapp, email: reg.email, niveau: reg.niveau, formation: reg.formation, modules: reg.modules, dateInscription: today() };
      const { users, student: withUser } = await makeAccount(db, student);
      update((d) => ({
        ...d, users,
        students: [{ ...withUser, statutPaiement: "impaye" as const }, ...d.students],
        registrations: d.registrations.map((r) => (r.id === regId ? { ...r, statut: "confirmee" as const } : r)),
        invoices: [
          ...(insc > 0 ? [{ id: uid("INV"), studentId: id, type: "inscription" as const, libelle: "Frais d'inscription", montant: insc, date: today() }] : []),
          ...(montant > 0 ? [{ id: uid("INV"), studentId: id, type: "formation" as const, libelle: `Formation — ${reg.modules.length} module(s) (${formationLabel(reg.formation)})`, montant, date: today() }] : []),
          ...d.invoices,
        ],
        notifications: [{ id: uid("NTF"), toId: withUser.userId!, title: "Inscription confirmée", body: `Bienvenue ${withUser.prenom} ! Identifiant : ${uname}. Un mot de passe temporaire vous a été communiqué. N° apprenant : ${id}.`, date: today(), lu: false, type: "inscription" }, ...d.notifications],
      }));
      setCreatedCreds({
        nom: `${reg.prenom} ${reg.nom}`,
        identifiant: uname,
        motDePasse: tempPassword,
        phone: reg.whatsapp || reg.telephone,
      });
      toastMsg.credentials({ nom: `${reg.prenom} ${reg.nom}`, identifiant: uname, motDePasse: tempPassword });
      toastMsg.info(`Factures générées : ${money(montant + insc)}`);
      log(`Pré-inscription confirmée : ${reg.nom} ${reg.prenom} (${id}) — compte ${uname} — à facturer ${money(montant + insc)}`);
    }
  };

  const rejectRegistration = async (regId: string) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from("registrations").update({ statut: "refusee" }).eq("id", regId);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.info("Pré-inscription refusée");
      } catch (err: any) {
        toastMsg.error("Erreur", err.message);
      }
    }
    update((d) => ({
      ...d,
      registrations: d.registrations.map((x) => (x.id === regId ? { ...x, statut: "refusee" as const } : x)),
    }));
  };

  const archiveRegistration = async (regId: string) => {
    const reg = db.registrations.find((r) => r.id === regId);
    if (!reg) return;
    const archivedItem = {
      ...reg,
      archiveReason: "Archivage manuel par l'administrateur",
      archivedAt: new Date().toLocaleString("fr-FR"),
    };
    if (isSupabaseConfigured) {
      try {
        await supabase.from("archived_registrations").insert({
          original_id: reg.id,
          nom: reg.nom,
          prenom: reg.prenom,
          email: reg.email,
          telephone: reg.telephone,
          formation: reg.formation,
          statut: reg.statut,
          archive_reason: "Archivage manuel par l'administrateur",
          created_at: (reg as any).createdAt || new Date().toISOString(),
          details: { whatsapp: reg.whatsapp, niveau: reg.niveau, modules: reg.modules }
        });
        await supabase.from("registrations").delete().eq("id", regId);
      } catch { /* silence */ }
    }
    update((d) => ({
      ...d,
      registrations: d.registrations.filter((r) => r.id !== regId),
      archivedRegistrations: [archivedItem, ...(d.archivedRegistrations || [])],
    }));
    toastMsg.success("Pré-inscription archivée ✓");
    log(`Pré-inscription archivée : ${reg.nom} ${reg.prenom}`);
  };

  const exportArchivesCSV = () => {
    const list = db.archivedRegistrations || [];
    if (list.length === 0) return;
    const headers = ["ID", "Nom", "Prénom", "Téléphone", "Email", "Formation", "Statut", "Motif Archivage", "Date Inscription", "Date Archivage"];
    const rows = list.map((a: any) => [
      a.id,
      `"${(a.nom || "").replace(/"/g, '""')}"`,
      `"${(a.prenom || "").replace(/"/g, '""')}"`,
      a.telephone || "",
      a.email || "",
      a.formation || "",
      a.statut || "",
      `"${(a.archiveReason || "").replace(/"/g, '""')}"`,
      a.date || "",
      a.archivedAt || ""
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `archives_preinscriptions_${today()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastMsg.success("Archives exportées en CSV ✓");
  };

  const confirmDeleteStudent = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const userId = deleteTarget.userId;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("students").delete().eq("id", id);
        if (userId) {
          await supabase.from("profiles").delete().eq("id", userId);
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Apprenant et compte supprimés avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({
      ...d,
      students: d.students.filter((s) => s.id !== id),
      users: userId ? d.users.filter((u) => u.id !== userId) : d.users,
    }));
    log(`Apprenant supprimé : ${deleteTarget.prenom} ${deleteTarget.nom} (${id})`);
    setDeleteTarget(null);
  };

  const statusBadge = (s: Student) => {
    const st = financialSummary(db, s.id).statut;
    return st === "paye" ? <Badge color="green">Payé</Badge>
      : st === "partiel" ? <Badge color="gold">Partiel</Badge>
      : st === "retard" ? <Badge color="red">Retard</Badge>
      : <Badge color="red">Impayé</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Gestion des apprenants"
        subtitle={`${db.students.length} apprenants inscrits • ${db.registrations.length} pré-inscription(s) en attente`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Sélecteur de Mode d'Affichage comme dans l'Emploi du temps */}
            <div className="flex items-center rounded-xl border border-white/10 bg-[#091124] p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  viewMode === "table"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Table2 size={14} /> Grand Tableau
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  viewMode === "cards"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <LayoutGrid size={14} /> Vue Cartes
              </button>
            </div>

            <Btn variant="outline" onClick={exportStudentsCSV}>
              <Download size={15} /> Exporter CSV
            </Btn>
            <Btn onClick={() => { setForm(emptyStudent()); setEditing(null); setCreating(true); }} className="shadow-[0_0_20px_-4px_rgba(0,229,255,0.7)]">
              <PlusCircle size={16} /> Inscrire un apprenant
            </Btn>
          </div>
        }
      />

      {/* Barre de Recherche et Filtres Pédagogiques & Financiers */}
      <div className="rounded-2xl border border-white/10 bg-[#0A1329]/80 p-4 backdrop-blur-md space-y-3.5 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
            <Input
              placeholder="Rechercher par nom, prénom, matricule, téléphone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10 text-xs font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">Filière :</span>
            {([["tous", `Toutes (${db.students.length})`], ["informatique", `Génie Info (${db.students.filter(s => s.formation === "informatique").length})`], ["industriel", `Génie Ind. (${db.students.filter(s => s.formation === "industriel").length})`]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-xl border px-3.5 py-2 text-xs font-bold transition",
                  tab === k
                    ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                    : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1">Paiement :</span>
            {(["", "paye", "partiel", "impaye", "retard"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFPay(st)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-bold transition",
                  fPay === st
                    ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-200"
                    : "border-white/10 text-slate-400 hover:text-slate-200"
                )}
              >
                {st === "" ? "Tous" : st === "paye" ? "Soldé" : st === "partiel" ? "Partiel" : st === "retard" ? "En retard" : "Impayé"}
              </button>
            ))}

            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px] ml-3 mr-1">Statut :</span>
            {(["", "actif", "inactif"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setFActif(a)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-bold transition",
                  fActif === a
                    ? "border-cyan-400/60 bg-cyan-400/20 text-cyan-200"
                    : "border-white/10 text-slate-400 hover:text-slate-200"
                )}
              >
                {a === "" ? "Tous" : a === "actif" ? "Actifs" : "Inactifs"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Affichés : <strong className="text-white font-mono">{filtered.length}</strong> / {db.students.length}
            </span>
            {(q || tab !== "tous" || fPay || fActif) && (
              <button
                type="button"
                onClick={() => { setQ(""); setTab("tous"); setFPay(""); setFActif(""); }}
                className="text-xs font-bold text-rose-400 hover:underline"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RÉSULTATS : GRAND TABLEAU OU CARTES */}
      {filtered.length === 0 ? (
        <Empty icon={<Users size={40} />} title="Aucun apprenant trouvé" sub="Essayez de modifier vos critères de recherche ou de filtres." />
      ) : viewMode === "table" ? (
        /* VUE 1 : GRAND TABLEAU SPACIEUX & ACTIONS COMPLÈTES */
        <Card className="overflow-hidden border-white/10 bg-[#081024]/90 backdrop-blur-md shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-4">N° Apprenant</th>
                  <th className="px-5 py-4">Apprenant (Identité)</th>
                  <th className="px-5 py-4">Filière & Modules</th>
                  <th className="px-5 py-4">Coordonnées</th>
                  <th className="px-5 py-4">Situation Financière</th>
                  <th className="px-5 py-4">Statut Compte</th>
                  <th className="px-5 py-4 text-right">Actions Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((s) => {
                  const fin = financialSummary(db, s.id);
                  const isInfo = s.formation === "informatique";
                  const phoneClean = (s.whatsapp || s.telephone || "").replace(/[^0-9]/g, "");

                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        "hover:bg-cyan-500/[0.04] transition-colors group",
                        s.actif === false && "opacity-60 bg-red-950/10"
                      )}
                    >
                      {/* Matricule */}
                      <td className="px-5 py-4.5 whitespace-nowrap">
                        <div className="inline-flex flex-col">
                          <span className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 font-mono text-xs font-bold text-cyan-300 shadow-sm">
                            {s.id}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1">
                            Inscrit le {s.dateInscription || "2026"}
                          </span>
                        </div>
                      </td>

                      {/* Apprenant (Identité) */}
                      <td className="px-5 py-4.5">
                        <div className="flex items-center gap-3.5">
                          {s.photo ? (
                            <img
                              src={s.photo}
                              alt=""
                              className="h-11 w-11 rounded-xl object-cover border border-cyan-400/40 shadow-md shrink-0"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 font-bold text-base border border-cyan-400/30 shadow-md shrink-0">
                              {s.prenom?.charAt(0) || "A"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-white group-hover:text-cyan-200 transition truncate">
                              {s.prenom} {s.nom}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {s.niveau || "Session continue"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Filière & Modules */}
                      <td className="px-5 py-4.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={cn(
                              "inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide",
                              isInfo
                                ? "border-red-500/40 bg-red-500/15 text-red-300"
                                : "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                            )}
                          >
                            {formationLabel(s.formation)}
                          </span>
                          <p className="text-xs text-slate-300 font-medium">
                            📚 <strong className="text-white">{s.modules.length}</strong> module(s) actif(s)
                          </p>
                        </div>
                      </td>

                      {/* Coordonnées */}
                      <td className="px-5 py-4.5 whitespace-nowrap text-xs text-slate-300">
                        <div className="space-y-1">
                          {s.telephone && (
                            <a
                              href={`tel:${s.telephone}`}
                              className="flex items-center gap-1.5 text-slate-300 hover:text-cyan-300 transition"
                            >
                              <Phone size={13} className="text-cyan-400" />
                              <span className="font-mono font-medium">{s.telephone}</span>
                            </a>
                          )}
                          {s.email && (
                            <a
                              href={`mailto:${s.email}`}
                              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-[11px] truncate max-w-[180px]"
                            >
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{s.email}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Situation Financière */}
                      <td className="px-5 py-4.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{statusBadge(s)}</div>
                          <p className="text-[11px] font-mono text-slate-400">
                            {fin.reste > 0 ? (
                              <span className="text-amber-400 font-bold">Reste: {money(fin.reste)}</span>
                            ) : (
                              <span className="text-emerald-400 font-bold">Soldé ✓</span>
                            )}
                          </p>
                        </div>
                      </td>

                      {/* Statut Compte */}
                      <td className="px-5 py-4.5 whitespace-nowrap">
                        <Badge color={s.actif !== false ? "green" : "red"}>
                          {s.actif !== false ? "Compte Actif" : "Suspendu"}
                        </Badge>
                      </td>

                      {/* Actions Complètes Disponibles */}
                      <td className="px-5 py-4.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Voir Dossier Complet */}
                          <button
                            type="button"
                            onClick={() => setViewing(s)}
                            className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:border-cyan-400 hover:bg-cyan-400/20 transition shadow-sm"
                            title="Ouvrir le dossier complet"
                          >
                            <Eye size={14} /> Dossier
                          </button>

                          {/* 2. Modifier */}
                          <button
                            type="button"
                            onClick={() => { setForm(s); setEditing(s); setCreating(true); }}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/50 hover:text-amber-300 hover:bg-amber-400/10 transition"
                            title="Modifier les informations"
                          >
                            <Pencil size={15} />
                          </button>

                          {/* 3. Paiement / Finances */}
                          <button
                            type="button"
                            onClick={() => navigate(`/app/finances`)}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-400/10 transition"
                            title="Consulter ou encaisser les paiements"
                          >
                            <CreditCard size={15} />
                          </button>

                          {/* 4. WhatsApp Direct */}
                          {phoneClean && (
                            <a
                              href={`https://wa.me/242${phoneClean}?text=${encodeURIComponent(
                                `Bonjour ${s.prenom},\nNous vous contactons depuis l'administration de SENTINELLES NUMÉRIQUES.`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-400/10 transition"
                              title="Contacter sur WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}

                          {/* 5. Imprimer Carte / Badge */}
                          <button
                            type="button"
                            onClick={() => setPrintingBadge(s)}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 hover:bg-cyan-400/10 transition"
                            title="Imprimer la carte d'apprenant"
                          >
                            <Printer size={15} />
                          </button>

                          {/* 6. Activer / Désactiver */}
                          <button
                            type="button"
                            onClick={() => toggleActiveStudent(s)}
                            className={cn(
                              "rounded-lg border p-2 transition",
                              s.actif !== false
                                ? "border-white/10 text-slate-400 hover:border-amber-400/50 hover:text-amber-300 hover:bg-amber-400/10"
                                : "border-emerald-400/50 text-emerald-300 bg-emerald-400/10"
                            )}
                            title={s.actif !== false ? "Suspendre l'apprenant" : "Réactiver l'apprenant"}
                          >
                            {s.actif !== false ? <EyeOff size={15} /> : <CheckCircle2 size={15} />}
                          </button>

                          {/* 7. Supprimer */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:border-red-500/60 hover:bg-red-500/20 transition"
                            title="Supprimer l'apprenant"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* VUE 2 : VUE FICHES CARTES (GRILLE MODERNE) */
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const fin = financialSummary(db, s.id);
            const isInfo = s.formation === "informatique";
            const phoneClean = (s.whatsapp || s.telephone || "").replace(/[^0-9]/g, "");

            return (
              <Card
                key={s.id}
                className={cn(
                  "p-5 border-white/10 bg-[#081024]/90 backdrop-blur-md shadow-xl hover:border-cyan-400/40 transition group",
                  s.actif === false && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5">
                  <span className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 font-mono text-xs font-bold text-cyan-300">
                    {s.id}
                  </span>
                  <Badge color={s.actif !== false ? "green" : "red"}>
                    {s.actif !== false ? "Actif" : "Suspendu"}
                  </Badge>
                </div>

                <div className="flex items-center gap-3.5 mb-4">
                  {s.photo ? (
                    <img
                      src={s.photo}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover border-2 border-cyan-400/40 shadow-lg shrink-0"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 font-bold text-xl border-2 border-cyan-400/30 shadow-lg shrink-0">
                      {s.prenom?.charAt(0) || "A"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-base font-extrabold text-white group-hover:text-cyan-200 transition truncate">
                      {s.prenom} {s.nom}
                    </h4>
                    <p className="text-xs text-slate-400">{s.niveau || "Session continue"}</p>
                    <span
                      className={cn(
                        "inline-block mt-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                        isInfo
                          ? "border-red-500/40 bg-red-500/15 text-red-300"
                          : "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                      )}
                    >
                      {formationLabel(s.formation)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/5 pt-3 text-xs text-slate-300 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Modules :</span>
                    <strong className="text-white">{s.modules.length} inscrit(s)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Paiement :</span>
                    <div>{statusBadge(s)}</div>
                  </div>
                  {fin.reste > 0 && (
                    <div className="flex items-center justify-between text-amber-300 font-mono">
                      <span>Reste à payer :</span>
                      <strong>{money(fin.reste)}</strong>
                    </div>
                  )}
                  {s.telephone && (
                    <div className="flex items-center justify-between pt-1 text-slate-400">
                      <span>Téléphone :</span>
                      <a href={`tel:${s.telephone}`} className="text-cyan-300 font-mono font-medium hover:underline">
                        {s.telephone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions de la Carte */}
                <div className="flex items-center justify-between gap-1.5 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setViewing(s)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-cyan-400/40 bg-cyan-400/15 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 transition shadow-sm"
                  >
                    <Eye size={14} /> Dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingBadge(s)}
                    className="rounded-xl border border-white/10 p-2 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 transition"
                    title="Imprimer carte"
                  >
                    <Printer size={15} />
                  </button>
                  {phoneClean && (
                    <a
                      href={`https://wa.me/242${phoneClean}?text=${encodeURIComponent(
                        `Bonjour ${s.prenom},\nNous vous contactons depuis l'administration de SENTINELLES NUMÉRIQUES.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 p-2 text-slate-300 hover:border-emerald-400/50 hover:text-emerald-400 transition"
                      title="WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => { setForm(s); setEditing(s); setCreating(true); }}
                    className="rounded-xl border border-white/10 p-2 text-slate-300 hover:border-amber-400/50 hover:text-amber-300 transition"
                    title="Modifier"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    className="rounded-xl border border-red-500/20 p-2 text-red-400 hover:bg-red-500/20 transition"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Section Pré-inscriptions en ligne & Archives sécurisées */}
      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-white">Pré-inscriptions en ligne</h3>
          <p className="text-xs text-slate-400">
            Cycle de vie automatique (7j non traitée, 2j traitée) • {db.registrations.length} active(s) • {(db.archivedRegistrations || []).length} archivée(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant="outline"
            className="px-3 py-1.5 text-xs"
            onClick={() => setShowArchives(!showArchives)}
          >
            <Archive size={14} />
            {showArchives ? "Voir les actives" : `Archives (${(db.archivedRegistrations || []).length})`}
          </Btn>
          {showArchives && (db.archivedRegistrations || []).length > 0 && (
            <Btn
              variant="outline"
              className="px-3 py-1.5 text-xs"
              onClick={exportArchivesCSV}
            >
              <FileSpreadsheet size={14} /> Exporter CSV
            </Btn>
          )}
        </div>
      </div>

      {!showArchives ? (
        db.registrations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune pré-inscription active.</p>
        ) : (
          <div className="space-y-3">
            {db.registrations.map((r) => (
              <Card key={r.id} className="p-4" glow={r.statut === "en_attente" ? "gold" : "none"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{r.nom} {r.prenom}</p>
                    <p className="text-xs text-slate-400">{formationLabel(r.formation)} • {r.modules.length} module(s) • {r.niveau}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Phone size={11} /> {r.telephone}</span>
                      <span className="flex items-center gap-1"><Mail size={11} /> {r.email}</span>
                      <span className="flex items-center gap-1"><CalendarDays size={11} /> {r.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={r.statut === "en_attente" ? "gold" : r.statut === "confirmee" ? "green" : "red"}>{r.statut.replace("_", " ")}</Badge>
                    {r.statut === "en_attente" && (
                      <>
                        <Btn variant="green" className="px-3 py-1.5 text-xs" onClick={() => confirmRegistration(r.id)}><CheckCircle2 size={15} /> Confirmer</Btn>
                        <Btn variant="ghost" className="px-2 py-1.5 text-xs text-rose-400 hover:text-rose-300" onClick={() => rejectRegistration(r.id)} title="Refuser"><XCircle size={15} /></Btn>
                      </>
                    )}
                    <Btn
                      variant="ghost"
                      className="px-2 py-1.5 text-xs text-slate-400 hover:text-amber-300"
                      onClick={() => archiveRegistration(r.id)}
                      title="Archiver sans supprimer"
                    >
                      <Archive size={14} />
                    </Btn>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* Tiroir / Vue des Archives de préinscriptions */
        <div className="space-y-3">
          {(db.archivedRegistrations || []).length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-500">Aucune pré-inscription archivée pour le moment.</p>
            </Card>
          ) : (
            (db.archivedRegistrations || []).map((a: any) => (
              <Card key={a.id} className="p-4 border-white/5 bg-white/[0.01]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-200">{a.nom} {a.prenom}</p>
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                        {a.archiveReason || "Archivée"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{formationLabel(a.formation)} • {a.modules?.length || 0} module(s)</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Phone size={11} /> {a.telephone}</span>
                      <span className="flex items-center gap-1"><Mail size={11} /> {a.email || "—"}</span>
                      <span className="flex items-center gap-1"><CalendarDays size={11} /> Inscrit le : {a.date}</span>
                      {a.archivedAt && <span className="flex items-center gap-1"><Archive size={11} /> Archivé le : {a.archivedAt}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={a.statut === "confirmee" ? "green" : a.statut === "refusee" ? "red" : "gold"}>
                      {a.statut ? a.statut.replace("_", " ") : "archivé"}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* add/edit modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Modifier ${editing.id}` : "Nouvel apprenant"} wide>
        <StudentForm form={form} setForm={setForm} />
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
          <Btn onClick={save}>{editing ? "Enregistrer" : "Créer l'apprenant"}</Btn>
        </div>
      </Modal>

      {/* view modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.prenom} ${viewing.nom}` : ""} wide>
        {viewing && <StudentView s={viewing} />}
      </Modal>

      {/* credentials & whatsapp modal */}
      {createdCreds && (
        <Modal open={Boolean(createdCreds)} onClose={() => setCreatedCreds(null)} title="Compte Apprenant Activé" wide={false}>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">{createdCreds.nom}</h3>
              <p className="text-xs text-slate-400 mt-1">L'inscription a été confirmée et le compte utilisateur est activé.</p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left space-y-2 font-mono text-sm">
              <div>
                <span className="text-xs text-slate-400 font-sans block">Identifiant :</span>
                <span className="font-bold text-cyan-300">{createdCreds.identifiant}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-sans block">Mot de passe temporaire :</span>
                <span className="font-bold text-amber-300">{createdCreds.motDePasse}</span>
              </div>
            </div>

            {/* Récapitulatif des tranches de paiement */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-2">Échéancier de règlement prévu :</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>1. Inscription (Immédiate) :</span>
                  <strong className="text-white">{money(createdCreds.inscAmount || 5000)}</strong>
                </div>
                {(createdCreds.tranche1 ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>2. Tranche 1 (Dans 1 mois - 50%) :</span>
                    <strong className="text-cyan-300">{money(createdCreds.tranche1 || 0)}</strong>
                  </div>
                )}
                {(createdCreds.tranche2 ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>3. Tranche 2 (Fin de session) :</span>
                    <strong className="text-emerald-300">{money(createdCreds.tranche2 || 0)}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {createdCreds.phone && (
                <a
                  href={`https://wa.me/242${createdCreds.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Bonjour ${createdCreds.nom},\n\n` +
                    `Votre inscription au centre de formation SENTINELLES NUMÉRIQUES (ENIA 2.0) est confirmée avec succès !\n\n` +
                    `Voici vos identifiants d'accès à l'Espace Apprenant :\n` +
                    `🌐 Lien de connexion : https://code6senti.vercel.app/#/connexion\n` +
                    `👤 Identifiant : ${createdCreds.identifiant}\n` +
                    `🔑 Mot de passe temporaire : ${createdCreds.motDePasse}\n\n` +
                    `💳 Modalités et cycle de règlement de votre formation (${money(createdCreds.totalAmount || (createdCreds.inscAmount || 5000) + (createdCreds.tranche1 || 0) + (createdCreds.tranche2 || 0))}) :\n` +
                    `1. Frais d'inscription (${money(createdCreds.inscAmount || 5000)}) : À régler auprès de la direction avant le début des cours (ouvre vos accès et badge).\n` +
                    ((createdCreds.tranche1 ?? 0) > 0 ? `2. Première tranche (${money(createdCreds.tranche1 || 0)}) : Exigible 1 mois après le démarrage de la formation (50% des cours).\n` : "") +
                    ((createdCreds.tranche2 ?? 0) > 0 ? `3. Deuxième tranche (${money(createdCreds.tranche2 || 0)}) : Solde restant exigible avant la fin de la formation.\n\n` : "\n") +
                    `📍 Rapprochez-vous de la direction (Institut des Jeunes Sourds / ENIA 2.0, Brazzaville) pour régulariser votre inscription.\n\n` +
                    `À très bientôt en cours !`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <Btn variant="green" className="w-full justify-center">
                    <MessageCircle size={16} /> Envoyer accès & échéancier par WhatsApp
                  </Btn>
                </a>
              )}
              <div className="flex gap-2">
                <Btn
                  variant="outline"
                  className="flex-1 justify-center"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Identifiant : ${createdCreds.identifiant}\nMot de passe : ${createdCreds.motDePasse}\nLien : https://code6senti.vercel.app/#/connexion\nInscription : ${money(createdCreds.inscAmount || 5000)}\nTranche 1 (1 mois) : ${money(createdCreds.tranche1 || 0)}\nTranche 2 (Fin) : ${money(createdCreds.tranche2 || 0)}`
                    );
                    toastMsg.success("Accès et échéancier copiés dans le presse-papier !");
                  }}
                >
                  Copier les accès
                </Btn>
                <Btn variant="ghost" onClick={() => setCreatedCreds(null)}>
                  Fermer
                </Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmation suppression apprenant */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement l'apprenant{" "}
            <span className="font-bold text-white">{deleteTarget?.prenom} {deleteTarget?.nom}</span> ({deleteTarget?.id}) ainsi que son compte d'accès ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Cette action est irréversible. Les inscriptions associées seront supprimées.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteStudent}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modale d'Impression Officielle de Carte / Badge Apprenant */}
      {printingBadge && (
        <Modal open={Boolean(printingBadge)} onClose={() => setPrintingBadge(null)} title="Carte Officielle d'Apprenant" wide={false}>
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-400/40 bg-gradient-to-br from-[#060D1F] via-[#0A1633] to-[#040814] p-5 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-white/15 pb-3.5 mb-3.5">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="Logo" className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.7)]" />
                  <div>
                    <h4 className="font-display text-xs font-black tracking-wider text-white">
                      SENTINELLE <span className="text-red-400">NUMÉRIQUE</span>
                    </h4>
                    <p className="text-[8px] uppercase tracking-widest text-cyan-300">CARTE D'APPRENANT OFFICIELLE</p>
                  </div>
                </div>
                <Badge color={printingBadge.formation === "informatique" ? "red" : "cyan"}>
                  {formationLabel(printingBadge.formation)}
                </Badge>
              </div>

              <div className="flex items-center gap-4">
                {printingBadge.photo ? (
                  <img src={printingBadge.photo} alt="" className="h-20 w-20 rounded-xl border-2 border-cyan-400/50 object-cover shadow-lg shrink-0" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/30 text-cyan-300 font-bold text-2xl shrink-0">
                    {printingBadge.prenom?.charAt(0) || "A"}
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <h3 className="font-display text-base font-black text-white leading-tight truncate">
                    {printingBadge.prenom} {printingBadge.nom}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-400/20 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300 border border-cyan-400/40">
                      {printingBadge.id}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      {printingBadge.niveau || "Session 2026"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    📞 {printingBadge.telephone || "Non renseigné"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Centre Agréé</p>
                  <p className="text-xs font-bold text-white">ENIA 2.0 · Brazzaville</p>
                </div>
                <div className="rounded-lg bg-white p-1.5 shadow">
                  <QRCodeSVG value={`https://code6senti.vercel.app/#/certificats?id=${printingBadge.id}`} size={54} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setPrintingBadge(null)}>Fermer</Btn>
              <Btn onClick={() => window.print()} className="shadow-[0_0_20px_-4px_rgba(0,229,255,0.7)]">
                <Printer size={16} /> Imprimer la carte
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StudentForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const { db } = useStore();
  const avail = db.modules.filter((m) => m.formation === form.formation);
  const toggle = (id: string) =>
    setForm({ ...form, modules: form.modules.includes(id) ? form.modules.filter((x: string) => x !== id) : [...form.modules, id] });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          setForm({ ...form, photo: pub.publicUrl });
          toastMsg.success("Photo téléversée sur le serveur ✓");
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    setForm({ ...form, photo: await readImage(f, 300) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {form.photo ? (
          <img src={form.photo} alt="photo" className="h-20 w-20 rounded-2xl border border-cyan-400/40 object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><UserCircle2 size={36} className="text-slate-500" /></div>
        )}
        <label className="cursor-pointer">
          <span className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">📷 Photo de profil</span>
          <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
        <Field label="Prénom"><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
        <Field label="Date de naissance"><Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} /></Field>
        <Field label="Sexe">
          <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
            <option value="M">Masculin</option><option value="F">Féminin</option>
          </Select>
        </Field>
        <Field label="Téléphone"><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Adresse"><Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
        <Field label="Niveau d'étude"><Input value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} /></Field>
        <Field label="Statut paiement">
          <Select value={form.statutPaiement} onChange={(e) => setForm({ ...form, statutPaiement: e.target.value })}>
            <option value="paye">Payé</option><option value="partiel">Partiel</option><option value="impaye">Impayé</option>
          </Select>
        </Field>
      </div>
      <Field label="Formation">
        <div className="grid grid-cols-2 gap-3">
          {(["informatique", "industriel"] as Formation[]).map((f) => (
            <button type="button" key={f} onClick={() => setForm({ ...form, formation: f, modules: [] })}
              className={cn("rounded-xl border p-3 text-sm font-bold transition-all",
                form.formation === f ? (f === "informatique" ? "border-red-500/60 bg-red-500/10 text-red-400" : "border-cyan-400/60 bg-cyan-400/10 text-cyan-300") : "border-white/10 text-slate-400")}>
              {formationLabel(f)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Modules (${form.modules.length})`}>
        <div className="grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {avail.map((m) => (
            <button type="button" key={m.id} onClick={() => toggle(m.id)}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                form.modules.includes(m.id) ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
              {moduleIcon(m.icon, "h-3.5 w-3.5")} {m.numero}. {m.titre}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StudentView({ s }: { s: Student }) {
  const { db } = useStore();
  const mods = db.modules.filter((m) => s.modules.includes(m.id));
  const teachersAssoc = db.teachers.filter((t) => t.modules.some((mid) => s.modules.includes(mid)));
  const schedule = db.schedule.filter((sc) =>
    sc.formation === s.formation && s.modules.includes(sc.moduleId) &&
    (!sc.studentIds?.length || sc.studentIds.includes(s.id)) &&
    (!sc.groupe || sc.groupe === s.groupe)
  );
  const courses = db.courses.filter((c) => s.modules.includes(c.moduleId) && c.publie !== false &&
    (!c.studentIds?.length || c.studentIds.includes(s.id)) &&
    (!c.groupe || c.groupe === s.groupe));
  const att = db.attendance.filter((a) => a.studentId === s.id);
  const grades = db.grades.filter((g) => g.studentId === s.id);
  const results = db.results.filter((r) => r.studentId === s.id);
  const cert = db.certificates.find((c) => c.studentId === s.id);
  const bourse = db.scholarships.find((b) => b.studentId === s.id);
  const summary = financialSummary(db, s.id);
  const payments = [...summary.payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? "")));

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
      {/* carte numérique */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0A1224] to-[#07152B] p-5">
        <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Logo Sentinelle" className="h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(0,229,255,0.6)]" />
              <div>
                <span className="font-display text-xs font-black tracking-wider text-white">SENTINELLE <span className="text-red-400">NUMÉRIQUE</span></span>
                <p className="text-[8px] uppercase tracking-widest text-cyan-300">ENIA 2.0 · CONGO</p>
              </div>
            </div>
            <Badge color={s.statut === "actif" ? "green" : "gray"}>{s.statut}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {s.photo ? <img src={s.photo} alt="" className="h-16 w-16 rounded-xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30"><UserCircle2 size={32} className="text-cyan-300" /></div>}
            <div>
              <p className="font-display text-base font-black text-white">{s.prenom} {s.nom}</p>
              <p className="text-[11px] text-slate-400">{formationLabel(s.formation)}</p>
              <p className="font-mono text-[11px] font-bold text-cyan-300">{s.id}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="rounded-lg bg-white p-1.5 shadow">
              <QRCodeSVG value={`SN|${s.id}|${s.nom}|${s.prenom}|${s.formation}`} size={84} />
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <p className="flex items-center gap-1.5"><Phone size={11} className="text-emerald-300" /> {s.telephone}</p>
              <p className="flex items-center gap-1.5"><Mail size={11} className="text-cyan-300" /> {s.email}</p>
              <p className="flex items-center gap-1.5"><MapPin size={11} className="text-blue-400" /> {s.adresse || "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[8px] uppercase tracking-[0.25em] font-semibold text-cyan-300/70">
            APPRENDRE • INNOVER • CRÉER • CODER • SÉCURISER
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-white">{mods.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Modules</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-emerald-300">{att.filter((a) => a.statut === "present").length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Présences</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-amber-300">{grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(1) : "—"}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Moyenne /20</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-cyan-300">{results.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Tests passés</p>
          </div>
        </div>

        {/* Finance */}
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Finance</p>
            <Badge color={summary.statut === "paye" ? "green" : summary.statut === "partiel" ? "gold" : "red"}>{statusLabel(summary.statut)}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[9px] uppercase text-slate-500">À payer</p><p className="font-mono text-sm font-bold text-white">{money(summary.totalDu)}</p></div>
            <div><p className="text-[9px] uppercase text-slate-500">Payé</p><p className="font-mono text-sm font-bold text-emerald-300">{money(summary.totalPaye)}</p></div>
            <div><p className="text-[9px] uppercase text-slate-500">Solde</p><p className="font-mono text-sm font-bold text-amber-300">{money(summary.solde)}</p></div>
          </div>
          {payments.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-cyan-300">Historique ({payments.length})</summary>
              <div className="mt-1.5 space-y-1">
                {payments.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                    <span>{p.date}{p.heure ? ` • ${p.heure}` : ""} · {p.mode} · <span className="font-mono text-cyan-300">{p.reference ?? "—"}</span></span>
                    <span className="font-bold text-slate-200">{money(p.montant)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Modules inscrits</p>
          <div className="flex flex-wrap gap-1.5">
            {mods.length === 0 ? <p className="text-xs text-slate-500">Aucun module.</p> :
              mods.map((m) => <span key={m.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{m.numero}. {m.titre}</span>)}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Enseignants associés ({teachersAssoc.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {teachersAssoc.length === 0 ? <p className="text-xs text-slate-500">Aucun.</p> :
              teachersAssoc.map((t) => <span key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">{t.prenom} {t.nom}</span>)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Emploi du temps ({schedule.length})</p>
            {schedule.length === 0 ? <p className="text-xs text-slate-500">Aucun créneau.</p> : (
              <div className="space-y-1">
                {schedule.slice(0, 5).map((sc) => (
                  <div key={sc.id} className="rounded border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300">
                    <b className="text-white">{sc.jour}</b> {sc.heureDebut}–{sc.heureFin} · {db.modules.find((m) => m.id === sc.moduleId)?.titre}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Cours disponibles ({courses.length})</p>
            {courses.length === 0 ? <p className="text-xs text-slate-500">Aucun cours publié.</p> : (
              <div className="space-y-1">
                {courses.slice(0, 5).map((c) => (
                  <div key={c.id} className="truncate rounded border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300">
                    <b className="text-white">{c.titre}</b> {(c.files?.length ?? 0) > 0 && <span className="text-cyan-400">📎 {c.files!.length}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {cert && <Badge color="gold">Certificat : {cert.numero}</Badge>}
          {bourse && <Badge color="green">Bourse : {bourse.statut.replace("_", " ")}</Badge>}
        </div>
      </div>
    </div>
  );
}

/* ================= TEACHERS ================= */
export function TeachersPage() {
  const { db, user, update, log } = useStore();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Ouverture automatique depuis la recherche globale
  useEffect(() => {
    const teacherId = searchParams.get("id");
    if (teacherId) {
      const found = db.teachers.find((t) => t.id === teacherId);
      if (found) {
        setViewing(found);
      }
    }
  }, [searchParams, db.teachers]);

  const [q, setQ] = useState("");
  const [fFormation, setFFormation] = useState("");
  const [fModule, setFModule] = useState("");
  const [fContrat, setFContrat] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [createAccount, setCreateAccount] = useState(true);
  const [accountEmail, setAccountEmail] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [savingTeacher, setSavingTeacher] = useState(false);
  const emptyTeacher = () => ({
    nom: "", prenom: "", specialite: "", email: "", phone: "", modules: [], photo: "", infosPro: "", diplomes: "",
    actif: true, typeContrat: "Prestation", tarifHoraire: 0, heuresPrevues: 0, tarifsParModule: {} as Record<string, number>,
  });
  const [form, setForm] = useState<any>(emptyTeacher());

  const confirmDeleteTeacher = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const userId = deleteTarget.userId;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("teachers").delete().eq("id", id);
        if (userId) {
          await supabase.from("profiles").delete().eq("id", userId);
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Enseignant et compte supprimés avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({
      ...d,
      teachers: d.teachers.filter((t) => t.id !== id),
      users: userId ? d.users.filter((u) => u.id !== userId) : d.users,
    }));
    log(`Enseignant supprimé : ${deleteTarget.prenom} ${deleteTarget.nom} (${id})`);
    setDeleteTarget(null);
  };
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          setForm((p: any) => ({ ...p, photo: pub.publicUrl }));
          toastMsg.success("Photo téléversée sur le serveur ✓");
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    const img = await readImage(f, 400);
    setForm((p: any) => ({ ...p, photo: img }));
  };

  const canEditRate = user?.role === "superadmin" || user?.role === "admin";

  const filtered = db.teachers.filter((t) => {
    const hay = `${t.nom} ${t.prenom} ${t.id} ${t.specialite} ${t.email ?? ""}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (fFormation && !(t.formations ?? []).includes(fFormation as any)) return false;
    if (fModule && !t.modules.includes(fModule)) return false;
    if (fContrat && (t.typeContrat ?? "") !== fContrat) return false;
    if (fStatut === "actif" && t.actif === false) return false;
    if (fStatut === "inactif" && t.actif !== false) return false;
    return true;
  });

  const save = async () => {
    if (!form.nom || !form.prenom) {
      toastMsg.error("Nom et prénom requis", "Veuillez renseigner le nom et le prénom du formateur.");
      return;
    }
    setSavingTeacher(true);

    if (editing) {
      if (isSupabaseConfigured) {
        try {
          await supabase.from("teachers").update({
            nom: form.nom,
            prenom: form.prenom,
            specialite: form.specialite || "Formateur",
            email: form.email || "",
            phone: form.phone || "",
            type_contrat: form.typeContrat || "Prestation",
            tarif_horaire: form.tarifHoraire || 0,
            photo_url: form.photo || null,
          }).eq("id", editing.id);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          toastMsg.success("Enseignant mis à jour côté serveur ✓");
        } catch (err: any) {
          toastMsg.error("Erreur mise à jour enseignant", err.message);
        }
      }
      update((d) => ({ ...d, teachers: d.teachers.map((t) => (t.id === editing.id ? { ...t, ...form } : t)) }));
      if (editing.tarifHoraire !== form.tarifHoraire || JSON.stringify(editing.tarifsParModule ?? {}) !== JSON.stringify(form.tarifsParModule ?? {})) {
        log(`Tarif horaire modifié pour ${form.nom} ${form.prenom} : ${money(form.tarifHoraire ?? 0)}/h`);
      } else {
        log(`Enseignant modifié : ${form.nom} ${form.prenom}`);
      }
    } else {
      if (createAccount) {
        const baseUname = slugify(`${form.prenom}.${form.nom}`) || `teacher${Math.floor(Math.random() * 10000)}`;
        let uname = baseUname;
        let i = 1;
        while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
        const tempPassword = customPassword.trim() || generateTempPassword();

        if (isSupabaseConfigured) {
          try {
            const email = accountEmail.trim() || form.email || `${uname}@sentinelles.local`;
            await invokeCreateUser({
              email,
              password: tempPassword,
              username: uname,
              name: `${form.prenom} ${form.nom}`,
              role: "teacher",
              teacher: {
                nom: form.nom, prenom: form.prenom, specialite: form.specialite || "Formateur",
                email, phone: form.phone, type_contrat: form.typeContrat, tarif_horaire: form.tarifHoraire,
                photo_url: form.photo || null,
              },
              module_ids: form.modules
            });
            
            toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
            toastMsg.success("Formateur et compte utilisateur créés ✓");
            log(`Enseignant avec compte ajouté : ${form.nom} ${form.prenom} — compte ${uname}`);
            window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          } catch (err: any) {
            toastMsg.error("Erreur lors de la création", (err as Error).message);
            setSavingTeacher(false);
            return;
          }
        } else {
          const id = `ENS-${String(db.teachers.length + 1).padStart(3, "0")}`;
          const teacher = { ...form, id };
          const { users, student } = await makeAccount(db, { ...emptyStudent(), id, nom: form.nom, prenom: form.prenom, email: form.email, phone: form.phone, modules: form.modules } as Student, "teacher");
          update((d) => ({
            ...d, users,
            teachers: [...d.teachers, { ...teacher, userId: student.userId }],
          }));
          log(`Enseignant ajouté : ${form.nom} ${form.prenom} — compte ${uname}`);
          toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
        }
      } else {
        // Enseignant créé sans compte utilisateur
        const id = `ENS-${String(db.teachers.length + 1).padStart(3, "0")}`;
        const teacher = { ...form, id, userId: undefined };

        if (isSupabaseConfigured) {
          try {
            const { data: insertedTeacher, error: tErr } = await supabase.from("teachers").insert({
              id,
              nom: form.nom,
              prenom: form.prenom,
              specialite: form.specialite || "Formateur",
              email: form.email || null,
              phone: form.phone || null,
              type_contrat: form.typeContrat || "Prestation",
              tarif_horaire: form.tarifHoraire || 0,
              photo_url: form.photo || null,
              user_id: null,
            }).select("id").single();

            if (tErr) throw tErr;

            if (form.modules && form.modules.length > 0) {
              const modRows = form.modules.map((mid: string) => ({
                teacher_id: insertedTeacher?.id || id,
                module_id: mid,
              }));
              await supabase.from("teacher_modules").insert(modRows);
            }

            try {
              await supabase.from("audit_logs").insert({
                user_id: user?.id || null,
                action: "CREATE_TEACHER_PROFILE",
                entity_type: "teachers",
                entity_id: id,
                description: `Création fiche enseignant (sans compte) : ${form.prenom} ${form.nom}`,
              });
            } catch { /* ignore audit */ }

            window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
            toastMsg.success("Fiche formateur créée avec succès (sans compte) ✓");
            log(`Enseignant sans compte créé : ${form.nom} ${form.prenom} (${id})`);
          } catch (err: any) {
            toastMsg.error("Erreur création enseignant", err.message);
            setSavingTeacher(false);
            return;
          }
        } else {
          toastMsg.success("Fiche formateur créée en local (sans compte) ✓");
        }

        update((d) => ({
          ...d,
          teachers: [...d.teachers, teacher],
        }));
      }
    }

    setSavingTeacher(false);
    setCreating(false);
    setEditing(null);
  };

  const exportTeachersCSV = () => {
    const headers = ["ID", "Nom", "Prénom", "Spécialité", "Email", "Téléphone", "Type Contrat", "Tarif Horaire", "Statut", "Compte Utilisateur"];
    const rows = filtered.map((t) => [
      t.id,
      t.nom,
      t.prenom,
      t.specialite || "",
      t.email || "",
      t.phone || "",
      t.typeContrat || "",
      t.tarifHoraire || 0,
      t.actif !== false ? "Actif" : "Inactif",
      t.userId ? "Oui" : "Non",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enseignants_sentinelles_${today()}.csv`;
    a.click();
    toastMsg.success("Export enseignants CSV téléchargé ✓");
  };

  const toggleActiveTeacher = async (t: any) => {
    const newStatus = t.actif === false ? true : false;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("teachers").update({ actif: newStatus }).eq("id", t.id);
        toastMsg.success(newStatus ? "Formateur réactivé ✓" : "Formateur désactivé ✓");
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur statut formateur", err.message);
        return;
      }
    }
    update((d) => ({
      ...d,
      teachers: d.teachers.map((x) => (x.id === t.id ? { ...x, actif: newStatus } : x)),
    }));
  };

  const contractTypes = Array.from(new Set(db.teachers.map((t) => t.typeContrat).filter(Boolean) as string[]));

  return (
    <div>
      <PageHead
        title="Enseignants"
        subtitle={`${db.teachers.length} formateurs`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={exportTeachersCSV}><Download size={15} /> Exporter CSV</Btn>
            <Btn onClick={() => { setForm(emptyTeacher()); setEditing(null); setCreateAccount(true); setAccountEmail(""); setCustomPassword(""); setCreating(true); }}><PlusCircle size={16} /> Ajouter un formateur</Btn>
          </div>
        }
      />

      {/* Recherche + filtres */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : nom, prénom, identifiant, spécialité..." className="pl-9" />
          </div>
          <Field label="Formation">
            <Select value={fFormation} onChange={(e) => setFFormation(e.target.value)}>
              <option value="">Toutes</option>
              <option value="informatique">Génie Informatique</option>
              <option value="industriel">Génie Industriel</option>
            </Select>
          </Field>
          <Field label="Module enseigné">
            <Select value={fModule} onChange={(e) => setFModule(e.target.value)}>
              <option value="">Tous</option>
              {db.modules.map((m) => <option key={m.id} value={m.id}>{m.numero}. {m.titre}</option>)}
            </Select>
          </Field>
          <Field label="Type de contrat">
            <Select value={fContrat} onChange={(e) => setFContrat(e.target.value)}>
              <option value="">Tous</option>
              {contractTypes.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Statut :</span>
          {(["", "actif", "inactif"] as const).map((s) => (
            <button key={s} onClick={() => setFStatut(s)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-bold", fStatut === s ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400")}>
              {s === "" ? "Tous" : s === "actif" ? "Actifs" : "Inactifs"}
            </button>
          ))}
          {(q || fFormation || fModule || fContrat || fStatut) && (
            <button onClick={() => { setQ(""); setFFormation(""); setFModule(""); setFContrat(""); setFStatut(""); }} className="ml-auto text-xs font-bold text-red-400 hover:underline">Réinitialiser</button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty icon={<GraduationCap size={40} />} title="Aucun enseignant trouvé" sub="Modifiez vos critères de recherche ou ajoutez un nouveau formateur." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const mods = db.modules.filter((m) => t.modules.includes(m.id));
            const fin = teacherFinanceSummary(db, t.id);
            return (
              <Card key={t.id} className={cn("p-5", t.actif === false && "opacity-60")} glow="cyan">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {t.photo ? (
                      <img src={t.photo} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30">
                        <GraduationCap size={22} className="text-cyan-300" />
                      </div>
                    )}
                    <div>
                      <p className="font-display text-sm font-bold text-white">{t.prenom} {t.nom}</p>
                      <p className="text-[11px] text-slate-400">{t.specialite}</p>
                      <p className="font-mono text-[10px] text-cyan-400/70">{t.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setViewing(t)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Détails"><Eye size={14} /></button>
                    <button onClick={() => toggleActiveTeacher(t)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300" title={t.actif !== false ? "Désactiver le formateur" : "Réactiver le formateur"}>
                      {t.actif !== false ? <EyeOff size={14} /> : <CheckCircle2 size={14} className="text-emerald-400" />}
                    </button>
                    <button onClick={() => { setForm(t); setEditing(t); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300" title="Modifier"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget(t)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.userId ? <Badge color="green">Compte actif</Badge> : <Badge color="gray">Fiche seule</Badge>}
                  {t.actif === false && <Badge color="red">Inactif</Badge>}
                  {t.typeContrat && <Badge color="gold">{t.typeContrat}</Badge>}
                  {mods.slice(0, 3).map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">{m.numero}. {m.titre}</span>)}
                  {mods.length > 3 && <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">+{mods.length - 3}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><Phone size={11} className="text-emerald-300" /> {t.phone || "—"}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-cyan-300"><Timer size={11} /> {fin.heuresValidees} h · {money(fin.solde)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal détails enseignant */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.prenom} ${viewing.nom}` : ""} wide>
        {viewing && <TeacherDetail t={viewing} />}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Modifier ${editing.id}` : "Nouvel enseignant"} wide>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {form.photo ? <img src={form.photo} alt="" className="h-20 w-20 rounded-2xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><GraduationCap size={30} className="text-slate-500" /></div>}
            <label className="cursor-pointer">
              <span className="rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">📷 Photo du formateur</span>
              <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
            </label>
            {form.photo && <Btn variant="ghost" onClick={() => setForm({ ...form, photo: "" })}>Supprimer</Btn>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
            <Field label="Prénom"><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
            <Field label="Spécialité"><Input value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} placeholder="ex: Réseaux & Cybersécurité" /></Field>
            <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Diplômes"><Input value={form.diplomes} onChange={(e) => setForm({ ...form, diplomes: e.target.value })} placeholder="ex: Master Cybersécurité — CEH" /></Field>
          <Field label="Informations professionnelles"><Textarea value={form.infosPro} onChange={(e) => setForm({ ...form, infosPro: e.target.value })} placeholder="Parcours, expérience, expertise..." /></Field>

          {/* Contrat */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Contrat & rémunération</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type de contrat">
                <Select value={form.typeContrat} onChange={(e) => setForm({ ...form, typeContrat: e.target.value })}>
                  <option>CDI</option><option>CDD</option><option>Prestation</option><option>Vacataire</option><option>Stage encadré</option><option>Autre</option>
                </Select>
              </Field>
              <Field label="Tarif horaire (FCFA)">
                <Input type="number" min={0} value={form.tarifHoraire} onChange={(e) => setForm({ ...form, tarifHoraire: +e.target.value })} disabled={!canEditRate} />
              </Field>
              <Field label="Heures prévues (contrat)">
                <Input type="number" min={0} value={form.heuresPrevues} onChange={(e) => setForm({ ...form, heuresPrevues: +e.target.value })} />
              </Field>
            </div>
            {!canEditRate && <p className="mt-2 text-[11px] text-amber-300">Seul l'Admin Sup / responsable financier peut modifier le tarif horaire.</p>}
          </div>

          <Field label="Modules enseignés">
            <div className="grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {db.modules.map((m) => (
                <button type="button" key={m.id} onClick={() => setForm({ ...form, modules: form.modules.includes(m.id) ? form.modules.filter((x: string) => x !== m.id) : [...form.modules, m.id] })}
                  className={cn("rounded-lg border px-3 py-2 text-left text-xs transition-all",
                    form.modules.includes(m.id) ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                  {formationLabel(m.formation)} — {m.numero}. {m.titre}
                </button>
              ))}
            </div>
          </Field>
          {canEditRate && form.modules.length > 0 && (
            <Field label="Tarifs spécifiques par module (optionnel, FCFA/h)" hint="Laissez 0 pour utiliser le tarif horaire global">
              <div className="space-y-1.5 rounded-xl border border-white/10 p-3">
                {form.modules.map((mid: string) => (
                  <div key={mid} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs text-slate-300">{db.modules.find((m) => m.id === mid)?.titre}</span>
                    <Input
                      type="number" min={0} className="w-28"
                      value={form.tarifsParModule?.[mid] ?? 0}
                      onChange={(e) => setForm({ ...form, tarifsParModule: { ...form.tarifsParModule, [mid]: +e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}

          {!editing && (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Compte utilisateur formateur</p>
                  <p className="text-[11px] text-slate-400">Permet à l'enseignant de se connecter à son espace</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-cyan-400 focus:ring-cyan-400"
                  />
                  <span className="text-xs font-semibold text-white">Créer également le compte utilisateur</span>
                </label>
              </div>

              {createAccount && (
                <div className="mt-3 grid gap-3 border-t border-white/5 pt-3 sm:grid-cols-2">
                  <Field label="Email de connexion (identifiant)" hint="Utilisé pour se connecter">
                    <Input
                      type="email"
                      value={accountEmail || form.email}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      placeholder="email@exemple.com"
                    />
                  </Field>
                  <Field label="Mot de passe temporaire" hint="Laisser vide pour génération automatique">
                    <Input
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="ex: Temp#2026! (ou automatique)"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setCreating(false)} disabled={savingTeacher}>Annuler</Btn>
            <Btn onClick={save} disabled={savingTeacher}>
              {savingTeacher ? "Création en cours..." : editing ? "Enregistrer les modifications" : createAccount ? "Créer l'enseignant et son compte" : "Créer l'enseignant (sans compte)"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression enseignant */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement l'enseignant{" "}
            <span className="font-bold text-white">{deleteTarget?.prenom} {deleteTarget?.nom}</span> ({deleteTarget?.specialite}) ainsi que son compte ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Cette action retirera également le formateur des modules attribués.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteTeacher}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* Détails enseignant : heures, finance, liens rapides */
function TeacherDetail({ t }: { t: any }) {
  const { db } = useStore();
  const fin = teacherFinanceSummary(db, t.id);
  const mods = db.modules.filter((m) => t.modules.includes(m.id));
  const _ignored = null; void _ignored; // placeholder

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        {t.photo ? <img src={t.photo} alt="" className="h-24 w-24 rounded-2xl border border-cyan-400/40 object-cover" />
          : <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><GraduationCap size={44} className="text-cyan-300" /></div>}
        <div className="flex-1">
          <p className="font-display text-xl font-black text-white">{t.prenom} {t.nom}</p>
          <p className="font-mono text-xs text-cyan-300">{t.id} {t.actif === false && <Badge color="red">Inactif</Badge>}</p>
          <p className="mt-1 text-sm text-slate-400">{t.specialite}</p>
          {t.diplomes && <p className="text-xs text-slate-500">{t.diplomes}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
            {t.typeContrat && <Badge color="gold">{t.typeContrat}</Badge>}
            {(t.formations ?? []).map((f: any) => <Badge key={f} color={f === "informatique" ? "red" : "cyan"}>{formationLabel(f)}</Badge>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[9px] uppercase text-slate-500">Tarif/h</p>
            <p className="font-display text-sm font-black text-white">{money(t.tarifHoraire ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[9px] uppercase text-slate-500">Prévues</p>
            <p className="font-display text-sm font-black text-white">{t.heuresPrevues ?? 0} h</p>
          </div>
        </div>
      </div>

      {t.infosPro && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">Informations professionnelles</p>
          <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm text-slate-300">{t.infosPro}</p>
        </div>
      )}

      {/* Accès sécurisé & Invitation WhatsApp à Usage Unique (Exigence formateur) */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Invitation & Accès Formateur (Lien Unique)</p>
            <p className="text-[11px] text-slate-400">Générer un lien à usage unique avec identifiant et mot de passe temporaire</p>
          </div>
          <Btn
            variant="outline"
            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
            onClick={async () => {
              const token = "TCH_" + uid("T") + "_" + Math.random().toString(36).slice(2, 10);
              if (isSupabaseConfigured) {
                try {
                  await supabase.from("account_invitations").insert({
                    token,
                    email: t.email || null,
                    phone: t.phone || null,
                    role: "teacher",
                    target_id: t.id,
                  });
                } catch (e: any) {
                  console.warn("Invitation token save notice:", e.message);
                }
              }
              const link = `${window.location.origin}/#/acces-formateur?token=${token}`;
              const teacherUser = db.users.find((u) => u.id === t.userId);
              const identifiant = teacherUser?.username || (t.email ? t.email.split("@")[0] : `${t.prenom.toLowerCase()}.${t.nom.toLowerCase()}`);
              const cleanPhone = (t.phone || "").replace(/[^0-9]/g, "");
              const message = `Bonjour ${t.prenom} ${t.nom},\n\n` +
                `Votre compte formateur SENTINELLE NUMÉRIQUE (ENIA 2.0) a été créé avec succès.\n\n` +
                `Voici vos identifiants temporaires :\n` +
                `👤 Identifiant : ${identifiant}\n` +
                `🔑 Mot de passe temporaire : Sentinelle#2026!\n\n` +
                `👉 Accédez directement à votre espace formateur via ce lien sécurisé à usage unique :\n${link}\n\n` +
                `⚠️ ATTENTION (Sécurité) : Ce lien est à usage unique et expirera dès votre premier clic. Vous devrez y renseigner votre email et définir votre mot de passe personnel définitif.\n\n` +
                `À très bientôt !`;

              if (cleanPhone) {
                const phoneWithCode = cleanPhone.startsWith("242") ? cleanPhone : `242${cleanPhone}`;
                window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, "_blank");
                toastMsg.success("Lien WhatsApp ouvert ✓", "L'invitation avec accès à usage unique a été pré-remplie.");
              } else {
                navigator.clipboard.writeText(message);
                toastMsg.success("Message d'accès copié ✓", "Partagez ce message sécurisé à usage unique avec l'enseignant.");
              }
            }}
          >
            <MessageCircle size={15} /> Inviter via WhatsApp (Usage Unique)
          </Btn>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Modules enseignés ({mods.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {mods.map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">{m.numero}. {m.titre}</span>)}
        </div>
      </div>

      {/* Finance enseignant */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat icon={<Clock size={20} />} label="Effectuées" value={`${fin.heuresEffectuees} h`} color="blue" />
        <Stat icon={<CheckCircle2 size={20} />} label="Validées" value={`${fin.heuresValidees} h`} color="green" />
        <Stat icon={<Wallet size={20} />} label="Dû" value={money(fin.montantDu)} color="gold" />
        <Stat icon={<BadgeDollarSign size={20} />} label="Payé" value={money(fin.montantPaye)} color="cyan" />
        <Stat icon={<BadgeDollarSign size={20} />} label="Solde" value={money(fin.solde)} color="red" />
      </div>

      {/* Mensuel */}
      {fin.months.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Ventilation mensuelle</p>
          <div className="space-y-2">
            {fin.months.map((m) => (
              <div key={m.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
                <span className="w-40 font-semibold text-slate-200">{m.label}</span>
                <span className="text-xs text-slate-400">{m.effectuees} h effectuées · {m.validees} h validées</span>
                <span className="font-mono text-amber-300">{money(m.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raccourcis */}
      <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <Link to={`/app/modules`}><Btn variant="outline">Modules</Btn></Link>
        <Link to={`/app/cours`}><Btn variant="outline">Cours</Btn></Link>
        <Link to={`/app/emploi-du-temps`}><Btn variant="outline">Emploi du temps</Btn></Link>
        <Link to={`/app/enseignants-heures`}><Btn variant="outline">Heures</Btn></Link>
        <Link to={`/app/paiements`}><Btn variant="outline">Paiements</Btn></Link>
      </div>
    </div>
  );
}

/* ================= USERS ================= */
export function UsersPage() {
  const { db, user, update, log } = useStore();
  const [adding, setAdding] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPwBusy, setNewPwBusy] = useState(false);
  const [newPwErr, setNewPwErr] = useState("");
  const emptyUserForm = () => ({ username: "", password: "", role: "student", name: "", email: "", phone: "", organizationName: "", poste: "", accessLevel: "viewer", startDate: today(), endDate: "" });
  const [form, setForm] = useState(emptyUserForm());

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const uid = deleteTarget.id;
    const username = deleteTarget.username;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc("admin_delete_user", { target_user_id: uid });
        if (error) {
          throw error;
        }

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "DELETE_USER",
            entity_type: "profiles",
            entity_id: uid,
            description: `Suppression du compte utilisateur ${deleteTarget.name} (${username})`,
          });
        } catch { /* audit fallback */ }

        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Compte utilisateur supprimé avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message || "Impossible de supprimer ce compte.");
        return;
      }
    }
    update((d) => ({
      ...d,
      users: d.users.filter((u) => u.id !== uid),
      students: d.students.filter((s) => s.userId !== uid),
      teachers: d.teachers.filter((t) => t.userId !== uid),
    }));
    log(`Compte utilisateur supprimé : ${deleteTarget.name} (${username})`);
    setDeleteTarget(null);
  };

  const roleColor = (r: string) => r === "superadmin" ? "red" : r === "admin" ? "gold" : r === "teacher" ? "cyan" : "green";
  const roleLabel = (r: string) => r === "superadmin" ? "Super Admin" : r === "admin" ? "Administration" : r === "partner_admin" ? "Admin partenaire" : r === "teacher" ? "Enseignant" : r === "partner" ? "Partenaire" : "Apprenant";

  return (
    <div>
      <PageHead title="Gestion des utilisateurs" subtitle="Comptes, rôles et permissions"
        actions={<Btn onClick={() => setAdding(true)}><PlusCircle size={16} /> Nouvel utilisateur</Btn>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["superadmin", "admin", "partner_admin", "teacher", "student", "partner"].map((r) => (
          <Badge key={r} color={roleColor(r) as any}>{roleLabel(r)}</Badge>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Identifiant</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-white">{u.name}</p>
                  <p className="text-[11px] text-slate-500">{u.linkedId ? `Lié à ${u.linkedId}` : "—"}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-300">{u.username}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge color={roleColor(u.role) as any}>{roleLabel(u.role)}</Badge>
                    {u.actif === false && <Badge color="red">Désactivé</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.email || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {u.role !== "superadmin" && (
                      <button title={u.actif === false ? "Activer" : "Désactiver"}
                        onClick={() => { update((d) => ({ ...d, users: d.users.map((x) => x.id === u.id ? { ...x, actif: x.actif === false } : x) })); log(`Compte ${u.actif === false ? "activé" : "désactivé"} : ${u.username}`); }}
                        className={cn("rounded-lg border p-2", u.actif === false ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-300 hover:border-amber-400/40 hover:text-amber-300")}>
                        {u.actif === false ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    )}
                    <button title="Réinitialiser le mot de passe"
                      onClick={() => { setResetTarget({ id: u.id, username: u.username }); setNewPw(""); setNewPwErr(""); }}
                      className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"><KeyRound size={14} /></button>
                    {user?.id !== u.id && (
                      <button
                        title="Supprimer cet utilisateur"
                        onClick={() => setDeleteTarget(u)}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal réinitialisation mot de passe */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Réinitialiser le mot de passe — ${resetTarget?.username}`}>
        <div className="space-y-4">
          <Field label="Nouveau mot de passe" hint="12+ car., MAJ, min, chiffre, spécial">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="••••••••••••" />
          </Field>
          {newPwErr && <p className="text-xs text-red-400">{newPwErr}</p>}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setResetTarget(null)}>Annuler</Btn>
            <Btn disabled={newPwBusy} onClick={async () => {
              if (!passwordStrong(newPw)) { setNewPwErr("Mot de passe trop faible. Respectez les critères de sécurité."); return; }
              setNewPwBusy(true); setNewPwErr("");
              const hash = await hashPassword(newPw);
              update((d) => ({ ...d, users: d.users.map((x) => x.id === resetTarget!.id ? { ...x, password: hash } : x) }));
              log(`Mot de passe réinitialisé pour ${resetTarget!.username}`);
              toastMsg.success(`Mot de passe mis à jour pour ${resetTarget!.username}`);
              setNewPwBusy(false); setResetTarget(null);
            }}>
              <KeyRound size={14} /> {newPwBusy ? "En cours…" : "Mettre à jour"}
            </Btn>
          </div>
        </div>
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Nouvel utilisateur">
        <div className="space-y-4">
          <Field label="Nom complet"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identifiant" hint="Lettres, chiffres, . _ -">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} spellCheck={false} />
            </Field>
            <Field label="Mot de passe" hint="12+ car., majuscule, minuscule, chiffre, spécial">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
          {form.password && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-[11px]">
              {(() => {
                const c = checkPassword(form.password);
                const rules: [boolean, string][] = [
                  [c.length, "12 car."], [c.upper, "MAJ"], [c.lower, "min"], [c.digit, "chiffre"], [c.special, "spécial"], [c.notCommon, "non-courant"],
                ];
                return (
                  <div className="flex flex-wrap gap-2">
                    {rules.map(([ok, l]) => (
                      <span key={l} className={cn("rounded-md border px-1.5 py-0.5", ok ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-500")}>
                        {ok ? "✓" : "✗"} {l}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          <Field label="Rôle">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Apprenant</option>
              <option value="teacher">Enseignant</option>
              <option value="admin">Administration</option>
              <option value="partner_admin">Administration partenaire</option>
              <option value="partner">Partenaire</option>
              <option value="superadmin">Super Admin</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          {(form.role === "partner" || form.role === "partner_admin") && (
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Organisation partenaire obligatoire</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organisation"><Input value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="Nom de l'organisation" /></Field>
                <Field label="Poste / fonction"><Input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="ex: Responsable pédagogique" /></Field>
                <Field label="Périmètre d'accès">
                  <Select value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}>
                    {Object.entries(PARTNER_SCOPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </Select>
                </Field>
                <Field label="Date de début"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
                <Field label="Date de fin éventuelle"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Un compte partenaire ne peut pas être créé sans organisation. Les droits restent en lecture seule.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setAdding(false)}>Annuler</Btn>
            <Btn onClick={async () => {
              if (!form.username || !form.name) return;
              if (db.users.some((u) => u.username.toLowerCase() === form.username.trim().toLowerCase())) {
                toastMsg.error("Identifiant déjà utilisé", "Choisissez un identifiant différent.");
                return;
              }
              if (!passwordStrong(form.password)) {
                toastMsg.error("Mot de passe trop faible", "12+ car., majuscule, minuscule, chiffre, spécial.");
                return;
              }
              
              if (isSupabaseConfigured) {
                try {
                  const email = form.email || `${form.username}@sentinelles.local`;
                  if ((form.role === "partner" || form.role === "partner_admin") && !form.organizationName.trim()) {
                    toastMsg.warning("Organisation obligatoire pour un compte partenaire.");
                    return;
                  }
                  await invokeCreateUser({
                    email,
                    password: form.password,
                    username: form.username.trim().toLowerCase(),
                    name: form.name,
                    role: form.role as AppRole,
                    partner: form.role === "partner" || form.role === "partner_admin" ? {
                      organization_name: form.organizationName,
                      contact_name: form.name,
                      email,
                      phone: form.phone,
                      poste: form.poste,
                      access_level: form.accessLevel,
                      start_date: form.startDate,
                      end_date: form.endDate || null,
                      scopes: [form.accessLevel],
                    } : undefined,
                  });
                  toastMsg.credentials({ nom: form.name, identifiant: form.username, motDePasse: form.password });
                  toastMsg.success("Utilisateur créé côté serveur ✓");
                  log(`Utilisateur créé (Supabase) : ${form.username} (${form.role})`);
                  window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
                } catch (err: any) {
                  toastMsg.error("Erreur lors de la création", (err as Error).message);
                  return;
                }
              } else {
                const hash = await hashPassword(form.password);
                const nu: User = { id: uid("u"), username: form.username.trim().toLowerCase(), password: hash, role: form.role as Role, name: form.name, email: form.email, createdAt: today(), actif: true };
                update((d) => ({ ...d, users: [...d.users, nu] }));
                log(`Utilisateur créé : ${form.username} (${form.role})`);
              }
              setAdding(false); setForm(emptyUserForm());
            }}>Créer</Btn>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression utilisateur */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement le compte de l'utilisateur{" "}
            <span className="font-bold text-white">{deleteTarget?.name}</span> (Identifiant : <span className="font-mono text-cyan-300">{deleteTarget?.username}</span>, Rôle : <span className="text-amber-300">{deleteTarget && roleLabel(deleteTarget.role)}</span>) ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Attention : Cette action est irréversible et révoquera immédiatement tous ses accès au logiciel.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteUser}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
