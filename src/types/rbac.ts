import type { Role } from "@/lib/types";

export const ROLES = ["superadmin", "admin", "partner_admin", "teacher", "student", "partner"] as const;

export type AccessScope = "viewer" | "academic" | "finance" | "institutional";

export type PrivacyLevel = "public" | "internal" | "partner" | "private" | "restricted";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "SUPER ADMIN",
  admin: "ADMINISTRATION",
  partner_admin: "ADMIN PARTENAIRE",
  teacher: "FORMATEUR",
  student: "APPRENANT",
  partner: "PARTENAIRE",
};

export const PARTNER_SCOPES: Record<AccessScope, string> = {
  viewer: "Partner Viewer",
  academic: "Partner Academic",
  finance: "Partner Finance",
  institutional: "Partner Institutional",
};

export const PERMISSIONS = [
  "dashboard.read",
  "students.read",
  "students.create",
  "students.update",
  "students.delete",
  "teachers.read",
  "teachers.create",
  "teachers.update",
  "teachers.delete",
  "formations.read",
  "formations.create",
  "formations.update",
  "formations.delete",
  "modules.read",
  "modules.create",
  "modules.update",
  "modules.delete",
  "schedule.read",
  "schedule.create",
  "schedule.update",
  "schedule.delete",
  "attendance.read",
  "attendance.create",
  "attendance.update",
  "courses.read",
  "courses.create",
  "courses.update",
  "courses.delete",
  "materials.read",
  "tests.read",
  "tests.create",
  "grades.read",
  "grades.create",
  "certificates.read",
  "certificates.create",
  "scholarships.read",
  "scholarships.update",
  "reports.read",
  "payments.read",
  "payments.create",
  "users.manage",
  "settings.manage",
  "audit.read",
  "enya.read",
  "enya.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
