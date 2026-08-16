import { getSupabase } from "./client";

export async function getPartnerDashboard() {
  const sb = getSupabase();
  const [students, teachers, formations, modules, courses, certificates, scholarships, reports] = await Promise.all([
    sb.from("partner_student_view").select("id", { count: "exact", head: true }),
    sb.from("partner_teacher_view").select("id", { count: "exact", head: true }),
    sb.from("formations").select("id", { count: "exact", head: true }),
    sb.from("modules").select("id", { count: "exact", head: true }),
    sb.from("courses").select("id", { count: "exact", head: true }).eq("publie", true),
    sb.from("partner_certificate_view").select("id", { count: "exact", head: true }),
    sb.from("scholarships").select("id", { count: "exact", head: true }),
    sb.from("partner_report_view").select("id", { count: "exact", head: true }),
  ]);

  return {
    students: students.count ?? 0,
    teachers: teachers.count ?? 0,
    formations: formations.count ?? 0,
    modules: modules.count ?? 0,
    courses: courses.count ?? 0,
    certificates: certificates.count ?? 0,
    scholarships: scholarships.count ?? 0,
    reports: reports.count ?? 0,
  };
}

export async function getPartnerStudents() {
  const sb = getSupabase();
  const { data, error } = await sb.from("partner_student_view").select("*").order("nom");
  if (error) throw error;
  return data || [];
}

export async function getPartnerTeachers() {
  const sb = getSupabase();
  const { data, error } = await sb.from("partner_teacher_view").select("*").order("nom");
  if (error) throw error;
  return data || [];
}

export async function getPartnerAttendance() {
  const sb = getSupabase();
  const { data, error } = await sb.from("partner_attendance_view").select("*").order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPartnerCertificates() {
  const sb = getSupabase();
  const { data, error } = await sb.from("partner_certificate_view").select("*").order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPartnerReports() {
  const sb = getSupabase();
  const { data, error } = await sb.from("partner_report_view").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMyPartnerMembership(userId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("partner_members")
    .select("*, organization:partner_organizations(*)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
