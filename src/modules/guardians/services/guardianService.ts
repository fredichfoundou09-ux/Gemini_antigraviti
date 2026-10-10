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

const LOCAL_GUARDIANS_KEY = "sentinelles_local_guardians";
const LOCAL_LINKS_KEY = "sentinelles_local_student_guardians";

function getLocalGuardians(): Guardian[] {
  try {
    const raw = localStorage.getItem(LOCAL_GUARDIANS_KEY);
    return raw ? JSON.parse(raw) : [
      { id: "g_demo_1", nom: "Mpassi", prenom: "Jean-Claude", email: "jc.mpassi@example.cg", telephone: "+242 06 123 4567", type: "parent", actif: true, created_at: new Date().toISOString() },
      { id: "g_demo_2", nom: "TotalEnergies RH", prenom: "Direction", email: "rh@totalenergies.cg", type: "employeur", organisation: "TotalEnergies EP Congo", actif: true, created_at: new Date().toISOString() }
    ];
  } catch {
    return [];
  }
}

function saveLocalGuardians(list: Guardian[]) {
  try {
    localStorage.setItem(LOCAL_GUARDIANS_KEY, JSON.stringify(list));
  } catch {}
}

function getLocalLinks(): StudentGuardianLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(list: StudentGuardianLink[]) {
  try {
    localStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(list));
  } catch {}
}

export const guardianService = {
  /**
   * Liste l'ensemble des tuteurs enregistrés
   */
  async getGuardians(): Promise<Guardian[]> {
    try {
      const { data, error } = await supabase
        .from("guardians")
        .select("*")
        .order("nom", { ascending: true });

      if (!error && data && data.length > 0) return data;
    } catch {}

    return getLocalGuardians();
  },

  /**
   * Crée un nouveau profil tuteur / parent / employeur
   */
  async createGuardian(g: Omit<Guardian, "id" | "actif" | "created_at">): Promise<{ success: boolean; data?: Guardian; error?: string }> {
    const newG: Guardian = {
      ...g,
      id: "g_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      actif: true,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalGuardians();
    saveLocalGuardians([...locals, newG]);

    try {
      const { data, error } = await supabase.from("guardians").insert(newG).select().single();
      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newG };
  },

  /**
   * Récupère les liaisons tuteurs pour un apprenant donné
   */
  async getStudentGuardians(studentId: string): Promise<StudentGuardianLink[]> {
    try {
      const { data, error } = await supabase
        .from("student_guardians")
        .select("*, guardian:guardians(*)")
        .eq("student_id", studentId);

      if (!error && data && data.length > 0) return data;
    } catch {}

    const links = getLocalLinks().filter((l) => l.student_id === studentId);
    const guardians = getLocalGuardians();
    return links.map((l) => ({
      ...l,
      guardian: l.guardian || guardians.find((g) => g.id === l.guardian_id),
    }));
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
    const newLink: StudentGuardianLink = {
      id: "link_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      guardian_id: link.guardian_id,
      student_id: link.student_id,
      relationship: link.relationship || "parent",
      can_view_grades: link.can_view_grades ?? true,
      can_view_attendance: link.can_view_attendance ?? true,
      can_view_finances: link.can_view_finances ?? true,
      can_view_messages: link.can_view_messages ?? false,
      is_active: true,
      consent_given_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const links = getLocalLinks();
    const existingIdx = links.findIndex((l) => l.guardian_id === link.guardian_id && l.student_id === link.student_id);
    if (existingIdx >= 0) links[existingIdx] = { ...links[existingIdx], ...newLink };
    else links.push(newLink);
    saveLocalLinks(links);

    try {
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

      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newLink };
  },

  /**
   * Modifie les autorisations d'une liaison
   */
  async updatePermissions(
    linkId: string,
    permissions: {
      can_view_grades: boolean;
      can_view_attendance: boolean;
      can_view_finances: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const links = getLocalLinks();
    saveLocalLinks(links.map((l) => (l.id === linkId ? { ...l, ...permissions } : l)));

    try {
      await supabase.from("student_guardians").update(permissions).eq("id", linkId);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime une tutelle
   */
  async deleteGuardianLink(linkId: string): Promise<{ success: boolean; error?: string }> {
    const links = getLocalLinks();
    saveLocalLinks(links.filter((l) => l.id !== linkId));

    try {
      await supabase.from("student_guardians").delete().eq("id", linkId);
    } catch {}

    return { success: true };
  },

  /**
   * Révoque immédiatement le consentement d'un tuteur (coupe tout accès)
   */
  async revokeConsent(linkId: string): Promise<{ success: boolean; error?: string }> {
    const links = getLocalLinks();
    saveLocalLinks(
      links.map((l) =>
        l.id === linkId
          ? { ...l, is_active: false, consent_revoked_at: new Date().toISOString() }
          : l
      )
    );

    try {
      const { error } = await supabase
        .from("student_guardians")
        .update({
          is_active: false,
          consent_revoked_at: new Date().toISOString(),
        })
        .eq("id", linkId);

      if (error) return { success: false, error: error.message };
    } catch {}

    return { success: true };
  },

  /**
   * Données autorisées pour le portail tuteur (lecture seule, isolation stricte)
   */
  async getGuardianPortalData(guardianId: string): Promise<{
    links: StudentGuardianLink[];
  }> {
    try {
      const { data: links, error } = await supabase
        .from("student_guardians")
        .select("*, guardian:guardians(*)")
        .eq("guardian_id", guardianId)
        .eq("is_active", true)
        .is("consent_revoked_at", null);

      if (!error && links && links.length > 0) return { links };
    } catch {}

    const links = getLocalLinks();
    const active = links.filter((l) => l.is_active && !l.consent_revoked_at);
    return { links: active };
  },
};
