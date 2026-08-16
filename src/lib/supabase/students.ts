import { getSupabase } from "./client";

export async function listStudents() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("students")
    .select("*, formation:formations(*), modules:student_modules(module:modules(*))")
    .order("nom");
  if (error) throw error;
  return data || [];
}

export async function getStudentById(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("students")
    .select("*, formation:formations(*), modules:student_modules(module:modules(*)), invoices(*), payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyStudentProfile(userId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("students")
    .select("*, formation:formations(*), modules:student_modules(module:modules(*))")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRegistrations() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("registrations")
    .select("*, formation:formations(*), modules:registration_modules(module_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPublicRegistration(payload: {
  formation_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  whatsapp: string;
  email?: string;
  niveau?: string;
  module_ids?: string[];
}) {
  const sb = getSupabase();
  const { data: reg, error } = await sb
    .from("registrations")
    .insert({
      formation_id: payload.formation_id,
      nom: payload.nom,
      prenom: payload.prenom,
      telephone: payload.telephone,
      whatsapp: payload.whatsapp,
      email: payload.email,
      niveau: payload.niveau,
      statut: "en_attente",
    })
    .select("*")
    .single();
  if (error) throw error;

  if (payload.module_ids?.length) {
    const rows = payload.module_ids.map((module_id) => ({ registration_id: reg.id, module_id }));
    const { error: e2 } = await sb.from("registration_modules").insert(rows);
    if (e2) throw e2;
  }
  return reg;
}
