import { supabase } from "@/lib/supabase/client";

export interface AlumniFollowUp {
  id: string;
  student_id: string;
  milestone: "3_months" | "6_months" | "12_months";
  status: "pending" | "contacted" | "employed" | "seeking" | "further_study";
  employer_name?: string;
  job_title?: string;
  salary_range?: string;
  notes?: string;
  contacted_at?: string;
  created_at: string;
}

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  type: "stage" | "cdd" | "cdi" | "freelance";
  description?: string;
  location?: string;
  contact_email?: string;
  deadline?: string;
  active: boolean;
  created_at: string;
}

export const alumniService = {
  /**
   * Récupère la liste des suivis d'insertion pour tous les diplômés
   */
  async getFollowUps(): Promise<AlumniFollowUp[]> {
    const { data, error } = await supabase
      .from("alumni_follow_ups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement suivis alumni:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Calcule les métriques d'insertion professionnelle
   */
  async getInsertionMetrics(): Promise<{
    totalFollowed: number;
    employedCount: number;
    furtherStudyCount: number;
    seekingCount: number;
    insertionRate: number; // Taux d'insertion (en emploi ou études)
  }> {
    const followUps = await this.getFollowUps();
    const total = followUps.length;
    if (total === 0) {
      return {
        totalFollowed: 0,
        employedCount: 0,
        furtherStudyCount: 0,
        seekingCount: 0,
        insertionRate: 0,
      };
    }

    const employed = followUps.filter((f) => f.status === "employed").length;
    const furtherStudy = followUps.filter((f) => f.status === "further_study").length;
    const seeking = followUps.filter((f) => f.status === "seeking").length;

    const rate = Math.round(((employed + furtherStudy) / total) * 100);

    return {
      totalFollowed: total,
      employedCount: employed,
      furtherStudyCount: furtherStudy,
      seekingCount: seeking,
      insertionRate: rate,
    };
  },

  /**
   * Enregistre ou met à jour le statut d'un diplômé
   */
  async recordFollowUp(followUp: {
    student_id: string;
    milestone: "3_months" | "6_months" | "12_months";
    status: "pending" | "contacted" | "employed" | "seeking" | "further_study";
    employer_name?: string;
    job_title?: string;
    salary_range?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("alumni_follow_ups").insert({
      ...followUp,
      contacted_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Récupère le catalogue des offres de stages et d'emploi
   */
  async getJobOffers(): Promise<JobOffer[]> {
    const { data, error } = await supabase
      .from("job_offers")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement offres:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Publie une nouvelle offre de stage ou d'emploi
   */
  async createJobOffer(offer: Omit<JobOffer, "id" | "created_at" | "active">): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { error } = await supabase.from("job_offers").insert({
      ...offer,
      active: true,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
