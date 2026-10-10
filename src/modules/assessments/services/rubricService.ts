/**
 * Service de Grilles critériées et Banque de commentaires (Phase D.2 - F10)
 * Tables SQL: rubrics, rubric_criteria, rubric_levels, grading_comments (Migration 0069)
 */

import { supabase, isSupabaseConfigured } from "../../../lib/supabase/client";

export interface RubricLevel {
  id?: string;
  points: number;
  label: string;
  description?: string;
}

export interface RubricCriterion {
  id?: string;
  title: string;
  description?: string;
  weight: number;
  levels?: RubricLevel[];
}

export interface Rubric {
  id: string;
  title: string;
  description?: string;
  total_points: number;
  created_by?: string;
  criteria?: RubricCriterion[];
}

export interface GradingComment {
  id: string;
  category: string;
  comment_text: string;
  sentiment?: "positive" | "constructive" | "warning";
  created_by?: string;
}

const LOCAL_RUBRICS_KEY = "sn_rubrics";
const LOCAL_COMMENTS_KEY = "sn_grading_comments";

const DEFAULT_COMMENTS: GradingComment[] = [
  { id: "c1", category: "Qualité du code", comment_text: "Excellente structure algorithmique et respect rigoureux des conventions.", sentiment: "positive" },
  { id: "c2", category: "Qualité du code", comment_text: "Penser à découper les fonctions longues en sous-modules réutilisables.", sentiment: "constructive" },
  { id: "c3", category: "Raisonnement", comment_text: "Démonstration solide et argumentation technique convaincante.", sentiment: "positive" },
  { id: "c4", category: "Raisonnement", comment_text: "Certaines hypothèses manquent de justification textuelle ou chiffrée.", sentiment: "constructive" },
  { id: "c5", category: "Ponctualité & Rigueur", comment_text: "Travail rendu dans les temps avec tous les livrables demandés.", sentiment: "positive" },
  { id: "c6", category: "Ponctualité & Rigueur", comment_text: "Attention au respect scrupuleux du format de rendu attendu.", sentiment: "warning" },
];

export const rubricService = {
  /**
   * Récupérer les grilles d'évaluation disponibles
   */
  async getRubrics(): Promise<Rubric[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("rubrics")
          .select("*, rubric_criteria(*, rubric_levels(*))")
          .order("created_at", { ascending: false });

        if (!error && data) {
          return data as Rubric[];
        }
      } catch (err) {
        console.warn("Notice fetch rubrics Supabase:", err);
      }
    }

    try {
      const raw = localStorage.getItem(LOCAL_RUBRICS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Créer ou mettre à jour une grille critériée
   */
  async saveRubric(rubric: Omit<Rubric, "id"> & { id?: string }): Promise<Rubric> {
    const id = rubric.id || `RUB_${Date.now()}`;
    const fullRubric: Rubric = {
      ...rubric,
      id,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from("rubrics").upsert({
          id: fullRubric.id,
          title: fullRubric.title,
          description: fullRubric.description,
          total_points: fullRubric.total_points,
        });
      } catch (err) {
        console.warn("Notice save rubric Supabase:", err);
      }
    }

    try {
      const current = await this.getRubrics();
      const updated = [fullRubric, ...current.filter((r) => r.id !== id)];
      localStorage.setItem(LOCAL_RUBRICS_KEY, JSON.stringify(updated));
    } catch {}

    return fullRubric;
  },

  /**
   * Récupérer la banque de commentaires
   */
  async getComments(): Promise<GradingComment[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("grading_comments")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          return data as GradingComment[];
        }
      } catch (err) {
        console.warn("Notice fetch grading comments:", err);
      }
    }

    try {
      const raw = localStorage.getItem(LOCAL_COMMENTS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_COMMENTS;
    } catch {
      return DEFAULT_COMMENTS;
    }
  },

  /**
   * Ajouter un commentaire réutilisable à la banque
   */
  async addComment(comment: Omit<GradingComment, "id">): Promise<GradingComment> {
    const id = `GC_${Date.now()}`;
    const newComment: GradingComment = { ...comment, id };

    if (isSupabaseConfigured) {
      try {
        await supabase.from("grading_comments").insert({
          category: newComment.category,
          comment_text: newComment.comment_text,
          sentiment: newComment.sentiment,
        });
      } catch (err) {
        console.warn("Notice insert grading comment Supabase:", err);
      }
    }

    try {
      const current = await this.getComments();
      const updated = [newComment, ...current];
      localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(updated));
    } catch {}

    return newComment;
  },
};
