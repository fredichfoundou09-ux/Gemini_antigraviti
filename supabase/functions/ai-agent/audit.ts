import { UserContext } from "./auth.ts";

export interface LoggedAction {
  id?: string;
  user_id: string;
  tool_name: string;
  arguments: Record<string, any>;
  status: "proposed" | "confirmed" | "executed" | "failed" | "rejected";
  result?: any;
  error?: string;
}

export async function logAgentAction(
  user: UserContext,
  action: {
    tool_name: string;
    arguments: Record<string, any>;
    status: "proposed" | "confirmed" | "executed" | "failed" | "rejected";
    result?: any;
    error?: string;
  }
): Promise<string | null> {
  const sb = user.sbUser;

  // Filtrage préventif des arguments pour éviter d'enregistrer des secrets
  const sanitizedArgs = JSON.parse(JSON.stringify(action.arguments || {}));
  for (const k of Object.keys(sanitizedArgs)) {
    if (k.toLowerCase().includes("password") || k.toLowerCase().includes("secret") || k.toLowerCase().includes("token")) {
      sanitizedArgs[k] = "[REDACTED]";
    }
  }

  const { data, error } = await sb
    .from("ai_agent_actions")
    .insert({
      user_id: user.userId,
      tool_name: action.tool_name,
      arguments: sanitizedArgs,
      status: action.status,
      result: action.result ?? null,
      error: action.error ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Échec d'enregistrement dans ai_agent_actions :", error);
    return null;
  }

  return data?.id ?? null;
}

export async function updateAgentActionStatus(
  user: UserContext,
  actionId: string,
  status: "executed" | "failed" | "rejected",
  result?: any,
  errorMsg?: string
): Promise<boolean> {
  const sb = user.sbUser;
  const { error } = await sb
    .from("ai_agent_actions")
    .update({
      status,
      result: result ?? null,
      error: errorMsg ?? null,
    })
    .eq("id", actionId)
    .eq("user_id", user.userId);

  return !error;
}
