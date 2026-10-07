import { supabase } from "@/lib/supabase/client";

export interface Survey {
  id: string;
  title: string;
  description?: string;
  module_id?: string;
  teacher_id?: string;
  mode: "auto" | "manual" | "hybrid";
  status: "draft" | "active" | "closed";
  is_anonymous: boolean;
  min_responses_for_aggregation: number;
  created_at: string;
  closed_at?: string | null;
  questions?: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  order_index: number;
  question_text: string;
  question_type: "rating_5" | "rating_10" | "yes_no" | "text";
  category: string;
}

export interface SurveyAnswerSubmission {
  question_id: string;
  rating_value?: number;
  text_value?: string;
}

export interface AggregatedSurveyResults {
  survey_id: string;
  total_respondents: number;
  is_aggregated: boolean;
  reason?: string;
  average_score?: number;
  questions_summary: {
    question_id: string;
    question_text: string;
    average_rating?: number;
    distribution?: Record<number, number>;
    text_answers?: string[];
  }[];
}

/**
 * Fonction de hachage anonymisant univoque
 */
export async function generateAnonymousHash(studentId: string, surveyId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`ANON_SALT_2026_${studentId}_${surveyId}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback simple
  let hash = 0;
  const str = `SALT_${studentId}_${surveyId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

export const surveyService = {
  /**
   * Récupère les enquêtes actives avec leurs questions
   */
  async getSurveys(moduleId?: string): Promise<Survey[]> {
    let query = supabase
      .from("surveys")
      .select("*, questions:survey_questions(*)")
      .order("created_at", { ascending: false });

    if (moduleId) {
      query = query.eq("module_id", moduleId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erreur chargement enquêtes:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Soumission anonyme garantie des réponses d'un apprenant
   */
  async submitSurveyAnswers(
    surveyId: string,
    studentId: string,
    answers: SurveyAnswerSubmission[]
  ): Promise<{ success: boolean; error?: string }> {
    const respondentHash = await generateAnonymousHash(studentId, surveyId);

    const rows = answers.map((ans) => ({
      survey_id: surveyId,
      question_id: ans.question_id,
      respondent_hash: respondentHash,
      rating_value: ans.rating_value,
      text_value: ans.text_value,
    }));

    const { error } = await supabase
      .from("survey_responses")
      .upsert(rows, { onConflict: "survey_id,question_id,respondent_hash" });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Calcul et agrégation des résultats avec protection du seuil minimal (min 5 réponses)
   */
  async getAggregatedResults(surveyId: string): Promise<AggregatedSurveyResults> {
    const { data: survey } = await supabase
      .from("surveys")
      .select("*, questions:survey_questions(*)")
      .eq("id", surveyId)
      .single();

    if (!survey) {
      throw new Error("Enquête introuvable");
    }

    const { data: responses, error } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId);

    if (error || !responses) {
      return {
        survey_id: surveyId,
        total_respondents: 0,
        is_aggregated: false,
        reason: "Aucune réponse enregistrée",
        questions_summary: [],
      };
    }

    // Calcul du nombre de répondants distincts
    const uniqueHashes = new Set(responses.map((r) => r.respondent_hash));
    const respondentCount = uniqueHashes.size;
    const minThreshold = survey.min_responses_for_aggregation || 5;

    if (respondentCount < minThreshold) {
      return {
        survey_id: surveyId,
        total_respondents: respondentCount,
        is_aggregated: false,
        reason: `Seuil d'anonymat non atteint (${respondentCount}/${minThreshold} réponses requises)`,
        questions_summary: [],
      };
    }

    const questions: SurveyQuestion[] = (survey as any).questions || [];
    let totalRatingsSum = 0;
    let totalRatingsCount = 0;

    const summary = questions.map((q) => {
      const qResponses = responses.filter((r) => r.question_id === q.id);
      const ratingResponses = qResponses.filter((r) => typeof r.rating_value === "number");

      let avg: number | undefined;
      const distribution: Record<number, number> = {};

      if (ratingResponses.length > 0) {
        const sum = ratingResponses.reduce((acc, curr) => acc + (curr.rating_value || 0), 0);
        avg = parseFloat((sum / ratingResponses.length).toFixed(2));
        totalRatingsSum += sum;
        totalRatingsCount += ratingResponses.length;

        ratingResponses.forEach((r) => {
          const val = r.rating_value!;
          distribution[val] = (distribution[val] || 0) + 1;
        });
      }

      const textAnswers = qResponses
        .map((r) => r.text_value)
        .filter((t): t is string => Boolean(t && t.trim().length > 0));

      return {
        question_id: q.id,
        question_text: q.question_text,
        average_rating: avg,
        distribution,
        text_answers: textAnswers,
      };
    });

    const globalAverage = totalRatingsCount > 0 ? parseFloat((totalRatingsSum / totalRatingsCount).toFixed(2)) : undefined;

    return {
      survey_id: surveyId,
      total_respondents: respondentCount,
      is_aggregated: true,
      average_score: globalAverage,
      questions_summary: summary,
    };
  },
};
