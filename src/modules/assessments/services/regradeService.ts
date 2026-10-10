/**
 * Service de Demandes de Révision de Notes (Phase D.1 - F08)
 * Conforme à la table SQL regrade_requests (Migration 0069)
 */

import { supabase, isSupabaseConfigured } from "../../../lib/supabase/client";

export interface RegradeRequest {
  id: string;
  test_result_id?: string | null;
  assignment_submission_id?: string | null;
  student_id: string;
  student_name?: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  teacher_response?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

const LOCAL_STORAGE_KEY = "sn_regrade_requests";

function getLocalRequests(): RegradeRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRequests(list: RegradeRequest[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const regradeService = {
  /**
   * Créer une demande de révision (initiée par l'apprenant, motif obligatoire)
   */
  async submitRequest(params: {
    studentId: string;
    studentName?: string;
    testResultId?: string;
    assignmentSubmissionId?: string;
    reason: string;
  }): Promise<{ success: boolean; data?: RegradeRequest; error?: string }> {
    if (!params.reason || params.reason.trim().length < 5) {
      return { success: false, error: "Un motif précis de contestation ou d'explication est obligatoire (min 5 car)." };
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("regrade_requests")
          .insert({
            student_id: params.studentId,
            test_result_id: params.testResultId || null,
            assignment_submission_id: params.assignmentSubmissionId || null,
            reason: params.reason.trim(),
            status: "pending",
          })
          .select("*")
          .single();

        if (!error && data) {
          return { success: true, data };
        }
      } catch (err: any) {
        console.warn("Notice persistance regrade_requests Supabase:", err);
      }
    }

    // Fallback local
    const newReq: RegradeRequest = {
      id: `REG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      student_id: params.studentId,
      student_name: params.studentName || "Apprenant",
      test_result_id: params.testResultId || null,
      assignment_submission_id: params.assignmentSubmissionId || null,
      reason: params.reason.trim(),
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const current = getLocalRequests();
    saveLocalRequests([newReq, ...current]);
    return { success: true, data: newReq };
  },

  /**
   * Récupérer toutes les demandes (pour la boîte de réception enseignant ou le suivi apprenant)
   */
  async getRequests(filter?: { studentId?: string }): Promise<RegradeRequest[]> {
    if (isSupabaseConfigured) {
      try {
        let q = supabase.from("regrade_requests").select("*").order("created_at", { ascending: false });
        if (filter?.studentId) {
          q = q.eq("student_id", filter.studentId);
        }
        const { data, error } = await q;
        if (!error && data) {
          return data as RegradeRequest[];
        }
      } catch (err) {
        console.warn("Notice fetch regrade_requests:", err);
      }
    }

    const local = getLocalRequests();
    if (filter?.studentId) {
      return local.filter((r) => r.student_id === filter.studentId);
    }
    return local;
  },

  /**
   * Traiter une demande (approuver / rejeter avec réponse enseignant)
   */
  async reviewRequest(params: {
    requestId: string;
    status: "approved" | "rejected";
    teacherResponse: string;
    teacherId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("regrade_requests")
          .update({
            status: params.status,
            teacher_response: params.teacherResponse,
            reviewed_by: params.teacherId,
            reviewed_at: now,
          })
          .eq("id", params.requestId);

        if (!error) return { success: true };
      } catch (err: any) {
        console.warn("Notice update regrade_requests Supabase:", err);
      }
    }

    const local = getLocalRequests().map((r) =>
      r.id === params.requestId
        ? {
            ...r,
            status: params.status,
            teacher_response: params.teacherResponse,
            reviewed_by: params.teacherId,
            reviewed_at: now,
          }
        : r
    );
    saveLocalRequests(local);
    return { success: true };
  },
};
