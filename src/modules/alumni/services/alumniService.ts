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

const LOCAL_FOLLOWUPS_KEY = "sentinelles_local_followups";
const LOCAL_OFFERS_KEY = "sentinelles_local_job_offers";

function getLocalFollowUps(): AlumniFollowUp[] {
  try {
    const raw = localStorage.getItem(LOCAL_FOLLOWUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFollowUps(list: AlumniFollowUp[]) {
  try {
    localStorage.setItem(LOCAL_FOLLOWUPS_KEY, JSON.stringify(list));
  } catch {}
}

function getLocalOffers(): JobOffer[] {
  try {
    const raw = localStorage.getItem(LOCAL_OFFERS_KEY);
    return raw ? JSON.parse(raw) : [
      {
        id: "offer_demo_1",
        title: "Stagiaire Opérateur Analyste SOC",
        company: "MTN Congo",
        type: "stage",
        description: "Surveillance des alertes de sécurité, gestion des incidents N1 et corrélation SIEM.",
        location: "Brazzaville",
        contact_email: "recrutement@mtn.cg",
        active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "offer_demo_2",
        title: "Administrateur Systèmes & Cloud Junior",
        company: "Airtel Congo",
        type: "cdd",
        description: "Maintenance des serveurs Linux, monitoring d'infrastructure et support aux équipes.",
        location: "Pointe-Noire",
        contact_email: "carrieres@airtel.cg",
        active: true,
        created_at: new Date().toISOString(),
      }
    ];
  } catch {
    return [];
  }
}

function saveLocalOffers(list: JobOffer[]) {
  try {
    localStorage.setItem(LOCAL_OFFERS_KEY, JSON.stringify(list));
  } catch {}
}

export const alumniService = {
  /**
   * Récupère la liste des suivis d'insertion pour tous les diplômés
   */
  async getFollowUps(): Promise<AlumniFollowUp[]> {
    try {
      const { data, error } = await supabase
        .from("alumni_follow_ups")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch {}

    return getLocalFollowUps();
  },

  /**
   * Calcule les métriques d'insertion professionnelle
   */
  async getInsertionMetrics(): Promise<{
    totalFollowed: number;
    employedCount: number;
    furtherStudyCount: number;
    seekingCount: number;
    insertionRate: number;
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
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const newFu: AlumniFollowUp = {
      id: "fu_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      student_id: followUp.student_id,
      milestone: followUp.milestone,
      status: followUp.status,
      employer_name: followUp.employer_name,
      job_title: followUp.job_title,
      salary_range: followUp.salary_range,
      notes: followUp.notes,
      contacted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const locals = getLocalFollowUps();
    saveLocalFollowUps([newFu, ...locals]);

    try {
      const { data, error } = await supabase.from("alumni_follow_ups").insert({
        ...followUp,
        contacted_at: new Date().toISOString(),
      }).select().single();

      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newFu };
  },

  /**
   * Modifie une fiche de suivi
   */
  async updateFollowUp(
    id: string,
    updates: Partial<Omit<AlumniFollowUp, "id" | "created_at">>
  ): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalFollowUps();
    saveLocalFollowUps(locals.map((f) => (f.id === id ? { ...f, ...updates } : f)));

    try {
      await supabase.from("alumni_follow_ups").update(updates).eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime un suivi
   */
  async deleteFollowUp(id: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalFollowUps();
    saveLocalFollowUps(locals.filter((f) => f.id !== id));

    try {
      await supabase.from("alumni_follow_ups").delete().eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Récupère le catalogue des offres de stages et d'emploi
   */
  async getJobOffers(): Promise<JobOffer[]> {
    try {
      const { data, error } = await supabase
        .from("job_offers")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch {}

    return getLocalOffers().filter((o) => o.active);
  },

  /**
   * Publie une nouvelle offre de stage ou d'emploi
   */
  async createJobOffer(offer: Omit<JobOffer, "id" | "created_at" | "active">): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const newOffer: JobOffer = {
      ...offer,
      id: "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      active: true,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalOffers();
    saveLocalOffers([newOffer, ...locals]);

    try {
      const { data, error } = await supabase.from("job_offers").insert({
        ...offer,
        active: true,
      }).select().single();

      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newOffer };
  },

  /**
   * Modifie une offre
   */
  async updateJobOffer(
    id: string,
    updates: Partial<Omit<JobOffer, "id" | "created_at">>
  ): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalOffers();
    saveLocalOffers(locals.map((o) => (o.id === id ? { ...o, ...updates } : o)));

    try {
      await supabase.from("job_offers").update(updates).eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime une offre de stage / emploi
   */
  async deleteJobOffer(id: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalOffers();
    saveLocalOffers(locals.filter((o) => o.id !== id));

    try {
      await supabase.from("job_offers").delete().eq("id", id);
    } catch {}

    return { success: true };
  },
};
