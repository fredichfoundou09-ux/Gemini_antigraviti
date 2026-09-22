import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, Eye, ArrowRight,
  ArrowLeft, Send, Check, RefreshCw, Lock, Award, FileText, ChevronRight, ChevronLeft
} from "lucide-react";
import { Assessment, AssessmentQuestion, ProctoringEventType } from "../types";
import {
  saveLocalDraft,
  getLocalDraft,
  clearLocalDraft,
  evaluateAnswersLocally,
  sanitizeAssessmentForStudent,
} from "../services/assessmentService";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";
import { Btn, Badge, Card, Modal } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

interface Props {
  rawAssessment: Assessment;
  studentId: string;
  studentName?: string;
  onFinish: (resultSummary: any) => void;
  onCancel: () => void;
}

export function AssessmentRunner({
  rawAssessment,
  studentId,
  studentName,
  onFinish,
  onCancel,
}: Props) {
  const { update, log, db } = useStore();

  // Aseptiser le sujet : aucune bonne réponse n'est transmise au composant apprenant
  const assessment = sanitizeAssessmentForStudent(rawAssessment);

  // États du flux d'examen
  const [phase, setPhase] = useState<"prep" | "exam" | "completed">("prep");
  const [attemptId, setAttemptId] = useState<string>(() => `ATT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  // Chronomètre & Horodatages
  const [startTimeMs, setStartTimeMs] = useState<number>(0);
  const [endTimeMs, setEndTimeMs] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(rawAssessment.duree * 60);

  // Réponses & Sauvegarde
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "offline">("saved");
  const lastSavedAnswersRef = useRef<string>("");

  // Navigation des questions
  const [activeQIndex, setActiveQIndex] = useState<number>(0);

  // Modale de soumission
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Résultat final
  const [finalResult, setFinalResult] = useState<any>(null);

  // Surveillance anti-fraude
  const [proctoringAlerts, setProctoringAlerts] = useState<Array<{ type: ProctoringEventType; time: string; msg: string }>>([]);
  const hasEnteredFullscreenRef = useRef(false);

  const activeQuestion = assessment.questions[activeQIndex] as AssessmentQuestion | undefined;

  // 1. Démarrer l'examen
  const handleStartExam = async () => {
    const now = Date.now();
    const durationMs = rawAssessment.duree * 60 * 1000;
    const end = now + durationMs;

    setStartTimeMs(now);
    setEndTimeMs(end);
    setSecondsRemaining(rawAssessment.duree * 60);

    // Vérifier si un brouillon local existe pour cet examen
    const existingDraft = getLocalDraft(`sn_exam_${assessment.id}_${studentId}`);
    if (existingDraft) {
      setAnswers(existingDraft);
      toastMsg.info("Reprise de session", "Vos réponses sauvegardées ont été automatiquement restaurées.");
    }

    // Tenter le passage en plein écran si mode sécurisé
    if (rawAssessment.modeSecurise && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        hasEnteredFullscreenRef.current = true;
      } catch (err) {
        console.warn("Plein écran non accordé:", err);
      }
    }

    // Si Supabase configuré, appeler la RPC de démarrage
    if (isSupabaseConfigured) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessment.id);
        if (isUuid) {
          const { data: rpcData, error } = await supabase.rpc("start_assessment_attempt", {
            p_test_id: assessment.id,
          });
          if (!error && rpcData?.attempt_id) {
            setAttemptId(rpcData.attempt_id);
            if (rpcData.heure_fin_prevue) {
              const serverEndMs = new Date(rpcData.heure_fin_prevue).getTime();
              setEndTimeMs(serverEndMs);
              setSecondsRemaining(Math.max(0, Math.floor((serverEndMs - Date.now()) / 1000)));
            }
            if (rpcData.reponses_temporaires && Object.keys(rpcData.reponses_temporaires).length > 0) {
              setAnswers(rpcData.reponses_temporaires);
            }
          }
        }
      } catch (e) {
        console.warn("Notice appel start_assessment_attempt:", e);
      }
    }

    setPhase("exam");
  };

  // 2. Journalisation d'un événement suspect
  const recordProctoringEvent = useCallback((type: ProctoringEventType, msg: string) => {
    if (phase !== "exam") return;

    const timeStr = new Date().toLocaleTimeString();
    setProctoringAlerts((prev) => [...prev, { type, time: timeStr, msg }]);

    // Sauvegarder immédiatement les réponses par précaution
    saveLocalDraft(`sn_exam_${assessment.id}_${studentId}`, answers);

    // Journalisation distante si Supabase disponible
    if (isSupabaseConfigured && attemptId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId);
      if (isUuid) {
        void supabase.rpc("log_proctoring_event", {
          p_attempt_id: attemptId,
          p_event_type: type,
          p_details: { message: msg, time: timeStr },
        });
      }
    }

    toastMsg.warning("Avertissement de surveillance", msg);
  }, [phase, assessment.id, studentId, answers, attemptId]);

  // 3. Détection des événements de sécurité pendant l'examen
  useEffect(() => {
    if (phase !== "exam") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordProctoringEvent("perte_visibilite", "Changement d'onglet ou perte de visibilité de l'évaluation.");
      } else {
        recordProctoringEvent("reconnexion", "Retour sur la fenêtre de l'évaluation.");
      }
    };

    const handleWindowBlur = () => {
      recordProctoringEvent("changement_onglet", "Focus perdu : basculement vers une autre application.");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && hasEnteredFullscreenRef.current) {
        recordProctoringEvent("sortie_plein_ecran", "Sortie du mode plein écran détectée.");
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      if (rawAssessment.bloquerCopierColler) {
        e.preventDefault();
        recordProctoringEvent("tentative_copier_coller", "Tentative de copier/coller interceptée et bloquée.");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (rawAssessment.bloquerClicDroit) {
        e.preventDefault();
        recordProctoringEvent("clic_droit", "Clic droit désactivé en mode examen.");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloquer PrintScreen, F12, Ctrl+U
      if (e.key === "PrintScreen" || e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u")) {
        e.preventDefault();
        recordProctoringEvent("touche_interdite", `Raccourci bloqué : ${e.key}`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, rawAssessment.bloquerCopierColler, rawAssessment.bloquerClicDroit, recordProctoringEvent]);

  // 4. Chronomètre persistant basé sur endTimeMs
  useEffect(() => {
    if (phase !== "exam" || !endTimeMs) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((endTimeMs - now) / 1000));
      setSecondsRemaining(diffSec);

      if (diffSec <= 0) {
        clearInterval(interval);
        // Expiration du temps : soumission forcée immédiate
        recordProctoringEvent("expiration_temps", "Temps officiel imparti écoulé.");
        toastMsg.error("Temps écoulé !", "L'épreuve est terminée. Enregistrement automatique de vos réponses.");
        void triggerFinalSubmit(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, endTimeMs]);

  // 5. Sauvegarde automatique continue (Autosave)
  useEffect(() => {
    if (phase !== "exam") return;

    const answersJson = JSON.stringify(answers);
    if (answersJson === lastSavedAnswersRef.current) return;

    setSaveStatus("saving");
    saveLocalDraft(`sn_exam_${assessment.id}_${studentId}`, answers);

    const timer = setTimeout(async () => {
      if (isSupabaseConfigured && attemptId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId);
        if (isUuid) {
          try {
            await supabase.rpc("save_assessment_progress", {
              p_attempt_id: attemptId,
              p_answers: answers,
            });
          } catch (e) {
            console.warn("Échec autosave Supabase, secours local actif:", e);
          }
        }
      }
      lastSavedAnswersRef.current = answersJson;
      setSaveStatus("saved");
    }, 800);

    return () => clearTimeout(timer);
  }, [answers, phase, assessment.id, studentId, attemptId]);

  // 6. Soumission finale de l'examen
  const triggerFinalSubmit = async (forcedByTimeout: boolean = false) => {
    setIsSubmitting(true);

    try {
      let finalEval: any = null;
      const isAttemptUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId);

      // Calcul sécurisé côté serveur si disponible
      if (isSupabaseConfigured && isAttemptUuid) {
        const { data: submitRes, error } = await supabase.rpc("submit_assessment", {
          p_attempt_id: attemptId,
          p_answers: answers,
        });

        if (!error && submitRes?.success) {
          finalEval = submitRes;
        }
      }

      // Si hors-ligne ou fallback local
      if (!finalEval) {
        finalEval = evaluateAnswersLocally(
          rawAssessment.questions,
          answers,
          rawAssessment.bareme,
          rawAssessment.seuilReussite
        );
      }

      const dureeMin = Math.round((Date.now() - (startTimeMs || Date.now())) / 60000);
      const studentObj = db.students.find((s) => s.id === studentId);

      const resultPayload = {
        id: `RES-${Date.now().toString(36)}`,
        testId: rawAssessment.id,
        studentId,
        studentNom: studentObj?.nom,
        studentPrenom: studentObj?.prenom,
        note: finalEval.note,
        bareme: rawAssessment.bareme,
        pourcentage: finalEval.pourcentage,
        date: new Date().toISOString().slice(0, 10),
        heure: new Date().toLocaleTimeString().slice(0, 5),
        reponses: answers,
        valide: !rawAssessment.validationRequise,
        statut: finalEval.statut,
        dureeUtilisee: `${dureeMin} min`,
        nbBonnes: finalEval.nbBonnes || 0,
        nbMauvaises: finalEval.nbMauvaises || 0,
        nbNonRepondues: finalEval.nbNonRepondues || 0,
        proctoringAlertsCount: proctoringAlerts.length,
      };

      // Mettre à jour le store local
      update((d) => ({
        ...d,
        results: [resultPayload, ...d.results.filter((r) => !(r.testId === rawAssessment.id && r.studentId === studentId))],
      }));

      log(`Évaluation soumise par ${studentName || studentId} : ${finalEval.note}/${rawAssessment.bareme}`);
      clearLocalDraft(`sn_exam_${assessment.id}_${studentId}`);

      // Sortir du plein écran
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch { /* ignore */ }
      }

      setFinalResult(resultPayload);
      setPhase("completed");
      onFinish(resultPayload);
    } catch (err: any) {
      console.error("Erreur soumission examen:", err);
      toastMsg.error("Erreur de soumission", err.message || "Impossible de finaliser l'enregistrement.");
    } finally {
      setIsSubmitting(false);
      setConfirmModalOpen(false);
    }
  };

  // Formatage du chronomètre
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== null && String(v).trim() !== "" && (!Array.isArray(v) || v.length > 0);
  }).length;
  const unansweredCount = assessment.questions.length - answeredCount;

  // ==========================================
  // PHASE 1 : ÉCRAN DE PRÉPARATION (Section #14)
  // ==========================================
  if (phase === "prep") {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <Card className="p-8 border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-950 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-400">
            <Award size={32} />
          </div>
          <Badge color="red">ÉVALUATION OFFICIELLE</Badge>
          <h1 className="font-display mt-3 text-2xl font-black text-white">{rawAssessment.titre}</h1>
          <p className="mt-1 text-sm text-slate-400">{rawAssessment.description || "Épreuve numérique individuelle"}</p>

          {/* Grille des caractéristiques */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 text-left">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500">Durée de l'épreuve</span>
              <p className="mt-1 text-sm font-black text-cyan-300">{rawAssessment.duree} minutes</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500">Nombre de questions</span>
              <p className="mt-1 text-sm font-black text-white">{rawAssessment.questions.length} questions</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500">Barème total</span>
              <p className="mt-1 text-sm font-black text-amber-300">/{rawAssessment.bareme} pts</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="text-[10px] uppercase font-bold text-slate-500">Seuil de réussite</span>
              <p className="mt-1 text-sm font-black text-emerald-300">{rawAssessment.seuilReussite} / {rawAssessment.bareme} pts</p>
            </div>
          </div>

          {/* Consignes officielles */}
          {rawAssessment.consignes && (
            <div className="mt-6 text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <FileText size={14} /> Consignes générales
              </p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {rawAssessment.consignes}
              </p>
            </div>
          )}

          {/* Règles de l'épreuve */}
          <div className="mt-4 text-left rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-slate-300 space-y-2">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert size={14} /> Règles et dispositif de surveillance
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>Le chronomètre démarrera dès votre clic sur « Commencer l'évaluation ».</li>
              <li>Vos réponses sont automatiquement sauvegardées au fil de votre frappe.</li>
              <li>Les changements d'onglet, pertes de focus ou sorties de plein écran sont journalisés dans le système.</li>
              <li>À l'expiration du temps, vos réponses seront verrouillées et transmises automatiquement.</li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Btn variant="ghost" onClick={onCancel}>
              Retour
            </Btn>
            <Btn onClick={handleStartExam} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5">
              Commencer l'évaluation <ArrowRight size={16} />
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ==========================================
  // PHASE 3 : ÉCRAN DE FIN / RÉSULTATS IMMÉDIATS
  // ==========================================
  if (phase === "completed") {
    const isSuccess = finalResult && finalResult.note >= rawAssessment.seuilReussite;
    const canSeeImmediateScore = rawAssessment.afficherCorrections || !rawAssessment.validationRequise;

    return (
      <div className="mx-auto max-w-2xl py-10 text-center space-y-6">
        <Card className="p-8 border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 ${
            isSuccess ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-400" : "border-red-500/60 bg-red-500/10 text-red-400"
          }`}>
            <CheckCircle2 size={40} />
          </div>

          <h2 className="font-display text-2xl font-black text-white">Évaluation terminée et enregistrée !</h2>
          <p className="mt-1 text-xs text-slate-400">Vos réponses ont été scellées et transmises avec succès.</p>

          {canSeeImmediateScore && finalResult ? (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-3">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">Votre score calculé</span>
              <p className="font-display text-4xl font-black text-white">
                {finalResult.note} <span className="text-base text-slate-500">/ {rawAssessment.bareme} pts</span>
              </p>
              <div className="flex justify-center gap-2">
                <Badge color="cyan">{finalResult.pourcentage}% de réussite</Badge>
                <Badge color={isSuccess ? "green" : "red"}>
                  {isSuccess ? "Épreuve réussie ✓" : "Sous le seuil de réussite"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-200">
              <p className="font-bold">En attente de validation par le formateur</p>
              <p className="mt-1 text-slate-300">
                Cette épreuve comporte des questions ouvertes ou requiert une validation manuelle avant la publication définitive de votre note.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Btn onClick={onCancel} className="px-8">
              Retourner à mes évaluations
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ==========================================
  // PHASE 2 : DÉROULEMENT DE L'ÉPREUVE (Section #7, #8, #9, #10)
  // ==========================================
  const isUrgent = secondsRemaining <= 300; // Moins de 5 minutes

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[600px] space-y-3 select-none">
      {/* 1. STICKY TOP BAR : CHRONOMÈTRE & INDICATEURS */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/85 p-3.5 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <Badge color="red">EN COURS</Badge>
          <div>
            <h3 className="text-sm font-bold text-white line-clamp-1">{rawAssessment.titre}</h3>
            <span className="text-[11px] text-slate-400">
              {answeredCount} / {assessment.questions.length} répondue(s)
            </span>
          </div>
        </div>

        {/* CHRONOMÈTRE EXACT OBLIGATOIRE (Section #7) */}
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 font-mono text-sm font-black transition ${
          isUrgent
            ? "border-red-500/60 bg-red-500/20 text-red-300 animate-pulse"
            : "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
        }`}>
          <Clock size={16} className={isUrgent ? "text-red-400" : "text-cyan-400"} />
          <span>TEMPS RESTANT : {formatTimer(secondsRemaining)}</span>
        </div>

        {/* Indicateur de sauvegarde automatique (Section #9) */}
        <div className="flex items-center gap-3">
          <span className="text-xs flex items-center gap-1.5 font-medium">
            {saveStatus === "saving" ? (
              <span className="text-amber-300 flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> Synchronisation en cours...
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check size={13} /> ✓ Réponses enregistrées
              </span>
            )}
          </span>

          <Btn
            onClick={() => setConfirmModalOpen(true)}
            className="text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            Terminer l'évaluation
          </Btn>
        </div>
      </div>

      {/* 2. ZONE CENTRALE : QUESTION EN COURS & NAVIGATION */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Volet questions (Pills) */}
        <div className="col-span-12 md:col-span-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-md flex flex-col overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Plan de l'épreuve
          </span>
          <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-1 flex-1">
            {assessment.questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== "";
              const isCurrent = idx === activeQIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    if (rawAssessment.navigationLibre) setActiveQIndex(idx);
                  }}
                  disabled={!rawAssessment.navigationLibre}
                  className={`h-10 rounded-xl border text-xs font-bold transition flex items-center justify-center ${
                    isCurrent
                      ? "border-cyan-400 bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                      : isAnswered
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-white/5 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Question répondue
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> Question en cours
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" /> Non répondue
            </div>
          </div>
        </div>

        {/* Question active */}
        <div className="col-span-12 md:col-span-9 rounded-2xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-md flex flex-col justify-between overflow-y-auto">
          {activeQuestion ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="font-display text-base font-bold text-cyan-400">
                  Question {activeQIndex + 1} sur {assessment.questions.length}
                </span>
                <div className="flex items-center gap-2">
                  <Badge color="cyan">{activeQuestion.type.toUpperCase()}</Badge>
                  <Badge color="gold">{activeQuestion.points} point{activeQuestion.points > 1 ? "s" : ""}</Badge>
                </div>
              </div>

              {/* Énoncé */}
              <div className="text-base font-medium text-white leading-relaxed">
                {activeQuestion.question}
              </div>

              {/* Formulaire de réponse selon le type */}
              {(activeQuestion.type === "qcm" || activeQuestion.type === "vf") && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {(activeQuestion.options || (activeQuestion.type === "vf" ? ["Vrai", "Faux"] : [])).map((opt, i) => {
                    const isSelected = answers[activeQuestion.id] === opt;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [activeQuestion.id]: opt })}
                        className={`rounded-2xl border p-4 text-left text-sm font-semibold transition flex items-center gap-3 ${
                          isSelected
                            ? "border-cyan-400/80 bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-400"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs ${
                          isSelected ? "border-cyan-400 bg-cyan-400 text-slate-950 font-bold" : "border-white/20 text-slate-400"
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeQuestion.type === "qcm_multiple" && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {(activeQuestion.options || []).map((opt, i) => {
                    const selectedList: string[] = Array.isArray(answers[activeQuestion.id])
                      ? answers[activeQuestion.id]
                      : [];
                    const isSelected = selectedList.includes(opt);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const next = isSelected
                            ? selectedList.filter((x) => x !== opt)
                            : [...selectedList, opt];
                          setAnswers({ ...answers, [activeQuestion.id]: next });
                        }}
                        className={`rounded-2xl border p-4 text-left text-sm font-semibold transition flex items-center justify-between ${
                          isSelected
                            ? "border-cyan-400/80 bg-cyan-400/15 text-cyan-100 shadow-lg ring-1 ring-cyan-400"
                            : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono text-xs ${
                            isSelected ? "border-cyan-400 bg-cyan-400 text-slate-950 font-bold" : "border-white/20 text-slate-400"
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span>{opt}</span>
                        </div>
                        {isSelected && <CheckCircle2 size={16} className="text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeQuestion.type === "courte" && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs text-slate-400">Votre réponse textuelle :</span>
                  <input
                    type="text"
                    value={answers[activeQuestion.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [activeQuestion.id]: e.target.value })}
                    placeholder="Saisissez votre réponse ici..."
                    className="w-full rounded-xl border border-white/15 bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}

              {activeQuestion.type === "longue" && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs text-slate-400">Rédigez votre réponse détaillée :</span>
                  <textarea
                    rows={6}
                    value={answers[activeQuestion.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [activeQuestion.id]: e.target.value })}
                    placeholder="Développez votre argumentation avec soin..."
                    className="w-full rounded-xl border border-white/15 bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              )}

              {activeQuestion.type === "numerique" && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs text-slate-400">Résultat numérique :</span>
                  <input
                    type="number"
                    step="any"
                    value={answers[activeQuestion.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [activeQuestion.id]: e.target.value })}
                    placeholder="Ex : 42 ou 3.14"
                    className="w-full sm:w-72 rounded-xl border border-white/15 bg-white/[0.03] p-4 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-xs text-slate-500">Sélectionnez une question.</p>
          )}

          {/* Boutons Suivant / Précédent */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-6">
            <button
              onClick={() => setActiveQIndex(Math.max(0, activeQIndex - 1))}
              disabled={activeQIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronLeft size={16} /> Question précédente
            </button>

            <button
              onClick={() => setActiveQIndex(Math.min(assessment.questions.length - 1, activeQIndex + 1))}
              disabled={activeQIndex === assessment.questions.length - 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-30"
            >
              Question suivante <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. MODALE DE CONFIRMATION DE SOUMISSION (Section #10) */}
      <Modal open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Terminer l'évaluation">
        <div className="space-y-4">
          <p className="text-sm text-slate-200">
            Êtes-vous certain de vouloir soumettre et clôturer définitivement cette évaluation ?
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-400">Répondues</span>
              <p className="mt-1 font-bold text-emerald-400 text-lg">{answeredCount}</p>
            </div>
            <div>
              <span className="text-slate-400">Non répondues</span>
              <p className={`mt-1 font-bold text-lg ${unansweredCount > 0 ? "text-amber-400" : "text-slate-500"}`}>
                {unansweredCount}
              </p>
            </div>
            <div>
              <span className="text-slate-400">Temps restant</span>
              <p className="mt-1 font-mono font-bold text-cyan-300 text-lg">{formatTimer(secondsRemaining)}</p>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Attention : il vous reste {unansweredCount} question(s) sans réponse.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Btn variant="ghost" onClick={() => setConfirmModalOpen(false)} disabled={isSubmitting}>
              Poursuivre l'évaluation
            </Btn>
            <Btn
              onClick={() => triggerFinalSubmit(false)}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {isSubmitting ? "Enregistrement final..." : "Confirmer et terminer"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
