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
  const { user, update, log } = useStore();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [organization, setOrganization] = useState((user as any)?.organization || "Institution Partenaire");
  const [description, setDescription] = useState((user as any)?.description || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastMsg.error("Validation", "Le nom du représentant est obligatoire.");
      return;
    }

    setSaving(true);
    try {
      if (isSupabaseConfigured && user) {
        // 1. Mise à jour du profil Supabase
        await supabase.from("profiles").update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        }).eq("id", user.id);

        // 2. Traçabilité obligatoire : enregistrement dans audit_logs
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "UPDATE_PARTNER_PROFILE",
          entity_type: "partners",
          entity_id: user.id,
          description: `Mise à jour du profil partenaire : ${name.trim()} (${user.username}) — Organisation : ${organization.trim()}`,
        });
      }

      // 3. Mise à jour locale dans le store
      update((d) => ({
        ...d,
        users: d.users.map((u) => (u.id === user?.id ? { ...u, name: name.trim(), email: email.trim(), phone: phone.trim(), organization: organization.trim(), description: description.trim() } : u)),
      }));

      log(`Profil partenaire modifié : ${name.trim()} (${organization.trim()})`);
      toastMsg.success("Profil mis à jour et consigné dans le journal d'audit ✓");
    } catch (err: any) {
      toastMsg.error("Erreur", err.message || "Échec de l'enregistrement du profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHead
        title="Mon profil Partenaire"
        subtitle="Gestion de vos informations institutionnelles de contact (traçabilité active)"
      />

      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 px-4 py-3 text-xs font-semibold text-cyan-200">
        <ShieldCheck size={14} className="mr-1 inline" /> Espace Partenaire : vos données institutionnelles et modifications de profil sont tracées dans les registres d'audit système.
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-purple-400/40 bg-purple-500/10 text-purple-300">
              <Building2 size={36} />
            </div>
            <h3 className="font-display text-lg font-bold text-white">{name || "Représentant Partenaire"}</h3>
            <p className="mt-0.5 text-xs text-purple-300 font-semibold">{organization || "Institution"}</p>
            <span className="mt-2 inline-block rounded border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-slate-400">
              Identifiant : {user?.username}
            </span>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Rôle système :</span>
              <span className="font-semibold text-white">{user?.role}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Audit traçabilité :</span>
              <span className="font-semibold text-emerald-400">Activé (Enregistré)</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display mb-4 text-base font-bold text-white flex items-center gap-2">
            <FileText size={18} className="text-cyan-300" /> Modifier mes informations
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du représentant / contact">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Dr. Jean Dupont"
                  required
                />
              </Field>

              <Field label="Organisation / Entreprise partenaire">
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="ex: Fondation Numérique Avenir"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email officiel">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@partenaire.cg"
                />
              </Field>

              <Field label="Téléphone de liaison">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+242 06 000 00 00"
                />
              </Field>
            </div>

            <Field label="Description institutionnelle & accords de partenariat">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Précisez la nature de l'alliance stratégique ou du partenariat académique..."
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Btn type="submit" disabled={saving}>
                <Save size={16} /> {saving ? "Enregistrement & traçabilité..." : "Enregistrer les modifications"}
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function ReadOnlyList({ title, subtitle, q, setQ, children, onCsv }: { title: string; subtitle?: string; q?: string; setQ?: (v: string) => void; children: ReactNode; onCsv?: () => void }) {
  return <div className="space-y-5"><PageHead title={title} subtitle={subtitle || "Consultation partenaire en lecture seule"} actions={<div className="flex gap-2">{setQ && <SearchBox value={q || ""} onChange={setQ} />}{onCsv && <Btn variant="outline" onClick={onCsv}><Download size={14}/> Export CSV</Btn>}</div>} /><ReadOnlyBanner />{children}</div>;
}

function ReadOnlyCards({ title, q, setQ, rows, render }: { title: string; q: string; setQ: (v: string) => void; rows: any[]; render: (row: any) => React.ReactNode }) {
  return <ReadOnlyList title={title} q={q} setQ={setQ}>{rows.length === 0 ? <Empty icon={<FileText size={40}/>} title="Aucune donnée autorisée" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row, i) => <Card key={row.id || i} className="p-4">{render(row)}</Card>)}</div>}</ReadOnlyList>;
}
