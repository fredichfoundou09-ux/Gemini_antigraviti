import { supabase } from "@/lib/supabase/client";

export interface Competency {
  id: string;
  code: string;
  nom: string;
  description?: string;
  domaine: string;
  niveau_requis: number;
}

export interface StudentCompetencyProgress {
  id: string;
  student_id: string;
  competency_id: string;
  score: number;
  status: "not_acquired" | "in_progress" | "acquired" | "mastered";
  validated_by?: string | null;
  validation_mode: "auto" | "manual";
  acquired_at?: string | null;
  updated_at: string;
  competency?: Competency;
}

export const competencyService = {
  /**
   * Récupère le référentiel complet des compétences
   */
  async getCompetencies(): Promise<Competency[]> {
    const { data, error } = await supabase
      .from("competencies")
      .select("*")
      .order("domaine", { ascending: true })
      .order("code", { ascending: true });

    if (error) {
      console.error("Erreur chargement compétences:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Récupère la progression d'un apprenant sur ses compétences
   */
  async getStudentCompetencies(studentId: string): Promise<StudentCompetencyProgress[]> {
    const { data, error } = await supabase
      .from("student_competency_progress")
      .select("*, competency:competencies(*)")
      .eq("student_id", studentId);

    if (error) {
      console.error("Erreur progression compétences:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Évalue et met à jour le statut d'une compétence pour un apprenant
   * Mode Auto (résultats d'évaluation >= 60%) ou Manuel (formateur)
   */
  async evaluateCompetency(
    studentId: string,
    competencyId: string,
    score: number,
    mode: "auto" | "manual" = "auto"
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { data, error } = await supabase.rpc("evaluate_student_competency", {
      p_student_id: studentId,
      p_competency_id: competencyId,
      p_score: score,
      p_mode: mode,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  /**
   * Valide manuellement l'acquisition d'une compétence par un enseignant
   */
  async validateManuallyByTeacher(
    studentId: string,
    competencyId: string,
    teacherUserId: string,
    status: "acquired" | "mastered" = "acquired"
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("student_competency_progress")
      .upsert(
        {
          student_id: studentId,
          competency_id: competencyId,
          score: status === "mastered" ? 95 : 75,
          status,
          validated_by: teacherUserId,
          validation_mode: "manual",
          acquired_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,competency_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Prépare les données pour l'impression ou le téléchargement du livret de compétences officiel
   */
  generateBookletData(
    student: { id: string; nom: string; prenom: string; formation?: string },
    progressList: StudentCompetencyProgress[]
  ) {
    const total = progressList.length;
    const acquired = progressList.filter((p) => p.status === "acquired" || p.status === "mastered").length;
    const rate = total > 0 ? Math.round((acquired / total) * 100) : 0;

    const byDomain: Record<string, StudentCompetencyProgress[]> = {};
    progressList.forEach((p) => {
      const domaine = p.competency?.domaine || "Général";
      if (!byDomain[domaine]) byDomain[domaine] = [];
      byDomain[domaine].push(p);
    });

    return {
      student,
      generatedAt: new Date().toLocaleDateString("fr-FR"),
      totalCompetencies: total,
      acquiredCompetencies: acquired,
      acquisitionRate: rate,
      domains: byDomain,
    };
  },
};
