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

const LOCAL_RESOURCES_KEY = "sentinelles_local_resources";

const DEFAULT_RESOURCES: EducationalResource[] = [
  {
    id: "res_demo_1",
    title: "Guide de configuration avancée Suricata & Nmap",
    description: "Support de travaux pratiques : détection d'intrusions, règles de filtrage et analyse de flux réseau.",
    file_url: "https://example.com/guides/suricata-nmap.pdf",
    file_type: "PDF",
    tags: ["securite", "tp", "reseau"],
    downloads_count: 14,
    created_by: "Formateur Principal",
    created_at: new Date().toISOString(),
  },
  {
    id: "res_demo_2",
    title: "Aide-mémoire Docker & Kubernetes pour Administrateurs",
    description: "Commandes essentielles, Dockerfile optimisés et manifestes de déploiement sécurisés.",
    file_url: "https://example.com/cheatsheets/k8s-docker.pdf",
    file_type: "PDF",
    tags: ["cloud", "devops", "linux"],
    downloads_count: 28,
    created_by: "Équipe Pédagogique",
    created_at: new Date().toISOString(),
  },
];

function getLocalResources(): EducationalResource[] {
  try {
    const raw = localStorage.getItem(LOCAL_RESOURCES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_RESOURCES;
  } catch {
    return DEFAULT_RESOURCES;
  }
}

function saveLocalResources(list: EducationalResource[]) {
  try {
    localStorage.setItem(LOCAL_RESOURCES_KEY, JSON.stringify(list));
  } catch {}
}

export const resourceService = {
  /**
   * Récupère les ressources avec filtres optionnels par module et tag
   */
  async getResources(filter?: { moduleId?: string; tag?: string; search?: string }): Promise<EducationalResource[]> {
    try {
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
      if (!error && data && data.length > 0) return data;
    } catch {}

    let locals = getLocalResources();
    if (filter?.moduleId) locals = locals.filter((r) => r.module_id === filter.moduleId);
    if (filter?.tag) locals = locals.filter((r) => r.tags.includes(filter.tag!));
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      locals = locals.filter((r) => r.title.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)));
    }
    return locals;
  },

  /**
   * Publie une nouvelle ressource dans la bibliothèque
   */
  async createResource(resource: Omit<EducationalResource, "id" | "downloads_count" | "created_at">): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const newRes: EducationalResource = {
      ...resource,
      id: "res_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      downloads_count: 0,
      created_at: new Date().toISOString(),
    };

    const locals = getLocalResources();
    saveLocalResources([newRes, ...locals]);

    try {
      const { data, error } = await supabase
        .from("resources")
        .insert({
          ...resource,
          downloads_count: 0,
        })
        .select()
        .single();

      if (!error && data) return { success: true, data };
    } catch {}

    return { success: true, data: newRes };
  },

  /**
   * Modifie une ressource existante
   */
  async updateResource(
    id: string,
    updates: Partial<Omit<EducationalResource, "id" | "created_at">>
  ): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalResources();
    saveLocalResources(locals.map((r) => (r.id === id ? { ...r, ...updates } : r)));

    try {
      await supabase.from("resources").update(updates).eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Supprime une ressource
   */
  async deleteResource(id: string): Promise<{ success: boolean; error?: string }> {
    const locals = getLocalResources();
    saveLocalResources(locals.filter((r) => r.id !== id));

    try {
      await supabase.from("resources").delete().eq("id", id);
    } catch {}

    return { success: true };
  },

  /**
   * Incrémente le compteur de téléchargement
   */
  async trackDownload(resourceId: string): Promise<void> {
    const locals = getLocalResources();
    saveLocalResources(
      locals.map((r) => (r.id === resourceId ? { ...r, downloads_count: (r.downloads_count || 0) + 1 } : r))
    );

    try {
      await supabase.rpc("increment_resource_downloads", { p_resource_id: resourceId });
    } catch {}
  },
};
