import React, { useEffect, useState } from "react";
import { Star, Shield, CheckCircle, BarChart3, MessageSquare, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { surveyService, Survey, AggregatedSurveyResults } from "@/modules/surveys/services/surveyService";
import { Card, PageHead, Badge, Btn, Empty } from "@/lib/ui";
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

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    const list = await surveyService.getSurveys();
    setSurveys(list);
    if (list.length > 0) {
      handleSelectSurvey(list[0]);
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
        toastMsg.success("Évaluation transmise", "Votre avis anonyme a été pris en compte.");
        setSubmitted(true);
        handleSelectSurvey(selectedSurvey);
      } else {
        toastMsg.error("Erreur", res.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isStudent = profile?.role === "student";

  return (
    <div className="space-y-6">
      <PageHead
        title="Qualité & Enquêtes de Satisfaction"
        subtitle="Évaluation anonyme des modules, transparence qualité et retour constructif"
      />

      {surveys.length === 0 ? (
        <Card className="p-8">
          <Empty
            icon={<Shield size={36} />}
            title="Aucune enquête active"
            sub="Les questionnaires d'évaluation de fin de module s'afficheront ici."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Liste des enquêtes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
              Enquêtes & Évaluations
            </h3>
            {surveys.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSurvey(s)}
                className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedSurvey?.id === s.id
                    ? "border-red-500 bg-red-950/20 text-white"
                    : "border-white/10 bg-black/40 text-white/70 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-white">{s.title}</p>
                  <Badge color={s.status === "active" ? "green" : "red"}>{s.status}</Badge>
                </div>
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{s.description || "Évaluation pédagogique"}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
                  <span>Anonyme ✓</span>
                  <span>·</span>
                  <span>Min. {s.min_responses_for_aggregation} réponses</span>
                </div>
              </button>
            ))}
          </div>

          {/* Détails / Formulaire ou Résultats */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSurvey && (
              <>
                <Card className="p-5 border border-white/10 bg-black/60">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-black text-white">{selectedSurvey.title}</h2>
                      <p className="text-xs text-white/60 mt-1">{selectedSurvey.description}</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                      <Shield size={13} /> Anonymat garanti
                    </span>
                  </div>
                </Card>

                {/* Formulaire étudiant si rôle étudiant */}
                {isStudent && !submitted ? (
                  <Card className="p-5 space-y-5">
                    <div className="border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-red-500" />
                        Donner votre avis sur ce module
                      </h3>
                      <p className="text-xs text-white/60 mt-0.5">
                        Vos réponses sont hachées unilatéralement. L'enseignant n'a aucun moyen de vous identifier.
                      </p>
                    </div>

                    {(selectedSurvey.questions || []).map((q, idx) => (
                      <div key={q.id} className="space-y-2 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
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
                          <span className="text-xs font-mono font-bold text-white/70 ml-2">
                            {studentRatings[q.id] ? `${studentRatings[q.id]} / 5` : "Notez"}
                          </span>
                        </div>

                        <input
                          type="text"
                          placeholder="Commentaire ou suggestion constructive (optionnel)..."
                          value={studentComments[q.id] || ""}
                          onChange={(e) => handleCommentChange(q.id, e.target.value)}
                          className="w-full mt-2 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-red-500 focus:outline-none"
                        />
                      </div>
                    ))}

                    <Btn
                      onClick={handleSubmitResponse}
                      disabled={submitting}
                      className="bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold w-full"
                    >
                      <Send size={14} /> {submitting ? "Envoi sécurisé..." : "Transmettre mon avis anonyme"}
                    </Btn>
                  </Card>
                ) : submitted ? (
                  <Card className="p-8 text-center border border-emerald-500/40 bg-emerald-950/20">
                    <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white">Merci pour votre retour !</h3>
                    <p className="text-xs text-white/60 mt-1">
                      Votre réponse a été enregistrée de manière anonyme et sera agrégée avec celles de vos pairs.
                    </p>
                  </Card>
                ) : null}

                {/* Vue agrégée (Enseignants, Admins, ou post-soumission) */}
                {results && (
                  <Card className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 size={16} className="text-red-500" />
                        Résultats Qualité Agrégés
                      </h3>
                      <span className="text-xs font-mono text-white/70">
                        {results.total_respondents} réponse(s)
                      </span>
                    </div>

                    {!results.is_aggregated ? (
                      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 text-xs">
                        <p className="font-bold flex items-center gap-2">
                          <Shield size={16} /> Protection de la vie privée
                        </p>
                        <p className="mt-1 text-white/70">{results.reason}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                          <div className="text-3xl font-black font-mono text-white">
                            {results.average_score ?? "—"} <span className="text-sm text-white/50">/ 5</span>
                          </div>
                          <div className="text-xs text-white/70">
                            Score moyen global de satisfaction calculé sur {results.total_respondents} apprenants.
                          </div>
                        </div>

                        {results.questions_summary.map((qSummary, i) => (
                          <div key={qSummary.question_id} className="p-3.5 rounded-lg border border-white/5 bg-white/[0.01] space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-white">{i + 1}. {qSummary.question_text}</span>
                              <span className="font-mono font-bold text-amber-400">
                                {qSummary.average_rating ? `${qSummary.average_rating} / 5` : "—"}
                              </span>
                            </div>

                            {qSummary.text_answers && qSummary.text_answers.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] uppercase font-bold text-white/50">Verbatims anonymes :</p>
                                {qSummary.text_answers.map((t, idx) => (
                                  <div key={idx} className="p-2 rounded bg-black/40 border border-white/5 text-[11px] text-white/80 italic">
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
    </div>
  );
};
