import { supabase } from "@/lib/supabase/client";

export interface EducationalResource {
  id: string;
  title: string;
  description?: string;
  module_id?: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  tags: string[];
  downloads_count: number;
  created_by?: string;
  created_at: string;
}

export const resourceService = {
  /**
   * Récupère les ressources avec filtres optionnels par module et tag
   */
  async getResources(filter?: { moduleId?: string; tag?: string; search?: string }): Promise<EducationalResource[]> {
    let query = supabase.from("resources").select("*").order("created_at", { ascending: false });

    if (filter?.moduleId) {
      query = query.eq("module_id", filter.moduleId);
    }

    if (filter?.tag) {
      query = query.contains("tags", [filter.tag]);
    }

    if (filter?.search) {
      query = query.ilike("title", `%${filter.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Erreur chargement ressources:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Publie une nouvelle ressource dans la bibliothèque
   */
  async createResource(resource: Omit<EducationalResource, "id" | "downloads_count" | "created_at">): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const { data, error } = await supabase
      .from("resources")
      .insert({
        ...resource,
        downloads_count: 0,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  /**
   * Incrémente le compteur de téléchargement
   */
  async trackDownload(resourceId: string): Promise<void> {
    try {
      await supabase.rpc("increment_resource_downloads", { p_resource_id: resourceId });
    } catch {
      // silence
    }
  },
};
