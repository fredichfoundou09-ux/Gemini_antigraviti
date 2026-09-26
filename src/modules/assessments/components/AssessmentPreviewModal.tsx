import React, { useState } from "react";
import { Modal, Btn, Badge } from "@/lib/ui";
import { Assessment } from "../types";
import { Clock, Eye, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

interface Props {
  assessment: Assessment | null;
  open: boolean;
  onClose: () => void;
}

export function AssessmentPreviewModal({ assessment, open, onClose }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mockAnswers, setMockAnswers] = useState<Record<string, any>>({});

  if (!assessment) return null;

  const q = assessment.questions[currentIdx];

  return (
    <Modal open={open} onClose={onClose} title={`Prévisualisation apprenant — ${assessment.titre}`} wide>
      <div className="space-y-4">
        {/* Bandeau de simulation */}
        <div className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span>Mode Aperçu Formateur : Vous visualisez l'épreuve exactement comme un apprenant.</span>
          </div>
          <div className="flex items-center gap-2 font-mono font-bold text-white">
            <Clock size={14} className="text-cyan-400" />
            <span>TEMPS RESTANT : {String(assessment.duree).padStart(2, "0")}:00</span>
          </div>
        </div>

        {/* Consignes si existantes */}
        {assessment.consignes && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-400 italic">
            <strong>Consignes : </strong>{assessment.consignes}
          </div>
        )}

        {/* Question actuelle */}
        {q ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="font-display text-sm font-bold text-cyan-400">
                Question {currentIdx + 1} sur {assessment.questions.length}
              </span>
              <div className="flex items-center gap-2">
                <Badge color="cyan">{q.type.toUpperCase()}</Badge>
                <Badge color="gold">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
              </div>
            </div>

            <p className="text-sm font-medium text-white leading-relaxed">
              {q.question}
            </p>

            {/* Options selon le type */}
            {(q.type === "qcm" || q.type === "vf") && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(q.options || (q.type === "vf" ? ["Vrai", "Faux"] : [])).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setMockAnswers({ ...mockAnswers, [q.id]: opt })}
                    className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                      mockAnswers[q.id] === opt
                        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-mono text-slate-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === "qcm_multiple" && (
              <div className="grid gap-2 sm:grid-cols-2">
                {(q.options || []).map((opt, i) => {
                  const currentArr: string[] = mockAnswers[q.id] || [];
                  const isChecked = currentArr.includes(opt);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const next = isChecked ? currentArr.filter((x) => x !== opt) : [...currentArr, opt];
                        setMockAnswers({ ...mockAnswers, [q.id]: next });
                      }}
                      className={`rounded-xl border p-3 text-left text-xs font-semibold transition flex items-center justify-between ${
                        isChecked
                          ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                          : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <span>
                        <span className="font-mono text-slate-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </span>
                      {isChecked && <CheckCircle2 size={14} className="text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "courte" && (
              <input
                type="text"
                value={mockAnswers[q.id] || ""}
                onChange={(e) => setMockAnswers({ ...mockAnswers, [q.id]: e.target.value })}
                placeholder="Votre réponse concise..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            )}

            {q.type === "longue" && (
              <textarea
                rows={4}
                value={mockAnswers[q.id] || ""}
                onChange={(e) => setMockAnswers({ ...mockAnswers, [q.id]: e.target.value })}
                placeholder="Rédigez votre argumentation ou explication..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none resize-none"
              />
            )}

            {q.type === "numerique" && (
              <input
                type="number"
                step="any"
                value={mockAnswers[q.id] || ""}
                onChange={(e) => setMockAnswers({ ...mockAnswers, [q.id]: e.target.value })}
                placeholder="Entrez la valeur numérique..."
                className="w-full sm:w-64 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            )}

            {/* Navigation entre questions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <button
                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
              >
                <ChevronLeft size={14} /> Précédente
              </button>
              <span className="text-[11px] text-slate-400">
                {Object.keys(mockAnswers).length} / {assessment.questions.length} répondue(s)
              </span>
              <button
                onClick={() => setCurrentIdx(Math.min(assessment.questions.length - 1, currentIdx + 1))}
                disabled={currentIdx === assessment.questions.length - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-30"
              >
                Suivante <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center py-8 text-xs text-slate-500">Aucune question dans cette évaluation.</p>
        )}

        <div className="flex justify-end pt-2">
          <Btn onClick={onClose}>Fermer la prévisualisation</Btn>
        </div>
      </div>
    </Modal>
  );
}
