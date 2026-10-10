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

const DEFAULT_COMPETENCIES: Competency[] = [
  { id: "comp_sec_01", code: "SEC-01", nom: "Analyse des vulnérabilités réseau", description: "Audit de sécurité, scan Nmap, analyse des ports et détection des failles.", domaine: "Cybersécurité", niveau_requis: 3 },
  { id: "comp_sec_02", code: "SEC-02", nom: "Configuration de pare-feu et SIEM", description: "Mise en place de règles iptables/Suricata et corrélation des journaux SOC.", domaine: "Cybersécurité", niveau_requis: 4 },
  { id: "comp_dev_01", code: "DEV-01", nom: "Conception d'APIs REST sécurisées", description: "Architecture de microservices, authentification JWT/OAuth2 et validation des payloads.", domaine: "Développement", niveau_requis: 2 },
  { id: "comp_dev_02", code: "DEV-02", nom: "Développement frontend moderne", description: "Composants React, TypeScript, gestion d'état et optimisation des performances.", domaine: "Développement", niveau_requis: 2 },
  { id: "comp_sys_01", code: "SYS-01", nom: "Administration Linux et Conteneurisation", description: "Gestion système Debian/Ubuntu, Docker, orchestration et scripts Bash.", domaine: "Systèmes & Cloud", niveau_requis: 3 },
  { id: "comp_sys_02", code: "SYS-02", nom: "Sauvegarde et Continuité d'activité", description: "Plan de reprise d'activité (PRA/PCA), snapshots chiffrés et restauration rapide.", domaine: "Systèmes & Cloud", niveau_requis: 3 },
];

const LOCAL_COMPETENCIES_KEY = "sentinelles_local_competencies";
const LOCAL_PROGRESS_KEY = "sentinelles_local_competency_progress";

function getLocalCompetencies(): Competency[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMPETENCIES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_COMPETENCIES;
  } catch {
    return DEFAULT_COMPETENCIES;
  }
}

function saveLocalCompetencies(list: Competency[]) {
  try {
    localStorage.setItem(LOCAL_COMPETENCIES_KEY, JSON.stringify(list));
  } catch {}
}

function getLocalProgress(): StudentCompetencyProgress[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProgress(list: StudentCompetencyProgress[]) {
  try {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(list));
  } catch {}
}

export const competencyService = {
  /**
   * Récupère le référentiel complet des compétences
   */
  async getCompetencies(): Promise<Competency[]> {
    try {
      const { data, error } = await supabase
        .from("competencies")
        .select("*")
        .order("domaine", { ascending: true })
        .order("code", { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}

    return getLocalCompetencies();
  },

  /**
   * Ajoute une nouvelle compétence au référentiel
   */
  async createCompetency(comp: Omit<Competency, "id">): Promise<{ success: boolean; data?: Competency; error?: string }> {
    const newComp: Competency = {
      ...comp,
      id: "comp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    };

    const current = getLocalCompetencies();
    saveLocalCompetencies([...current, newComp]);

    try {
      const { data, error } = await supabase.from("competencies").insert(newComp).select().single();
      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newComp };
  },

  /**
   * Modifie une compétence existante
   */
  async updateCompetency(
    id: string,
    updates: Partial<Omit<Competency, "id">>
  ): Promise<{ success: boolean; error?: string }> {
    const current = getLocalCompetencies();
    const updated = current.map((c) => (c.id === id ? { ...c, ...updates } : c));
    saveLocalCompetencies(updated);

    try {
      await supabase.from("competencies").update(updates).eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime une compétence du référentiel
   */
  async deleteCompetency(id: string): Promise<{ success: boolean; error?: string }> {
    const current = getLocalCompetencies();
    saveLocalCompetencies(current.filter((c) => c.id !== id));

    const progress = getLocalProgress();
    saveLocalProgress(progress.filter((p) => p.competency_id !== id));

    try {
      await supabase.from("competencies").delete().eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Récupère la progression d'un apprenant sur ses compétences
   */
  async getStudentCompetencies(studentId: string): Promise<StudentCompetencyProgress[]> {
    try {
      const { data, error } = await supabase
        .from("student_competency_progress")
        .select("*, competency:competencies(*)")
        .eq("student_id", studentId);

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}

    const list = getLocalProgress().filter((p) => p.student_id === studentId);
    const allComps = getLocalCompetencies();
    return list.map((p) => ({
      ...p,
      competency: p.competency || allComps.find((c) => c.id === p.competency_id),
    }));
  },

  /**
   * Évalue et met à jour le statut d'une compétence pour un apprenant
   */
  async evaluateCompetency(
    studentId: string,
    competencyId: string,
    score: number,
    mode: "auto" | "manual" = "auto"
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const status: StudentCompetencyProgress["status"] =
      score >= 90 ? "mastered" : score >= 60 ? "acquired" : score >= 30 ? "in_progress" : "not_acquired";

    const allProgress = getLocalProgress();
    const existingIdx = allProgress.findIndex((p) => p.student_id === studentId && p.competency_id === competencyId);
    const entry: StudentCompetencyProgress = {
      id: existingIdx >= 0 ? allProgress[existingIdx].id : "prog_" + Date.now(),
      student_id: studentId,
      competency_id: competencyId,
      score,
      status,
      validation_mode: mode,
      updated_at: new Date().toISOString(),
      acquired_at: status === "acquired" || status === "mastered" ? new Date().toISOString() : null,
    };

    if (existingIdx >= 0) allProgress[existingIdx] = entry;
    else allProgress.push(entry);
    saveLocalProgress(allProgress);

    try {
      const { data, error } = await supabase.rpc("evaluate_student_competency", {
        p_student_id: studentId,
        p_competency_id: competencyId,
        p_score: score,
        p_mode: mode,
      });

      if (!error) return { success: true, data };
    } catch {}

    return { success: true, data: entry };
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
    const allProgress = getLocalProgress();
    const existingIdx = allProgress.findIndex((p) => p.student_id === studentId && p.competency_id === competencyId);
    const entry: StudentCompetencyProgress = {
      id: existingIdx >= 0 ? allProgress[existingIdx].id : "prog_" + Date.now(),
      student_id: studentId,
      competency_id: competencyId,
      score: status === "mastered" ? 95 : 75,
      status,
      validated_by: teacherUserId,
      validation_mode: "manual",
      acquired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) allProgress[existingIdx] = entry;
    else allProgress.push(entry);
    saveLocalProgress(allProgress);

    try {
      await supabase
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
    } catch {}

    return { success: true };
  },

  /**
   * Réinitialise la progression d'une compétence pour un apprenant
   */
  async resetCompetencyProgress(studentId: string, competencyId: string): Promise<{ success: boolean }> {
    const allProgress = getLocalProgress();
    saveLocalProgress(allProgress.filter((p) => !(p.student_id === studentId && p.competency_id === competencyId)));

    try {
      await supabase
        .from("student_competency_progress")
        .delete()
        .eq("student_id", studentId)
        .eq("competency_id", competencyId);
    } catch {}

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
