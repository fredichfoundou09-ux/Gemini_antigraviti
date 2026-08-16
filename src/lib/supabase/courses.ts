import { getSupabase } from "./client";

export async function fetchCourses() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("courses")
    .select("*, files:course_files(*), targets:course_targets(student_id)")
    .order("date_publication", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCourse(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("courses").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id: string, patch: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("courses").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from("courses").delete().eq("id", id);
  if (error) throw error;
}

export async function addCourseFile(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("course_files").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function setCourseTargets(courseId: string, studentIds: string[]) {
  const sb = getSupabase();
  await sb.from("course_targets").delete().eq("course_id", courseId);
  if (studentIds.length) {
    const { error } = await sb.from("course_targets").insert(studentIds.map((student_id) => ({ course_id: courseId, student_id })));
    if (error) throw error;
  }
}
