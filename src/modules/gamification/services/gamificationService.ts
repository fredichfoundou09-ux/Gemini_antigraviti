import { supabase } from "@/lib/supabase/client";

export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  points: number;
  active: boolean;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  awarded_at: string;
  reason?: string;
  badge?: Badge;
}

const GAMIFICATION_SETTING_KEY = "sn_gamification_enabled";

export const gamificationService = {
  /**
   * Vérifie si la gamification est activée
   */
  isEnabled(): boolean {
    try {
      const val = localStorage.getItem(GAMIFICATION_SETTING_KEY);
      return val !== "false"; // Actif par défaut, désactivable
    } catch {
      return true;
    }
  },

  /**
   * Active ou désactive globalement la gamification
   */
  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(GAMIFICATION_SETTING_KEY, enabled ? "true" : "false");
    } catch {
      // silence
    }
  },

  /**
   * Récupère la liste des badges existants
   */
  async getBadges(): Promise<Badge[]> {
    const { data, error } = await supabase
      .from("badges")
      .select("*")
      .eq("active", true);

    if (error) {
      console.error("Erreur chargement badges:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Récupère les badges obtenus par un apprenant
   */
  async getStudentBadges(studentId: string): Promise<StudentBadge[]> {
    if (!this.isEnabled()) return [];

    const { data, error } = await supabase
      .from("student_badges")
      .select("*, badge:badges(*)")
      .eq("student_id", studentId);

    if (error) {
      console.error("Erreur chargement badges apprenant:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Attribue un badge à un apprenant (idempotent grâce à UNIQUE)
   */
  async awardBadge(
    studentId: string,
    badgeId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) return { success: false, error: "Gamification désactivée" };

    const { error } = await supabase.from("student_badges").upsert(
      {
        student_id: studentId,
        badge_id: badgeId,
        reason,
        awarded_at: new Date().toISOString(),
      },
      { onConflict: "student_id,badge_id" }
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
