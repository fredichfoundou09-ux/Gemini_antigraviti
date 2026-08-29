import { useState } from "react";
import {
  ClipboardCheck, FileText, Upload, Download, CheckCircle2, PenLine,
  Send, AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { cn } from "@/utils/cn";
import { Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Textarea, uid, today } from "@/lib/ui";
import { ingestFile, fileKind, humanSize, downloadFile } from "@/lib/files";
import { studentsOfCourse } from "@/lib/access";

/* ================= ENSEIGNANT : voir & corriger les remises ================= */
export function TeacherSubmissions() {
  const { db, user, update, log } = useStore();
  const teacher = db.teachers.find((t) => t.userId === user!.id);
  const [filterCourse, setFilterCourse] = useState("");
  const [grading, setGrading] = useState<any>(null);
  const [note, setNote] = useState("");
  const [appr, setAppr] = useState("");

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  if (!teacher && !isAdmin) return <Empty icon={<ClipboardCheck size={40} />} title="Profil enseignant introuvable" />;

  // Devoirs publiés (tous les devoirs pour l'administration, filtrés pour un formateur)
  const devoirs = db.courses.filter((c) =>
    c.type === "devoir" && (isAdmin || !teacher || c.teacherId === teacher.id || teacher.modules.includes(c.moduleId))
  );
  const submissions = db.submissions
    .filter((s) => devoirs.some((c) => c.id === s.courseId))
    .filter((s) => !filterCourse || s.courseId === filterCourse)
    .sort((a, b) => b.date.localeCompare(a.date));

  const saveGrade = () => {
    if (!grading) return;
    if (note === "" || isNaN(+note)) { toastMsg.error("Note invalide", "Saisissez une note entre 0 et 20."); return; }
    update((d) => ({
      ...d,
      submissions: d.submissions.map((s) => (s.id === grading.id ? { ...s, note: Math.min(20, Math.max(0, +note)), appreciation: appr || undefined, valide: true, dateCorrection: today() } : s)),
    }));
    // note automatique dans le carnet de notes
    const sName = db.students.find((x) => x.id === grading.studentId);
    if (sName) {
      update((d) => ({
        ...d,
        grades: [...d.grades, { id: uid("GRD"), studentId: grading.studentId, moduleId: grading.moduleId, note: Math.min(20, Math.max(0, +note)), appreciation: appr || "Devoir corrigé", date: today() }],
      }));
      if (sName.userId) update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: sName.userId!, title: "Devoir corrigé", body: `Note : ${note}/20 — ${appr || "Sans appréciation."}`, date: today(), lu: false, type: "info" }, ...d.notifications] }));
    }
    log(`Devoir corrigé : note ${note}/20`);
    setGrading(null); setNote(""); setAppr("");
  };

  return (
    <div>
      <PageHead title="Devoirs remis par mes apprenants" subtitle="Consulter, télécharger et corriger" />

      <Card className="mb-5 p-4">
        <Field label="Filtrer par devoir">
          <Select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}>
            <option value="">Tous mes devoirs</option>
            {devoirs.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
          </Select>
        </Field>
      </Card>

      {submissions.length === 0 ? (
        <Empty icon={<ClipboardCheck size={40} />} title="Aucune remise" sub="Les devoirs déposés par les apprenants apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => {
            const stu = db.students.find((x) => x.id === s.studentId);
            const mod = db.modules.find((m) => m.id === s.moduleId);
            const dev = db.courses.find((c) => c.id === s.courseId);
            return (
              <Card key={s.id} className="p-5" glow="green">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={16} className="shrink-0 text-emerald-300" />
                      <h4 className="font-display text-base font-bold text-white">{stu?.prenom} {stu?.nom}</h4>
                      {s.valide ? <Badge color="green">Noté : {s.note}/20</Badge> : <Badge color="gold">À corriger</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Devoir : <b>{dev?.titre}</b> • Module : {mod ? `${mod.numero}. ${mod.titre}` : "—"} • Remis le {s.date} à {s.heure}</p>
                    {s.texte && <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/20 p-3 text-xs text-slate-300">{s.texte}</p>}
                    {s.fichier && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-1.5 text-[11px]">
                        <FileText size={12} className="text-emerald-300" />
                        <span className="font-semibold text-slate-200">{s.fichier.originalName}</span>
                        <span className="text-slate-500">· {fileKind(s.fichier.mime, s.fichier.originalName)} · {humanSize(s.fichier.size)}</span>
                        <button onClick={() => s.fichier && downloadFile(s.fichier)} className="ml-auto rounded border border-emerald-400/40 px-2 py-0.5 text-emerald-300 hover:bg-emerald-400/10"><Download size={11} /></button>
                      </div>
                    )}
                    {s.valide && (
                      <p className="mt-2 text-xs text-emerald-300">Corrigé le {s.dateCorrection}{s.appreciation ? ` — ${s.appreciation}` : ""}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Btn variant={s.valide ? "outline" : "primary"} onClick={() => { setGrading(s); setNote(s.note !== undefined ? String(s.note) : ""); setAppr(s.appreciation ?? ""); }}>
                      <PenLine size={14} /> {s.valide ? "Modifier la note" : "Corriger"}
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!grading} onClose={() => setGrading(null)} title={grading ? `Note — ${db.students.find((x) => x.id === grading.studentId)?.prenom ?? ""}` : ""}>
        <div className="space-y-4">
          <Field label="Note /20"><Input type="number" min={0} max={20} step={0.5} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Field label="Appréciation"><Textarea value={appr} onChange={(e) => setAppr(e.target.value)} placeholder="Très bien, À retravailler..." /></Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setGrading(null)}>Annuler</Btn>
            <Btn onClick={saveGrade}><CheckCircle2 size={15} /> Valider la note</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= APPRENANT : remettre un devoir ================= */
export function StudentSubmission() {
  const { db, user, update, log } = useStore();
  const student = db.students.find((s) => s.userId === user!.id);
  const [submitting, setSubmitting] = useState<any>(null);
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<any>(null);

  if (!student) return <Empty icon={<FileText size={40} />} title="Profil apprenant introuvable" />;

  // Devoirs destinés à cet apprenant
  const devoirs = db.courses
    .filter((c) => c.type === "devoir" && studentsOfCourse(db, c).some((x) => x.id === student.id) && c.publie !== false)
    .sort((a, b) => b.date.localeCompare(a.date));

  const mySubmissions = db.submissions.filter((x) => x.studentId === student.id);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const cf = await ingestFile(f);
      setFichier(cf);
    } catch (err: any) {
      toastMsg.error("Fichier refusé", err.message || "Fichier invalide");
    }
  };

  const submit = () => {
    if (!submitting) return;
    if (!texte.trim() && !fichier) { toastMsg.warning("Rédigez une réponse ou joignez un fichier."); return; }
    const s = {
      id: uid("SUB"), courseId: submitting.id, moduleId: submitting.moduleId, studentId: student.id,
      teacherId: submitting.teacherId, texte: texte || undefined, fichier: fichier || undefined,
      date: today(), heure: new Date().toTimeString().slice(0, 5),
    };
    update((d) => ({ ...d, submissions: [s, ...d.submissions] }));
    // notifier le formateur
    const tUser = db.users.find((u) => u.linkedId === submitting.teacherId);
    if (tUser) update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: tUser.id, title: "Devoir remis", body: `${student.prenom} ${student.nom} a remis le devoir « ${submitting.titre} ».`, date: today(), lu: false, type: "info" }, ...d.notifications] }));
    log(`Devoir remis : ${submitting.titre} par ${student.prenom} ${student.nom}`);
    setSubmitting(null); setTexte(""); setFichier(null);
  };

  return (
    <div>
      <PageHead title="Mes devoirs" subtitle="Recevez, remettez e corrigez" />
      {devoirs.length === 0 ? (
        <Empty icon={<ClipboardCheck size={40} />} title="Aucun devoir" sub="Vos formateurs n'ont pas encore publié de devoirs pour vos modules." />
      ) : (
        <div className="space-y-3">
          {devoirs.map((c) => {
            const mine = mySubmissions.find((x) => x.courseId === c.id);
            const mod = db.modules.find((m) => m.id === c.moduleId);
            return (
              <Card key={c.id} className="p-5" glow={mine ? "green" : "gold"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck size={16} className={cn("shrink-0", mine ? "text-emerald-300" : "text-amber-300")} />
                      <h4 className="font-display text-base font-bold text-white">{c.titre}</h4>
                      {mine ? (mine.valide ? <Badge color="green">Noté : {mine.note}/20</Badge> : <Badge color="cyan">Remis</Badge>) : <Badge color="gold">À remettre</Badge>}
                    </div>
                    {mod && <p className="mt-1 text-xs text-slate-400">{mod.numero}. {mod.titre}</p>}
                    {c.description && <p className="mt-1.5 text-xs text-slate-300">{c.description}</p>}
                    {c.content && <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/20 p-3 font-mono text-[11px] text-slate-400">{c.content}</p>}
                    {(c.files ?? []).length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {c.files!.map((f: any) => (
                          <div key={f.id} className="flex items-center justify-between rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[11px]">
                            <span className="flex min-w-0 items-center gap-1.5 text-slate-200">
                              <FileText size={12} className="shrink-0 text-cyan-300" /> <span className="truncate">{f.originalName}</span>
                              <span className="text-slate-500">· {humanSize(f.size)}</span>
                            </span>
                            <button onClick={() => downloadFile(f)} className="rounded border border-cyan-400/40 px-2 py-0.5 text-cyan-300 hover:bg-cyan-400/10">Télécharger</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {mine && mine.valide && (
                      <div className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-2.5 text-xs">
                        <p className="font-bold text-emerald-300">Note : {mine.note}/20</p>
                        {mine.appreciation && <p className="mt-0.5 text-slate-300">{mine.appreciation}</p>}
                      </div>
                    )}
                  </div>
                  <div>
                    {!mine ? (
                      <Btn onClick={() => { setSubmitting(c); setTexte(""); setFichier(null); }}><Send size={14} /> Remettre</Btn>
                    ) : (
                      !mine.valide && <Btn variant="outline" onClick={() => { setSubmitting(c); setTexte(mine.texte ?? ""); setFichier(mine.fichier ?? null); }}>Modifier</Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!submitting} onClose={() => setSubmitting(null)} title={submitting ? `Remettre — ${submitting.titre}` : ""} wide>
        <div className="space-y-4">
          <Field label="Votre réponse (texte)"><Textarea value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rédigez votre réponse..." /></Field>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Pièce jointe</p>
            {!fichier ? (
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={13} /> Charger un fichier</span>
                <input type="file" onChange={onFile} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.zip" />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                <span>{fichier.originalName} · {humanSize(fichier.size)}</span>
                <button onClick={() => setFichier(null)} className="text-red-400"><AlertTriangle size={13} /></button>
              </div>
            )}
            <p className="mt-1 text-[10px] text-slate-500">Formats acceptés : PDF, Word, Excel, PowerPoint, images, ZIP. Max 8 Mo.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setSubmitting(null)}>Annuler</Btn>
            <Btn variant="green" onClick={submit}><Send size={15} /> Envoyer</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
