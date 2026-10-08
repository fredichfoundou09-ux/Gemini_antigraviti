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
   * Soumission anonyme garantie des réponses d'un apprenant (déléguée au serveur avec salt confidentiel)
   */
  async submitSurveyAnswers(
    surveyId: string,
    studentId: string,
    answers: SurveyAnswerSubmission[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc("submit_survey_response", {
        p_survey_id: surveyId,
        p_answers: answers.map((ans) => ({
          question_id: ans.question_id,
          rating_value: ans.rating_value,
          text_value: ans.text_value,
        })),
      });

      if (error) {
        return { success: false, error: error.message };
      }
      if (data && data.success === false) {
        return { success: false, error: data.error || "Soumission refusée par le serveur" };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Erreur de communication avec le serveur" };
    }
  },

  /**
   * Calcul et agrégation sécurisée des résultats côté serveur (min 5 réponses garanties)
   */
  async getAggregatedResults(surveyId: string): Promise<AggregatedSurveyResults> {
    if (typeof supabase.rpc === "function") {
      try {
        const rpcRes = await supabase.rpc("get_survey_results", {
          p_survey_id: surveyId,
        });

        if (rpcRes && !rpcRes.error && rpcRes.data?.success) {
          const data = rpcRes.data;
          if (!data.is_aggregated) {
            return {
              survey_id: surveyId,
              total_respondents: data.total_respondents || 0,
              is_aggregated: false,
              reason: data.reason || "Seuil d'anonymat non atteint (5 réponses requises)",
              questions_summary: [],
            };
          }

          return {
            survey_id: surveyId,
            total_respondents: data.total_respondents,
            is_aggregated: true,
            average_score: data.average_score,
            questions_summary: (data.questions_summary || []).map((q: any) => ({
              question_id: q.question_id,
              question_text: q.question_text,
              average_rating: q.average_rating,
              distribution: q.distribution || {},
              text_answers: q.text_answers || [],
            })),
          };
        }
      } catch {
        // Fallback sécurisé ci-dessous
      }
    }

    // Fallback sécurisé appliquant le seuil minimal d'anonymat (min 5 réponses requises)
    try {
      const { data: survey } = await supabase
        .from("surveys")
        .select("*, questions:survey_questions(*)")
        .eq("id", surveyId)
        .single();

      if (!survey) {
        return {
          survey_id: surveyId,
          total_respondents: 0,
          is_aggregated: false,
          reason: "Enquête introuvable",
          questions_summary: [],
        };
      }

      const { data: responses } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", surveyId);

      const respList = responses || [];
      const uniqueHashes = new Set(respList.map((r: any) => r.respondent_hash));
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
        const qResponses = respList.filter((r: any) => r.question_id === q.id);
        const ratingResponses = qResponses.filter((r: any) => typeof r.rating_value === "number");

        let avg: number | undefined;
        const distribution: Record<number, number> = {};

        if (ratingResponses.length > 0) {
          const sum = ratingResponses.reduce((acc: number, curr: any) => acc + (curr.rating_value || 0), 0);
          avg = parseFloat((sum / ratingResponses.length).toFixed(2));
          totalRatingsSum += sum;
          totalRatingsCount += ratingResponses.length;

          ratingResponses.forEach((r: any) => {
            const val = r.rating_value!;
            distribution[val] = (distribution[val] || 0) + 1;
          });
        }

        const textAnswers = qResponses
          .map((r: any) => r.text_value)
          .filter((t: any): t is string => Boolean(t && t.trim().length > 0));

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
    } catch (err: any) {
      return {
        survey_id: surveyId,
        total_respondents: 0,
        is_aggregated: false,
        reason: err?.message || "Erreur d'agrégation sécurisée",
        questions_summary: [],
      };
    }
  },
};
