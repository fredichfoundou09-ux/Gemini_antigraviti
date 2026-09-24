export interface AiChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  id?: string;
  createdAt?: string;
  sources?: string[];
  intent?: string;
  feedback?: "positive" | "negative" | null;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface EvaluationQuestion {
  type: "qcm" | "vf" | "courte";
  enonce: string;
  options?: string[];
  bonne_reponse: string;
  points: number;
  explication?: string;
}

export interface PublierEvaluationArgs {
  module_id: string;
  titre: string;
  duree: number;
  bareme: number;
  questions: EvaluationQuestion[];
}

export interface AiPendingAction {
  action_id: string;
  tool_name:
    | "valider_presence"
    | "publier_devoir"
    | "publier_evaluation"
    | "send_message"
    | "create_notification"
    | "create_invoice_draft"
    | string;
  arguments: Record<string, any>;
  status?: "proposed" | "confirmed" | "rejected";
}

export interface AiAgentReply {
  reply: string;
  pending_actions: AiPendingAction[];
  intent?: string;
  sources?: string[];
  memories_count?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface AiFeedbackPayload {
  message_id: string;
  rating: "positive" | "negative";
  comment?: string;
}

/** Libellé lisible en français pour chaque outil */
export function toolLabel(toolName: string): string {
  switch (toolName) {
    case "valider_presence":
      return "Valider une présence";
    case "publier_devoir":
      return "Publier un devoir";
    case "publier_evaluation":
      return "Publier une évaluation";
    case "send_message":
      return "Envoyer un message";
    case "create_notification":
      return "Diffuser une notification";
    case "create_invoice_draft":
      return "Émettre une facture";
    case "get_dashboard_stats":
      return "Statistiques du tableau de bord";
    case "search_student":
      return "Rechercher un apprenant";
    case "get_student":
      return "Détail apprenant";
    case "search_teacher":
      return "Rechercher un formateur";
    case "get_schedule":
      return "Emploi du temps";
    case "get_attendance":
      return "Consulter les présences";
    case "get_finance_summary":
      return "Synthèse financière";
    case "get_student_balance":
      return "Solde de l'apprenant";
    case "get_certificates":
      return "Certificats officiels";
    case "search_courses":
      return "Recherche de cours";
    case "search_documents":
      return "Recherche documentaire (RAG)";
    case "detecter_anomalies":
      return "Détection d'anomalies";
    case "prepare_message":
      return "Projet de message";
    case "prepare_notification":
      return "Projet de notification";
    case "generate_report":
      return "Génération de rapport";
    case "create_learning_exercise":
      return "Création d'exercice";
    case "create_schedule_draft":
      return "Créneau prévisionnel";
    default:
      return toolName;
  }
}
