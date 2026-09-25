import { UserContext } from "./auth.ts";

export type RoleName = "superadmin" | "admin" | "partner_admin" | "partner" | "teacher" | "student";

// Registre exhaustif des outils autorisés par rôle
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: [
    // Web & Connaissances
    "search_web",
    "search_wikipedia",
    "fetch_web_page",
    "search_documents",
    "summarize_document",
    "remember_information",
    "search_courses",
    // Admin & Métier
    "get_dashboard_stats",
    "search_student",
    "search_students",
    "get_student",
    "search_teacher",
    "search_teachers",
    "get_schedule",
    "get_attendance",
    "get_attendance_stats",
    "get_finance_summary",
    "get_student_balance",
    "get_certificates",
    "detecter_anomalies",
    "generate_report",
    // Actions & Brouillons
    "prepare_message",
    "send_message",
    "prepare_notification",
    "create_notification",
    "manage_notifications",
    "create_invoice_draft",
    "create_schedule_draft",
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "create_learning_exercise",
  ],
  admin: [
    // Web & Connaissances
    "search_web",
    "search_wikipedia",
    "fetch_web_page",
    "search_documents",
    "summarize_document",
    "remember_information",
    "search_courses",
    // Admin & Métier
    "get_dashboard_stats",
    "search_student",
    "search_students",
    "get_student",
    "search_teacher",
    "search_teachers",
    "get_schedule",
    "get_attendance",
    "get_attendance_stats",
    "get_finance_summary",
    "get_student_balance",
    "get_certificates",
    "detecter_anomalies",
    "generate_report",
    // Actions & Brouillons
    "prepare_message",
    "send_message",
    "prepare_notification",
    "create_notification",
    "manage_notifications",
    "create_invoice_draft",
    "create_schedule_draft",
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "create_learning_exercise",
  ],
  teacher: [
    // Web & Connaissances
    "search_web",
    "search_wikipedia",
    "fetch_web_page",
    "search_documents",
    "search_course_documents",
    "summarize_document",
    "remember_information",
    "search_courses",
    // Métier Enseignant
    "get_dashboard_stats",
    "get_my_schedule",
    "get_schedule",
    "get_my_courses",
    "get_assigned_students",
    "search_student",
    "get_student",
    "get_attendance",
    "get_grades",
    "detecter_anomalies",
    // Pédagogie
    "create_exercise",
    "create_quiz",
    "create_learning_exercise",
    "summarize_course",
    "generate_lesson_plan",
    "explain_course",
    // Actions Niveau 3
    "valider_presence",
    "publier_devoir",
    "publier_evaluation",
    "prepare_message",
    "send_message",
  ],
  student: [
    // Web & Connaissances
    "search_web",
    "search_wikipedia",
    "fetch_web_page",
    "search_documents",
    "search_my_documents",
    "search_course_knowledge",
    "summarize_document",
    "remember_information",
    "search_courses",
    // Espace Apprenant (scopé)
    "get_dashboard_stats",
    "get_my_profile",
    "get_student",
    "get_my_schedule",
    "get_my_next_course",
    "get_schedule",
    "get_my_courses",
    "get_my_modules",
    "get_my_attendance",
    "get_attendance",
    "get_my_grades",
    "get_student_balance",
    "get_certificates",
    // Tuteur & Pédagogie
    "create_practice_exercise",
    "create_learning_exercise",
    "explain_course",
    "summarize_course",
  ],
  partner_admin: [
    "search_web",
    "search_wikipedia",
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
    "search_web",
    "search_wikipedia",
    "get_dashboard_stats",
    "get_schedule",
    "get_certificates",
    "search_courses",
    "search_documents",
  ],
};

/** Vérifie si un utilisateur avec un rôle donné a le droit d'appeler l'outil */
export function isToolAllowedForRole(role: string, toolName: string): boolean {
  const allowedTools = ROLE_PERMISSIONS[role] || [];
  return allowedTools.includes(toolName);
}

/** Vérifie les restrictions d'accès sur les arguments (ex: un étudiant ne peut consulter que sa propre fiche) */
export function validateAccessScope(
  user: UserContext,
  toolName: string,
  args: Record<string, any>
): { ok: boolean; reason?: string } {
  // Règle 1 : Rôle étudiant — isolation absolue des données des tiers
  if (user.role === "student") {
    // Liste d'outils d'accès aux fiches apprenants
    if (toolName === "get_student" || toolName === "get_student_balance" || toolName === "get_my_profile") {
      if (args.student_id && user.studentId && args.student_id !== user.studentId) {
        return { ok: false, reason: "Sécurité RBAC : Vous ne pouvez consulter que vos propres données d'apprenant." };
      }
      if (user.studentId) {
        args.student_id = user.studentId;
      }
    }

    if (toolName === "get_attendance" || toolName === "get_my_attendance" || toolName === "get_my_grades") {
      if (args.student_id && user.studentId && args.student_id !== user.studentId) {
        return { ok: false, reason: "Sécurité RBAC : Relevé réservé exclusivement à votre dossier étudiant." };
      }
      if (user.studentId) {
        args.student_id = user.studentId;
      }
    }

    if (toolName === "get_certificates") {
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
