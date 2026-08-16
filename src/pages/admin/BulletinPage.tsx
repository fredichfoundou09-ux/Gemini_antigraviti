import { useState } from "react";
import { FileText, Download, Users, Award } from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, Empty, Field, PageHead, Select, Badge } from "@/lib/ui";
import { generateBulletin } from "@/lib/bulletin";
import { formationLabel, money } from "@/lib/ui";
import { financialSummary, statusLabel } from "@/lib/finance";

export function BulletinsPage() {
  const { db } = useStore();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [formationFilter, setFormationFilter] = useState("");

  const filtered = db.students.filter((s) =>
    (!formationFilter || s.formation === formationFilter) && s.statut === "actif"
  );

  const student = db.students.find((s) => s.id === selectedStudentId);
  const grades = student ? db.grades.filter((g) => g.studentId === student.id) : [];
  const avg = grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(2) : "—";
  const summary = student ? financialSummary(db, student.id) : null;

  return (
    <div className="space-y-5">
      <PageHead
        title="Bulletins de notes"
        subtitle="Générer et imprimer les bulletins officiels par apprenant"
        actions={
          student && (
            <Btn onClick={() => generateBulletin(db, selectedStudentId)}>
              <Download size={15} /> Générer le bulletin PDF
            </Btn>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Liste apprenants */}
        <Card className="p-4" glow="none">
          <div className="mb-3 space-y-2">
            <Field label="Filtrer par formation">
              <Select value={formationFilter} onChange={(e) => setFormationFilter(e.target.value)}>
                <option value="">Toutes</option>
                <option value="informatique">Génie Informatique</option>
                <option value="industriel">Génie Industriel</option>
              </Select>
            </Field>
          </div>
          <div className="space-y-1 max-h-[65vh] overflow-y-auto">
            {filtered.length === 0 && (
              <Empty icon={<Users size={32} />} title="Aucun apprenant" />
            )}
            {filtered.map((s) => {
              const sg = db.grades.filter((g) => g.studentId === s.id);
              const sAvg = sg.length ? (sg.reduce((a, g) => a + g.note, 0) / sg.length).toFixed(1) : "—";
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all ${selectedStudentId === s.id ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 hover:bg-white/5"}`}
                >
                  <p className="text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="font-mono text-[10px] text-slate-500">{s.id}</p>
                    <span className={`text-xs font-bold ${parseFloat(sAvg) >= 10 ? "text-emerald-300" : sAvg === "—" ? "text-slate-400" : "text-red-400"}`}>{sAvg}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Aperçu bulletin */}
        {student ? (
          <div className="space-y-4">
            <Card className="p-5" glow="cyan">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-black text-white">{student.prenom} {student.nom}</p>
                  <p className="font-mono text-xs text-cyan-300">{student.id}</p>
                  <Badge color={student.formation === "informatique" ? "red" : "cyan"} className="mt-1">
                    {formationLabel(student.formation)}
                  </Badge>
                </div>
                <div className={`rounded-2xl border p-4 text-center ${parseFloat(avg) >= 10 ? "border-emerald-400/40 bg-emerald-400/5" : avg === "—" ? "border-white/10 bg-white/[0.02]" : "border-red-500/40 bg-red-500/5"}`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Moyenne</p>
                  <p className={`font-display text-3xl font-black ${parseFloat(avg) >= 10 ? "text-emerald-300" : avg === "—" ? "text-slate-400" : "text-red-400"}`}>{avg}</p>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                {db.modules.filter((m) => student.modules.includes(m.id)).map((mod) => {
                  const grade = grades.find((g) => g.moduleId === mod.id);
                  return (
                    <div key={mod.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                      <p className="text-sm text-slate-300">{mod.numero}. {mod.titre}</p>
                      <div className="flex items-center gap-3">
                        {grade?.appreciation && <span className="text-xs text-slate-500">{grade.appreciation}</span>}
                        <span className={`font-mono text-sm font-bold ${grade ? (grade.note >= 10 ? "text-emerald-300" : "text-red-400") : "text-slate-600"}`}>
                          {grade ? `${grade.note}/20` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Finance */}
            {summary && (
              <Card className="p-4 grid grid-cols-3 gap-3" glow="none">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Dû</p>
                  <p className="font-display text-sm font-black text-white">{money(summary.totalDu)}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Payé</p>
                  <p className="font-display text-sm font-black text-emerald-300">{money(summary.totalPaye)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                  <p className="text-[10px] uppercase text-slate-500">Statut</p>
                  <Badge color={summary.statut === "paye" ? "green" : summary.statut === "partiel" ? "gold" : "red"}>{statusLabel(summary.statut)}</Badge>
                </div>
              </Card>
            )}

            <Btn className="w-full py-3.5" onClick={() => generateBulletin(db, selectedStudentId)}>
              <FileText size={16} /> Générer et imprimer le bulletin
            </Btn>
          </div>
        ) : (
          <Card className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center" glow="none">
            <Award size={48} className="mb-3 text-slate-600" />
            <p className="font-display text-lg font-black text-slate-400">Sélectionnez un apprenant</p>
            <p className="mt-2 text-sm text-slate-500">Choisissez un apprenant dans la liste pour voir son bulletin.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
