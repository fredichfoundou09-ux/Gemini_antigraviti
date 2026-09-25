import { isToolAllowedForRole } from "./permissions.ts";
import { TOOLS } from "./tools.ts";

export type UserIntent =
  | "SCHEDULE"
  | "PEDAGOGY"
  | "ATTENDANCE"
  | "DOCUMENT_RAG"
  | "ADMIN_FINANCE"
  | "COMMUNICATION"
  | "GENERAL";

const INTENT_TOOL_MAPPING: Record<UserIntent, string[]> = {
  SCHEDULE: [
    "get_schedule",
    "create_schedule_draft",
  ],
  PEDAGOGY: [
    "search_courses",
    "create_learning_exercise",
    "publier_evaluation",
    "publier_devoir",
  ],
  ATTENDANCE: [
    "get_attendance",
    "detecter_anomalies",
    "valider_presence",
  ],
  DOCUMENT_RAG: [
    "search_documents",
    "get_certificates",
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
  ],
  GENERAL: [
    "get_dashboard_stats",
    "search_student",
    "get_student",
    "search_teacher",
  ],
};

/**
 * Classifie l'intention utilisateur à partir des mots-clés sémantiques.
 * Exécution ultra-rapide (< 1ms) sans appel réseau.
 */
export function classifyIntent(message: string): UserIntent {
  const text = message.toLowerCase();

  // Emploi du temps & Horaires
  if (
    text.includes("emploi du temps") ||
    text.includes("planning") ||
    text.includes("horaire") ||
    text.includes("salle") ||
    text.includes("créneau") ||
    text.includes("creneau") ||
    text.includes("séance") ||
    text.includes("seance") ||
    text.includes("cours aujourd'hui") ||
    text.includes("cours demain") ||
    text.includes("prochain cours") ||
    text.includes("heure de cours")
  ) {
    return "SCHEDULE";
  }

  // Présences & Absences
  if (
    text.includes("présence") ||
    text.includes("presence") ||
    text.includes("absent") ||
    text.includes("retard") ||
    text.includes("pointer") ||
    text.includes("pointage") ||
    text.includes("anomalie") ||
    text.includes("appel")
  ) {
    return "ATTENDANCE";
  }

  // Finances, Facturation, Rapports
  if (
    text.includes("facture") ||
    text.includes("solde") ||
    text.includes("trésorerie") ||
    text.includes("paiement") ||
    text.includes("payer") ||
    text.includes("frais") ||
    text.includes("financier") ||
    text.includes("recouvrement") ||
    text.includes("rapport") ||
    text.includes("synthèse") ||
    text.includes("synthese") ||
    text.includes("bilan")
  ) {
    return "ADMIN_FINANCE";
  }

  // Communication & Messages
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

  // Pédagogie, Quiz, Évaluations, Devoirs
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
    text.includes("leçon")
  ) {
    return "PEDAGOGY";
  }

  // Recherche documentaire, Règlements, Certificats
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
 * Combine l'intention détectée et le rôle RBAC pour n'envoyer que 2 à 4 outils au modèle.
 */
export function getOptimizedTools(role: string, userMessage: string): any[] {
  const intent = classifyIntent(userMessage);
  const targetToolNames = new Set(INTENT_TOOL_MAPPING[intent]);

  // Ajout de secours si général
  if (intent === "GENERAL") {
    targetToolNames.add("search_documents");
  }

  return TOOLS.filter(
    (t) =>
      targetToolNames.has(t.function.name) &&
      isToolAllowedForRole(role, t.function.name)
  );
}
