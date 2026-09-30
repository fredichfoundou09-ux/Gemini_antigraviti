import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  Assessment,
  AssessmentQuestion,
  AssessmentAttempt,
  ProctoringEventType,
  AssessmentResultSummary,
} from "../types";

export interface ValidationDiagnostic {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 1. Validation stricte avant publication (Exigence #5)
export function validateAssessmentForPublication(assessment: Assessment): ValidationDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!assessment.titre?.trim()) {
    errors.push("Le titre de l'évaluation est obligatoire.");
  }

  if (!assessment.moduleId?.trim()) {
    errors.push("Le module associé est obligatoire.");
  }

  if (!assessment.consignes?.trim()) {
    errors.push("Les consignes générales sont obligatoires avant publication.");
  }

  if (!assessment.duree || assessment.duree <= 0) {
    errors.push("La durée de l'épreuve doit être supérieure à 0 minute.");
  }

  if (assessment.bareme <= 0) {
    errors.push("Le barème global doit être strictement supérieur à 0 point.");
  }

  if (!assessment.questions || assessment.questions.length === 0) {
    errors.push("L'évaluation doit comporter au moins une question.");
  } else {
    let totalPoints = 0;
    assessment.questions.forEach((q, idx) => {
      totalPoints += q.points || 0;
      const qNum = idx + 1;

      if (!q.question?.trim()) {
        errors.push(`Question ${qNum} : L'énoncé de la question est vide.`);
      }

      if (q.points <= 0) {
        errors.push(`Question ${qNum} : Le nombre de points doit être supérieur à 0.`);
      }

      if (q.type === "qcm") {
        if (!q.options || q.options.filter(Boolean).length < 2) {
          errors.push(`Question ${qNum} (QCM) : Vous devez renseigner au moins 2 options.`);
        }
        if (!q.bonneReponse?.trim()) {
          errors.push(`Question ${qNum} (QCM) : Aucune réponse correcte n'est sélectionnée.`);
        }
      } else if (q.type === "qcm_multiple") {
        if (!q.options || q.options.filter(Boolean).length < 2) {
          errors.push(`Question ${qNum} (QCM Multiple) : Vous devez renseigner au moins 2 options.`);
        }
        if (!q.bonnesReponses || q.bonnesReponses.length === 0) {
          errors.push(`Question ${qNum} (QCM Multiple) : Sélectionnez au moins une bonne réponse.`);
        }
      } else if (q.type === "vf") {
        if (!q.bonneReponse || !["Vrai", "Faux"].includes(q.bonneReponse)) {
          errors.push(`Question ${qNum} (Vrai/Faux) : Définissez si la réponse attendue est Vrai ou Faux.`);
        }
      } else if (q.type === "courte") {
        if (!q.bonneReponse?.trim()) {
          warnings.push(`Question ${qNum} (Réponse courte) : Pas de réponse type définie (notation manuelle probable).`);
        }
      } else if (q.type === "numerique") {
        if (q.valeurNumerique === undefined && !q.bonneReponse?.trim()) {
          errors.push(`Question ${qNum} (Numérique) : Vous devez spécifier la valeur numérique attendue.`);
        }
      }
    });

    if (totalPoints !== assessment.bareme) {
      warnings.push(`La somme des points (${totalPoints} pts) diffère du barème affiché (${assessment.bareme} pts). Le calcul sera proportionnel.`);
    }
  }

  if (assessment.dateDebut && assessment.dateFin && assessment.dateDebut > assessment.dateFin) {
    errors.push("La date de début doit être antérieure à la date de fin.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// 2. Assainissement du sujet pour les apprenants (Ne JAMAIS exposer les réponses)
export function sanitizeAssessmentForStudent(assessment: Assessment): Assessment {
  return {
    ...assessment,
    questions: assessment.questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []),
      choices: (q.choices || []).map((c) => ({ id: c.id, texte: c.texte })),
      points: q.points,
      ordre: q.ordre,
      obligatoire: q.obligatoire !== false,
      // Les données sensibles sont délibérément supprimées
      bonneReponse: undefined,
      bonnesReponses: undefined,
      valeurNumerique: undefined,
      toleranceNumerique: undefined,
      explication: undefined,
    })),
  };
}

// 3. Sauvegarde locale de secours (Autosave tolérant aux coupures)
export function saveLocalDraft(attemptId: string, answers: Record<string, any>) {
  try {
    localStorage.setItem(`sn_attempt_draft_${attemptId}`, JSON.stringify({
      answers,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.warn("Échec sauvegarde localStorage:", err);
  }
}

export function getLocalDraft(attemptId: string): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(`sn_attempt_draft_${attemptId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.answers || null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(attemptId: string) {
  try {
    localStorage.removeItem(`sn_attempt_draft_${attemptId}`);
  } catch { /* ignore */ }
}

// 4. Calcul de correction automatique hors-ligne / de secours
export function evaluateAnswersLocally(
  questions: AssessmentQuestion[],
  answers: Record<string, any>,
  bareme: number,
  seuilReussite: number
) {
  let earnedPoints = 0;
  let totalPoints = 0;
  let nbBonnes = 0;
  let nbMauvaises = 0;
  let nbNonRepondues = 0;
  let requiresManual = false;

  const details = questions.map((q) => {
    totalPoints += q.points || 1;
    const rawAnswer = answers[q.id];
    let isCorrect = false;
    let answerText: string;

    if (rawAnswer === undefined || rawAnswer === null || String(rawAnswer).trim() === "") {
      nbNonRepondues++;
      return {
        questionId: q.id,
        reponseDonnee: "",
        correct: false,
        pointsObtenus: 0,
        statutCorrection: "auto" as const,
      };
    }

    if (q.type === "longue") {
      requiresManual = true;
      answerText = String(rawAnswer);
      return {
        questionId: q.id,
        reponseDonnee: answerText,
        reponseLongue: answerText,
        correct: false,
        pointsObtenus: 0,
        statutCorrection: "en_attente" as const,
      };
    } else if (q.type === "numerique") {
      answerText = String(rawAnswer).trim();
      const numVal = parseFloat(answerText.replace(",", "."));
      const expected = q.valeurNumerique !== undefined ? q.valeurNumerique : parseFloat(String(q.bonneReponse || "").replace(",", "."));
      const tolerance = q.toleranceNumerique || 0;
      if (!isNaN(numVal) && !isNaN(expected)) {
        isCorrect = Math.abs(numVal - expected) <= tolerance;
      }
    } else if (q.type === "qcm_multiple") {
      const selectedArr = Array.isArray(rawAnswer) ? rawAnswer : [String(rawAnswer)];
      answerText = selectedArr.join(", ");
      const expectedArr = q.bonnesReponses || (q.bonneReponse ? [q.bonneReponse] : []);
      // Égalité d'ensembles
      if (selectedArr.length === expectedArr.length && selectedArr.every((item) => expectedArr.includes(item))) {
        isCorrect = true;
      }
    } else if (q.type === "vf" || q.type === "qcm") {
      answerText = String(rawAnswer).trim();
      isCorrect = answerText.toLowerCase() === (q.bonneReponse || "").trim().toLowerCase();
    } else {
      // Courte : comparaison stricte sans accents et insensible à la casse
      answerText = String(rawAnswer).trim();
      const normalizeText = (s: string) =>
        s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const given = normalizeText(answerText);
      const expected = normalizeText(q.bonneReponse || "");

      if (!expected) {
        // Bonne réponse non configurée -> correction manuelle requise
        requiresManual = true;
        return {
          questionId: q.id,
          reponseDonnee: answerText,
          correct: false,
          pointsObtenus: 0,
          statutCorrection: "en_attente" as const,
        };
      } else {
        isCorrect = given === expected;
      }
    }

    if (isCorrect) {
      earnedPoints += q.points || 1;
      nbBonnes++;
    } else {
      nbMauvaises++;
    }

    return {
      questionId: q.id,
      reponseDonnee: answerText,
      correct: isCorrect,
      pointsObtenus: isCorrect ? (q.points || 1) : 0,
      statutCorrection: "auto" as const,
    };
  });

  const finalBareme = bareme > 0 ? bareme : 20;
  const note = Math.round((earnedPoints / Math.max(1, totalPoints)) * finalBareme * 10) / 10;
  const pct = Math.round((earnedPoints / Math.max(1, totalPoints)) * 100);
  const reussi = note >= seuilReussite;

  return {
    note,
    pourcentage: pct,
    bareme: finalBareme,
    statut: reussi ? ("reussi" as const) : ("echoue" as const),
    nbBonnes,
    nbMauvaises,
    nbNonRepondues,
    requiresManual,
    details,
  };
}

// 5. Synchronisation Supabase d'une évaluation
export async function persistAssessmentToSupabase(assessment: Assessment): Promise<{ success: boolean; id: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: true, id: assessment.id };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessment.id);

    const testPayload: Record<string, any> = {
      id: isUuid ? assessment.id : undefined,
      titre: assessment.titre || "Évaluation sans titre",
      description: assessment.description || "",
      consignes: assessment.consignes?.trim() || "Veuillez lire attentivement chaque consigne et répondre dans le temps imparti.",
      module_id: assessment.moduleId,
      teacher_id: assessment.teacherId,
      duree: Number(assessment.duree || 45),
      bareme: Number(assessment.bareme || 20),
      seuil_reussite: Number(assessment.seuilReussite || 10),
      difficulte: assessment.difficulte || "moyen",
      tentatives: Number(assessment.tentatives || 1),
      afficher_corrections: assessment.afficherCorrections !== false,
      validation_requise: Boolean(assessment.validationRequise),
      statut: assessment.statut || "publie",
      audience: assessment.audience || "all",
      target_groupe: assessment.targetGroupe || null,
      target_student_ids: assessment.targetStudentIds || [],
      mode_securise: Boolean(assessment.modeSecurise),
      bloquer_copier_coller: assessment.bloquerCopierColler !== false,
      bloquer_clic_droit: Boolean(assessment.bloquerClicDroit),
      navigation_libre: assessment.navigationLibre !== false,
      date_debut: assessment.dateDebut ? `${assessment.dateDebut}T${assessment.dateDebutHeure || "00:00"}:00Z` : null,
      date_fin: assessment.dateFin ? `${assessment.dateFin}T${assessment.dateFinHeure || "23:59"}:00Z` : null,
      date_publication: (assessment.statut === "publie" || assessment.statut === "en_cours") ? (assessment.datePublication || new Date().toISOString()) : null,
    };

    const questionsPayload = (assessment.questions || []).map((q, idx) => ({
      question: q.question || `Question ${idx + 1}`,
      type: q.type || "qcm",
      points: Number(q.points || 1),
      bonne_reponse: q.bonneReponse || (q.bonnesReponses ? q.bonnesReponses[0] : "") || "",
      bonnes_reponses_json: q.bonnesReponses || (q.bonneReponse ? [q.bonneReponse] : []),
      options_json: q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []),
      valeur_numerique: q.valeurNumerique !== null && q.valeurNumerique !== undefined ? Number(q.valeurNumerique) : null,
      tolerance_numerique: Number(q.toleranceNumerique || 0),
      explication: q.explication || "",
      ordre: idx + 1,
      obligatoire: q.obligatoire !== false,
    }));

    // 1. Tenter l'appel de la RPC sécurisée upsert_test_safe
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("upsert_test_safe", {
      p_test: testPayload,
      p_questions: questionsPayload,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      return { success: true, id: rpcRes.id || assessment.id };
    }

    if (rpcErr) {
      console.warn("Fallback upsert direct tests:", rpcErr);
    }

    // 2. Fallback upsert direct si la RPC n'est pas invoquable
    let moduleId = assessment.moduleId;
    const isModUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(moduleId);
    if (!isModUuid) {
      const { data: mRow } = await supabase.from("modules").select("id").eq("titre", moduleId).maybeSingle();
      if (mRow?.id) moduleId = mRow.id;
      else {
        const { data: firstM } = await supabase.from("modules").select("id").limit(1).maybeSingle();
        if (firstM?.id) moduleId = firstM.id;
      }
    }
    testPayload.module_id = moduleId;

    let testId = assessment.id;
    if (isUuid) {
      testPayload.id = assessment.id;
      const { error: upsertErr } = await supabase.from("tests").upsert(testPayload);
      if (upsertErr) throw upsertErr;
    } else {
      const { data: inserted, error: insErr } = await supabase.from("tests").insert(testPayload).select("id").single();
      if (insErr) throw insErr;
      if (inserted?.id) testId = inserted.id;
    }

    if (questionsPayload.length > 0) {
      await supabase.from("questions").delete().eq("test_id", testId);
      const rows = questionsPayload.map((q) => ({ ...q, test_id: testId }));
      await supabase.from("questions").insert(rows);
    }

    return { success: true, id: testId };
  } catch (err: any) {
    console.error("Erreur persistAssessmentToSupabase:", err);
    return { success: false, id: assessment.id, error: err.message || "Erreur base de données" };
  }
}

// Suppression sécurisée d'une évaluation
export async function deleteAssessment(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      const { data, error } = await supabase.rpc("delete_test_safe", { p_test_id: id });
      if (!error && data && data.success) {
        return { success: true };
      }
    }

    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Erreur suppression évaluation:", err);
    return { success: false, error: err.message };
  }
}

// Suppression d'un résultat d'examen
export async function deleteTestResult(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const { error } = await supabase.from("test_results").delete().eq("id", id);
    if (error) throw error;
    // Supprimer également du cache local
    const locals = getLocalAssessmentResults().filter((r) => r.id !== id);
    saveLocalAssessmentResults(locals);
    return { success: true };
  } catch (err: any) {
    console.error("Erreur suppression résultat test:", err);
    return { success: false, error: err.message };
  }
}

// 7. Persistance locale haute fiabilité des résultats d'évaluations (Offline resilience)
const RESULTS_STORAGE_KEY = "sn_assessment_results";

export function getLocalAssessmentResults(): AssessmentResultSummary[] {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAssessmentResults(results: AssessmentResultSummary[]): void {
  try {
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
  } catch (e) {
    console.warn("Erreur sauvegarde locale résultats évaluations:", e);
  }
}

/**
 * Enregistre un résultat d'examen de manière infaillible :
 * 1. Enregistre immédiatement dans le cache local (localStorage) pour garantir l'absence de perte
 * 2. Tente la RPC sécurisée `submit_assessment_result_safe`
 * 3. Fallback avec auto-résolution UUID et insertion directe dans public.test_results
 */
export async function submitAssessmentResultToSupabase(
  result: AssessmentResultSummary,
  answers: Record<string, any> = {}
): Promise<{ success: boolean; id: string; error?: string }> {
  // 1. Sauvegarde locale prioritaire et inconditionnelle
  try {
    const existing = getLocalAssessmentResults();
    const updated = [
      result,
      ...existing.filter((r) => !(r.testId === result.testId && r.studentId === result.studentId)),
    ];
    saveLocalAssessmentResults(updated);
  } catch (e) {
    console.warn("Erreur cache local résultat:", e);
  }

  if (!isSupabaseConfigured) {
    return { success: true, id: result.id };
  }

  try {
    // 2. Appel de la RPC sécurisée SECURITY DEFINER
    const isTestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.testId);
    const answersArray = Object.entries(answers).map(([qId, val]) => ({
      questionId: qId,
      reponseDonnee: typeof val === "string" ? val : JSON.stringify(val),
    }));

    const { data: rpcData, error: rpcErr } = await supabase.rpc("submit_assessment_result_safe", {
      p_result: {
        testId: isTestUuid ? result.testId : undefined,
        studentId: result.studentId,
        studentNom: result.studentNom,
        studentPrenom: result.studentPrenom,
        note: result.note,
        bareme: result.bareme,
        pourcentage: result.pourcentage,
        date: result.date,
        heure: result.heure,
        valide: result.valide,
        statut: result.statut,
      },
      p_answers: answersArray,
    });

    if (!rpcErr && rpcData && rpcData.success) {
      return { success: true, id: rpcData.id || result.id };
    }

    if (rpcErr) {
      console.warn("RPC submit_assessment_result_safe non disponible ou erreur, repli direct:", rpcErr);
    }

    // 3. Fallback direct vers public.test_results
    if (isTestUuid) {
      // Résoudre le student_id dans public.students
      let resolvedStudentId = result.studentId;
      const { data: stuRow } = await supabase
        .from("students")
        .select("id")
        .or(`id.eq.${result.studentId},user_id.eq.${result.studentId}`)
        .maybeSingle();

      if (stuRow?.id) {
        resolvedStudentId = stuRow.id;
      }

      const { data: insData, error: insErr } = await supabase
        .from("test_results")
        .insert({
          test_id: result.testId,
          student_id: resolvedStudentId,
          note: result.note,
          pourcentage: result.pourcentage,
          date: result.date,
          heure: result.heure,
          valide: result.valide,
          statut: result.statut,
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.warn("Échec insertion direct test_results:", insErr);
        return { success: false, id: result.id, error: insErr.message };
      }

      if (insData?.id && Object.keys(answers).length > 0) {
        try {
          const answerInserts = Object.entries(answers)
            .filter(([qId]) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qId))
            .map(([qId, val]) => ({
              result_id: insData.id,
              question_id: qId,
              reponse: typeof val === "string" ? val : JSON.stringify(val),
              reponse_donnee: typeof val === "string" ? val : JSON.stringify(val),
            }));
          if (answerInserts.length > 0) {
            await supabase.from("test_answers").insert(answerInserts);
          }
        } catch (e) {
          console.warn("Erreur insertion repli test_answers:", e);
        }
      }

      return { success: true, id: insData?.id || result.id };
    }

    if (rpcErr || (rpcData && !rpcData.success)) {
      return {
        success: false,
        id: result.id,
        error: rpcErr?.message || rpcData?.error || "Échec de l'enregistrement de l'évaluation",
      };
    }

    return { success: true, id: result.id };
  } catch (err: any) {
    console.warn("Erreur submitAssessmentResultToSupabase:", err);
    return { success: false, id: result.id, error: err.message };
  }
}

