import { supabase } from "@/lib/supabase/client";

export interface RiskFactor {
  code: string;
  poids: number;
  label: string;
}

export interface RiskScore {
  id: string;
  student_id: string;
  score: number;
  level: "faible" | "modere" | "eleve" | "critique";
  factors: RiskFactor[];
  calculated_at: string;
  student?: {
    first_name: string;
    last_name: string;
    email: string;
    formation_id: string;
  };
}

export interface StudentFollowup {
  id: string;
  student_id: string;
  author_id?: string;
  type: "appel" | "convocation" | "tutorat" | "remediation" | "entretien_tuteur";
  note: string;
  due_date?: string;
  status: "ouvert" | "en_cours" | "resolu" | "archive";
  created_at: string;
  updated_at: string;
}

export const riskService = {
  async getRiskScores(level?: string): Promise<{ data: RiskScore[]; error: string | null }> {
    try {
      let query = supabase
        .from("risk_scores")
        .select(`
          *,
          student:students (
            first_name,
            last_name,
            email,
            formation_id
          )
        `)
        .order("score", { ascending: false });

      if (level && level !== "all") {
        query = query.eq("level", level);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: error.message };
      return { data: (data as unknown as RiskScore[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async getStudentRisk(studentId: string): Promise<{ data: RiskScore | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from("risk_scores")
        .select(`
          *,
          student:students (
            first_name,
            last_name,
            email,
            formation_id
          )
        `)
        .eq("student_id", studentId)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      return { data: (data as unknown as RiskScore) || null, error: null };
    } catch (err: unknown) {
      return { data: null, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async computeRiskScores(): Promise<{
    success: boolean;
    updatedCount?: number;
    highRiskCount?: number;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.rpc("compute_risk_scores");
      if (error) return { success: false, error: error.message };

      const res = data as {
        success?: boolean;
        updated_students?: number;
        high_risk_count?: number;
        error?: string;
      };

      if (res && res.success === false) {
        return { success: false, error: res.error || "Erreur de calcul" };
      }

      return {
        success: true,
        updatedCount: res?.updated_students,
        highRiskCount: res?.high_risk_count,
        error: null,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async getFollowups(studentId?: string): Promise<{ data: StudentFollowup[]; error: string | null }> {
    try {
      let query = supabase
        .from("student_followups")
        .select("*")
        .order("created_at", { ascending: false });

      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: error.message };
      return { data: (data as StudentFollowup[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async addFollowup(
    followup: Omit<StudentFollowup, "id" | "created_at" | "updated_at">
  ): Promise<{ success: boolean; followupId?: string; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from("student_followups")
        .insert([followup])
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, followupId: data?.id, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async updateFollowupStatus(
    id: string,
    status: StudentFollowup["status"]
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from("student_followups")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },
};
