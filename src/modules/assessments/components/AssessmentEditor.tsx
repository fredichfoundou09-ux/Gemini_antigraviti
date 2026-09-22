import React, { useState, useMemo } from "react";
import {
  PlusCircle, Trash2, ArrowUp, ArrowDown, Save, Send, Eye, ShieldAlert,
  CheckCircle2, XCircle, AlertTriangle, Clock, Settings, HelpCircle,
  FileCheck, Sparkles, Layers, ListOrdered, FileDown
} from "lucide-react";
import { Assessment, AssessmentQuestion, QuestionType, AssessmentStatus, AssessmentAudience, DifficultyLevel } from "../types";
import { validateAssessmentForPublication, ValidationDiagnostic } from "../services/assessmentService";
import { Btn, Badge, Field, Input, Select, Card, Modal } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

interface Props {
  initialAssessment: Assessment;
  onSaveDraft: (assessment: Assessment) => void;
  onPublish: (assessment: Assessment) => void;
  onPreview: (assessment: Assessment) => void;
  onCancel: () => void;
  allowedModules: Array<{ id: string; titre: string; numero?: number }>;
  allStudents?: Array<{ id: string; nom: string; prenom: string }>;
}

export function AssessmentEditor({
  initialAssessment,
  onSaveDraft,
  onPublish,
  onPreview,
  onCancel,
  allowedModules,
  allStudents = [],
}: Props) {
  const [assessment, setAssessment] = useState<Assessment>({ ...initialAssessment });
  const [selectedQIndex, setSelectedQIndex] = useState<number>(0);

  const activeQuestion = assessment.questions[selectedQIndex] as AssessmentQuestion | undefined;

  // Recalcul du diagnostic en direct
  const diagnostic = useMemo(() => {
    return validateAssessmentForPublication(assessment);
  }, [assessment]);

  const totalPoints = useMemo(() => {
    return assessment.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  }, [assessment.questions]);

  // Actions sur les questions
  const handleAddQuestion = (type: QuestionType = "qcm") => {
    const newQ: AssessmentQuestion = {
      id: `Q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      question: `Nouvelle question ${assessment.questions.length + 1}`,
      type,
      options: type === "vf" ? ["Vrai", "Faux"] : type.startsWith("qcm") ? ["Choix 1", "Choix 2", "Choix 3", "Choix 4"] : [],
      bonneReponse: type === "vf" ? "Vrai" : type === "qcm" ? "Choix 1" : "",
      bonnesReponses: type === "qcm_multiple" ? ["Choix 1"] : [],
      points: 2,
      ordre: assessment.questions.length + 1,
      obligatoire: true,
    };

    const nextQuestions = [...assessment.questions, newQ];
    setAssessment({ ...assessment, questions: nextQuestions });
    setSelectedQIndex(nextQuestions.length - 1);
  };

  const handleDeleteQuestion = (indexToDelete: number) => {
    if (assessment.questions.length <= 1) {
      toastMsg.error("Action impossible", "Une évaluation doit comporter au moins une question.");
      return;
    }
    const nextQuestions = assessment.questions
      .filter((_, idx) => idx !== indexToDelete)
      .map((q, idx) => ({ ...q, ordre: idx + 1 }));

    setAssessment({ ...assessment, questions: nextQuestions });
    setSelectedQIndex(Math.max(0, indexToDelete - 1));
  };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === assessment.questions.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const items = [...assessment.questions];
    const [moved] = items.splice(index, 1);
    items.splice(targetIdx, 0, moved);

    const reordered = items.map((q, idx) => ({ ...q, ordre: idx + 1 }));
    setAssessment({ ...assessment, questions: reordered });
    setSelectedQIndex(targetIdx);
  };

  const updateActiveQuestion = (patch: Partial<AssessmentQuestion>) => {
    if (!activeQuestion) return;
    const nextQuestions = [...assessment.questions];
    nextQuestions[selectedQIndex] = { ...activeQuestion, ...patch };
    setAssessment({ ...assessment, questions: nextQuestions });
  };

  // Gestion des choix de QCM
  const handleAddOption = () => {
    if (!activeQuestion) return;
    const currentOptions = activeQuestion.options || [];
    const newOptionText = `Option ${currentOptions.length + 1}`;
    updateActiveQuestion({
      options: [...currentOptions, newOptionText],
    });
  };

  const handleUpdateOption = (optIndex: number, newText: string) => {
    if (!activeQuestion) return;
    const currentOptions = [...(activeQuestion.options || [])];
    const oldText = currentOptions[optIndex];
    currentOptions[optIndex] = newText;

    const patch: Partial<AssessmentQuestion> = { options: currentOptions };

    // Si c'était la bonne réponse
    if (activeQuestion.bonneReponse === oldText) {
      patch.bonneReponse = newText;
    }
    if (activeQuestion.bonnesReponses?.includes(oldText)) {
      patch.bonnesReponses = activeQuestion.bonnesReponses.map((r) => r === oldText ? newText : r);
    }

    updateActiveQuestion(patch);
  };

  const handleDeleteOption = (optIndex: number) => {
    if (!activeQuestion) return;
    const currentOptions = (activeQuestion.options || []).filter((_, idx) => idx !== optIndex);
    updateActiveQuestion({ options: currentOptions });
  };

  // Actions de publication et enregistrement
  const handleSaveDraft = () => {
    onSaveDraft({
      ...assessment,
      statut: "brouillon",
    });
    toastMsg.success("Évaluation enregistrée en brouillon ✓");
  };

  const handlePublish = () => {
    if (!diagnostic.isValid) {
      toastMsg.error(
        "Publication bloquée",
        `Veuillez corriger les ${diagnostic.errors.length} point(s) bloquant(s) avant de publier.`
      );
      return;
    }

    onPublish({
      ...assessment,
      statut: "publie",
      datePublication: new Date().toISOString(),
    });
    toastMsg.success("Évaluation publiée avec succès !", "Elle est maintenant disponible pour les apprenants ciblés.");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-110px)] min-h-[640px] space-y-4">
      {/* Barre d'action supérieure */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Badge color={assessment.statut === "publie" ? "green" : "gold"}>
            {assessment.statut.toUpperCase()}
          </Badge>
          <div>
            <h2 className="font-display text-lg font-black text-white">
              {assessment.titre || "Évaluation sans titre"}
            </h2>
            <p className="text-xs text-slate-400">
              {assessment.questions.length} questions • Barème total : {totalPoints} / {assessment.bareme} pts • Durée : {assessment.duree} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="outline" className="text-xs py-1.5" onClick={() => onPreview(assessment)}>
            <Eye size={15} /> Prévisualiser
          </Btn>
          <Btn variant="ghost" className="text-xs py-1.5" onClick={handleSaveDraft}>
            <Save size={15} /> Enregistrer brouillon
          </Btn>
          <Btn
            onClick={handlePublish}
            disabled={!diagnostic.isValid}
            className={`text-xs py-1.5 ${diagnostic.isValid ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold" : "opacity-60"}`}
          >
            <Send size={15} /> Publier l'évaluation
          </Btn>
          <Btn variant="ghost" className="text-xs py-1.5" onClick={onCancel}>
            Fermer
          </Btn>
        </div>
      </div>

      {/* Disposition 3 Panneaux */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* PANNEAU GAUCHE : LISTE DES QUESTIONS (3 cols) */}
        <div className="col-span-12 md:col-span-3 flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-3.5 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ListOrdered size={14} /> Questions ({assessment.questions.length})
            </span>
            <button
              onClick={() => handleAddQuestion("qcm")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
            >
              <PlusCircle size={14} /> Ajouter
            </button>
          </div>

          {/* Liste déroulante des questions */}
          <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
            {assessment.questions.map((q, idx) => {
              const isSelected = idx === selectedQIndex;
              return (
                <div
                  key={q.id || idx}
                  onClick={() => setSelectedQIndex(idx)}
                  className={`group relative cursor-pointer rounded-xl border p-2.5 transition text-left ${
                    isSelected
                      ? "border-cyan-400/50 bg-cyan-400/10 shadow-lg shadow-cyan-950/20"
                      : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-mono text-xs font-bold text-cyan-300 shrink-0">
                      Q{idx + 1}
                    </span>
                    <span className="line-clamp-2 text-xs font-medium text-slate-200 flex-1">
                      {q.question || "Sans énoncé..."}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="uppercase text-[10px] font-bold text-slate-500">
                      {q.type}
                    </span>
                    <span className="font-semibold text-amber-300">
                      {q.points} pt{q.points > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Contrôles de réordonnancement rapides */}
                  <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-slate-900/90 rounded-md p-0.5 border border-white/10">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, "up"); }}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Monter"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, "down"); }}
                      disabled={idx === assessment.questions.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      title="Descendre"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(idx); }}
                      className="p-1 text-red-400 hover:text-red-300"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/5 flex gap-1.5">
            <button
              onClick={() => handleAddQuestion("qcm")}
              className="flex-1 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-[11px] text-slate-300 hover:bg-white/5"
            >
              + QCM
            </button>
            <button
              onClick={() => handleAddQuestion("vf")}
              className="flex-1 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-[11px] text-slate-300 hover:bg-white/5"
            >
              + Vrai/Faux
            </button>
            <button
              onClick={() => handleAddQuestion("courte")}
              className="flex-1 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-[11px] text-slate-300 hover:bg-white/5"
            >
              + Texte
            </button>
          </div>
        </div>

        {/* ZONE CENTRALE : ÉDITEUR DE LA QUESTION SÉLECTIONNÉE (6 cols) */}
        <div className="col-span-12 md:col-span-6 flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-md overflow-y-auto">
          {activeQuestion ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-cyan-400 text-sm">
                    Question {selectedQIndex + 1} / {assessment.questions.length}
                  </span>
                  <Badge color="cyan">{activeQuestion.type.toUpperCase()}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Points :</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={activeQuestion.points}
                    onChange={(e) => updateActiveQuestion({ points: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Énoncé de la question */}
              <Field label="Énoncé de la question">
                <textarea
                  rows={3}
                  value={activeQuestion.question}
                  onChange={(e) => updateActiveQuestion({ question: e.target.value })}
                  placeholder="Saisissez l'intitulé de votre question..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition resize-none"
                />
              </Field>

              {/* Type de question */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type de question">
                  <Select
                    value={activeQuestion.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      let newOptions = activeQuestion.options || [];
                      let newBonneReponse = activeQuestion.bonneReponse || "";
                      if (newType === "vf") {
                        newOptions = ["Vrai", "Faux"];
                        newBonneReponse = "Vrai";
                      } else if (newType.startsWith("qcm") && newOptions.length < 2) {
                        newOptions = ["Choix 1", "Choix 2", "Choix 3", "Choix 4"];
                        newBonneReponse = "Choix 1";
                      }
                      updateActiveQuestion({
                        type: newType,
                        options: newOptions,
                        bonneReponse: newBonneReponse,
                      });
                    }}
                  >
                    <option value="qcm">QCM à réponse unique</option>
                    <option value="qcm_multiple">QCM à réponses multiples</option>
                    <option value="vf">Vrai / Faux</option>
                    <option value="courte">Réponse courte</option>
                    <option value="longue">Réponse longue (ouverte / réflexion)</option>
                    <option value="numerique">Question numérique</option>
                  </Select>
                </Field>

                <Field label="Statut de réponse">
                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={activeQuestion.obligatoire !== false}
                      onChange={(e) => updateActiveQuestion({ obligatoire: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-cyan-500"
                    />
                    Réponse obligatoire pour l'apprenant
                  </label>
                </Field>
              </div>

              {/* Options pour QCM et QCM multiple */}
              {(activeQuestion.type === "qcm" || activeQuestion.type === "qcm_multiple") && (
                <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Choix de réponses (Cochez la ou les bonnes réponses)
                    </p>
                    <button
                      onClick={handleAddOption}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      + Ajouter un choix
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeQuestion.options || []).map((opt, oIdx) => {
                      const isSingleCorrect = activeQuestion.bonneReponse === opt;
                      const isMultiCorrect = activeQuestion.bonnesReponses?.includes(opt);
                      const isChecked = activeQuestion.type === "qcm" ? isSingleCorrect : isMultiCorrect;

                      return (
                        <div key={oIdx} className="flex items-center gap-2">
                          <input
                            type={activeQuestion.type === "qcm" ? "radio" : "checkbox"}
                            name={`correct-${activeQuestion.id}`}
                            checked={Boolean(isChecked)}
                            onChange={() => {
                              if (activeQuestion.type === "qcm") {
                                updateActiveQuestion({ bonneReponse: opt });
                              } else {
                                const current = activeQuestion.bonnesReponses || [];
                                const next = isChecked ? current.filter((x) => x !== opt) : [...current, opt];
                                updateActiveQuestion({ bonnesReponses: next, bonneReponse: next[0] || "" });
                              }
                            }}
                            className="text-cyan-500 cursor-pointer"
                            title="Marquer comme bonne réponse"
                          />
                          <span className="font-mono text-xs font-bold text-slate-400 w-5">
                            {String.fromCharCode(65 + oIdx)}.
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => handleUpdateOption(oIdx, e.target.value)}
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                            placeholder={`Choix ${oIdx + 1}`}
                          />
                          {(activeQuestion.options || []).length > 2 && (
                            <button
                              onClick={() => handleDeleteOption(oIdx)}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vrai / Faux */}
              {activeQuestion.type === "vf" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Bonne réponse attendue
                  </p>
                  <div className="flex gap-4">
                    {["Vrai", "Faux"].map((val) => (
                      <label
                        key={val}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer text-xs font-bold transition ${
                          activeQuestion.bonneReponse === val
                            ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                            : "border-white/10 text-slate-400 hover:bg-white/5"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`vf-${activeQuestion.id}`}
                          value={val}
                          checked={activeQuestion.bonneReponse === val}
                          onChange={() => updateActiveQuestion({ bonneReponse: val })}
                          className="hidden"
                        />
                        {val === "Vrai" ? "✓ Vrai" : "✕ Faux"}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Réponse courte */}
              {activeQuestion.type === "courte" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                  <Field label="Réponse attendue exacte (sensible ou tolérante à la casse)">
                    <Input
                      value={activeQuestion.bonneReponse || ""}
                      onChange={(e) => updateActiveQuestion({ bonneReponse: e.target.value })}
                      placeholder="Ex : Algorithme"
                    />
                  </Field>
                </div>
              )}

              {/* Question numérique */}
              {activeQuestion.type === "numerique" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Valeur numérique attendue">
                      <Input
                        type="number"
                        step="any"
                        value={activeQuestion.valeurNumerique ?? activeQuestion.bonneReponse ?? ""}
                        onChange={(e) => updateActiveQuestion({
                          valeurNumerique: parseFloat(e.target.value) || 0,
                          bonneReponse: e.target.value,
                        })}
                        placeholder="Ex : 42"
                      />
                    </Field>
                    <Field label="Marge d'erreur / Tolérance (±)">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={activeQuestion.toleranceNumerique ?? 0}
                        onChange={(e) => updateActiveQuestion({ toleranceNumerique: Math.max(0, parseFloat(e.target.value) || 0) })}
                        placeholder="Ex : 0.5"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* Question longue */}
              {activeQuestion.type === "longue" && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-300">
                    ℹ️ Correction manuelle requise
                  </p>
                  <p className="text-xs text-slate-400">
                    Pour cette question ouverte, l'apprenant rédigera une réponse textuelle complète. Vous pourrez lui attribuer une note et un commentaire personnalisé lors de la correction.
                  </p>
                </div>
              )}

              {/* Explication / Note de correction */}
              <Field label="Explication pédagogique (affichée après publication des résultats)">
                <textarea
                  rows={2}
                  value={activeQuestion.explication || ""}
                  onChange={(e) => updateActiveQuestion({ explication: e.target.value })}
                  placeholder="Justification de la solution, rappel de cours..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition resize-none"
                />
              </Field>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Sélectionnez ou créez une question pour commencer l'édition.
            </div>
          )}
        </div>

        {/* PANNEAU DROIT : PARAMÈTRES & VALIDATION CHECKLIST (3 cols) */}
        <div className="col-span-12 md:col-span-3 flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-md overflow-y-auto space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Settings size={14} /> Paramètres de l'épreuve
          </p>

          <Field label="Titre de l'évaluation">
            <Input
              value={assessment.titre}
              onChange={(e) => setAssessment({ ...assessment, titre: e.target.value })}
              placeholder="Ex : Évaluation finale Réseaux"
            />
          </Field>

          <Field label="Module d'enseignement">
            <Select
              value={assessment.moduleId}
              onChange={(e) => setAssessment({ ...assessment, moduleId: e.target.value })}
            >
              <option value="">— Sélectionner —</option>
              {allowedModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero ? `${m.numero}. ` : ""}{m.titre}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Durée (min)">
              <Input
                type="number"
                min="5"
                value={assessment.duree}
                onChange={(e) => setAssessment({ ...assessment, duree: Math.max(1, parseInt(e.target.value) || 45) })}
              />
            </Field>
            <Field label="Barème total">
              <Input
                type="number"
                min="1"
                value={assessment.bareme}
                onChange={(e) => setAssessment({ ...assessment, bareme: Math.max(1, parseFloat(e.target.value) || 20) })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Seuil réussite">
              <Input
                type="number"
                min="0"
                value={assessment.seuilReussite}
                onChange={(e) => setAssessment({ ...assessment, seuilReussite: parseFloat(e.target.value) || 10 })}
              />
            </Field>
            <Field label="Tentatives max">
              <Input
                type="number"
                min="1"
                value={assessment.tentatives}
                onChange={(e) => setAssessment({ ...assessment, tentatives: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </Field>
          </div>

          <Field label="Consignes obligatoires">
            <textarea
              rows={3}
              value={assessment.consignes || ""}
              onChange={(e) => setAssessment({ ...assessment, consignes: e.target.value })}
              placeholder="Consignes officielles à lire avant le début de l'épreuve..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition resize-none"
            />
          </Field>

          {/* Mode sécurisé & Anti-triche */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <p className="text-[11px] font-bold text-red-300 flex items-center gap-1">
              <ShieldAlert size={13} /> Mode Examen Sécurisé
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={assessment.modeSecurise}
                onChange={(e) => setAssessment({ ...assessment, modeSecurise: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-red-500"
              />
              Activer la surveillance proactive
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={assessment.bloquerCopierColler}
                onChange={(e) => setAssessment({ ...assessment, bloquerCopierColler: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-red-500"
              />
              Bloquer copier / coller
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={assessment.bloquerClicDroit}
                onChange={(e) => setAssessment({ ...assessment, bloquerClicDroit: e.target.checked })}
                className="rounded border-white/20 bg-white/5 text-red-500"
              />
              Bloquer clic droit
            </label>
          </div>

          {/* Checklist de validation */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileCheck size={14} /> Contrôle avant publication
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                {assessment.titre?.trim() ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                <span className={assessment.titre?.trim() ? "text-slate-300" : "text-red-300"}>Titre défini</span>
              </div>
              <div className="flex items-center gap-2">
                {assessment.consignes?.trim() ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                <span className={assessment.consignes?.trim() ? "text-slate-300" : "text-red-300"}>Consignes rédigées</span>
              </div>
              <div className="flex items-center gap-2">
                {assessment.questions.length > 0 ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                <span className={assessment.questions.length > 0 ? "text-slate-300" : "text-red-300"}>{assessment.questions.length} question(s) présente(s)</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostic.errors.length === 0 ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                <span className={diagnostic.errors.length === 0 ? "text-slate-300" : "text-red-300"}>
                  {diagnostic.errors.length === 0 ? "Réponses & Barème valides" : `${diagnostic.errors.length} erreur(s) détectée(s)`}
                </span>
              </div>
            </div>

            {diagnostic.errors.length > 0 && (
              <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-300 space-y-1">
                {diagnostic.errors.slice(0, 3).map((err, i) => (
                  <p key={i}>• {err}</p>
                ))}
                {diagnostic.errors.length > 3 && (
                  <p className="italic">+ {diagnostic.errors.length - 3} autre(s) erreur(s)...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
