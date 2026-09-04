import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  UserCircle2, CalendarDays, Clock, MapPin, ClipboardCheck, PenLine, Wallet, Award,
  BadgeDollarSign, CheckCircle2, XCircle, Timer, Phone, Mail, FileText, TestTube2, PlayCircle,
  ShieldCheck, ChevronRight, Printer, ReceiptText, TrendingUp, Eye, AlertCircle, ArrowRight,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import {
  Btn, Badge, Card, Empty, Field, Input, PageHead, Progress, Modal, Stat, moduleIcon, money,
  formationLabel, today, printHTML, uid, SentinelLogo,
} from "@/lib/ui";
import { Test } from "@/lib/types";
import { financialSummary, statusLabel } from "@/lib/finance";
import { studentCanSeeCourse, scheduleFor } from "@/lib/access";
import { fileKind, humanSize, downloadFile } from "@/lib/files";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { PasswordChangeCard } from "@/pages/shared/PasswordChangeCard";

export function StudentDashboard() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id);
  if (!student) return <Empty icon={<UserCircle2 size={40} />} title="Profil apprenant introuvable. Contactez l'administration." />;

  const myMods = db.modules.filter((m) => student.modules.includes(m.id));
  const att = db.attendance.filter((a) => a.studentId === student.id);
  const grades = db.grades.filter((g) => g.studentId === student.id);
  const avg = grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(1) : "—";
  const present = att.filter((a) => a.statut === "present").length;
  const absent = att.filter((a) => a.statut === "absent").length;
  const progression = Math.min(100, Math.round(((grades.length + att.length) / Math.max(6, myMods.length * 3)) * 100));
  const todaySessions = db.schedule.filter((s) => s.formation === student.formation && s.jour === new Date().toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()));
  const notifs = db.notifications.filter((n) => n.toId === user!.id || n.toId === "all").slice(0, 3);

  const summary = financialSummary(db, student.id);
  const inscriptionInv = summary.invoices.find((i) => i.type === "inscription" || i.libelle.toLowerCase().includes("inscription"));
  const inscAmount = inscriptionInv?.montant || 5000;
  const formationInvs = summary.invoices.filter((i) => i.type === "formation");
  const formationTotal = formationInvs.reduce((a, b) => a + (b.montant || 0), 0);
  const tranche1Amount = Math.round(formationTotal / 2);
  const tranche2Amount = formationTotal - tranche1Amount;
  const hasRemainingFees = summary.solde > 0 || summary.statut !== "paye";

  return (
    <div>
      <PageHead title={`Bonjour, ${student.prenom} 👋`} subtitle={`${student.id} — ${formationLabel(student.formation)}`} />

      {/* Rappel Frais de Formation & Cycle de Règlement */}
      {hasRemainingFees && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[#0a1426] to-[#07101f] p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start gap-3.5">
            <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-300 shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-amber-300">
                  Rappel Frais de Formation : Rapprochez-vous de la direction
                </h3>
                <Badge color="gold">Règlement en cours</Badge>
              </div>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                Veuillez vous rapprocher de la direction du centre (Institut des Jeunes Sourds / ENIA 2.0) pour régulariser vos frais de formation selon les modalités officielles :
              </p>

              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3 text-xs">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">1. Frais d'inscription</p>
                  <p className="mt-1 text-sm font-black text-white">{money(inscAmount)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">À régler au démarrage (valide votre badge et vos accès aux cours).</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">2. Tranche 1 (Après 1 mois)</p>
                  <p className="mt-1 text-sm font-black text-white">{money(tranche1Amount)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">50% des frais de cours à régler 1 mois après le démarrage.</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">3. Tranche 2 (Fin de session)</p>
                  <p className="mt-1 text-sm font-black text-white">{money(tranche2Amount)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Solde restant exigible avant les évaluations finales et la certification.</p>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="text-xs text-slate-400">
                  Total payé : <strong className="text-emerald-300">{money(summary.totalPaye)}</strong> • Reste dû : <strong className="text-amber-300">{money(summary.solde)}</strong>
                </div>
                <Link to="/app/mes-paiements">
                  <Btn variant="outline" className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 text-xs py-1.5">
                    Consulter mes reçus et échéancier <ArrowRight size={14} />
                  </Btn>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<TrendingUp size={20} />} label="Progression" value={`${progression}%`} color="cyan" />
        <Stat icon={<ClipboardCheck size={20} />} label="Présences" value={present} color="green" />
        <Stat icon={<XCircle size={20} />} label="Absences" value={absent} color="red" />
        <Stat icon={<PenLine size={20} />} label="Moyenne" value={avg} color="gold" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Mes prochaines sessions</h3>
            <Badge color="gray">{todaySessions.length} aujourd'hui</Badge>
          </div>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune session aujourd'hui. Consultez votre emploi du temps.</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                  <Clock size={16} className="shrink-0 text-cyan-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{db.modules.find((m) => m.id === s.moduleId)?.titre}</p>
                    <p className="text-[11px] text-slate-400">{s.heureDebut} — {s.heureFin} • Salle {s.salle}</p>
                  </div>
                  <ChevronRight size={15} className="text-slate-600" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Mes modules ({myMods.length})</h3>
          <div className="space-y-2.5">
            {myMods.slice(0, 4).map((m) => {
              const g = grades.filter((x) => x.moduleId === m.id);
              const pct = g.length ? Math.min(100, Math.round((g[0].note / 20) * 100)) : 15;
              return (
                <div key={m.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="truncate text-sm font-bold text-slate-200">{m.numero}. {m.titre}</p>
                    {g.length ? <Badge color={g[0].note >= 10 ? "green" : "red"}>{g[0].note}/20</Badge> : <Badge color="gray">En cours</Badge>}
                  </div>
                  <Progress value={pct} color={g.length && g[0].note < 10 ? "red" : "cyan"} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Notifications récentes</h3>
          {notifs.length === 0 ? <p className="text-sm text-slate-500">Aucune notification.</p> : (
            <div className="space-y-2">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <BellIcon type={n.type} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-200">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="relative overflow-hidden p-5 border border-cyan-400/30 bg-gradient-to-br from-[#0A1224] to-[#07152B]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SentinelLogo variant="symbol" alt="Symbole SENTINEL'S" className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(255,23,79,0.5)]" />
              <div>
                <span className="font-display text-xs font-black text-white">SENTINELLE <span className="text-red-400">NUMÉRIQUE</span></span>
                <p className="text-[8px] uppercase tracking-wider text-cyan-300">ENIA 2.0 · CONGO</p>
              </div>
            </div>
            <Badge color="green">{student.statut}</Badge>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <div className="rounded-xl bg-white p-2 shadow">
              <QRCodeSVG value={`SN|${student.id}|${student.nom}|${student.prenom}|${student.formation}`} size={85} />
            </div>
            <div>
              <p className="font-display text-base font-black text-white">{student.prenom} {student.nom}</p>
              <p className="font-mono text-xs font-bold text-cyan-300">{student.id}</p>
              <p className="mt-1 text-xs text-slate-400">{formationLabel(student.formation)} • {myMods.length} modules</p>
              <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-500">Présentez ce QR Code pour vos émargements</p>
            </div>
          </div>
          <p className="mt-3 border-t border-white/5 pt-2 text-center text-[8px] uppercase tracking-widest text-cyan-300/70">
            APPRENDRE • INNOVER • CRÉER • CODER • SÉCURISER
          </p>
        </Card>
      </div>
    </div>
  );
}

function BellIcon({ type }: { type: string }) {
  const c = type === "paiement" ? "text-amber-300 border-amber-400/30" : type === "test" ? "text-red-400 border-red-500/30" : type === "certif" ? "text-blue-400 border-blue-500/30" : "text-cyan-300 border-cyan-400/30";
  return <div className={cn("rounded-lg border p-1.5", c)}><ShieldCheck size={14} /></div>;
}

/* ---------- profile ---------- */
export function StudentProfile() {
  const { db, user, update, log } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const [form, setForm] = useState({ telephone: student.telephone, whatsapp: student.whatsapp, email: student.email, adresse: student.adresse });
  const att = db.attendance.filter((a) => a.studentId === student.id);

  return (
    <div>
      <PageHead title="Mon profil" subtitle="Vos informations personnelles et votre carte d'apprenant" />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-4">
            {student.photo ? (
              <img src={student.photo} alt="" className="h-20 w-20 rounded-2xl border-2 border-cyan-400/50 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30"><UserCircle2 size={40} className="text-cyan-300" /></div>
            )}
            <div>
              <p className="font-display text-xl font-black text-white">{student.prenom} {student.nom}</p>
              <p className="font-mono text-sm text-cyan-300">{student.id}</p>
              <Badge color="green" className="mt-1.5">{formationLabel(student.formation)}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Date de naissance" value={student.dateNaissance || "—"} />
            <Info label="Sexe" value={student.sexe === "M" ? "Masculin" : "Féminin"} />
            <Info label="Niveau d'étude" value={student.niveau || "—"} />
            <Info label="Inscrit le" value={student.dateInscription} />
          </div>
          <div className="mt-4 rounded-xl bg-white p-2">
            <QRCodeSVG value={`SN|${student.id}|${student.nom}|${student.prenom}|${student.formation}`} size={140} className="mx-auto" />
          </div>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-slate-500">Présentez ce QR Code en salle</p>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Modifier mes coordonnées</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone"><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Adresse"><Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
            </div>
            <Btn
              className="mt-5"
              onClick={async () => {
                if (isSupabaseConfigured) {
                  try {
                    const { error: sErr } = await supabase.from("students").update({
                      telephone: form.telephone,
                      whatsapp: form.whatsapp,
                      email: form.email,
                      adresse: form.adresse,
                    }).eq("id", student.id);
                    if (sErr) throw sErr;

                    if (user?.id) {
                      await supabase.from("profiles").update({
                        phone: form.telephone,
                        email: form.email,
                      }).eq("id", user.id);

                      await supabase.from("audit_logs").insert({
                        user_id: user.id,
                        action: "PROFILE_UPDATED",
                        entity_type: "students",
                        entity_id: student.id,
                        description: "Mise à jour des coordonnées apprenant",
                      });
                    }
                    toastMsg.success("Coordonnées enregistrées côté serveur ✓");
                    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
                  } catch (err: any) {
                    toastMsg.error("Erreur d'enregistrement", err.message);
                    return;
                  }
                } else {
                  toastMsg.success("Coordonnées enregistrées en local ✓");
                }

                update((d) => ({ ...d, students: d.students.map((s) => (s.id === student.id ? { ...s, ...form } : s)) }));
                log(`Profil mis à jour par ${student.prenom} ${student.nom}`);
              }}
            >
              Enregistrer mes coordonnées
            </Btn>
            <div className="mt-6 border-t border-white/5 pt-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Mes statistiques</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="text-[10px] uppercase text-slate-500">Présences</p><p className="font-display text-lg font-black text-emerald-300">{att.filter((a) => a.statut === "present").length}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="text-[10px] uppercase text-slate-500">Absences</p><p className="font-display text-lg font-black text-red-400">{att.filter((a) => a.statut === "absent").length}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="text-[10px] uppercase text-slate-500">Retards</p><p className="font-display text-lg font-black text-amber-300">{att.filter((a) => a.statut === "retard").length}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="text-[10px] uppercase text-slate-500">Modules</p><p className="font-display text-lg font-black text-cyan-300">{student.modules.length}</p></div>
              </div>
            </div>
          </Card>

          {/* Sécurité et mot de passe */}
          <PasswordChangeCard />
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-bold text-slate-200">{value}</p>
    </div>
  );
}

/* ---------- ma formation ---------- */
export function MyFormation() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const info = db.settings.infos;
  const myMods = db.modules.filter((m) => student.modules.includes(m.id));
  const grades = db.grades.filter((g) => g.studentId === student.id);

  return (
    <div>
      <PageHead title="Ma formation" subtitle={`${formationLabel(student.formation)} — ${info.duree}`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: <CalendarDays size={18} className="text-cyan-300" />, t: "Début", v: info.debut },
          { icon: <Clock size={18} className="text-red-400" />, t: "Durée", v: info.duree },
          { icon: <MapPin size={18} className="text-blue-400" />, t: "Lieu", v: info.lieu },
        ].map((c, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mt-0.5">{c.icon}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.t}</p>
              <p className="text-sm font-bold text-slate-200">{c.v}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {myMods.map((m) => {
          const g = grades.find((x) => x.moduleId === m.id);
          const pct = g ? Math.min(100, Math.round((g.note / 20) * 100)) : 10;
          return (
            <Card key={m.id} className="p-5" glow={student.formation === "informatique" ? "red" : "cyan"}>
              <div className="flex items-center gap-3">
                <div className={cn("rounded-xl border p-2.5", student.formation === "informatique" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}>
                  {moduleIcon(m.icon, "h-5 w-5")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-slate-500">MODULE {String(m.numero).padStart(2, "0")}</p>
                  <h4 className="font-display text-sm font-bold text-white">{m.titre}</h4>
                </div>
                {g && <Badge color={g.note >= 10 ? "green" : "red"}>{g.note}/20</Badge>}
              </div>
              <div className="mt-3">
                <Progress value={pct} color={g && g.note < 10 ? "red" : "cyan"} />
                <p className="mt-1 text-[11px] text-slate-500">{g ? `Note : ${g.note}/20 — ${g.appreciation}` : "Module en cours..."}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- mes modules ---------- */
export function MyModules() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const myMods = db.modules.filter((m) => student.modules.includes(m.id));
  const [preview, setPreview] = useState<any>(null);

  return (
    <div>
      <PageHead title="Mes modules" subtitle={`${myMods.length} module(s) — ${formationLabel(student.formation)}`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {myMods.map((m) => (
          <button key={m.id} type="button" onClick={() => setPreview(m)} className="text-left">
            <Card className="p-5 transition hover:-translate-y-0.5" glow={student.formation === "informatique" ? "red" : "cyan"}>
              <div className="mb-3 flex items-center justify-between">
                <div className={cn("rounded-xl border p-2.5", student.formation === "informatique" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}>
                  {moduleIcon(m.icon, "h-5 w-5")}
                </div>
                <span className={cn("font-mono text-[10px] font-bold tracking-[0.2em]", student.formation === "informatique" ? "text-red-400/70" : "text-cyan-400/70")}>MODULE {String(m.numero).padStart(2, "0")}</span>
              </div>
              <h4 className="font-display text-base font-bold text-white">{m.titre}</h4>
              <ul className="mt-3 space-y-1.5">
                {m.notions.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", student.formation === "informatique" ? "bg-red-400" : "bg-cyan-400")} /> {n}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] font-semibold text-cyan-300">Voir le détail →</p>
            </Card>
          </button>
        ))}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview ? `${preview.numero}. ${preview.titre}` : ""} wide>
        {preview && (
          <div className="space-y-4">
            {preview.description && <p className="text-sm text-slate-300">{preview.description}</p>}
            {preview.objectifs?.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">Objectifs</p>
                <ul className="space-y-1 text-sm text-slate-300">
                  {preview.objectifs.map((o: string, i: number) => <li key={i}>• {o}</li>)}
                </ul>
              </div>
            )}
            {preview.chapitres?.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">Chapitres</p>
                <div className="space-y-2">
                  {preview.chapitres.map((c: any) => (
                    <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-sm font-bold text-white">{c.titre}</p>
                      {c.contenu && <p className="mt-1 text-xs text-slate-400">{c.contenu}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {preview.supports && <p className="text-sm text-slate-300"><b className="text-cyan-300">Supports :</b> {preview.supports}</p>}
            {preview.infosSupp && <p className="text-sm text-slate-300"><b className="text-cyan-300">Infos :</b> {preview.infosSupp}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- emploi du temps ---------- */
export function MySchedule() {
  const { db, user } = useStore();
  const items = scheduleFor(db, user);

  return (
    <div>
      <PageHead title="Mon emploi du temps" subtitle="Vos sessions uniquement" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((day) => {
          const dayItems = items.filter((i) => i.jour === day).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
          return (
            <Card key={day} className="p-4">
              <div className="mb-3 flex items-center gap-2 border-b border-white/5 pb-2">
                <CalendarDays size={15} className="text-cyan-300" />
                <h4 className="font-display text-sm font-bold text-white">{day}</h4>
              </div>
              {dayItems.length === 0 ? <p className="py-3 text-center text-xs text-slate-600">Libre</p> : (
                <div className="space-y-2">
                  {dayItems.map((i) => (
                    <div key={i.id} className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
                      <p className="font-mono text-xs font-bold text-white">{i.heureDebut} — {i.heureFin}</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-200">{db.modules.find((m) => m.id === i.moduleId)?.titre}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={11} /> {i.salle} • {db.teachers.find((t) => t.id === i.teacherId)?.prenom} {db.teachers.find((t) => t.id === i.teacherId)?.nom}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- cours + tests ---------- */
export function MyCourses() {
  const { db, user, update, log } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const courses = db.courses.filter((c) => studentCanSeeCourse(db, student.id, c));
  const tests = db.tests.filter((t) => student.modules.includes(t.moduleId));

  const track = (course: any, _f: any, action: "ouvert" | "telecharge") => {
    update((d) => ({
      ...d,
      fileActivities: [{ id: uid("FA"), courseId: course.id, courseTitre: course.titre, userId: user!.id, userName: user!.name, action, date: today(), heure: new Date().toTimeString().slice(0, 5) }, ...d.fileActivities],
    }));
  };
  const [taking, setTaking] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ note: number; pct: number } | null>(null);
  const [reviewing, setReviewing] = useState<{ test: Test; result: any } | null>(null);

  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "—";

  const submitTest = () => {
    if (!taking) return;
    let pts = 0, total = 0;
    taking.questions.forEach((q) => {
      total += q.points;
      const a = (answers[q.id] ?? "").trim().toLowerCase();
      const good = q.bonneReponse.trim().toLowerCase();
      if (q.type === "qcm" || q.type === "vf") { if (a === good) pts += q.points; }
      else if (a && (a === good || good.includes(a) || a.includes(good))) pts += q.points;
    });
    const bareme = taking.bareme ?? 20;
    const note = Math.round((pts / Math.max(1, total)) * bareme * 10) / 10;
    const pct = Math.round((pts / Math.max(1, total)) * 100);
    const seuil = bareme / 2;
    update((d) => ({ ...d, results: [{ id: uid("RES"), testId: taking.id, studentId: student.id, note, pourcentage: pct, date: today(), heure: new Date().toTimeString().slice(0, 5), reponses: { ...answers }, valide: !taking.validationRequise, statut: note >= seuil ? "reussi" : "echoue" }, ...d.results] }));
    log(`Test passé par ${student.prenom} ${student.nom} : ${note}/${bareme}`);
    setResult({ note, pct });
  };

  return (
    <div>
      <PageHead title="Mes cours & tests" subtitle="Supports pédagogiques et évaluations" />
      <h3 className="font-display mb-3 text-lg font-bold text-white">📚 Cours et supports</h3>
      {courses.length === 0 ? (
        <Empty icon={<FileText size={40} />} title="Aucun cours publié pour vos modules" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="p-5" glow="cyan">
              <div className="mb-2 flex items-center justify-between">
                <Badge color={c.type === "cours" ? "cyan" : c.type === "devoir" ? "gold" : "green"}>{c.type}</Badge>
                <span className="text-[10px] text-slate-500">{c.date}</span>
              </div>
              <h4 className="font-display text-base font-bold text-white">{c.titre}</h4>
              <p className="mt-1 text-sm text-slate-400">{c.description}</p>
              <p className="mt-2 text-xs text-slate-500">{modName(c.moduleId)}</p>
              {c.content && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-3 font-mono text-[11px] text-slate-400">{c.content}</p>}
              {(c.files ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(c.files ?? []).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-200">
                        <FileText size={12} className="shrink-0 text-cyan-300" />
                        <span className="truncate font-semibold">{f.originalName}</span>
                        <span className="shrink-0 text-slate-500">· {fileKind(f.mime, f.originalName)} · {humanSize(f.size)}</span>
                      </span>
                      <div className="flex shrink-0 gap-1">
                        {f.mime?.startsWith("image/") && <a href={f.dataUrl} target="_blank" rel="noreferrer" className="rounded border border-white/10 px-2 py-0.5 text-cyan-300 hover:bg-white/5">Voir</a>}
                        <button onClick={() => { track(c, f, "telecharge"); downloadFile(f); }} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-300 hover:bg-cyan-400/10">Télécharger</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <h3 className="font-display mb-3 mt-8 text-lg font-bold text-white">🧪 Tests à passer</h3>
      {tests.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun test disponible pour le moment.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((t) => {
            const attempts = db.results.filter((r) => r.testId === t.id && r.studentId === student.id);
            const done = attempts[0];
            const maxAtt = t.tentatives ?? 1;
            const canRetry = attempts.length < maxAtt;
            const bareme = t.bareme ?? 20;
            const seuil = bareme / 2;
            const visible = done && (done.valide || !t.validationRequise);
            return (
              <Card key={t.id} className="p-5" glow="red">
                <div className="flex items-center justify-between">
                  <Badge color="red">Test</Badge>
                  <div className="flex gap-1.5">
                    {t.difficulte && <Badge color={t.difficulte === "difficile" ? "red" : t.difficulte === "moyen" ? "gold" : "green"}>{t.difficulte}</Badge>}
                    {done && (visible ? <Badge color={done.note >= seuil ? "green" : "red"}>{done.note}/{bareme}</Badge> : <Badge color="gold">En attente</Badge>)}
                  </div>
                </div>
                <h4 className="font-display mt-2 text-base font-bold text-white">{t.titre}</h4>
                <p className="mt-1 text-xs text-slate-400">{modName(t.moduleId)}</p>
                <p className="mt-2 text-xs text-slate-500">{t.questions.length} questions • {t.duree} min • /{bareme} pts</p>
                <p className="mt-0.5 text-[11px] text-slate-600">Tentatives : {attempts.length}/{maxAtt}</p>
                <div className="mt-4 flex gap-2">
                  <Btn className="flex-1" variant={canRetry ? "red" : "outline"} disabled={!canRetry}
                    onClick={() => { setTaking(t); setAnswers({}); setResult(null); }}>
                    <PlayCircle size={15} /> {attempts.length === 0 ? "Passer le test" : canRetry ? "Retenter" : "Terminé"}
                  </Btn>
                  {done && visible && t.afficherCorrections && (
                    <Btn variant="ghost" onClick={() => setReviewing({ test: t, result: done })}><Eye size={15} /></Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!taking} onClose={() => setTaking(null)} title={taking?.titre ?? "Test"} wide>
        {taking && (
          <div className="space-y-4">
            {result ? (
              <div className="py-8 text-center">
                <div className={cn("mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-2", result.note >= 10 ? "border-emerald-400/60 bg-emerald-400/10" : "border-red-500/60 bg-red-500/10")}>
                  <span className="font-display text-2xl font-black text-white">{result.note}<span className="text-sm text-slate-400">/20</span></span>
                </div>
                <p className="text-sm text-slate-300">Réussite : <b className="text-cyan-300">{result.pct}%</b></p>
                <p className="mt-1 text-xs text-slate-500">{result.note >= 10 ? "Félicitations, vous avez réussi ce test !" : "Continuez vos efforts, vous pouvez retenter plus tard."}</p>
                <Btn className="mt-6" onClick={() => setTaking(null)}>Fermer</Btn>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{taking.questions.length} questions • {taking.duree} minutes • Note sur 20</p>
                {taking.questions.map((q, i) => (
                  <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm font-bold text-white">{i + 1}. {q.question} <span className="text-xs font-normal text-slate-500">({q.points} pts)</span></p>
                    {q.type === "qcm" || q.type === "vf" ? (
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {(q.options ?? []).map((o) => (
                          <button key={o} onClick={() => setAnswers({ ...answers, [q.id]: o })}
                            className={cn("rounded-lg border px-3 py-2 text-left text-sm transition-all",
                              answers[q.id] === o ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-300 hover:bg-white/5")}>
                            {o}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Input className="mt-2" placeholder="Votre réponse..." value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    )}
                  </div>
                ))}
                <Btn variant="red" className="w-full py-3" onClick={submitTest} disabled={Object.keys(answers).length < taking.questions.length}>
                  <CheckCircle2 size={16} /> Valider mes réponses
                </Btn>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Consultation des réponses / corrections */}
      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title={reviewing ? `Correction — ${reviewing.test.titre}` : ""} wide>
        {reviewing && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={reviewing.result.note >= (reviewing.test.bareme ?? 20) / 2 ? "green" : "red"}>Score : {reviewing.result.note}/{reviewing.test.bareme ?? 20}</Badge>
              <Badge color="cyan">Réussite : {reviewing.result.pourcentage}%</Badge>
              <Badge color="gray">{reviewing.result.date}{reviewing.result.heure ? ` à ${reviewing.result.heure}` : ""}</Badge>
            </div>
            {reviewing.test.questions.map((q, i) => {
              const mine = reviewing.result.reponses?.[q.id] ?? "—";
              const ok = mine.trim().toLowerCase() === q.bonneReponse.trim().toLowerCase();
              return (
                <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-bold text-white">{i + 1}. {q.question}</p>
                  <p className={cn("mt-2 flex items-center gap-1.5 text-sm", ok ? "text-emerald-300" : "text-red-400")}>
                    {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Votre réponse : <b>{mine}</b>
                  </p>
                  {!ok && <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-300"><CheckCircle2 size={14} /> Bonne réponse : <b>{q.bonneReponse}</b></p>}
                  {q.explication && <p className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2.5 text-xs text-slate-300"><b className="text-cyan-300">Explication :</b> {q.explication}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- documents ---------- */
export function MyDocuments() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const docs = db.courses.filter((c) => c.type !== "cours" && studentCanSeeCourse(db, student.id, c));
  return (
    <div>
      <PageHead title="Mes documents" subtitle="Devoirs et supports téléchargeables" />
      {docs.length === 0 ? (
        <Empty icon={<FileText size={40} />} title="Aucun document" sub="Les devoirs et documents publiés par vos formateurs apparaîtront ici." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docs.map((c) => (
            <Card key={c.id} className="p-5" glow="green">
              <Badge color={c.type === "devoir" ? "gold" : "green"}>{c.type}</Badge>
              <h4 className="font-display mt-2 text-base font-bold text-white">{c.titre}</h4>
              {c.description && <p className="mt-1 text-sm text-slate-400">{c.description}</p>}
              <p className="mt-2 text-[11px] text-slate-500">{db.modules.find((m) => m.id === c.moduleId)?.titre} • {c.date}</p>
              {c.content && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-3 font-mono text-[11px] text-slate-400">{c.content}</p>}
              {(c.files ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(c.files ?? []).map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-1.5 text-[11px]">
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-200">
                        <FileText size={12} className="shrink-0 text-emerald-300" />
                        <span className="truncate font-semibold">{f.originalName}</span>
                        <span className="shrink-0 text-slate-500">· {fileKind(f.mime, f.originalName)} · {humanSize(f.size)}</span>
                      </span>
                      <div className="flex shrink-0 gap-1">
                        {f.mime?.startsWith("image/") && <a href={f.dataUrl} target="_blank" rel="noreferrer" className="rounded border border-white/10 px-2 py-0.5 text-emerald-300 hover:bg-white/5">Voir</a>}
                        <button onClick={() => downloadFile(f)} className="rounded border border-emerald-400/40 px-2 py-0.5 text-emerald-300 hover:bg-emerald-400/10">Télécharger</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- présences ---------- */
export function MyAttendance() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const att = db.attendance.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date));
  const present = att.filter((a) => a.statut === "present").length;

  return (
    <div>
      <PageHead title="Mes présences" subtitle="Historique complet" />
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Stat icon={<CheckCircle2 size={20} />} label="Présences" value={present} color="green" />
        <Stat icon={<Timer size={20} />} label="Retards" value={att.filter((a) => a.statut === "retard").length} color="gold" />
        <Stat icon={<XCircle size={20} />} label="Absences" value={att.filter((a) => a.statut === "absent").length} color="red" />
      </div>
      {att.length === 0 ? (
        <Empty icon={<ClipboardCheck size={40} />} title="Aucun enregistrement" sub="Vos présences seront enregistrées par l'enseignant via votre QR Code." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Heure</th><th className="px-4 py-3">Salle</th><th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {att.map((a) => (
                <tr key={a.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-sm text-slate-300">{a.date}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{db.modules.find((m) => m.id === a.moduleId)?.titre ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.heure}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.salle}</td>
                  <td className="px-4 py-3">
                    <Badge color={a.statut === "present" ? "green" : a.statut === "retard" ? "gold" : "red"}>{a.statut}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ---------- notes ---------- */
export function MyGrades() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const grades = db.grades.filter((g) => g.studentId === student.id);
  const results = db.results.filter((r) => r.studentId === student.id);
  const avg = grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(1) : "—";
  const avgTest = results.length ? (results.reduce((a, r) => a + r.note, 0) / results.length).toFixed(1) : "—";

  return (
    <div>
      <PageHead title="Mes notes" subtitle="Évaluations et résultats" />
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<PenLine size={20} />} label="Moyenne modules" value={avg} color="cyan" />
        <Stat icon={<TestTube2 size={20} />} label="Moyenne tests" value={avgTest} color="gold" />
        <Stat icon={<Award size={20} />} label="Tests passés" value={results.length} color="green" />
        <Stat icon={<CheckCircle2 size={20} />} label="Modules notés" value={grades.length} color="blue" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Notes par module</h3>
          {grades.length === 0 ? <p className="text-sm text-slate-500">Aucune note publiée.</p> : (
            <div className="space-y-2">
              {grades.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-sm font-bold text-slate-200">{db.modules.find((m) => m.id === g.moduleId)?.titre}</p>
                    <p className="text-[11px] text-slate-500">{g.appreciation} • {g.date}</p>
                  </div>
                  <Badge color={g.note >= 10 ? "green" : "red"}>{g.note}/20</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Résultats des tests</h3>
          {results.length === 0 ? <p className="text-sm text-slate-500">Aucun test passé.</p> : (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-sm font-bold text-slate-200">{db.tests.find((t) => t.id === r.testId)?.titre ?? "Test"}</p>
                    <p className="text-[11px] text-slate-500">Réussite {r.pourcentage}% • {r.date}</p>
                  </div>
                  <Badge color={r.note >= 10 ? "green" : "red"}>{r.note}/20</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- paiements ---------- */
export function MyPayments() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const summary = financialSummary(db, student.id);
  const payments = [...summary.payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? "")));

  const receipt = (p: any) => {
    printHTML(`Reçu ${p.reference ?? p.id}`, `
      <div class="receipt">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><h1 class="accent">SENTINELLES NUMÉRIQUES</h1><p>Centre de Formation — Génie Info & Industriel</p></div>
          <div style="text-align:right"><p class="label">Reçu N°</p><p class="font-mono">${p.reference ?? p.id}</p></div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <div class="grid">
          <div><p class="label">Apprenant</p><p style="font-weight:700">${student.prenom} ${student.nom} (${student.id})</p></div>
          <div><p class="label">Date</p><p>${p.date}${p.heure ? " à " + p.heure : ""}</p></div>
          <div><p class="label">Libellé</p><p>${p.libelle}</p></div>
          <div><p class="label">Mode</p><p>${p.mode}</p></div>
          ${p.createdByName ? `<div><p class="label">Encaissé par</p><p>${p.createdByName}</p></div>` : ""}
        </div>
        <div class="row" style="margin-top:16px"><span>Montant encaissé</span><span class="gold" style="font-size:20px;font-weight:800">${money(p.montant)}</span></div>
        <div class="row"><span>Total payé</span><span class="green">${money(summary.totalPaye)}</span></div>
        <div class="row"><span>Solde restant</span><span>${money(summary.solde)}</span></div>
        <p style="margin-top:24px;text-align:center" class="label">SENTINELLES NUMÉRIQUES</p>
      </div>`);
  };

  const inscriptionInv = summary.invoices.find((i) => i.type === "inscription" || i.libelle.toLowerCase().includes("inscription"));
  const inscPaid = inscriptionInv ? db.payments.filter((p) => p.invoiceId === inscriptionInv.id || p.type === "inscription").reduce((a, p) => a + p.montant, 0) : 0;
  const inscRest = inscriptionInv ? Math.max(0, inscriptionInv.montant - inscPaid) : 0;
  const inscStatus = !inscriptionInv ? "paye" : inscRest === 0 ? "paye" : inscPaid > 0 ? "partiel" : "impaye";

  const nextSchedule = (summary.schedules || []).find((s) => s.status !== "paye" && s.paidAmount < s.amount);

  return (
    <div className="space-y-6">
      <PageHead title="Mes paiements" subtitle="Suivi transparent et gestion financière de votre formation" />

      {/* BLOC 3 — SYNTHÈSE FINANCIÈRE GLOBALE */}
      <div className="rounded-2xl border border-white/10 bg-[#081021]/80 p-5">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <span>📊 Synthèse financière globale</span>
          </h3>
          {nextSchedule && (
            <span className="text-xs text-amber-300 font-medium">
              Prochaine échéance : <b>{nextSchedule.label}</b> avant le <b>{nextSchedule.dueDate}</b>
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total formation</p>
            <p className="font-display text-2xl font-black text-white">{money(summary.totalDu)}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total payé</p>
            <p className="font-display text-2xl font-black text-emerald-300">{money(summary.totalPaye)}</p>
          </div>
          <div className={cn("rounded-xl border p-4", summary.solde === 0 ? "border-emerald-400/25 bg-emerald-400/5" : "border-amber-400/25 bg-amber-400/5")}>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Solde restant</p>
            <p className={cn("font-display text-2xl font-black", summary.solde === 0 ? "text-emerald-300" : "text-amber-300")}>{money(summary.solde)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Statut financier</p>
            <p className="mt-1"><Badge color={summary.statut === "paye" ? "green" : summary.statut === "partiel" ? "gold" : "red"}>{statusLabel(summary.statut)}</Badge></p>
          </div>
        </div>
      </div>

      {/* BLOC 1 — FRAIS D'INSCRIPTION */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-amber-300 flex items-center gap-2">
              <span>📝 Bloc 1 — Frais d'inscription</span>
            </h3>
            <p className="text-xs text-slate-400">Frais obligatoires d'ouverture de dossier et badge apprenant</p>
          </div>
          <Badge color={inscStatus === "paye" ? "green" : inscStatus === "partiel" ? "gold" : "red"}>
            {inscStatus === "paye" ? "Payé ✓" : inscStatus === "partiel" ? "Partiellement payé" : "À payer"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-4 text-sm">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase text-slate-500">Montant d'inscription</p>
            <p className="font-display text-lg font-bold text-white">{money(inscriptionInv?.montant || 5000)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase text-slate-500">Montant réglé</p>
            <p className="font-display text-lg font-bold text-emerald-300">{money(inscPaid)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase text-slate-500">Reste à payer</p>
            <p className={cn("font-display text-lg font-bold", inscRest === 0 ? "text-emerald-300" : "text-amber-300")}>{money(inscRest)}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase text-slate-500">Date d'inscription</p>
            <p className="font-bold text-slate-200">{student.dateInscription || "—"}</p>
          </div>
        </div>
      </Card>

      {/* BLOC 2 — FRAIS DE FORMATION & ÉCHÉANCIER EN 2 TRANCHES */}
      <div className="rounded-2xl border border-cyan-400/20 bg-[#081021]/80 p-5">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-cyan-300 flex items-center gap-2">
              <span>📅 Bloc 2 — Frais de formation (Échéancier en 2 tranches)</span>
            </h3>
            <p className="text-xs text-slate-400">Paiement échelonné sur 3 mois : Tranche 1 (inscription) et Tranche 2 (J+30)</p>
          </div>
          <Badge color="cyan">Formation 3 mois</Badge>
        </div>

        {summary.schedules && summary.schedules.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {summary.schedules.map((sch) => {
              const isPaid = sch.status === "paye" || sch.paidAmount >= sch.amount;
              const isLate = sch.status === "retard" || (!isPaid && sch.dueDate < today());
              const remaining = Math.max(0, sch.amount - sch.paidAmount);
              return (
                <div
                  key={sch.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    isPaid
                      ? "border-emerald-400/30 bg-emerald-950/20"
                      : isLate
                      ? "border-red-400/30 bg-red-950/20"
                      : "border-cyan-400/20 bg-cyan-950/10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm text-white">{sch.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Date limite : <span className={cn(isLate && !isPaid ? "text-red-400 font-bold" : "text-slate-300")}>{sch.dueDate}</span>
                      </p>
                    </div>
                    <Badge color={isPaid ? "green" : isLate ? "red" : "cyan"}>
                      {isPaid ? "Réglé ✓" : isLate ? "En retard" : "En attente"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex justify-between items-baseline border-t border-white/5 pt-2 text-xs">
                    <span className="text-slate-400">Montant dû : <b className="text-white">{money(sch.amount)}</b></span>
                    <span className={cn("font-bold", isPaid ? "text-emerald-300" : "text-amber-300")}>
                      {isPaid ? "Payé en totalité ✓" : `Reste : ${money(remaining)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-slate-400">
            Aucun échéancier généré pour le moment. Votre dossier est en cours de validation par l'administration.
          </div>
        )}
      </div>

      {summary.invoices.length > 0 && (
        <>
          <h3 className="font-display mb-2 text-sm font-bold text-white">Mes factures</h3>
          <Card className="mb-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Libellé</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Payé</th><th className="px-4 py-3">Reste</th>
                </tr>
              </thead>
              <tbody>
                {summary.invoices.map((i) => {
                  const paid = db.payments.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + p.montant, 0);
                  const rest = Math.max(0, i.montant - paid);
                  return (
                    <tr key={i.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-200">{i.libelle}</td>
                      <td className="px-4 py-3 font-mono text-white">{money(i.montant)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-300">{money(paid)}</td>
                      <td className="px-4 py-3 font-mono">{rest === 0 ? <Badge color="green">Soldé</Badge> : <span className="text-amber-300">{money(rest)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <h3 className="font-display mb-2 text-sm font-bold text-white">Historique des paiements</h3>
      {payments.length === 0 ? (
        <Empty icon={<Wallet size={40} />} title="Aucun paiement enregistré" sub={`Pour toute question, contactez : ${db.settings.infos.whatsapp.join(" / ") || "—"}`} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Réf.</th><th className="px-4 py-3">Libellé</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Date / heure</th><th className="px-4 py-3 text-right">Reçu</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-300">{p.reference ?? p.id}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-200">{p.libelle}</td>
                  <td className="px-4 py-3 font-mono text-sm text-white">{money(p.montant)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{p.mode}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{p.date}{p.heure ? ` • ${p.heure}` : ""}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => receipt(p)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"><ReceiptText size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ---------- certificat ---------- */
export function MyCertificate() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const cert = db.certificates.find((c) => c.studentId === student.id);

  if (!cert) {
    return (
      <div>
        <PageHead title="Mon certificat" />
        <Empty icon={<Award size={40} />} title="Certificat non disponible" sub="Votre certificat sera émis après le test final de fin de formation." />
      </div>
    );
  }

  const mods = db.modules.filter((m) => (cert.modules ?? []).includes(m.id));
  const print = () => {
    printHTML(`Certificat ${cert.numero}`, `
      <div class="receipt" style="text-align:center">
        <p class="accent" style="letter-spacing:4px;font-size:12px">SENTINELLES NUMÉRIQUES</p>
        <p class="label">Centre de Formation en Génie Informatique & Génie Industriel</p>
        <div style="margin:24px 0"><h1 style="font-size:40px;letter-spacing:6px">CERTIFICAT</h1><p class="label">de formation professionnelle</p></div>
        <p class="label">Décerné à</p>
        <h2 style="font-size:28px;color:#FFB300;margin:8px 0">${student.prenom} ${student.nom}</h2>
        <p class="label">N° ${student.id} • ${formationLabel(cert.formation)}</p>
        <p style="margin:20px auto;max-width:520px">pour avoir suivi avec succès la formation de <b>${formationLabel(cert.formation)}</b> du ${cert.periode}.</p>
        <div class="row" style="max-width:420px;margin:0 auto"><span>Résultat</span><span class="green">${cert.resultat} — ${cert.note}/20</span></div>
        <div style="margin-top:32px;display:flex;justify-content:space-between;align-items:end">
          <div style="text-align:center"><p style="border-top:1px solid #00E5FF;padding-top:6px;font-size:11px">Coach Fredich FOUNDOU<br>Responsable du Centre</p></div>
          <div style="text-align:center"><p class="font-mono" style="font-size:12px">${cert.numero}</p><p class="label">Certificat vérifiable</p></div>
        </div>
      </div>`);
  };

  return (
    <div>
      <PageHead title="Mon certificat" subtitle="Certification des délibérés par ENIA 2.0"
        actions={<Btn onClick={print}><Printer size={16} /> Imprimer</Btn>} />
      <div id="print-area" className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-[#0A1224] to-[#120d1f] p-8 text-center">
        <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10">
            <ShieldCheck size={22} className="text-cyan-300" />
          </div>
          <p className="font-display text-sm font-black tracking-[0.3em] text-cyan-300">SENTINELLES NUMÉRIQUES</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Centre de Formation en Génie Informatique & Génie Industriel</p>
          <h2 className="font-display mt-6 text-4xl font-black tracking-[0.2em] text-white">CERTIFICAT</h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">de formation professionnelle</p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-slate-500">Décerné à</p>
          <p className="font-display mt-1 text-3xl font-black text-amber-300 drop-shadow-[0_0_16px_rgba(255,179,0,0.4)]">{student.prenom} {student.nom}</p>
          <p className="mt-1 font-mono text-xs text-cyan-300/70">N° {student.id} • {formationLabel(cert.formation)}</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-300">pour avoir suivi avec succès la formation de <b className="text-white">{formationLabel(cert.formation)}</b> du {cert.periode}.</p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
            {mods.map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300">{m.numero}. {m.titre}</span>)}
          </div>
          <div className="mx-auto mt-5 flex max-w-md items-center justify-between border-t border-amber-400/20 pt-4">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Résultat</p>
              <p className="font-bold text-emerald-300">{cert.resultat} — {cert.note}/20</p>
            </div>
            <div className="rounded-lg bg-white p-1"><QRCodeSVG value={`CERT|${cert.numero}|${student.id}`} size={64} /></div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">N° certificat</p>
              <p className="font-mono text-[11px] text-cyan-300">{cert.numero}</p>
            </div>
          </div>
          <p className="mt-5 text-[11px] text-slate-500">Signature : Coach Fredich FOUNDOU — Responsable du Centre</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- bourse ---------- */
const BOURSE_FLOW = [
  { k: "en_attente", l: "En attente", d: "Votre dossier est en cours d'examen." },
  { k: "test_programme", l: "Test programmé", d: "Le test final de fin de formation est planifié." },
  { k: "test_effectue", l: "Test effectué", d: "Votre test a été enregistré." },
  { k: "admis", l: "Admis", d: "Félicitations ! Vous êtes admissible à la bourse." },
  { k: "bourse_attribuee", l: "Bourse attribuée", d: "🎉 Bourse de 3 ans d'études 100% gratuite à ENIA 2.0 !" },
];

export function MyScholarship() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user!.id)!;
  const b = db.scholarships.find((x) => x.studentId === student.id);
  const cur = b?.statut ?? "en_attente";
  const idx = BOURSE_FLOW.findIndex((x) => x.k === cur);

  return (
    <div>
      <PageHead title="Ma bourse — MON AVENIR" subtitle="3 ans d'études 100% gratuites à ENIA 2.0" />
      <Card className="mb-6 flex items-center gap-4 border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-transparent to-transparent p-5">
        <BadgeDollarSign size={30} className="shrink-0 text-amber-300" />
        <p className="text-sm text-slate-300">
          Les apprenants qui réussissent le <b className="text-white">test final</b> bénéficient d'une <b className="text-amber-300">bourse d'études de 3 ans à ENIA 2.0</b>, 100% gratuite.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <h3 className="font-display mb-5 text-sm font-bold text-white">Parcours de votre dossier</h3>
          <div className="space-y-1">
            {BOURSE_FLOW.map((s, i) => {
              const done = i <= idx;
              const current = i === idx;
              return (
                <div key={s.k} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black",
                      done ? "border-amber-400/60 bg-amber-400/15 text-amber-300" : "border-white/10 text-slate-600")}>
                      {done ? <CheckCircle2 size={15} /> : i + 1}
                    </div>
                    {i < BOURSE_FLOW.length - 1 && <div className={cn("h-6 w-0.5", done ? "bg-amber-400/40" : "bg-white/10")} />}
                  </div>
                  <div className={cn("mb-4 rounded-xl border p-3.5", current ? "border-amber-400/50 bg-amber-400/10" : "border-white/5 bg-white/[0.02]")}>
                    <p className={cn("text-sm font-bold", done ? "text-amber-300" : "text-slate-400")}>{s.l}</p>
                    <p className="text-xs text-slate-400">{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6 text-center" glow="gold">
            <BadgeDollarSign size={36} className="mx-auto text-amber-300" />
            <p className="font-display mt-3 text-2xl font-black text-white">3 ANS D'ÉTUDES</p>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">100% gratuites à ENIA 2.0</p>
            <div className="mt-4">
              <Badge color={cur === "bourse_attribuee" ? "green" : cur === "admis" ? "gold" : "gray"} className="text-xs">
                Statut : {BOURSE_FLOW.find((x) => x.k === cur)?.l}
              </Badge>
            </div>
          </Card>
          <Card className="p-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Vos coordonnées</h4>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="flex items-center gap-2"><Mail size={14} className="text-cyan-300" /> {student.email || "—"}</p>
              <p className="flex items-center gap-2"><Phone size={14} className="text-emerald-300" /> {student.telephone}</p>
              <p className="flex items-center gap-2"><UserCircle2 size={14} className="text-blue-400" /> {student.id}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
