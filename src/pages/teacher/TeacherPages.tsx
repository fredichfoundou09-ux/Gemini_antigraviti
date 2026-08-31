import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Users, CalendarDays, PenLine, BookOpen, ClipboardCheck, TestTube2, MessagesSquare,
  Phone, Mail, ChevronRight, FileText, Upload, UserCircle2, Clock, Wallet, CheckCircle2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Stat, PageHead, Badge, Empty, moduleIcon, formationLabel, Input, Field, Btn, money, readImage, uid, today } from "@/lib/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { PasswordChangeCard } from "@/pages/shared/PasswordChangeCard";

export function TeacherDashboard() {
  const { db, user } = useStore();
  const teacher = db.teachers.find((t) => t.userId === user!.id);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;

  const myModules = db.modules.filter((m) => teacher.modules.includes(m.id));
  const myStudents = db.students.filter((s) => s.modules.some((mid) => teacher.modules.includes(mid)));
  const mySessions = db.schedule.filter((s) => s.teacherId === teacher.id);
  const todaySessions = mySessions.filter((s) => s.jour === new Date().toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()));
  const myCourses = db.courses.filter((c) => c.teacherId === teacher.id);
  const myGrades = db.grades.filter((g) => teacher.modules.includes(g.moduleId));

  const avg = myGrades.length ? (myGrades.reduce((a, g) => a + g.note, 0) / myGrades.length).toFixed(1) : "—";
  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "—";

  return (
    <div>
      <PageHead title={`Espace Formateur`} subtitle={`${teacher.prenom} ${teacher.nom} — ${teacher.specialite}`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<BookOpen size={20} />} label="Mes modules" value={myModules.length} color="cyan" />
        <Stat icon={<Users size={20} />} label="Mes apprenants" value={myStudents.length} color="blue" />
        <Stat icon={<CalendarDays size={20} />} label="Sessions aujourd'hui" value={todaySessions.length} color="green" />
        <Stat icon={<PenLine size={20} />} label="Moyenne classe" value={avg} color="gold" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Mes modules enseignés</h3>
            <Link to="/app/mes-classes" className="text-xs font-bold text-cyan-300 hover:underline">Voir →</Link>
          </div>
          <div className="space-y-2.5">
            {myModules.map((m) => {
              const count = db.students.filter((s) => s.modules.includes(m.id)).length;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-300">{moduleIcon(m.icon, "h-4 w-4")}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-200">{m.numero}. {m.titre}</p>
                    <p className="text-[11px] text-slate-500">{formationLabel(m.formation)}</p>
                  </div>
                  <Badge color="gray">{count} apprenant(s)</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Mes prochaines sessions</h3>
            <Link to="/app/emploi-du-temps" className="text-xs font-bold text-cyan-300 hover:underline">Emploi du temps →</Link>
          </div>
          <div className="space-y-2">
            {mySessions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="w-24 shrink-0">
                  <p className="text-xs font-bold text-white">{s.jour}</p>
                  <p className="font-mono text-[10px] text-cyan-300">{s.heureDebut}—{s.heureFin}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-200">{modName(s.moduleId)}</p>
                  <p className="text-[11px] text-slate-500">Salle {s.salle}</p>
                </div>
                <ChevronRight size={15} className="text-slate-600" />
              </div>
            ))}
            {mySessions.length === 0 && <p className="text-sm text-slate-500">Aucune session planifiée.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Mes derniers cours publiés</h3>
            <Link to="/app/mes-cours" className="text-xs font-bold text-cyan-300 hover:underline">Publier →</Link>
          </div>
          {myCourses.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun cours publié.</p>
          ) : (
            <div className="space-y-2">
              {myCourses.slice(0, 4).map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <FileText size={15} className="shrink-0 text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-200">{c.titre}</p>
                    <p className="text-[11px] text-slate-500">{modName(c.moduleId)} • {c.date}</p>
                  </div>
                  <Badge color={c.type === "cours" ? "cyan" : c.type === "devoir" ? "gold" : "green"}>{c.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/app/presences", l: "Enregistrer les présences", i: <ClipboardCheck size={16} /> },
              { to: "/app/mes-cours", l: "Publier un cours", i: <BookOpen size={16} /> },
              { to: "/app/devoirs", l: "Devoirs remis", i: <PenLine size={16} /> },
              { to: "/app/tests", l: "Créer un test", i: <TestTube2 size={16} /> },
              { to: "/app/notes", l: "Saisir les notes", i: <PenLine size={16} /> },
              { to: "/app/messages", l: "Messagerie", i: <MessagesSquare size={16} /> },
            ].map((a, i) => (
              <Link key={i} to={a.to} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300">
                {a.i} {a.l}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function TeacherClasses() {
  const { db, user } = useStore();
  const teacher = db.teachers.find((t) => t.userId === user!.id);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;
  const myModules = db.modules.filter((m) => teacher.modules.includes(m.id));

  return (
    <div>
      <PageHead title="Mes classes" subtitle={`${myModules.length} modules enseignés`} />
      <div className="space-y-5">
        {myModules.map((m) => {
          const students = db.students.filter((s) => s.modules.includes(m.id));
          return (
            <Card key={m.id} className="overflow-hidden" glow="cyan">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2.5 text-cyan-300">{moduleIcon(m.icon, "h-5 w-5")}</div>
                  <div>
                    <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-slate-500">MODULE {String(m.numero).padStart(2, "0")}</p>
                    <h4 className="font-display text-base font-bold text-white">{m.titre}</h4>
                  </div>
                </div>
                <Badge color="gray">{students.length} apprenant(s)</Badge>
              </div>
              {students.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Aucun apprenant inscrit à ce module.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {students.map((s) => {
                    const grades = db.grades.filter((g) => g.studentId === s.id && g.moduleId === m.id);
                    return (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-200">{s.prenom} {s.nom}</p>
                          <p className="font-mono text-[10px] text-slate-500">{s.id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {grades.length > 0 ? <Badge color={grades[0].note >= 10 ? "green" : "red"}>{grades[0].note}/20</Badge> : <Badge color="gray">Pas de note</Badge>}
                          <span className="flex items-center gap-1 text-[11px] text-slate-500"><Phone size={11} className="text-emerald-300" /> {s.telephone}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TeacherStudents() {
  const { db, user } = useStore();
  const teacher = db.teachers.find((t) => t.userId === user!.id);
  if (!teacher) return <Empty icon={<Users size={40} />} title="Profil enseignant introuvable" />;
  const students = db.students.filter((s) => s.modules.some((mid) => teacher.modules.includes(mid)));

  return (
    <div>
      <PageHead title="Mes apprenants" subtitle={`${students.length} apprenant(s) dans mes modules`} />
      {students.length === 0 ? (
        <Empty icon={<Users size={40} />} title="Aucun apprenant" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => {
            const myMods = db.modules.filter((m) => s.modules.includes(m.id) && teacher.modules.includes(m.id));
            return (
              <Card key={s.id} className="p-5" glow="cyan">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30">
                    <GraduationCap size={20} className="text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                    <p className="font-mono text-[10px] text-cyan-300/70">{s.id}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {myMods.map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">{m.numero}. {m.titre}</span>)}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><Mail size={11} className="text-cyan-300" /> {s.email || "—"}</span>
                  <span className="flex items-center gap-1"><Phone size={11} className="text-emerald-300" /> {s.telephone}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- profil formateur ---------- */
export function TeacherProfile() {
  const { db, user, update, log } = useStore();
  const teacher = db.teachers.find((t) => t.userId === user?.id);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;

  const [phone, setPhone] = useState(teacher.phone || "");
  const [photo, setPhoto] = useState(teacher.photo || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const myMods = db.modules.filter((m) => teacher.modules.includes(m.id));

  const onPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `avatars/teacher-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          setPhoto(pub.publicUrl);
          toastMsg.success("Photo téléversée sur le serveur ✓");
          setUploading(false);
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    const img = await readImage(f, 400);
    setPhoto(img);
    setUploading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const changedFields: string[] = [];
    if (phone !== teacher.phone) changedFields.push("Téléphone");
    if (photo !== teacher.photo) changedFields.push("Photo");

    if (changedFields.length === 0) {
      toastMsg.info("Aucune modification détectée");
      setSaving(false);
      return;
    }

    if (isSupabaseConfigured) {
      try {
        // 1. Mise à jour table teachers
        const { error: tErr } = await supabase.from("teachers").update({
          phone: phone || null,
          photo_url: photo || null,
        }).eq("id", teacher.id);
        if (tErr) throw tErr;

        // 2. Mise à jour table profiles
        if (user?.id) {
          await supabase.from("profiles").update({
            phone: phone || null,
            avatar_url: photo || null,
          }).eq("id", user.id);
        }

        // 3. Notification pour les administrateurs
        const adminUsers = db.users.filter((u) => u.role === "admin" || u.role === "superadmin");
        for (const adm of adminUsers) {
          try {
            await supabase.from("notifications").insert({
              to_id: adm.id,
              title: "Modification de profil formateur",
              body: `L'enseignant ${teacher.prenom} ${teacher.nom} (${teacher.id}) a mis à jour ses coordonnées (${changedFields.join(", ")}).`,
              type: "teacher_profile_updated",
            });
          } catch { /* ignore notification failure */ }
        }

        // 4. Audit log
        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "PROFILE_UPDATED",
            entity_type: "teachers",
            entity_id: teacher.id,
            description: `Mise à jour du profil par le formateur ${teacher.prenom} ${teacher.nom} : champs [${changedFields.join(", ")}]`,
          });
        } catch { /* ignore audit */ }

        toastMsg.success("Profil mis à jour côté serveur ✓");
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur de mise à jour", err.message);
        setSaving(false);
        return;
      }
    } else {
      toastMsg.success("Profil mis à jour en local ✓");
    }

    update((d) => ({
      ...d,
      teachers: d.teachers.map((t) => (t.id === teacher.id ? { ...t, phone, photo } : t)),
    }));
    log(`Profil formateur mis à jour par ${teacher.prenom} ${teacher.nom}`);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Mon profil formateur"
        subtitle={`${teacher.prenom} ${teacher.nom} — ${teacher.specialite}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {/* Fiche d'identité formateur */}
          <Card className="p-6">
            <div className="flex items-center gap-5">
              {photo ? (
                <img src={photo} alt="" className="h-20 w-20 rounded-2xl border-2 border-cyan-400/50 object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30">
                  <UserCircle2 size={44} className="text-cyan-300" />
                </div>
              )}
              <div>
                <p className="font-display text-xl font-black text-white">{teacher.prenom} {teacher.nom}</p>
                <p className="font-mono text-xs text-cyan-300">{teacher.id}</p>
                <p className="text-xs text-slate-400 mt-0.5">{teacher.specialite}</p>
                <div className="mt-2 flex gap-2">
                  <Badge color="cyan">{teacher.typeContrat || "Prestation"}</Badge>
                  <Badge color="gold">{money(teacher.tarifHoraire || 0)} / h</Badge>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/5 pt-4">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-cyan-300 mb-3">Modifier mes coordonnées</h4>
              <div className="space-y-4">
                <Field label="Photo de profil">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">
                        <Upload size={14} /> {uploading ? "Téléversement..." : "Changer la photo"}
                      </span>
                      <input type="file" accept="image/*" onChange={onPhotoUpload} disabled={uploading} className="hidden" />
                    </label>
                    {photo && (
                      <button type="button" onClick={() => setPhoto("")} className="text-xs text-red-400 hover:underline">
                        Supprimer
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Téléphone / WhatsApp">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+242 06..." />
                </Field>

                <Field label="Email professionnel" hint="Non modifiable directement. Contactez l'administration si besoin.">
                  <Input value={teacher.email || ""} disabled className="opacity-60 cursor-not-allowed" />
                </Field>

                <Btn onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer les coordonnées"}
                </Btn>
              </div>
            </div>
          </Card>

          {/* Modules enseignés */}
          <Card className="p-6">
            <h3 className="font-display text-sm font-bold text-white mb-3">Mes modules attribués ({myMods.length})</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {myMods.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-1.5 text-cyan-300">{moduleIcon(m.icon, "h-3.5 w-3.5")}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{m.numero}. {m.titre}</p>
                    <p className="text-[10px] text-slate-500">{formationLabel(m.formation)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sécurité du mot de passe */}
        <div className="space-y-6">
          <PasswordChangeCard />
        </div>
      </div>
    </div>
  );
}

