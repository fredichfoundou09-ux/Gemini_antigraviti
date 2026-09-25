import { isToolAllowedForRole } from "./permissions.ts";
import { TOOLS } from "./tools.ts";

export type UserIntent =
  | "SCHEDULE"
  | "PEDAGOGY"
  | "ATTENDANCE"
  | "DOCUMENT_RAG"
  | "WEB_SEARCH"
  | "ADMIN_FINANCE"
  | "COMMUNICATION"
  | "GENERAL";

const INTENT_TOOL_MAPPING: Record<UserIntent, string[]> = {
  SCHEDULE: [
    "get_my_next_course",
    "get_my_schedule",
    "get_schedule",
    "create_schedule_draft",
  ],
  PEDAGOGY: [
    "explain_course",
    "create_practice_exercise",
    "search_courses",
    "get_my_courses",
    "create_quiz",
    "generate_lesson_plan",
    "publier_evaluation",
    "publier_devoir",
    "search_wikipedia",
  ],
  ATTENDANCE: [
    "get_my_attendance",
    "get_attendance",
    "detecter_anomalies",
    "valider_presence",
  ],
  DOCUMENT_RAG: [
    "search_documents",
    "search_course_knowledge",
    "search_my_documents",
    "get_certificates",
  ],
  WEB_SEARCH: [
    "search_wikipedia",
    "search_web",
    "fetch_web_page",
  ],
  ADMIN_FINANCE: [
    "get_finance_summary",
    "get_student_balance",
    "generate_report",
    "create_invoice_draft",
  ],
  COMMUNICATION: [
    "prepare_message",
    "send_message",
    "prepare_notification",
    "create_notification",
    "manage_notifications",
  ],
  GENERAL: [
    "get_my_profile",
    "get_dashboard_stats",
    "search_student",
    "search_students",
    "get_student",
    "search_teacher",
    "search_teachers",
    "get_assigned_students",
    "get_my_grades",
    "search_wikipedia",
    "search_documents",
    "remember_information",
  ],
};

/**
 * Classifie l'intention utilisateur à partir des termes sémantiques.
 * Exécution ultra-rapide (< 1ms).
 */
export function classifyIntent(message: string): UserIntent {
  const text = message.toLowerCase();

  // 1. Wikipédia, Recherche Web externe & culture générale
  if (
    text.includes("wikipédia") ||
    text.includes("wikipedia") ||
    text.includes("qui a créé") ||
    text.includes("qui est") ||
    text.includes("histoire de") ||
    text.includes("biographie") ||
    text.includes("sur le web") ||
    text.includes("cherche sur internet") ||
    text.includes("recherche web") ||
    text.includes("norme rfc") ||
    text.includes("recherche externe")
  ) {
    return "WEB_SEARCH";
  }

  // 2. Emploi du temps, Prochain cours & Horaires
  if (
    text.includes("prochain cours") ||
    text.includes("cours aujourd'hui") ||
    text.includes("cours demain") ||
    text.includes("emploi du temps") ||
    text.includes("planning") ||
    text.includes("horaire") ||
    text.includes("salle") ||
    text.includes("créneau") ||
    text.includes("creneau") ||
    text.includes("séance") ||
    text.includes("seance") ||
    text.includes("heure de cours")
  ) {
    return "SCHEDULE";
  }

  // 3. Présences, Assiduité, Absences & Anomalies
  if (
    text.includes("présence") ||
    text.includes("presence") ||
    text.includes("absent") ||
    text.includes("retard") ||
    text.includes("pointer") ||
    text.includes("pointage") ||
    text.includes("anomalie") ||
    text.includes("assiduité") ||
    text.includes("assiduite") ||
    /\bappel\b/i.test(text)
  ) {
    return "ATTENDANCE";
  }

  // 4. Finances, Facturation, Trésorerie
  if (
    text.includes("facture") ||
    text.includes("solde") ||
    text.includes("trésorerie") ||
    text.includes("tresorerie") ||
    text.includes("paiement") ||
    text.includes("payer") ||
    text.includes("frais") ||
    text.includes("financier") ||
    text.includes("recouvrement") ||
    text.includes("rapport financier")
  ) {
    return "ADMIN_FINANCE";
  }

  // 5. Communication & Messages
  if (
    text.includes("message") ||
    text.includes("notification") ||
    text.includes("diffuser") ||
    text.includes("annoncer") ||
    text.includes("écrire aux élèves") ||
    text.includes("envoyer à")
  ) {
    return "COMMUNICATION";
  }

  // 6. Pédagogie, Tuteur, Exercices, Quiz, Évaluations, Devoirs
  if (
    text.includes("quiz") ||
    text.includes("qcm") ||
    text.includes("évaluation") ||
    text.includes("evaluation") ||
    text.includes("exercice") ||
    text.includes("devoir") ||
    text.includes("tp") ||
    text.includes("cours") ||
    text.includes("expliquer") ||
    text.includes("explique") ||
    text.includes("réviser") ||
    text.includes("correction") ||
    text.includes("tuteur") ||
    text.includes("leçon")
  ) {
    return "PEDAGOGY";
  }

  // 7. Recherche documentaire, Règlements, Certificats
  if (
    text.includes("règlement") ||
    text.includes("reglement") ||
    text.includes("certificat") ||
    text.includes("attestation") ||
    text.includes("procédure") ||
    text.includes("faq") ||
    text.includes("enia") ||
    text.includes("guide") ||
    text.includes("document")
  ) {
    return "DOCUMENT_RAG";
  }

  return "GENERAL";
}

/**
 * Filtre les outils nécessaires pour la requête :
 * Combine l'intention détectée et le rôle RBAC pour n'envoyer que 3 à 5 outils optimaux au modèle.
 */
export function getOptimizedTools(role: string, userMessage: string): any[] {
  const intent = classifyIntent(userMessage);
  const targetToolNames = new Set(INTENT_TOOL_MAPPING[intent]);

  // Si c'est un étudiant, toujours fournir l'accès à son profil et ses cours
  if (role === "student") {
    targetToolNames.add("get_my_next_course");
    targetToolNames.add("search_course_knowledge");
  }

  // Recherche documentaire et Wikipédia accessibles en filet de sécurité
  targetToolNames.add("search_documents");
  targetToolNames.add("search_wikipedia");

  return TOOLS.filter(
    (t) =>
      targetToolNames.has(t.function.name) &&
      isToolAllowedForRole(role, t.function.name)
  );
}
