import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Users, CalendarDays, PenLine, BookOpen, ClipboardCheck, TestTube2, MessagesSquare,
  Phone, Mail, ChevronRight, FileText, Upload, UserCircle2,
  Search, X, Shield, Eye,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getTeacherModuleIds, getStudentsOfTeacher, scheduleFor } from "@/lib/access";
import { ContactButtons } from "@/components/ContactButtons";
import { Card, Stat, PageHead, Badge, Empty, moduleIcon, formationLabel, Input, Field, Btn, readImage, Textarea } from "@/lib/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { PasswordChangeCard } from "@/pages/shared/PasswordChangeCard";

function getTeacher(db: any, user: any) {
  if (!user) return null;
  return db.teachers.find((t: any) =>
    t.userId === user.id ||
    (user.linkedId && t.id === user.linkedId) ||
    (user.email && t.email && t.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  ) || null;
}

export function TeacherDashboard() {
  const { db, user } = useStore();
  const teacher = getTeacher(db, user);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;

  const teacherModuleIds = useMemo(
    () => getTeacherModuleIds(teacher, db, { heuristic: true }),
    [teacher, db.courses, db.schedule, teacher?.modules]
  );
  const myModules = useMemo(
    () => db.modules.filter((m) => teacherModuleIds.includes(m.id)),
    [db.modules, teacherModuleIds]
  );
  const myStudents = useMemo(() => getStudentsOfTeacher(db, teacher.id), [db, teacher.id]);
  const mySessions = useMemo(() => scheduleFor(db, user), [db, user]);
  const todaySessions = mySessions.filter((s) => s.jour === new Date().toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^\w/, (c) => c.toUpperCase()));
  const myCourses = db.courses.filter((c) => c.teacherId === teacher.id || teacherModuleIds.includes(c.moduleId));
  const myGrades = db.grades.filter((g) => teacherModuleIds.includes(g.moduleId));

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
              const count = db.students.filter((s) => (s.modules || []).includes(m.id)).length;
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
  const teacher = getTeacher(db, user);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;

  const teacherModuleIds = useMemo(
    () => getTeacherModuleIds(teacher, db, { heuristic: true }),
    [teacher, db.courses, db.schedule, teacher?.modules]
  );
  const myModules = useMemo(
    () => db.modules.filter((m) => teacherModuleIds.includes(m.id)),
    [db.modules, teacherModuleIds]
  );

  return (
    <div>
      <PageHead title="Mes classes" subtitle={`${myModules.length} modules enseignés`} />
      <div className="space-y-5">
        {myModules.map((m) => {
          const students = db.students.filter((s) => (s.modules || []).includes(m.id));
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
  const teacher = getTeacher(db, user);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  if (!teacher) return <Empty icon={<Users size={40} />} title="Profil enseignant introuvable" />;

  // Résolution unifiée et consolidée des modules enseignés
  const teacherModuleIds = useMemo(
    () => getTeacherModuleIds(teacher, db, { heuristic: true }),
    [teacher, db.courses, db.schedule, teacher?.modules]
  );

  // Règle automatique stricte via la fonction centralisée getStudentsOfTeacher
  const allMyStudents = useMemo(() => {
    return getStudentsOfTeacher(db, teacher.id);
  }, [db, teacher.id]);

  const teacherModules = useMemo(() => {
    return db.modules.filter((m) => teacherModuleIds.includes(m.id));
  }, [db.modules, teacherModuleIds]);

  const filteredStudents = useMemo(() => {
    return allMyStudents.filter((s) => {
      // Filtre textuel
      const q = searchTerm.toLowerCase().trim();
      const matchQuery =
        !q ||
        `${s.prenom} ${s.nom}`.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.telephone || "").includes(q);

      // Filtre par module
      const matchModule = filterModule === "all" || (s.modules || []).includes(filterModule);

      return matchQuery && matchModule;
    });
  }, [allMyStudents, searchTerm, filterModule]);

  return (
    <div className="space-y-4">
      <PageHead
        title="Mes apprenants"
        subtitle={`${allMyStudents.length} apprenant(s) officiellement inscrit(s) dans vos modules`}
      />

      {/* Barre de recherche et filtres (Point 7) */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, prénom, matricule, téléphone..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Module :</span>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#07102B] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400/50"
            >
              <option value="all">Tous mes modules ({teacherModules.length})</option>
              {teacherModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Liste des cartes apprenants */}
      {teacherModuleIds.length === 0 ? (
        <Empty
          icon={<Users size={40} />}
          title="Aucun module assigné"
          sub="Aucun module ne vous a été assigné. Contactez l'administration pour qu'un module ou un cours vous soit attribué."
        />
      ) : filteredStudents.length === 0 ? (
        <Empty icon={<Users size={40} />} title="Aucun apprenant correspondant" sub="Ajustez vos filtres ou contactez la scolarité." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStudents.map((s) => {
            const myMods = db.modules.filter((m) => (s.modules || []).includes(m.id) && teacherModuleIds.includes(m.id));
            const studentAttendances = db.attendance.filter(
              (a) => a.studentId === s.id && teacherModuleIds.includes(a.moduleId)
            );
            const presentCount = studentAttendances.filter((a) => a.statut === "present").length;
            const presenceRate = studentAttendances.length > 0 ? Math.round((presentCount / studentAttendances.length) * 100) : 100;

            return (
              <Card key={s.id} className="p-5 flex flex-col justify-between" glow="cyan">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/30">
                        <GraduationCap size={22} className="text-cyan-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                        <p className="font-mono text-[10px] text-cyan-300/70 font-semibold">{s.id}</p>
                        <span className="text-[10px] text-slate-400">{formationLabel(s.formation)}</span>
                      </div>
                    </div>
                    <Badge color={presenceRate >= 80 ? "green" : presenceRate >= 50 ? "gold" : "red"}>
                      {presenceRate}% prés.
                    </Badge>
                  </div>

                  {/* Modules partagés */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {myMods.map((m) => (
                      <span key={m.id} className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-[10px] text-cyan-300 font-medium">
                        {m.numero}. {m.titre}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-t border-white/5 pt-2.5">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="flex items-center gap-1 truncate hover:text-cyan-300 transition" title={s.email}>
                        <Mail size={12} className="text-cyan-400 shrink-0" /> {s.email}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 truncate text-slate-600"><Mail size={12} /> —</span>
                    )}
                    {s.telephone ? (
                      <a href={`tel:${s.telephone.replace(/\s+/g, "")}`} className="flex items-center gap-1 truncate hover:text-emerald-300 transition" title={s.telephone}>
                        <Phone size={12} className="text-emerald-400 shrink-0" /> {s.telephone}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 truncate text-slate-600"><Phone size={12} /> —</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <ContactButtons
                    phone={s.telephone}
                    userId={s.userId}
                    email={s.email}
                    name={`${s.prenom} ${s.nom}`}
                    size="sm"
                  />
                  <button
                    onClick={() => setSelectedStudent(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 transition"
                  >
                    <Eye size={13} /> Fiche
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal / Fiche pédagogique de l'apprenant (Point 8) */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-400/40">
                  <GraduationCap size={28} className="text-cyan-300" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    {selectedStudent.prenom} {selectedStudent.nom}
                  </h3>
                  <p className="font-mono text-xs text-cyan-300">Matricule : {selectedStudent.id}</p>
                  <p className="text-xs text-slate-400">{formationLabel(selectedStudent.formation)}</p>
                  <div className="mt-2.5">
                    <ContactButtons
                      phone={selectedStudent.telephone}
                      userId={selectedStudent.userId}
                      email={selectedStudent.email}
                      name={`${selectedStudent.prenom} ${selectedStudent.nom}`}
                      showLabels
                      size="md"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Statistiques pédagogiques dans les modules du formateur */}
            {(() => {
              const sharedMods = db.modules.filter((m) => (selectedStudent.modules || []).includes(m.id) && teacherModuleIds.includes(m.id));
              const myAtts = db.attendance.filter((a) => a.studentId === selectedStudent.id && teacherModuleIds.includes(a.moduleId));
              const presents = myAtts.filter((a) => a.statut === "present").length;
              const lates = myAtts.filter((a) => a.statut === "retard").length;
              const absents = myAtts.filter((a) => a.statut === "absent").length;
              const myGrades = db.grades.filter((g) => g.studentId === selectedStudent.id && teacherModuleIds.includes(g.moduleId));
              const avgNote = myGrades.length > 0 ? (myGrades.reduce((a, b) => a + b.note, 0) / myGrades.length).toFixed(1) : "—";

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Modules communs</p>
                      <p className="font-display text-lg font-black text-cyan-300">{sharedMods.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Présences</p>
                      <p className="font-display text-lg font-black text-emerald-300">{presents}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Retards / Absences</p>
                      <p className="font-display text-lg font-black text-amber-300">{lates} / {absents}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Moyenne tests</p>
                      <p className="font-display text-lg font-black text-purple-300">{avgNote} / 20</p>
                    </div>
                  </div>

                  {/* Modules suivis avec ce formateur */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">Modules partagés</h4>
                    <div className="space-y-1.5">
                      {sharedMods.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-200">{m.numero}. {m.titre}</span>
                          <Badge color="cyan">Actif</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historique récent des présences */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 mb-2">Historique récent des séances</h4>
                    {myAtts.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Aucune séance enregistrée pour cet apprenant dans vos cours.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {myAtts.slice(0, 5).map((att) => (
                          <div key={att.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] px-3 py-1.5 text-xs">
                            <span className="font-mono text-slate-400">{att.date} à {att.heure || "—"}</span>
                            <Badge color={att.statut === "present" ? "green" : att.statut === "retard" ? "gold" : "red"}>
                              {att.statut.toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Avertissement de confidentialité (Point 8) */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 flex items-center gap-3">
                    <Shield size={18} className="text-emerald-400 shrink-0" />
                    <p className="text-[11px] text-emerald-200 leading-tight">
                      <b>Accès Pédagogique Conforme :</b> Les données financières privées (soldes, factures, encaissements) sont strictement réservées à l'administration et à l'apprenant.
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <Btn onClick={() => setSelectedStudent(null)} className="px-5">
                Fermer la fiche
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- profil formateur (Points 16-17) ---------- */
export function TeacherProfile() {
  const { db, user, update, log } = useStore();
  const teacher = getTeacher(db, user);
  if (!teacher) return <Empty icon={<GraduationCap size={40} />} title="Profil enseignant introuvable" />;

  const [phone, setPhone] = useState(teacher.phone || "");
  const [whatsapp, setWhatsapp] = useState((teacher as any).whatsapp || teacher.phone || "");
  const [emailPro, setEmailPro] = useState(teacher.email || user?.email || "");
  const [bio, setBio] = useState((teacher as any).bio || teacher.specialite || "");
  const [photo, setPhoto] = useState(teacher.photo || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const teacherModuleIds = useMemo(
    () => getTeacherModuleIds(teacher, db, { heuristic: true }),
    [teacher, db.courses, db.schedule, teacher?.modules]
  );
  const myMods = db.modules.filter((m) => teacherModuleIds.includes(m.id));

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
    if (whatsapp !== (teacher as any).whatsapp) changedFields.push("WhatsApp");
    if (emailPro !== teacher.email) changedFields.push("Email Pro");
    if (bio !== (teacher as any).bio) changedFields.push("Biographie");
    if (photo !== teacher.photo) changedFields.push("Photo");

    if (changedFields.length === 0) {
      toastMsg.info("Aucune modification détectée");
      setSaving(false);
      return;
    }

    if (isSupabaseConfigured) {
      try {
        // 1. Mise à jour table teachers
        await supabase.from("teachers").update({
          phone: phone || null,
          photo_url: photo || null,
          email: emailPro || null,
        }).eq("id", teacher.id);

        // 2. Mise à jour table profiles
        if (user?.id) {
          await supabase.from("profiles").update({
            phone: phone || null,
            avatar_url: photo || null,
            email: emailPro || null,
          }).eq("id", user.id);
        }

        // 3. Notification pour les administrateurs
        const adminUsers = db.users.filter((u) => u.role === "admin" || u.role === "superadmin");
        for (const adm of adminUsers) {
          try {
            await supabase.from("notifications").insert({
              user_id: adm.id,
              title: "Mise à jour coordonnées formateur",
              body: `L'enseignant ${teacher.prenom} ${teacher.nom} (${teacher.id}) a modifié son profil : ${changedFields.join(", ")}.`,
              type: "teacher_profile_updated",
            });
          } catch (err) {
            console.error("Erreur envoi notification admin lors de la mise à jour profil formateur:", err);
          }
        }

        // 4. Audit log obligatoire (Point 17)
        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "PROFILE_UPDATED",
            entity_type: "teachers",
            entity_id: teacher.id,
            description: `Mise à jour du profil par le formateur ${teacher.prenom} ${teacher.nom} : champs modifiés [${changedFields.join(", ")}]`,
          });
        } catch (err) {
          console.error("Erreur enregistrement audit log lors de la mise à jour profil formateur:", err);
        }

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
      teachers: d.teachers.map((t) => (t.id === teacher.id ? { ...t, phone, photo, email: emailPro, whatsapp, bio } as any : t)),
    }));
    log(`Mise à jour profil formateur : ${teacher.prenom} ${teacher.nom} (${changedFields.join(", ")})`);
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
                <img src={photo} alt="" className="h-20 w-20 rounded-2xl border-2 border-cyan-400/50 object-cover shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40">
                  <UserCircle2 size={44} className="text-cyan-300" />
                </div>
              )}
              <div>
                <p className="font-display text-xl font-black text-white">{teacher.prenom} {teacher.nom}</p>
                <p className="font-mono text-xs text-cyan-300 font-semibold">{teacher.id}</p>
                <p className="text-xs text-slate-400 mt-0.5">{teacher.specialite}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge color="cyan">{teacher.typeContrat || "Prestation"}</Badge>
                  <Badge color="gold">2 500 FCFA / séance</Badge>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/5 pt-4">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-cyan-300 mb-3">Modifier mes coordonnées professionnelles</h4>
              <div className="space-y-4">
                <Field label="Photo de profil">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10 transition">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Téléphone professionnel">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+242 06..." />
                  </Field>
                  <Field label="Numéro WhatsApp direct">
                    <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+242 05..." />
                  </Field>
                </div>

                <Field label="Email professionnel">
                  <Input value={emailPro} onChange={(e) => setEmailPro(e.target.value)} placeholder="nom@sentinellesnumeriques.cg" />
                </Field>

                <Field label="Biographie / Présentation pédagogique">
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Décrivez votre parcours d'expert, vos certifications et domaines d'intervention..." />
                </Field>

                <Btn onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
                  {saving ? "Enregistrement..." : "Enregistrer mes modifications"}
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

