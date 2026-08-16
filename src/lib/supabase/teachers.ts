import { getSupabase } from "./client";

export async function fetchTeachers() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("teachers")
    .select("*, modules:teacher_modules(module_id), rates:teacher_module_rates(*)")
    .order("nom");
  if (error) throw error;
  return data || [];
}

export async function fetchTeacher(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("teachers")
    .select("*, modules:teacher_modules(module_id), rates:teacher_module_rates(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateTeacher(id: string, patch: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("teachers").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function setTeacherActive(id: string, actif: boolean) {
  return updateTeacher(id, { actif });
}

export async function setTeacherModules(teacherId: string, moduleIds: string[]) {
  const sb = getSupabase();
  await sb.from("teacher_modules").delete().eq("teacher_id", teacherId);
  if (moduleIds.length) {
    const { error } = await sb.from("teacher_modules").insert(moduleIds.map((module_id) => ({ teacher_id: teacherId, module_id })));
    if (error) throw error;
  }
}
