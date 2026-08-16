import { getSupabase } from "./client";

/* ---------- Emploi du temps ---------- */
export async function fetchSchedule() {
  const sb = getSupabase();
  const { data, error } = await sb.from("schedule").select("*, targets:schedule_targets(student_id)").order("jour");
  if (error) throw error;
  return data || [];
}

export async function createScheduleSlot(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("schedule").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteScheduleSlot(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from("schedule").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Présences ---------- */
export async function fetchAttendance(filters?: { studentId?: string; date?: string; moduleId?: string }) {
  const sb = getSupabase();
  let q = sb.from("attendance").select("*").order("date", { ascending: false });
  if (filters?.studentId) q = q.eq("student_id", filters.studentId);
  if (filters?.date) q = q.eq("date", filters.date);
  if (filters?.moduleId) q = q.eq("module_id", filters.moduleId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertAttendance(records: Record<string, unknown>[]) {
  const sb = getSupabase();
  const { data, error } = await sb.from("attendance").upsert(records, { onConflict: "student_id,schedule_id,date" }).select("*");
  if (error) throw error;
  return data || [];
}

/* ---------- Tests ---------- */
export async function fetchTests(moduleId?: string) {
  const sb = getSupabase();
  let q = sb.from("tests").select("*, questions(*, options:question_options(*))").order("date", { ascending: false });
  if (moduleId) q = q.eq("module_id", moduleId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function submitTestResult(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("test_results").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* ---------- Notes ---------- */
export async function fetchGrades(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("grades").select("*").order("date", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertGrade(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("grades").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* ---------- Devoirs / soumissions ---------- */
export async function fetchSubmissions(filters?: { studentId?: string; courseId?: string }) {
  const sb = getSupabase();
  let q = sb.from("submissions").select("*, files:submission_files(*)").order("date", { ascending: false });
  if (filters?.studentId) q = q.eq("student_id", filters.studentId);
  if (filters?.courseId) q = q.eq("course_id", filters.courseId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSubmission(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("submissions").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function gradeSubmission(id: string, patch: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("submissions").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
