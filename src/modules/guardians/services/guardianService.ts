import { supabase } from "@/lib/supabase/client";

export interface Guardian {
  id: string;
  user_id?: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  type: "parent" | "tuteur" | "employeur" | "autre";
  organisation?: string;
  actif: boolean;
  created_at: string;
}

export interface StudentGuardianLink {
  id: string;
  guardian_id: string;
  student_id: string;
  relationship: string;
  can_view_grades: boolean;
  can_view_attendance: boolean;
  can_view_finances: boolean;
  can_view_messages: boolean;
  consent_given_at: string;
  consent_revoked_at?: string | null;
  is_active: boolean;
  created_at: string;
  guardian?: Guardian;
}

export const guardianService = {
  /**
   * Liste l'ensemble des tuteurs enregistrés
   */
  async getGuardians(): Promise<Guardian[]> {
    const { data, error } = await supabase
      .from("guardians")
      .select("*")
      .order("nom", { ascending: true });

    if (error) {
      console.error("Erreur chargement tuteurs:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Récupère les liaisons tuteurs pour un apprenant donné
   */
  async getStudentGuardians(studentId: string): Promise<StudentGuardianLink[]> {
    const { data, error } = await supabase
      .from("student_guardians")
      .select("*, guardian:guardians(*)")
      .eq("student_id", studentId);

    if (error) {
      console.error("Erreur chargement liaisons tuteur-apprenant:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Associe un tuteur à un apprenant avec granularité des droits et consentement
   */
  async linkGuardian(link: {
    guardian_id: string;
    student_id: string;
    relationship?: string;
    can_view_grades?: boolean;
    can_view_attendance?: boolean;
    can_view_finances?: boolean;
    can_view_messages?: boolean;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const { data, error } = await supabase
      .from("student_guardians")
      .upsert(
        {
          guardian_id: link.guardian_id,
          student_id: link.student_id,
          relationship: link.relationship || "parent",
          can_view_grades: link.can_view_grades ?? true,
          can_view_attendance: link.can_view_attendance ?? true,
          can_view_finances: link.can_view_finances ?? true,
          can_view_messages: link.can_view_messages ?? false,
          is_active: true,
          consent_given_at: new Date().toISOString(),
          consent_revoked_at: null,
        },
        { onConflict: "guardian_id,student_id" }
      )
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  /**
   * Révoque immédiatement le consentement d'un tuteur (coupe tout accès)
   */
  async revokeConsent(linkId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from("student_guardians")
      .update({
        is_active: false,
        consent_revoked_at: new Date().toISOString(),
      })
      .eq("id", linkId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Journalise la consultation d'une rubrique par un tuteur
   */
  async logAccess(guardianId: string, studentId: string, section: string): Promise<void> {
    try {
      await supabase.from("guardian_access_logs").insert({
        guardian_id: guardianId,
        student_id: studentId,
        section,
      });
    } catch {
      // silence
    }
  },

  /**
   * Données autorisées pour le portail tuteur (lecture seule, isolation stricte)
   */
  async getGuardianPortalData(guardianId: string): Promise<{
    links: StudentGuardianLink[];
  }> {
    const { data: links, error } = await supabase
      .from("student_guardians")
      .select("*, guardian:guardians(*)")
      .eq("guardian_id", guardianId)
      .eq("is_active", true)
      .is("consent_revoked_at", null);

    if (error) {
      console.error("Erreur chargement portail tuteur:", error);
      return { links: [] };
    }
    return { links: links || [] };
  },
};
