import { getSupabase } from "./client";

export async function fetchScholarships(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("scholarships").select("*").order("date", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertScholarship(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("scholarships").upsert(payload, { onConflict: "student_id" }).select("*").single();
  if (error) throw error;
  return data;
}
