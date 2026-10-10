/**
 * Service d'Historique et d'Audit des Notes (Phase D.3 - F12)
 * Table SQL: grade_audit (Migration 0069)
 * Alimenté côté serveur lors de grade_test_result, upsert_grade_safe, etc.
 */

import { supabase, isSupabaseConfigured } from "../../../lib/supabase/client";

export interface GradeAuditEntry {
  id: string;
  student_id: string;
  module_id?: string | null;
  test_result_id?: string | null;
  old_score?: number | null;
  new_score: number;
  changed_by?: string | null;
  reason?: string | null;
  created_at: string;
}

const LOCAL_AUDIT_KEY = "sn_grade_audit_logs";

export const gradeAuditService = {
  /**
   * Consulter l'historique d'audit des modifications de notes
   */
  async getAuditLogs(params?: {
    studentId?: string;
    moduleId?: string;
    testResultId?: string;
    limit?: number;
  }): Promise<GradeAuditEntry[]> {
    if (isSupabaseConfigured) {
      try {
        let q = supabase
          .from("grade_audit")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 50);

        if (params?.studentId) {
          q = q.eq("student_id", params.studentId);
        }
        if (params?.moduleId) {
          q = q.eq("module_id", params.moduleId);
        }
        if (params?.testResultId) {
          q = q.eq("test_result_id", params.testResultId);
        }

        const { data, error } = await q;
        if (!error && data) {
          return data as GradeAuditEntry[];
        }
      } catch (err) {
        console.warn("Notice fetch grade_audit Supabase:", err);
      }
    }

    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
      const list: GradeAuditEntry[] = raw ? JSON.parse(raw) : [];
      return list
        .filter((item) => {
          if (params?.studentId && item.student_id !== params.studentId) return false;
          if (params?.moduleId && item.module_id !== params.moduleId) return false;
          if (params?.testResultId && item.test_result_id !== params.testResultId) return false;
          return true;
        })
        .slice(0, params?.limit || 50);
    } catch {
      return [];
    }
  },

  /**
   * Enregistrer une trace d'audit locale (en cas de repli hors-ligne)
   */
  recordLocalAudit(entry: Omit<GradeAuditEntry, "id" | "created_at">): void {
    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
      const list: GradeAuditEntry[] = raw ? JSON.parse(raw) : [];
      const newEntry: GradeAuditEntry = {
        ...entry,
        id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify([newEntry, ...list.slice(0, 99)]));
    } catch {}
  },
};
