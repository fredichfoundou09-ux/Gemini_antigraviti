import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, ClipboardCheck, Download, FileText,
  GraduationCap, Search, ShieldCheck, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Empty, Input, PageHead, Stat, Badge, Btn, moduleIcon, formationLabel } from "@/lib/ui";
import { cn } from "@/utils/cn";
import { exportCsv, exportJsonAsExcel } from "@/lib/export";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getPartnerDashboard, getPartnerStudents } from "@/lib/supabase/partner";

function ReadOnlyBanner() {
  return (
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3 text-xs font-semibold text-cyan-200">
      <ShieldCheck size={14} className="mr-1 inline" /> Accès partenaire : lecture seule. Les actions Ajouter, Modifier, Supprimer, Valider et Réinitialiser sont désactivées côté interface et refusées par RLS.
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = "Rechercher..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9 text-xs" />
    </div>
  );
}

export function PartnerDashboard() {
  const { db } = useStore();
  const [counts, setCounts] = useState<any>(null);

  useEffect(() => {
    if (isSupabaseConfigured) {
      getPartnerDashboard().then(setCounts).catch(() => {});
    }
  }, []);

  const presenceTotal = db.attendance.length || 1;
  const present = db.attendance.filter((a) => a.statut === "present").length;
  const presenceRate = Math.round((present / presenceTotal) * 100);

  const studentCount = counts?.students ?? db.students.length;
  const teacherCount = counts?.teachers ?? db.teachers.length;
  const moduleCount = counts?.modules ?? db.modules.length;

  return (
    <div className="space-y-5">
      <PageHead title="Dashboard Partenaire" subtitle="Indicateurs institutionnels autorisés" />
      <ReadOnlyBanner />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Users size={20} />} label="Apprenants" value={studentCount} color="cyan" />
        <Stat icon={<GraduationCap size={20} />} label="Enseignants" value={teacherCount} color="blue" />
        <Stat icon={<BookOpen size={20} />} label="Modules" value={moduleCount} color="green" />
        <Stat icon={<ClipboardCheck size={20} />} label="Taux présence" value={`${presenceRate}%`} color="gold" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Activités pédagogiques</h3>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <Info label="Cours publiés" value={counts?.courses ?? db.courses.filter((c) => c.publie !== false).length} />
            <Info label="Tests" value={db.tests.length} />
            <Info label="Certificats" value={counts?.certificates ?? db.certificates.length} />
            <Info label="Bourses" value={counts?.scholarships ?? db.scholarships.length} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Raccourcis</h3>
          <div className="grid grid-cols-2 gap-2">
            <LinkBtn to="/app/partner/formations" label="Formations" />
            <LinkBtn to="/app/partner/apprenants" label="Apprenants" />
            <LinkBtn to="/app/partner/certificats" label="Certificats" />
            <LinkBtn to="/app/partner/rapports" label="Rapports" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function LinkBtn({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs font-bold text-slate-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/5 hover:text-cyan-300">
      <span>{label}</span>
      <span className="text-slate-500">→</span>
    </Link>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="font-display text-lg font-black text-white">{value}</p></div>;
}

export function PartnerStudents() {
  const { db } = useStore();
  const [remoteStudents, setRemoteStudents] = useState<any[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (isSupabaseConfigured) {
      getPartnerStudents().then((data) => {
        if (data && data.length > 0) setRemoteStudents(data);
      }).catch(() => {});
    }
  }, []);

  const sourceStudents = remoteStudents || db.students;
  const rows = sourceStudents.filter((s: any) => `${s.id} ${s.nom} ${s.prenom} ${s.formation || ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <ReadOnlyList title="Apprenants" subtitle="Données partenaires filtrées" q={q} setQ={setQ} onCsv={() => exportCsv("apprenants-partenaire", rows.map((s: any) => ({ id: s.id, nom: s.nom, prenom: s.prenom, formation: s.formation, statut: s.statut })))}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s: any) => <Card key={s.id} className="p-4"><p className="font-display text-sm font-bold text-white">{s.prenom} {s.nom}</p><p className="font-mono text-[10px] text-cyan-300">{s.id}</p><p className="mt-1 text-xs text-slate-400">{formationLabel(s.formation)} · {s.statut}</p><p className="mt-2 text-[11px] text-slate-600">Téléphone, adresse et email masqués (PRIVATE).</p></Card>)}
      </div>
    </ReadOnlyList>
  );
}

export function PartnerTeachers() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.teachers.filter((t) => `${t.id} ${t.nom} ${t.prenom} ${t.specialite}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Enseignants" q={q} setQ={setQ} rows={rows} render={(t) => <><p className="font-display text-sm font-bold text-white">{t.prenom} {t.nom}</p><p className="text-xs text-slate-400">{t.specialite}</p><p className="font-mono text-[10px] text-cyan-300">{t.id}</p></>} />;
}

export function PartnerFormations() { return <PartnerModules formationOnly />; }

export function PartnerModules({ formationOnly = false }: { formationOnly?: boolean }) {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.modules.filter((m) => `${m.titre} ${m.description || ""}`.toLowerCase().includes(q.toLowerCase()));
  const grouped = useMemo(() => ({ informatique: rows.filter((m) => m.formation === "informatique"), industriel: rows.filter((m) => m.formation === "industriel") }), [rows]);
  return (
    <ReadOnlyList title={formationOnly ? "Formations" : "Modules"} subtitle="Catalogue pédagogique autorisé" q={q} setQ={setQ}>
      <div className="space-y-5">
        {(["informatique", "industriel"] as const).map((f) => (
          <div key={f}>
            <h3 className={cn("font-display mb-3 text-sm font-bold", f === "informatique" ? "text-red-400" : "text-cyan-300")}>{formationLabel(f)}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grouped[f].map((m) => <Card key={m.id} className="p-4" glow={f === "informatique" ? "red" : "cyan"}><div className="flex items-center gap-3"><span className="rounded-xl border border-white/10 p-2 text-cyan-300">{moduleIcon(m.icon, "h-4 w-4")}</span><div><p className="font-display text-sm font-bold text-white">{m.numero}. {m.titre}</p><p className="line-clamp-2 text-xs text-slate-400">{m.description || m.notions.join(" · ")}</p></div></div></Card>)}
            </div>
          </div>
        ))}
      </div>
    </ReadOnlyList>
  );
}

export function PartnerSchedule() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.schedule.filter((s) => `${s.jour} ${s.salle} ${db.modules.find((m) => m.id === s.moduleId)?.titre || ""}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Emploi du temps" q={q} setQ={setQ} rows={rows} render={(s) => <><p className="font-display text-sm font-bold text-white">{s.jour} {s.heureDebut}-{s.heureFin}</p><p className="text-xs text-slate-400">{db.modules.find((m) => m.id === s.moduleId)?.titre || "Module"} · {s.salle}</p></>} />;
}

export function PartnerAttendance() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.attendance.filter((a) => `${a.date} ${a.statut}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Présences" q={q} setQ={setQ} rows={rows} render={(a) => <><p className="font-display text-sm font-bold text-white">{a.date}</p><p className="text-xs text-slate-400">{db.modules.find((m) => m.id === a.moduleId)?.titre || "Module"}</p><Badge color={a.statut === "present" ? "green" : a.statut === "retard" ? "gold" : "red"}>{a.statut}</Badge></>} />;
}

export function PartnerCourses() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.courses.filter((c) => c.publie !== false && `${c.titre} ${c.description}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Cours & Supports" q={q} setQ={setQ} rows={rows} render={(c) => <><p className="font-display text-sm font-bold text-white">{c.titre}</p><p className="text-xs text-slate-400">{c.description || c.type}</p><Badge color="cyan">{c.type}</Badge></>} />;
}

export function PartnerTests() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.tests.filter((t) => `${t.titre}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Tests" q={q} setQ={setQ} rows={rows} render={(t) => <><p className="font-display text-sm font-bold text-white">{t.titre}</p><p className="text-xs text-slate-400">{t.questions.length} questions · {t.duree} min</p></>} />;
}

export function PartnerGrades() {
  const { db } = useStore();
  return <ReadOnlyList title="Notes" subtitle="Données restreintes selon la politique du centre"><div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200">Les notes individuelles sont classées RESTRICTED. Seuls les indicateurs agrégés et autorisés peuvent être présentés au partenaire.</div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat icon={<BookOpen size={20}/>} label="Notes enregistrées" value={db.grades.length} color="gold"/><Stat icon={<Users size={20}/>} label="Apprenants notés" value={new Set(db.grades.map(g=>g.studentId)).size} color="cyan"/></div></ReadOnlyList>;
}

export function PartnerCertificates() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.certificates.filter((c) => `${c.numero} ${c.resultat}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Certificats" q={q} setQ={setQ} rows={rows} render={(c) => <><p className="font-mono text-xs text-cyan-300">{c.numero}</p><p className="font-display text-sm font-bold text-white">{c.resultat}</p><p className="text-xs text-slate-400">{c.periode} · {c.date}</p></>} />;
}

export function PartnerScholarships() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.scholarships.filter((s) => `${s.statut}`.toLowerCase().includes(q.toLowerCase()));
  return <ReadOnlyCards title="Bourses" q={q} setQ={setQ} rows={rows} render={(s) => <><p className="font-display text-sm font-bold text-white">{s.statut.replace("_", " ")}</p><p className="text-xs text-slate-400">{s.date}</p></>} />;
}

export function PartnerReports() {
  const { db } = useStore();
  const reports = [
    { categorie: "Pédagogique", indicateur: "Effectif total", valeur: db.students.length },
    { categorie: "Pédagogique", indicateur: "Cours publiés", valeur: db.courses.filter((c) => c.publie !== false).length },
    { categorie: "Institutionnel", indicateur: "Certificats", valeur: db.certificates.length },
    { categorie: "Institutionnel", indicateur: "Bourses", valeur: db.scholarships.length },
    { categorie: "Présence", indicateur: "Présents", valeur: db.attendance.filter((a) => a.statut === "present").length },
    { categorie: "Présence", indicateur: "Absents", valeur: db.attendance.filter((a) => a.statut === "absent").length },
  ];
  return <ReadOnlyList title="Rapports" subtitle="Exports autorisés"><div className="flex flex-wrap gap-2"><Btn variant="outline" onClick={() => exportCsv("rapport-partenaire", reports)}><Download size={14}/> CSV</Btn><Btn variant="outline" onClick={() => exportJsonAsExcel("rapport-partenaire", reports)}><Download size={14}/> Excel</Btn></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reports.map((r,i)=><Card key={i} className="p-4"><p className="text-xs text-slate-500">{r.categorie}</p><p className="font-display text-sm font-bold text-white">{r.indicateur}</p><p className="mt-1 text-2xl font-black text-cyan-300">{r.valeur}</p></Card>)}</div></ReadOnlyList>;
}

export function PartnerProfile() {
  const { user } = useStore();
  return <ReadOnlyList title="Profil partenaire" subtitle="Informations de connexion"><Card className="p-5"><p className="font-display text-lg font-bold text-white">{user?.name}</p><p className="font-mono text-xs text-cyan-300">{user?.username}</p><p className="mt-2 text-sm text-slate-400">Rôle : {user?.role}</p></Card></ReadOnlyList>;
}

function ReadOnlyList({ title, subtitle, q, setQ, children, onCsv }: { title: string; subtitle?: string; q?: string; setQ?: (v: string) => void; children: ReactNode; onCsv?: () => void }) {
  return <div className="space-y-5"><PageHead title={title} subtitle={subtitle || "Consultation partenaire en lecture seule"} actions={<div className="flex gap-2">{setQ && <SearchBox value={q || ""} onChange={setQ} />}{onCsv && <Btn variant="outline" onClick={onCsv}><Download size={14}/> Export CSV</Btn>}</div>} /><ReadOnlyBanner />{children}</div>;
}

function ReadOnlyCards({ title, q, setQ, rows, render }: { title: string; q: string; setQ: (v: string) => void; rows: any[]; render: (row: any) => React.ReactNode }) {
  return <ReadOnlyList title={title} q={q} setQ={setQ}>{rows.length === 0 ? <Empty icon={<FileText size={40}/>} title="Aucune donnée autorisée" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row, i) => <Card key={row.id || i} className="p-4">{render(row)}</Card>)}</div>}</ReadOnlyList>;
}
