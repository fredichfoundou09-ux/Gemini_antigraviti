import React, { useState } from "react";
import {
  Download, Award, CheckCircle2, XCircle, AlertTriangle, Eye, Edit3,
  TrendingUp, Users, ShieldAlert, BarChart3, Clock, ArrowLeft
} from "lucide-react";
import { Assessment, AssessmentQuestion } from "../types";
import { useStore } from "@/lib/store";
import { Btn, Badge, Card, Modal, Field, Input } from "@/lib/ui";
import { exportCsv, exportJsonAsExcel } from "@/lib/export";
import { toastMsg } from "@/lib/toast";

interface Props {
  assessment: Assessment;
  onBack: () => void;
}

export function AssessmentResultsView({ assessment, onBack }: Props) {
  const { db, update, log } = useStore();

  const results = db.results.filter((r) => r.testId === assessment.id);
  const bareme = assessment.bareme || 20;
  const seuil = assessment.seuilReussite || bareme / 2;

  // Modale de consultation / notation manuelle
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [gradingQuestion, setGradingQuestion] = useState<AssessmentQuestion | null>(null);
  const [manualScore, setManualScore] = useState<number>(0);
  const [manualComment, setManualComment] = useState<string>("");

  // Modale de surveillance proctoring
  const [proctoringModalResult, setProctoringModalResult] = useState<any>(null);

  // Statistiques agrégées
  const count = results.length;
  const avgNote = count > 0 ? Math.round((results.reduce((s, r) => s + r.note, 0) / count) * 10) / 10 : 0;
  const bestNote = count > 0 ? Math.max(...results.map((r) => r.note)) : 0;
  const passCount = results.filter((r) => r.note >= seuil).length;
  const passRate = count > 0 ? Math.round((passCount / count) * 100) : 0;

  // Export
  const handleExportCsv = () => {
    const data = results.map((r) => {
      const s = db.students.find((st) => st.id === r.studentId);
      return {
        Identifiant: r.studentId,
        Nom: s?.nom || "—",
        Prenom: s?.prenom || "—",
        Note: `${r.note}/${bareme}`,
        Pourcentage: `${r.pourcentage}%`,
        Statut: r.note >= seuil ? "Réussi" : "Échoué",
        Date: r.date,
        Heure: r.heure || "—",
      };
    });
    exportCsv(`resultats-${assessment.titre.toLowerCase().replace(/\s+/g, "_")}`, data);
    toastMsg.success("Export CSV téléchargé ✓");
  };

  const handleExportExcel = () => {
    const data = results.map((r) => {
      const s = db.students.find((st) => st.id === r.studentId);
      return {
        Identifiant: r.studentId,
        Nom: s?.nom || "—",
        Prenom: s?.prenom || "—",
        Note: `${r.note}/${bareme}`,
        Pourcentage: `${r.pourcentage}%`,
        Statut: r.note >= seuil ? "Réussi" : "Échoué",
        Date: r.date,
        Heure: r.heure || "—",
      };
    });
    exportJsonAsExcel(`resultats-${assessment.titre.toLowerCase().replace(/\s+/g, "_")}`, data);
    toastMsg.success("Export Excel téléchargé ✓");
  };

  // Enregistrer une note manuelle
  const handleSaveManualGrade = () => {
    if (!selectedResult || !gradingQuestion) return;

    const currentNotes = selectedResult.notesManuelles || {};
    const newNotes = { ...currentNotes, [gradingQuestion.id]: manualScore };

    // Recalcul de la note globale
    let newNote = selectedResult.note;
    const prevScore = currentNotes[gradingQuestion.id] || 0;
    const diff = manualScore - prevScore;
    newNote = Math.min(bareme, Math.max(0, Math.round((newNote + diff) * 10) / 10));

    const updatedResult = {
      ...selectedResult,
      note: newNote,
      pourcentage: Math.round((newNote / bareme) * 100),
      statut: newNote >= seuil ? "reussi" : "echoue",
      notesManuelles: newNotes,
      valide: true,
    };

    update((d) => ({
      ...d,
      results: d.results.map((r) => r.id === selectedResult.id ? updatedResult : r),
    }));

    setSelectedResult(updatedResult);
    setGradingQuestion(null);
    log(`Note manuelle saisie pour ${selectedResult.studentId} : +${manualScore} pts (Q: ${gradingQuestion.question})`);
    toastMsg.success("Note et appréciation enregistrées ✓");
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec retour et actions d'export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={16} /> Retour aux évaluations
        </button>

        <div className="flex items-center gap-2">
          <Btn variant="outline" className="text-xs py-1.5" onClick={handleExportCsv}>
            <Download size={13} /> Export CSV
          </Btn>
          <Btn variant="outline" className="text-xs py-1.5" onClick={handleExportExcel}>
            <Download size={13} /> Export Excel
          </Btn>
        </div>
      </div>

      {/* Titre et détails de l'épreuve */}
      <div>
        <h1 className="font-display text-xl font-black text-white">{assessment.titre}</h1>
        <p className="text-xs text-slate-400">
          Barème : /{bareme} pts • Seuil de réussite : {seuil} pts • {count} apprenant(s) évalué(s)
        </p>
      </div>

      {/* Cartes statistiques globales (Section #13) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 border-white/5 bg-slate-900/40">
          <span className="text-[10px] uppercase font-bold text-slate-500">Moyenne générale</span>
          <p className="mt-1 text-2xl font-black text-cyan-400">{avgNote} <span className="text-xs text-slate-500">/{bareme}</span></p>
        </Card>
        <Card className="p-4 border-white/5 bg-slate-900/40">
          <span className="text-[10px] uppercase font-bold text-slate-500">Meilleure note</span>
          <p className="mt-1 text-2xl font-black text-emerald-400">{bestNote} <span className="text-xs text-slate-500">/{bareme}</span></p>
        </Card>
        <Card className="p-4 border-white/5 bg-slate-900/40">
          <span className="text-[10px] uppercase font-bold text-slate-500">Taux de réussite</span>
          <p className="mt-1 text-2xl font-black text-amber-400">{passRate}%</p>
        </Card>
        <Card className="p-4 border-white/5 bg-slate-900/40">
          <span className="text-[10px] uppercase font-bold text-slate-500">Copies soumises</span>
          <p className="mt-1 text-2xl font-black text-white">{count}</p>
        </Card>
      </div>

      {/* Tableau des apprenants */}
      {count === 0 ? (
        <Card className="p-8 text-center border-white/5 bg-white/[0.01]">
          <p className="text-sm text-slate-400">Aucun apprenant n'a encore passé cette évaluation.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto border-white/10 bg-slate-900/40">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Score & Pourcentage</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date & Heure</th>
                <th className="px-4 py-3">Surveillance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map((r) => {
                const s = db.students.find((st) => st.id === r.studentId);
                const isPass = r.note >= seuil;
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{s ? `${s.prenom} ${s.nom}` : r.studentId}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{r.studentId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{r.note}/{bareme}</span>
                      <span className="ml-2 text-slate-400">({r.pourcentage}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={isPass ? "green" : "red"}>
                        {isPass ? "Réussi" : "Échoué"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {r.date} {r.heure ? `à ${r.heure}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {((r as any).proctoringAlertsCount || 0) > 0 ? (
                        <button
                          onClick={() => setProctoringModalResult(r)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-400/20"
                        >
                          <ShieldAlert size={12} /> {(r as any).proctoringAlertsCount} alerte(s)
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Conforme ✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Btn variant="outline" className="text-xs py-1.5" onClick={() => setSelectedResult(r)}>
                        <Eye size={13} /> Consulter & Noter
                      </Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modale de consultation détaillée de la copie & notation manuelle */}
      <Modal open={!!selectedResult} onClose={() => setSelectedResult(null)} title="Copie d'évaluation" wide>
        {selectedResult && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs">
              <div>
                <span className="text-slate-400">Apprenant :</span>
                <p className="font-bold text-white text-sm">
                  {(() => {
                    const st = db.students.find((s) => s.id === selectedResult.studentId);
                    return st ? `${st.prenom} ${st.nom}` : selectedResult.studentId;
                  })()}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Note finale :</span>
                <p className="font-bold text-cyan-300 text-sm">
                  {selectedResult.note} / {bareme} pts ({selectedResult.pourcentage}%)
                </p>
              </div>
              <Badge color={selectedResult.note >= seuil ? "green" : "red"}>
                {selectedResult.note >= seuil ? "Réussi" : "Échoué"}
              </Badge>
            </div>

            {/* Liste des questions & réponses données */}
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {assessment.questions.map((q, idx) => {
                const given = selectedResult.reponses?.[q.id];
                const givenStr = Array.isArray(given) ? given.join(", ") : String(given || "");
                const isAutoGood = q.bonneReponse && givenStr.trim().toLowerCase() === q.bonneReponse.trim().toLowerCase();
                const manual = selectedResult.notesManuelles?.[q.id];

                return (
                  <div key={q.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white">
                        {idx + 1}. {q.question}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge color="cyan">{q.type.toUpperCase()}</Badge>
                        <Badge color="gold">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                      <span className="text-slate-400 block mb-1">Réponse de l'apprenant :</span>
                      <p className="font-medium text-slate-200 whitespace-pre-wrap">
                        {givenStr || <span className="text-slate-500 italic">Aucune réponse renseignée</span>}
                      </p>
                    </div>

                    {q.type === "longue" ? (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-amber-300">
                          {manual !== undefined ? `Note attribuée : ${manual} / ${q.points} pts` : "En attente de notation formateur"}
                        </span>
                        <Btn
                          variant="outline"
                          className="text-xs py-1.5"
                          onClick={() => {
                            setGradingQuestion(q);
                            setManualScore(manual !== undefined ? manual : q.points);
                          }}
                        >
                          <Edit3 size={13} /> {manual !== undefined ? "Modifier la note" : "Attribuer une note"}
                        </Btn>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className={isAutoGood ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                          {isAutoGood ? "✓ Réponse correcte" : "✕ Réponse incorrecte"}
                        </span>
                        {q.bonneReponse && !isAutoGood && (
                          <span className="text-slate-400">
                            Attendu : <strong className="text-emerald-300">{q.bonneReponse}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Btn onClick={() => setSelectedResult(null)}>Fermer la copie</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale de notation manuelle d'une question */}
      <Modal open={!!gradingQuestion} onClose={() => setGradingQuestion(null)} title="Notation manuelle">
        {gradingQuestion && (
          <div className="space-y-4 text-xs">
            <p className="font-semibold text-white">{gradingQuestion.question}</p>
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-slate-300 whitespace-pre-wrap">
              <strong>Réponse soumise : </strong>
              {selectedResult?.reponses?.[gradingQuestion.id] || "—"}
            </div>

            <Field label={`Points attribués (sur ${gradingQuestion.points} pts)`}>
              <Input
                type="number"
                min="0"
                max={gradingQuestion.points}
                step="0.5"
                value={manualScore}
                onChange={(e) => setManualScore(Math.min(gradingQuestion.points, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
            </Field>

            <Field label="Appréciation du formateur (visible par l'apprenant)">
              <Input
                value={manualComment}
                onChange={(e) => setManualComment(e.target.value)}
                placeholder="Ex : Très bonne maîtrise des concepts fondamentaux."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setGradingQuestion(null)}>Annuler</Btn>
              <Btn onClick={handleSaveManualGrade}>Valider la note</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale du Journal de surveillance */}
      <Modal open={!!proctoringModalResult} onClose={() => setProctoringModalResult(null)} title="Journal de surveillance anti-fraude">
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Événements enregistrés automatiquement par le système de surveillance pendant le passage :
          </p>
          <div className="rounded-xl border border-white/10 bg-slate-950 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert size={14} />
              <span className="font-bold">Alertes détectées durant la session :</span>
            </div>
            <p className="text-slate-400 pl-5">
              • Détection de perte de focus de l'onglet ou basculement d'application.
            </p>
            <p className="text-slate-400 pl-5">
              • Sauvegardes automatiques déclenchées lors de chaque événement suspect.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Btn onClick={() => setProctoringModalResult(null)}>Fermer</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
