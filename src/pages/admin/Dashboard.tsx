import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users, GraduationCap, BookOpen, Wallet, ClipboardCheck, UserX, Timer,
  TestTube2, Award, BadgeDollarSign, TrendingUp, Activity, AlertTriangle, PlusCircle, RotateCcw,
  CalendarDays, DollarSign,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Stat, PageHead, Badge, Btn, Field, Input, today, money, Empty, formationLabel } from "@/lib/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

/* ---------- helpers ---------- */
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-slate-400">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/5">
        <div className={`h-full rounded-md bg-gradient-to-r ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-300">{value}</span>
    </div>
  );
}

export function AdminDashboard() {
  const { db } = useStore();
  const d = today();
  const students = db.students;
  const attToday = db.attendance.filter((a) => a.date === d);
  // Le statut financier réel est désormais calculé dynamiquement via financialSummary().
  // Pour l'affichage du dashboard, on additionne simplement tous les montants encaissés.
  const revenue = db.payments.reduce((a, p) => a + (p.montant || 0), 0);
  const partial: typeof db.payments = [];
  const unpaid = db.invoices.length > 0
    ? db.students.filter((s) => {
        const invoicesTotal = db.invoices.filter((i) => i.studentId === s.id).reduce((a, i) => a + i.montant, 0);
        const paymentsTotal = db.payments.filter((p) => p.studentId === s.id).reduce((a, p) => a + p.montant, 0);
        return invoicesTotal > paymentsTotal;
      }).length
    : 0;

  const byMonth: Record<string, number> = {};
  students.forEach((s) => {
    const m = s.dateInscription.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  });
  const months = Object.keys(byMonth).sort();
  const maxMonth = Math.max(1, ...Object.values(byMonth));

  const infoCount = students.filter((s) => s.formation === "informatique").length;
  const indCount = students.filter((s) => s.formation === "industriel").length;
  const total = Math.max(1, students.length);
  const infoPct = (infoCount / total) * 100;

  const paidPct = 100; // Tous les paiements enregistrés sont considérés comme encaissés

  const avgNote = db.grades.length ? (db.grades.reduce((a, g) => a + g.note, 0) / db.grades.length).toFixed(1) : "—";
  const scholarshipsGranted = db.scholarships.filter((s) => s.statut === "bourse_attribuee").length;
  const isEmpty = db.students.length === 0 && db.teachers.length === 0 && db.modules.length === 0;

  if (isEmpty) {
    return (
      <div>
        <PageHead title="Tableau de bord" subtitle="SENTINELLES NUMÉRIQUES" />
        <Card className="mx-auto max-w-2xl p-8 text-center" glow="cyan">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_30px_-6px_rgba(0,229,255,0.8)]">
            <BookOpen size={28} className="text-white" />
          </div>
          <h2 className="font-display text-2xl font-black text-white">Bienvenue dans votre plateforme.</h2>
          <p className="mt-2 text-slate-400">Aucune donnée n'est encore configurée. Commencez par configurer votre établissement.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/app/modules"><Btn className="w-full"><PlusCircle size={16} /> Créer une formation / module</Btn></Link>
            <Link to="/app/utilisateurs"><Btn variant="outline" className="w-full">Créer un administrateur</Btn></Link>
            <Link to="/app/enseignants"><Btn variant="outline" className="w-full">Ajouter un formateur</Btn></Link>
            <Link to="/app/etudiants"><Btn variant="outline" className="w-full">Ajouter un apprenant</Btn></Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">Puis : Formations → Modules → Formateurs → Apprenants → Cours → Emplois du temps → Tests → Paiements.</p>
        </Card>
      </div>
    );
  }

  // Calcul des présences sur les 7 derniers jours (Lundi à Dimanche)
  const last7Days = useMemo(() => {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const target = new Date(now);
      target.setDate(now.getDate() - i);
      const dateStr = target.toISOString().slice(0, 10);
      const dayName = days[(target.getDay() + 6) % 7];
      const dayAtt = db.attendance.filter((a) => a.date === dateStr);
      const presents = dayAtt.filter((a) => a.statut === "present").length;
      const absents = dayAtt.filter((a) => a.statut === "absent").length;
      const retards = dayAtt.filter((a) => a.statut === "retard").length;
      result.push({ date: dateStr, label: dayName, presents, absents, retards, total: dayAtt.length });
    }
    return result;
  }, [db.attendance]);

  const maxAttCount = Math.max(1, ...last7Days.map((d) => Math.max(d.presents, d.absents + d.retards)));

  // Répartition globale des présences
  const totalAttRecords = db.attendance.length || 1;
  const totalPresents = db.attendance.filter((a) => a.statut === "present").length;
  const totalAbsents = db.attendance.filter((a) => a.statut === "absent").length;
  const totalRetards = db.attendance.filter((a) => a.statut === "retard").length;
  const attendanceRate = Math.round((totalPresents / totalAttRecords) * 100);

  return (
    <div className="space-y-6">
      <PageHead
        title="Tableau de bord"
        subtitle="Supervision en temps réel — SENTINELLE NUMÉRIQUE"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/qr-scanner">
              <Btn variant="primary" className="bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                <ClipboardCheck size={16} /> Scanner QR Présence
              </Btn>
            </Link>
            <Link to="/app/etudiants">
              <Btn variant="outline"><PlusCircle size={16} /> Nouvel apprenant</Btn>
            </Link>
            <Link to="/app/contenu">
              <Btn variant="outline">Modifier le site</Btn>
            </Link>
          </div>
        }
      />

      {/* Cartes statistiques principales (Inspirées de la maquette officielle) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Apprenants */}
        <Card className="relative overflow-hidden p-5 border-cyan-400/20 bg-gradient-to-br from-[#0B1733] to-[#070D1E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Apprenants</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
              <Users size={20} />
            </div>
          </div>
          <p className="font-display mt-2 text-3xl font-black text-white">{students.length.toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
              <TrendingUp size={13} /> +12% actifs
            </span>
            <span className="text-slate-400">{infoCount} Info · {indCount} Ind.</span>
          </div>
        </Card>

        {/* Formateurs */}
        <Card className="relative overflow-hidden p-5 border-blue-500/20 bg-gradient-to-br from-[#0D1938] to-[#070D1E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Formateurs</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">
              <GraduationCap size={20} />
            </div>
          </div>
          <p className="font-display mt-2 text-3xl font-black text-white">{db.teachers.length.toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
              <TrendingUp size={13} /> +5% corps enseignant
            </span>
            <span className="text-slate-400">Pédagogie active</span>
          </div>
        </Card>

        {/* Présences Aujourd'hui */}
        <Card className="relative overflow-hidden p-5 border-emerald-500/20 bg-gradient-to-br from-[#0A1F26] to-[#070D1E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Présences aujourd'hui</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <p className="font-display mt-2 text-3xl font-black text-white">
            {attToday.filter((a) => a.statut === "present").length.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
              <TrendingUp size={13} /> {attToday.length > 0 ? `${Math.round((attToday.filter((a) => a.statut === "present").length / attToday.length) * 100)}% d'assiduité` : "Aucun appel"}
            </span>
            <span className="text-slate-400">{attToday.filter((a) => a.statut === "absent").length} absents</span>
          </div>
        </Card>

        {/* Modules Actifs */}
        <Card className="relative overflow-hidden p-5 border-red-500/20 bg-gradient-to-br from-[#1E0F1E] to-[#070D1E]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Modules actifs</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10 text-red-400">
              <BookOpen size={20} />
            </div>
          </div>
          <p className="font-display mt-2 text-3xl font-black text-white">{db.modules.length.toLocaleString()}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-bold text-cyan-400">
              <TrendingUp size={13} /> 2 filières
            </span>
            <span className="text-slate-400">Génie Info & Ind.</span>
          </div>
        </Card>
      </div>

      {/* Graphiques et statistiques avancées (Section 6) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Présences sur les 7 derniers jours */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-white">Présences sur les 7 derniers jours</h3>
              <p className="text-xs text-slate-400">Assiduité journalière et variations d'effectifs</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Présents</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Absents</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Retards</span>
            </div>
          </div>

          <div className="flex h-52 items-end justify-between gap-2 pt-6 pb-2 border-b border-white/5">
            {last7Days.map((day) => {
              const presentHeight = (day.presents / maxAttCount) * 100;
              const absentHeight = (day.absents / maxAttCount) * 100;
              const retardHeight = (day.retards / maxAttCount) * 100;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.presents}
                  </div>
                  <div className="w-full max-w-[28px] flex flex-col gap-1 items-center justify-end h-full">
                    {day.absents > 0 && (
                      <div
                        className="w-full rounded bg-red-500/80 transition-all hover:bg-red-400"
                        style={{ height: `${Math.max(4, absentHeight)}%` }}
                        title={`${day.absents} absent(s)`}
                      />
                    )}
                    {day.retards > 0 && (
                      <div
                        className="w-full rounded bg-amber-400/80 transition-all hover:bg-amber-300"
                        style={{ height: `${Math.max(4, retardHeight)}%` }}
                        title={`${day.retards} retard(s)`}
                      />
                    )}
                    <div
                      className="w-full rounded bg-cyan-400 transition-all hover:bg-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                      style={{ height: `${Math.max(day.presents > 0 ? 8 : 2, presentHeight)}%` }}
                      title={`${day.presents} présent(s)`}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 mt-2">{day.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Taux de présence global : <strong className="text-cyan-300">{attendanceRate}%</strong></span>
            <Link to="/app/presences" className="font-bold text-cyan-400 hover:underline">Consulter les feuilles d'émargement →</Link>
          </div>
        </Card>

        {/* Répartition des présences (Donut / Gauges) */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-white">Répartition des présences</h3>
            <p className="text-xs text-slate-400">Statistiques cumulées d'assiduité</p>

            <div className="my-6 flex items-center justify-center gap-6">
              <div
                className="relative h-32 w-32 rounded-full"
                style={{
                  background: `conic-gradient(#00E5FF 0 ${attendanceRate}%, #FF1744 ${attendanceRate}% ${attendanceRate + Math.round((totalAbsents / totalAttRecords) * 100)}%, #FFB300 ${attendanceRate + Math.round((totalAbsents / totalAttRecords) * 100)}% 100%)`
                }}
              >
                <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-[#0A1224]">
                  <span className="font-display text-2xl font-black text-white">{attendanceRate}%</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">Présents</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                  <span>Présents : <strong className="text-white">{totalPresents}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span>Absents : <strong className="text-white">{totalAbsents}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span>Retards : <strong className="text-white">{totalRetards}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
            <p className="font-bold text-white">Bourses & Trésorerie :</p>
            <div className="mt-1 flex items-center justify-between text-slate-400">
              <span>Bourses attribuées :</span>
              <span className="font-bold text-amber-300">{scholarshipsGranted}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-slate-400">
              <span>Total encaissé :</span>
              <span className="font-bold text-emerald-300">{money(revenue)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* recent registrations */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Pré-inscriptions récentes</h3>
            <Link to="/app/etudiants" className="text-xs font-bold text-cyan-300 hover:underline">Gérer →</Link>
          </div>
          {db.registrations.length === 0 ? (
            <Empty icon={<Users size={32} />} title="Aucune pré-inscription" />
          ) : (
            <div className="space-y-2">
              {db.registrations.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-bold text-slate-200">{r.nom} {r.prenom}</p>
                    <p className="text-[11px] text-slate-500">{formationLabel(r.formation)} • {r.modules.length} module(s) • {r.date}</p>
                  </div>
                  <Badge color={r.statut === "en_attente" ? "gold" : r.statut === "confirmee" ? "green" : "red"}>{r.statut.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* activity log */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Activité récente</h3>
            <Link to="/app/journal" className="text-xs font-bold text-cyan-300 hover:underline">Journal →</Link>
          </div>
          <div className="space-y-2">
            {db.log.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-start gap-2.5 text-sm">
                <Activity size={14} className="mt-1 shrink-0 text-cyan-400" />
                <div className="min-w-0">
                  <p className="truncate text-slate-300">{l.action}</p>
                  <p className="text-[10px] text-slate-600">{l.user} • {l.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* quick actions */}
      <Card className="mt-4 p-5">
        <h3 className="font-display mb-3 text-sm font-bold text-white">Actions rapides</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { to: "/app/etudiants", l: "Apprenants", i: <Users size={16} /> },
            { to: "/app/presences", l: "Présences", i: <ClipboardCheck size={16} /> },
            { to: "/app/tests", l: "Tests", i: <TestTube2 size={16} /> },
            { to: "/app/certificats", l: "Certificats", i: <Award size={16} /> },
            { to: "/app/bourses", l: "Bourses", i: <BadgeDollarSign size={16} /> },
            { to: "/app/enia", l: "ENIA 2.0", i: <GraduationCap size={16} /> },
            { to: "/app/enia-admin", l: "Admin ENIA", i: <BookOpen size={16} /> },
            { to: "/app/contenu", l: "Contenu site", i: <CalendarDays size={16} /> },
          ].map((a, i) => (
            <Link key={i} to={a.to} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300">
              {a.i} {a.l}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Journal ---------- */
export function JournalPage() {
  const { db } = useStore();
  return (
    <div>
      <PageHead title="Journal d'activité" subtitle="Toutes les actions effectuées sur la plateforme" />
      <Card className="overflow-hidden">
        <div className="divide-y divide-white/5">
          {db.log.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Activity size={14} className="shrink-0 text-cyan-400" />
              <p className="min-w-0 flex-1 text-sm text-slate-300">{l.action}</p>
              <Badge color="gray">{l.user}</Badge>
              <span className="font-mono text-[11px] text-slate-500">{l.date}</span>
            </div>
          ))}
          {db.log.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Journal vide.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Paramètres ---------- */
export function ParametresPage() {
  const { db, user, update, log } = useStore();
  const s = db.settings;
  const [email, setEmail] = useState(s.contact.email);
  const [adresse, setAdresse] = useState(s.contact.adresse);

  return (
    <div>
      <PageHead title="Paramètres" subtitle="Configuration générale de la plateforme" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display mb-4 text-sm font-bold text-white">Coordonnées de contact</h3>
          <div className="space-y-4">
            <Field label="Email de contact"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Adresse"><Input value={adresse} onChange={(e) => setAdresse(e.target.value)} /></Field>
            <Btn
              onClick={async () => {
                const nextSettings = { ...db.settings, contact: { email, adresse } };
                update((d) => ({ ...d, settings: nextSettings }));
                if (isSupabaseConfigured) {
                  try {
                    await supabase.from("site_settings").upsert({
                      id: "default",
                      data: {
                        settings: nextSettings,
                        advantages: db.advantages,
                        partners: db.partners,
                        announcements: db.announcements,
                      },
                      updated_at: new Date().toISOString(),
                    });
                  } catch (err) {
                    console.error("Erreur sauvegarde site_settings:", err);
                  }
                }
                log("Paramètres de contact mis à jour");
                toastMsg.success("Coordonnées enregistrées avec succès ✓");
              }}
              className="w-full"
            >
              Enregistrer les coordonnées
            </Btn>
          </div>
        </Card>

        <Card className="p-6" glow="red">
          <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-bold text-red-400"><AlertTriangle size={16} /> Initialisation du logiciel</h3>
          <p className="text-sm text-slate-400">
            Réinitialisez sélectivement les données de la plateforme (formations, apprenants, paiements, contenu…).
            L'opération est irréversible et réservée à l'Administrateur Supérieur.
          </p>
          {user?.role === "superadmin" ? (
            <Link to="/app/initialisation" className="mt-4 inline-block">
              <Btn variant="red"><RotateCcw size={15} /> Ouvrir l'initialisation</Btn>
            </Link>
          ) : (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">
              Seul l'Administrateur Supérieur peut initialiser le logiciel.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
