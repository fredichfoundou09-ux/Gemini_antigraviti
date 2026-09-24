import { supabase } from "@/lib/supabase/client";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EvaluationQuestion {
  type: "qcm" | "vf" | "courte";
  enonce: string;
  options?: string[];
  bonne_reponse: string;
  points: number;
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
  tool_name: "valider_presence" | "publier_devoir" | "publier_evaluation";
  arguments: Record<string, any>;
}

export interface AiAgentReply {
  reply: string;
  pending_actions: AiPendingAction[];
}

async function callAgent(payload: Record<string, any>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée, reconnectez-vous.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erreur de l'assistant IA");
  return json;
}

/** Envoie l'historique de conversation à l'agent, reçoit une réponse texte + des actions à confirmer. */
export async function askAgent(messages: AiChatMessage[]): Promise<AiAgentReply> {
  return callAgent({ messages });
}

/** Confirme explicitement une action d'écriture proposée par l'agent (validation présence, publication devoir/évaluation...). */
export async function confirmAgentAction(action: AiPendingAction): Promise<{ ok: boolean; result: any }> {
  return callAgent({ confirm_action: action });
}

/** Libellé lisible d'un outil, pour affichage dans les cartes de confirmation. */
export function toolLabel(toolName: string): string {
  switch (toolName) {
    case "valider_presence": return "Valider une présence";
    case "publier_devoir": return "Publier un devoir";
    case "publier_evaluation": return "Publier une évaluation";
    default: return toolName;
  }
}
