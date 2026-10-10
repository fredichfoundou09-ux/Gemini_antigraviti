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
  updated_at?: string;
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
  updated_at?: string;
}

const FORUM_LOCAL_THREADS_KEY = "sentinelles_forum_threads";
const FORUM_LOCAL_POSTS_KEY = "sentinelles_forum_posts";

function getLocalThreads(): ForumThread[] {
  try {
    const raw = localStorage.getItem(FORUM_LOCAL_THREADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalThreads(threads: ForumThread[]) {
  try {
    localStorage.setItem(FORUM_LOCAL_THREADS_KEY, JSON.stringify(threads));
  } catch {}
}

function getLocalPosts(): ForumPost[] {
  try {
    const raw = localStorage.getItem(FORUM_LOCAL_POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPosts(posts: ForumPost[]) {
  try {
    localStorage.setItem(FORUM_LOCAL_POSTS_KEY, JSON.stringify(posts));
  } catch {}
}

export const forumService = {
  /**
   * Récupère les sujets du forum pour un module donné
   */
  async getThreads(moduleId: string): Promise<ForumThread[]> {
    try {
      const { data, error } = await supabase
        .from("forum_threads")
        .select("*")
        .eq("module_id", moduleId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn("Supabase forum fetch failed, using local fallback", e);
    }

    // Fallback local
    const locals = getLocalThreads().filter((t) => t.module_id === moduleId);
    return locals.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
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
    const newThread: ForumThread = {
      id: "thread_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      module_id: thread.module_id,
      author_id: thread.author_id,
      author_name: thread.author_name,
      author_role: thread.author_role,
      title: thread.title,
      content: thread.content,
      is_pinned: false,
      is_closed: false,
      created_at: new Date().toISOString(),
    };

    // Sauvegarde locale systématique pour synchronisation fluide
    const locals = getLocalThreads();
    saveLocalThreads([newThread, ...locals]);

    try {
      const { data, error } = await supabase
        .from("forum_threads")
        .insert({
          ...thread,
          is_pinned: false,
          is_closed: false,
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, data };
      }
    } catch {}

    return { success: true, data: newThread };
  },

  /**
   * Modifie un sujet
   */
  async updateThread(
    threadId: string,
    updates: { title: string; content: string }
  ): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalThreads();
    const updated = locals.map((t) =>
      t.id === threadId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
    );
    saveLocalThreads(updated);

    try {
      await supabase
        .from("forum_threads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", threadId);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime un fil de discussion et ses messages associés
   */
  async deleteThread(threadId: string): Promise<{ success: boolean; error?: string }> {
    const threads = getLocalThreads().filter((t) => t.id !== threadId);
    saveLocalThreads(threads);

    const posts = getLocalPosts().filter((p) => p.thread_id !== threadId);
    saveLocalPosts(posts);

    try {
      await supabase.from("forum_posts").delete().eq("thread_id", threadId);
      await supabase.from("forum_threads").delete().eq("id", threadId);
    } catch {}

    return { success: true };
  },

  /**
   * Récupère les messages d'un fil de discussion
   */
  async getPosts(threadId: string): Promise<ForumPost[]> {
    try {
      const { data, error } = await supabase
        .from("forum_posts")
        .select("*")
        .eq("thread_id", threadId)
        .order("is_pinned_solution", { ascending: false })
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn("Supabase posts fetch failed, using local fallback", e);
    }

    const locals = getLocalPosts().filter((p) => p.thread_id === threadId);
    return locals.sort((a, b) => {
      if (a.is_pinned_solution !== b.is_pinned_solution) return a.is_pinned_solution ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
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
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const newPost: ForumPost = {
      id: "post_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      thread_id: post.thread_id,
      author_id: post.author_id,
      author_name: post.author_name,
      author_role: post.author_role,
      content: post.content,
      is_pinned_solution: false,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalPosts();
    saveLocalPosts([...locals, newPost]);

    try {
      const { error } = await supabase.from("forum_posts").insert(post);
      if (!error) return { success: true, data: newPost };
    } catch {}

    return { success: true, data: newPost };
  },

  /**
   * Modifie le contenu d'un message existant
   */
  async updatePost(postId: string, content: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalPosts();
    const updated = locals.map((p) =>
      p.id === postId ? { ...p, content, updated_at: new Date().toISOString() } : p
    );
    saveLocalPosts(updated);

    try {
      await supabase
        .from("forum_posts")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", postId);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime un message du fil
   */
  async deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    const posts = getLocalPosts().filter((p) => p.id !== postId);
    saveLocalPosts(posts);

    try {
      await supabase.from("forum_posts").delete().eq("id", postId);
    } catch {}

    return { success: true };
  },

  /**
   * Épingle une réponse comme solution officielle (enseignant)
   */
  async pinSolution(postId: string, isSolution: boolean): Promise<{ success: boolean }> {
    const locals = getLocalPosts();
    const updated = locals.map((p) =>
      p.id === postId ? { ...p, is_pinned_solution: isSolution } : p
    );
    saveLocalPosts(updated);

    try {
      await supabase
        .from("forum_posts")
        .update({ is_pinned_solution: isSolution })
        .eq("id", postId);
    } catch {}

    return { success: true };
  },
};
