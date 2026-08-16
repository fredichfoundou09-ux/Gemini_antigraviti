import { getSupabase } from "./client";

export async function listFormations() {
  const sb = getSupabase();
  const { data, error } = await sb.from("formations").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data || [];
}

export async function listModules(formationCode?: string) {
  const sb = getSupabase();
  let q = sb.from("modules").select("*, formation:formations(code,name), chapters(*)").eq("active", true).order("numero");
  if (formationCode) {
    const { data: f } = await sb.from("formations").select("id").eq("code", formationCode).maybeSingle();
    if (f?.id) q = q.eq("formation_id", f.id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Résout le code de formation (ex: "informatique" ou "industriel") en UUID réel de PostgreSQL.
 */
export async function resolveFormationId(codeOrUuid: string): Promise<string> {
  if (!codeOrUuid) return "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrUuid);
  if (isUuid) return codeOrUuid;

  try {
    const sb = getSupabase();
    const { data } = await sb.from("formations").select("id").eq("code", codeOrUuid.toLowerCase()).maybeSingle();
    if (data?.id) return data.id;

    // Fallback : recherche générale dans les formations
    const { data: all } = await sb.from("formations").select("id, code");
    const found = (all || []).find((f) => f.code.toLowerCase() === codeOrUuid.toLowerCase());
    return found?.id || codeOrUuid;
  } catch {
    return codeOrUuid;
  }
}
