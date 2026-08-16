import { getSupabase } from "./client";

export async function fetchCertificates(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("certificates").select("*, modules:certificate_modules(module_id)").order("date", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createCertificate(payload: Record<string, unknown>, moduleIds: string[] = []) {
  const sb = getSupabase();
  const { data, error } = await sb.from("certificates").insert(payload).select("*").single();
  if (error) throw error;
  if (moduleIds.length) {
    await sb.from("certificate_modules").insert(moduleIds.map((module_id) => ({ certificate_id: data.id, module_id })));
  }
  return data;
}

/** Vérification publique d'un certificat par numéro. */
export async function verifyCertificate(numero: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from("certificates").select("numero, periode, resultat, date").eq("numero", numero).maybeSingle();
  if (error) throw error;
  return data;
}
