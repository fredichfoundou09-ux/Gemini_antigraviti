import { getSupabase } from "./client";

export async function writeAudit(input: {
  action: string;
  entity_type: string;
  entity_id?: string;
  description: string;
}) {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const { error } = await sb.from("audit_logs").insert({
    user_id: auth.user?.id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    description: input.description,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw error;
}

export async function listAuditLogs(limit = 100) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
