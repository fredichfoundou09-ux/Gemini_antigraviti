import React, { useEffect, useState } from "react";
import {
  Star,
  Shield,
  CheckCircle,
  BarChart3,
  MessageSquare,
  Send,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Printer,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { surveyService, Survey, AggregatedSurveyResults } from "@/modules/surveys/services/surveyService";
import { Card, PageHead, Badge, Btn, Empty, Modal, Field, Input, Select, Textarea, printHTML } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const SurveysAndQualityPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<AggregatedSurveyResults | null>(null);
  const [studentRatings, setStudentRatings] = useState<Record<string, number>>({});
  const [studentComments, setStudentComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSurveyTitle, setNewSurveyTitle] = useState("");
  const [newSurveyDesc, setNewSurveyDesc] = useState("");
  const [newSurveyModuleId, setNewSurveyModuleId] = useState("");
  const [newQuestions, setNewQuestions] = useState<string[]>([
    "Qualité globale de l'enseignement et clarté des explications",
    "Pertinence des travaux pratiques et des exercices appliqués",
    "Disponibilité et accompagnement du formateur",
  ]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const isStaff = profile?.role === "superadmin" || profile?.role === "admin" || profile?.role === "teacher";
  const isStudent = profile?.role === "student";

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    const list = await surveyService.getSurveys();
    setSurveys(list);
    if (list.length > 0) {
      if (selectedSurvey) {
        const found = list.find((s) => s.id === selectedSurvey.id);
        if (found) {
          handleSelectSurvey(found);
          return;
        }
      }
      handleSelectSurvey(list[0]);
    } else {
      setSelectedSurvey(null);
      setResults(null);
    }
  };

  const handleSelectSurvey = async (survey: Survey) => {
    setSelectedSurvey(survey);
    setSubmitted(false);
    try {
      const res = await surveyService.getAggregatedResults(survey.id);
      setResults(res);
    } catch {
      setResults(null);
    }
  };

  const handleRatingChange = (qId: string, rating: number) => {
    setStudentRatings((prev) => ({ ...prev, [qId]: rating }));
  };

  const handleCommentChange = (qId: string, text: string) => {
    setStudentComments((prev) => ({ ...prev, [qId]: text }));
  };

  const handleSubmitResponse = async () => {
    if (!selectedSurvey) return;
    const questions = selectedSurvey.questions || [];
    if (questions.length === 0) return;

    setSubmitting(true);
    try {
      const answers = questions.map((q) => ({
        question_id: q.id,
        rating_value: studentRatings[q.id] || 5,
        text_value: studentComments[q.id] || "",
      }));

      const res = await surveyService.submitSurveyAnswers(
        selectedSurvey.id,
        profile?.id || "mock-student",
        answers
      );

      if (res.success) {
        toastMsg.success("Évaluation transmise", "Votre avis anonyme a été pris en compte ✓");
        setSubmitted(true);
        handleSelectSurvey(selectedSurvey);
      } else {
        toastMsg.error("Erreur", res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSurvey = async () => {
    if (!newSurveyTitle.trim()) {
      toastMsg.error("Titre requis", "Veuillez renseigner le titre de l'enquête.");
      return;
    }

    const qList = newQuestions.filter((q) => q.trim().length > 0).map((q) => ({
      question_text: q.trim(),
      category: "qualite",
    }));

    if (qList.length === 0) {
      toastMsg.error("Questions requises", "Veuillez ajouter au moins une question d'évaluation.");
      return;
    }

    const res = await surveyService.createSurvey({
      title: newSurveyTitle.trim(),
      description: newSurveyDesc.trim(),
      module_id: newSurveyModuleId || undefined,
      questions: qList,
    });

    if (res.success) {
      toastMsg.success("Enquête créée", "Le questionnaire est maintenant ouvert aux apprenants.");
      setShowAddModal(false);
      setNewSurveyTitle("");
      setNewSurveyDesc("");
      loadSurveys();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleOpenEdit = () => {
    if (!selectedSurvey) return;
    setEditTitle(selectedSurvey.title);
    setEditDesc(selectedSurvey.description || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSurvey || !editTitle.trim()) return;
    const res = await surveyService.updateSurvey(selectedSurvey.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    if (res.success) {
      toastMsg.success("Enquête modifiée", "Les informations ont été mises à jour.");
      setShowEditModal(false);
      loadSurveys();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteSurvey = async (surveyId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cette enquête ?")) return;
    const res = await surveyService.deleteSurvey(surveyId);
    if (res.success) {
      toastMsg.success("Enquête supprimée", "Le questionnaire et ses données ont été supprimés.");
      loadSurveys();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handlePrintReport = () => {
    if (!selectedSurvey) return;
    const moduleName = db.modules.find((m) => m.id === selectedSurvey.module_id)?.titre || "Établissement";

    const questionsHtml = (results?.questions_summary || [])
      .map(
        (q, idx) => `
      <tr>
        <td style="font-weight:bold">${idx + 1}. ${q.question_text}</td>
        <td style="text-align:center;font-weight:bold;color:#0284c7;font-family:monospace">${q.average_rating ? `${q.average_rating} / 5` : '—'}</td>
        <td>
          ${q.text_answers && q.text_answers.length > 0 ? q.text_answers.map((t) => `<div style="font-size:11px;font-style:italic;color:#475569;margin-bottom:2px">« ${t} »</div>`).join('') : '<small style="color:#94a3b8">Aucun commentaire</small>'}
        </td>
      </tr>
    `
      )
      .join("");

    printHTML(
      `Rapport_Qualite_${selectedSurvey.title.replace(/\s+/g, '_')}`,
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge-official">AUDIT QUALITÉ & SATISFACTION APPRENANTS</span>
            <h1 style="margin:8px 0 2px 0;font-size:20px;color:#0c4a6e">${selectedSurvey.title}</h1>
            <p style="margin:0;font-size:11px;color:#64748b">Module : <strong>${moduleName}</strong> · Seuil d'anonymat garanti (min 5 répondants)</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:26px;font-weight:900;color:#0284c7;font-family:monospace">
              ${results?.average_score ? `${results.average_score} / 5` : 'En attente'}
            </div>
            <div style="font-size:11px;color:#64748b">${results?.total_respondents || 0} réponse(s) collectée(s)</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Indicateur d'évaluation</th>
              <th style="width:90px;text-align:center">Note Moyenne</th>
              <th>Verbatims & Commentaires anonymisés</th>
            </tr>
          </thead>
          <tbody>
            ${questionsHtml || '<tr><td colspan="3" style="text-align:center;color:#64748b">Données en cours de recueillement ou seuil d\'anonymat non atteint.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
          <div>Certifié conforme · Commission Qualité et Pédagogie Sentinelles Numériques</div>
          <div>Émis le ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>
    `
    );
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Qualité & Enquêtes de Satisfaction"
        subtitle="Évaluation anonyme des modules, transparence qualité et retour constructif certifié"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedSurvey && (
              <Btn onClick={handlePrintReport} variant="outline" className="border-cyan-500/30 text-cyan-200">
                <Printer size={14} /> Imprimer Rapport Qualité
              </Btn>
            )}
            {isStaff && (
              <Btn
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
              >
                <Plus size={14} /> Nouvelle Enquête
              </Btn>
            )}
          </div>
        }
      />

      {surveys.length === 0 ? (
        <Card className="p-12 text-center border border-cyan-500/30 bg-[#0B1220]/90">
          <Empty
            icon={<Shield size={36} className="text-cyan-400" />}
            title="Aucune enquête active"
            sub="Les questionnaires d'évaluation de fin de module s'afficheront ici."
          />
          {isStaff && (
            <Btn onClick={() => setShowAddModal(true)} className="mt-4 bg-cyan-600 text-white">
              <Plus size={14} /> Créer la première enquête
            </Btn>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des enquêtes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Enquêtes & Évaluations ({surveys.length})
            </h3>
            {surveys.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSurvey(s)}
                className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedSurvey?.id === s.id
                    ? "border-cyan-400 bg-cyan-950/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                    : "border-white/10 bg-[#0B1220]/80 text-slate-300 hover:border-cyan-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-white">{s.title}</p>
                  <Badge color={s.status === "active" ? "green" : "red"}>{s.status}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {s.description || "Évaluation pédagogique"}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-2">
                  <span className="text-cyan-400 font-semibold">Anonymat garanti ✓</span>
                  <span>Min. {s.min_responses_for_aggregation} réponses</span>
                </div>
              </button>
            ))}
          </div>

          {/* Détails / Formulaire ou Résultats */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSurvey && (
              <>
                <Card className="p-5 border border-cyan-500/30 bg-[#0B1220]/90 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-white">{selectedSurvey.title}</h2>
                      <p className="text-xs text-slate-400 mt-1">{selectedSurvey.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                        <Shield size={13} /> Anonymat garanti
                      </span>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={handleOpenEdit}
                          title="Modifier l'enquête"
                          className="p-1 rounded text-slate-400 hover:text-cyan-300"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSurvey(selectedSurvey.id)}
                          title="Supprimer l'enquête"
                          className="p-1 rounded text-slate-400 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Formulaire étudiant si rôle étudiant */}
                {isStudent && !submitted ? (
                  <Card className="p-5 space-y-5 border border-cyan-500/30 bg-[#0B1220]/90">
                    <div className="border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-cyan-400" />
                        Donner votre avis sur ce module
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Vos réponses sont hachées unilatéralement. L'enseignant n'a aucun moyen de vous identifier.
                      </p>
                    </div>

                    {(selectedSurvey.questions || []).map((q, idx) => (
                      <div key={q.id} className="space-y-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-xs font-semibold text-white">
                          {idx + 1}. {q.question_text}
                        </p>

                        {/* Étoiles 1-5 */}
                        <div className="flex items-center gap-2 pt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRatingChange(q.id, star)}
                              className="p-1 text-white/30 hover:text-amber-400 transition cursor-pointer"
                            >
                              <Star
                                size={20}
                                className={
                                  (studentRatings[q.id] || 0) >= star
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-white/20"
                                }
                              />
                            </button>
                          ))}
                          <span className="text-xs font-mono font-bold text-slate-300 ml-2">
                            {studentRatings[q.id] ? `${studentRatings[q.id]} / 5` : "Notez"}
                          </span>
                        </div>

                        <input
                          type="text"
                          placeholder="Commentaire ou suggestion constructive (optionnel)..."
                          value={studentComments[q.id] || ""}
                          onChange={(e) => handleCommentChange(q.id, e.target.value)}
                          className="w-full mt-2 rounded-lg border border-cyan-500/30 bg-[#07101E] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                    ))}

                    <Btn
                      onClick={handleSubmitResponse}
                      disabled={submitting}
                      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold w-full"
                    >
                      <Send size={14} /> {submitting ? "Envoi sécurisé..." : "Transmettre mon avis anonyme"}
                    </Btn>
                  </Card>
                ) : submitted ? (
                  <Card className="p-8 text-center border border-emerald-500/40 bg-emerald-950/20">
                    <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white">Merci pour votre retour !</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Votre réponse a été enregistrée de manière anonyme et sera agrégée avec celles de vos pairs.
                    </p>
                  </Card>
                ) : null}

                {/* Vue agrégée (Enseignants, Admins, ou post-soumission) */}
                {results && (
                  <Card className="p-5 space-y-4 border border-cyan-500/30 bg-[#0B1220]/90">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 size={16} className="text-cyan-400" />
                        Résultats Qualité Agrégés
                      </h3>
                      <span className="text-xs font-mono text-cyan-300">
                        {results.total_respondents} réponse(s)
                      </span>
                    </div>

                    {!results.is_aggregated ? (
                      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 text-xs">
                        <p className="font-bold flex items-center gap-2">
                          <Shield size={16} /> Protection de la vie privée
                        </p>
                        <p className="mt-1 text-slate-300">{results.reason}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                          <div className="text-3xl font-black font-mono text-cyan-300">
                            {results.average_score ?? "—"} <span className="text-sm text-slate-400">/ 5</span>
                          </div>
                          <div className="text-xs text-slate-300">
                            Score moyen global de satisfaction calculé sur {results.total_respondents} apprenants.
                          </div>
                        </div>

                        {results.questions_summary.map((qSummary, i) => (
                          <div
                            key={qSummary.question_id}
                            className="p-3.5 rounded-lg border border-white/5 bg-white/[0.01] space-y-2"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-white">
                                {i + 1}. {qSummary.question_text}
                              </span>
                              <span className="font-mono font-bold text-amber-400">
                                {qSummary.average_rating ? `${qSummary.average_rating} / 5` : "—"}
                              </span>
                            </div>

                            {qSummary.text_answers && qSummary.text_answers.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] uppercase font-bold text-slate-400">
                                  Verbatims anonymes :
                                </p>
                                {qSummary.text_answers.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 rounded bg-black/40 border border-white/5 text-[11px] text-slate-300 italic"
                                  >
                                    « {t} »
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Créer Enquête */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Créer une enquête de satisfaction">
        <div className="space-y-4">
          <Field label="Titre de l'enquête">
            <Input
              value={newSurveyTitle}
              onChange={(e) => setNewSurveyTitle(e.target.value)}
              placeholder="ex: Évaluation de fin de module : Cybersécurité Avancée"
            />
          </Field>
          <Field label="Module rattaché">
            <Select
              value={newSurveyModuleId}
              onChange={(e) => setNewSurveyModuleId(e.target.value)}
            >
              <option value="">Général / Tous les modules</option>
              {db.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description & Objectifs">
            <Textarea
              value={newSurveyDesc}
              onChange={(e) => setNewSurveyDesc(e.target.value)}
              placeholder="Expliquez aux apprenants l'importance de leur retour pour améliorer la pédagogie..."
            />
          </Field>

          <div>
            <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 block">
              Questions d'évaluation (Notation 1-5 étoiles) :
            </label>
            <div className="space-y-2">
              {newQuestions.map((q, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={q}
                    onChange={(e) => {
                      const next = [...newQuestions];
                      next[idx] = e.target.value;
                      setNewQuestions(next);
                    }}
                    placeholder={`Question ${idx + 1}`}
                  />
                  {newQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <Btn
                variant="outline"
                onClick={() => setNewQuestions([...newQuestions, ""])}
                className="text-xs mt-1"
              >
                + Ajouter une question
              </Btn>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowAddModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateSurvey} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Publier l'enquête
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Modifier Enquête */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier l'enquête">
        <div className="space-y-4">
          <Field label="Titre">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowEditModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSaveEdit} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
