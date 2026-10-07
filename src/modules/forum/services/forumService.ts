import { supabase } from "@/lib/supabase/client";

export interface ForumThread {
  id: string;
  module_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
  posts_count?: number;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  content: string;
  is_pinned_solution: boolean;
  created_at: string;
}

export const forumService = {
  /**
   * Récupère les sujets du forum pour un module donné
   */
  async getThreads(moduleId: string): Promise<ForumThread[]> {
    const { data, error } = await supabase
      .from("forum_threads")
      .select("*")
      .eq("module_id", moduleId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement forum:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Crée un nouveau fil de discussion
   */
  async createThread(thread: {
    module_id: string;
    author_id: string;
    author_name: string;
    author_role: string;
    title: string;
    content: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const { data, error } = await supabase
      .from("forum_threads")
      .insert({
        ...thread,
        is_pinned: false,
        is_closed: false,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  /**
   * Récupère les messages d'un fil de discussion
   */
  async getPosts(threadId: string): Promise<ForumPost[]> {
    const { data, error } = await supabase
      .from("forum_posts")
      .select("*")
      .eq("thread_id", threadId)
      .order("is_pinned_solution", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erreur chargement réponses:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Ajoute une réponse à un fil
   */
  async replyToThread(post: {
    thread_id: string;
    author_id: string;
    author_name: string;
    author_role: string;
    content: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("forum_posts").insert(post);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Épingle une réponse comme solution officielle (enseignant)
   */
  async pinSolution(postId: string, isSolution: boolean): Promise<{ success: boolean }> {
    await supabase
      .from("forum_posts")
      .update({ is_pinned_solution: isSolution })
      .eq("id", postId);

    return { success: true };
  },
};
