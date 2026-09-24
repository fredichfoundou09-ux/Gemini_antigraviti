import { UserContext } from "./auth.ts";

export type RoleName = "superadmin" | "admin" | "partner_admin" | "partner" | "teacher" | "student";

// Registre des outils autorisés par rôle
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: [
    "get_dashboard_stats",
    "search_student",
    "get_student",
    "search_teacher",
    "get_schedule",
    "get_attendance",
    "get_finance_summary",
    "get_student_balance",
    "get_certificates",
    "search_courses",
    "search_documents",
    "detecter_anomalies",
    "prepare_message",
    "prepare_notification",
    "generate_report",
    "create_learning_exercise",
    "create_schedule_draft",
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "send_message",
    "create_notification",
    "create_invoice_draft",
  ],
  admin: [
    "get_dashboard_stats",
    "search_student",
    "get_student",
    "search_teacher",
    "get_schedule",
    "get_attendance",
    "get_finance_summary",
    "get_student_balance",
    "get_certificates",
    "search_courses",
    "search_documents",
    "detecter_anomalies",
    "prepare_message",
    "prepare_notification",
    "generate_report",
    "create_learning_exercise",
    "create_schedule_draft",
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "send_message",
    "create_notification",
    "create_invoice_draft",
  ],
  partner_admin: [
    "get_dashboard_stats",
    "search_student",
    "get_student",
    "search_teacher",
    "get_schedule",
    "get_attendance",
    "get_certificates",
    "search_courses",
    "search_documents",
    "generate_report",
  ],
  partner: [
    "get_dashboard_stats",
    "get_schedule",
    "get_certificates",
    "search_courses",
    "search_documents",
  ],
  teacher: [
    "get_dashboard_stats",
    "search_student",
    "get_student",
    "get_schedule",
    "get_attendance",
    "search_courses",
    "search_documents",
    "detecter_anomalies",
    "prepare_message",
    "create_learning_exercise",
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "send_message",
  ],
  student: [
    "get_dashboard_stats",
    "get_student",
    "get_schedule",
    "get_attendance",
    "get_student_balance",
    "get_certificates",
    "search_courses",
    "search_documents",
    "create_learning_exercise",
  ],
};

/** Vérifie si un utilisateur avec un rôle donné a le droit d'appeler l'outil */
export function isToolAllowedForRole(role: string, toolName: string): boolean {
  const allowedTools = ROLE_PERMISSIONS[role] || [];
  return allowedTools.includes(toolName);
}

/** Vérifie les restrictions d'accès sur les arguments (ex: un étudiant ne peut consulter que sa propre fiche) */
export function validateAccessScope(user: UserContext, toolName: string, args: Record<string, any>): { ok: boolean; reason?: string } {
  // Règle 1 : Rôle étudiant
  if (user.role === "student") {
    if (toolName === "get_student" || toolName === "get_student_balance") {
      if (args.student_id && user.studentId && args.student_id !== user.studentId) {
        return { ok: false, reason: "Vous ne pouvez consulter que vos propres données d'apprenant." };
      }
      // Forcer le student_id sur celui de l'utilisateur connecté
      if (user.studentId) {
        args.student_id = user.studentId;
      }
    }
  }

  // Règle 2 : Rôle formateur
  if (user.role === "teacher") {
    if (!user.teacherId) {
      return { ok: false, reason: "Compte formateur non relié à une fiche enseignante active." };
    }
  }

  return { ok: true };
}
