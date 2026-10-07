import { supabase } from "@/lib/supabase/client";

export interface TrashItem {
  id: string;
  entity_type: "tests" | "test_results" | "assignments" | "assignment_submissions" | "students" | "invoices" | "messages";
  label: string;
  details: Record<string, unknown>;
  deleted_at: string;
  deleted_by?: string;
  deleted_by_name?: string;
}

export interface SystemBackup {
  id: string;
  created_at: string;
  created_by?: string;
  title: string;
  backup_type: string;
  tables_included: string[];
  record_counts: Record<string, number>;
  backup_data: Record<string, unknown>;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface SimulationResult {
  backup_id: string;
  title: string;
  created_at: string;
  status: string;
  is_destructive: boolean;
  checks: {
    schema_compatible: boolean;
    rls_intact: boolean;
    tables_checked: string[];
    backup_record_counts: Record<string, number>;
  };
  current_record_counts: Record<string, number>;
  differences: {
    conflicts_detected: number;
    missing_foreign_keys: number;
    recommendation: string;
  };
}

export const trashService = {
  async getTrashItems(table?: string): Promise<{ data: TrashItem[]; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("get_trash_items", {
        p_table: table || null,
      });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as TrashItem[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async softDeleteItem(table: string, id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("soft_delete_item", {
        p_table: table,
        p_id: id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean; error?: string };
      if (res && res.success === false) {
        return { success: false, error: res.error || "Échec de suppression" };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async restoreItem(table: string, id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("restore_item", {
        p_table: table,
        p_id: id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean; error?: string };
      if (res && res.success === false) {
        return { success: false, error: res.error || "Échec de restauration" };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async purgeDeletedItems(
    table: string = "all",
    daysOld: number = 30
  ): Promise<{ success: boolean; purgedCount: number; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("purge_deleted_items", {
        p_table: table,
        p_days_old: daysOld,
      });

      if (error) {
        return { success: false, purgedCount: 0, error: error.message };
      }

      const res = data as { success?: boolean; purged_count?: number; error?: string };
      if (res && res.success === false) {
        return { success: false, purgedCount: 0, error: res.error || "Échec de purge" };
      }

      return { success: true, purgedCount: res?.purged_count || 0, error: null };
    } catch (err: unknown) {
      return { success: false, purgedCount: 0, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async getSystemBackups(): Promise<{ data: SystemBackup[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from("system_backups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as SystemBackup[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async createSystemBackup(title?: string): Promise<{ success: boolean; backupId?: string; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("create_system_backup", {
        p_title: title || "Sauvegarde manuelle",
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean; backup_id?: string; error?: string };
      if (res && res.success === false) {
        return { success: false, error: res.error || "Échec de la sauvegarde" };
      }

      return { success: true, backupId: res?.backup_id, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async simulateRestoreBackup(
    backupId: string
  ): Promise<{ success: boolean; simulation?: SimulationResult; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("simulate_restore_backup", {
        p_backup_id: backupId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const res = data as { success?: boolean; simulation?: SimulationResult; error?: string };
      if (res && res.success === false) {
        return { success: false, error: res.error || "Échec de la simulation" };
      }

      return { success: true, simulation: res?.simulation, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },
};
