import { getSupabase } from "./client";

/* ---------- Factures ---------- */
export async function fetchInvoices(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("invoices").select("*").order("date", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createInvoice(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("invoices").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* ---------- Paiements ---------- */
export async function fetchPayments(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("payments").select("*").order("date", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function recordPayment(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("payments").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* ---------- Résumé financier serveur ---------- */
export async function studentFinancialSummary(studentId: string) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("student_financial_summary", { p_student_id: studentId });
  if (error) throw error;
  return data;
}

/* ---------- Heures & paie enseignant ---------- */
export async function fetchTeacherHours(teacherId?: string) {
  const sb = getSupabase();
  let q = sb.from("teacher_hours").select("*").order("date", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function validateTeacherHour(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("teacher_hours").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function recordTeacherPayment(payload: Record<string, unknown>) {
  const sb = getSupabase();
  const { data, error } = await sb.from("teacher_payments").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}
