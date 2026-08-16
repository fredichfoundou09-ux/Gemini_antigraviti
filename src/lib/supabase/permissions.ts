import type { AppRole, Profile } from "./auth";
import type { Permission } from "@/types/rbac";

export function isSuperAdmin(p?: Profile | null) {
  return p?.role === "superadmin";
}
export function isAdmin(p?: Profile | null) {
  return p?.role === "admin" || p?.role === "superadmin";
}
export function isPartnerAdmin(p?: Profile | null) {
  return p?.role === "partner_admin";
}
export function isTeacher(p?: Profile | null) {
  return p?.role === "teacher";
}
export function isStudent(p?: Profile | null) {
  return p?.role === "student";
}
export function isPartner(p?: Profile | null) {
  return p?.role === "partner";
}
export function isStaff(p?: Profile | null) {
  return isAdmin(p);
}

export function hasPermission(p: Profile | null | undefined, action: Permission | string): boolean {
  if (!p || !p.active) return false;
  const role = p.role as AppRole;

  const matrix: Record<string, AppRole[]> = {
    "dashboard.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "users.manage": ["superadmin", "admin"],
    "students.manage": ["superadmin", "admin"],
    "students.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "teachers.manage": ["superadmin", "admin"],
    "teachers.read": ["superadmin", "admin", "partner_admin", "partner", "teacher"],
    "modules.manage": ["superadmin", "admin"],
    "modules.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "formations.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "courses.manage": ["superadmin", "admin", "teacher"],
    "courses.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "attendance.manage": ["superadmin", "admin", "teacher"],
    "attendance.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "finance.manage": ["superadmin", "admin"],
    "payments.read": ["superadmin", "admin", "partner_admin"],
    "enia.manage": ["superadmin", "admin"],
    "enia.read": ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"],
    "audit.read": ["superadmin", "admin"],
    "certificates.manage": ["superadmin", "admin"],
    "certificates.read": ["superadmin", "admin", "partner_admin", "partner", "student"],
    "scholarships.manage": ["superadmin", "admin"],
    "scholarships.read": ["superadmin", "admin", "partner_admin", "partner", "student"],
    "reports.read": ["superadmin", "admin", "partner_admin", "partner"],
  };

  return (matrix[action] || []).includes(role);
}
