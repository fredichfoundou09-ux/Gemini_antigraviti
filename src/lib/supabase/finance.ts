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

/* ---------- Échéances de paiement en 2 tranches ---------- */
export async function fetchPaymentSchedules(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("payment_schedules").select("*").order("installment_number", { ascending: true });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function recordStudentPaymentV2(payload: {
  studentId: string;
  amount: number;
  method: string;
  reference?: string;
  invoiceId?: string;
  notes?: string;
}) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("record_student_payment_v3", {
    p_student_id: payload.studentId,
    p_amount: payload.amount,
    p_method: payload.method,
    p_reference: payload.reference || "",
    p_invoice_id: payload.invoiceId || null,
    p_notes: payload.notes || null,
  });
  if (error) {
    // Fallback v2 si v3 non encore appliquée
    const { data: d2, error: e2 } = await sb.rpc("record_student_payment_v2", {
      p_student_id: payload.studentId,
      p_amount: payload.amount,
      p_method: payload.method,
      p_reference: payload.reference || "",
      p_invoice_id: payload.invoiceId || null,
      p_notes: payload.notes || null,
    });
    if (e2) throw e2;
    return d2;
  }
  return data;
}

/* ---------- Reçus officiels normalisés (SN-REC-YYYY-XXXXXX) ---------- */
export async function fetchPaymentReceipts(studentId?: string) {
  const sb = getSupabase();
  let q = sb.from("payment_receipts").select("*").order("created_at", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) {
    console.warn("fetchPaymentReceipts:", error.message);
    return [];
  }
  return data || [];
}

export async function cancelPaymentWithAudit(paymentId: string, reason: string) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("cancel_payment_v2", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/* ---------- Clôtures financières journalières (Section 18) ---------- */
export async function fetchDailyClosures() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("daily_financial_closures")
    .select("*")
    .order("closure_date", { ascending: false });
  if (error) {
    console.warn("fetchDailyClosures:", error.message);
    return [];
  }
  return data || [];
}

export async function executeDailyClosure(date: string, notes?: string) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("execute_daily_closure", {
    p_date: date,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

/* ---------- Avances & Bulletins formateurs (Section 26, 27) ---------- */
export async function fetchTeacherAdvances(teacherId?: string) {
  const sb = getSupabase();
  let q = sb.from("teacher_advances").select("*").order("date", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) {
    console.warn("fetchTeacherAdvances:", error.message);
    return [];
  }
  return data || [];
}

export async function recordTeacherAdvance(payload: {
  teacherId: string;
  amount: number;
  reason: string;
  date?: string;
}) {
  const sb = getSupabase();
  const { data, error } = await sb.from("teacher_advances").insert({
    teacher_id: payload.teacherId,
    amount: payload.amount,
    reason: payload.reason,
    date: payload.date || new Date().toISOString().slice(0, 10),
    status: "APPROUVE",
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function fetchTeacherPayslips(teacherId?: string) {
  const sb = getSupabase();
  let q = sb.from("teacher_payslips").select("*").order("period_month", { ascending: false });
  if (teacherId) q = q.eq("teacher_id", teacherId);
  const { data, error } = await q;
  if (error) {
    console.warn("fetchTeacherPayslips:", error.message);
    return [];
  }
  return data || [];
}

export async function generateTeacherPayslip(
  teacherId: string,
  periodMonth: string,
  ratePerSession: number = 2500
) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("generate_teacher_payslip_v2", {
    p_teacher_id: teacherId,
    p_period_month: periodMonth,
    p_rate_per_session: ratePerSession,
  });
  if (error) throw error;
  return data;
}
