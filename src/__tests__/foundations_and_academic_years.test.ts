import { describe, it, expect } from "vitest";
import { defaultAcademicYears, defaultModuleRestrictions, emptyDB } from "../lib/seed";
import type { User, Role } from "../lib/types";

describe("PHASE 2 — Fondations : Années Académiques et Restrictions de Modules", () => {
  it("initialise les années académiques par défaut avec une année active", () => {
    const years = defaultAcademicYears();
    expect(years.length).toBeGreaterThanOrEqual(3);

    const activeYear = years.find((y) => y.statut === "active" && y.isDefault);
    expect(activeYear).toBeDefined();
    expect(activeYear?.label).toBe("2025-2026");

    const closedYear = years.find((y) => y.statut === "cloturee");
    expect(closedYear).toBeDefined();
    expect(closedYear?.label).toBe("2024-2025");
  });

  it("génère une base propre avec academicYears et moduleRestrictions", () => {
    const db = emptyDB([]);
    expect(db.academicYears).toBeDefined();
    expect(db.academicYears?.length).toBeGreaterThanOrEqual(3);
    expect(db.activeAcademicYearId).toBe("ay-2025-2026");

    expect(db.moduleRestrictions).toBeDefined();
    expect(db.moduleRestrictions?.some((r) => r.moduleKey === "ia")).toBe(true);
    expect(db.moduleRestrictions?.some((r) => r.moduleKey === "evaluations")).toBe(true);
  });

  it("permet d'associer un apprenant à une année académique", () => {
    const db = emptyDB([]);
    const student = {
      id: "SN-2025-00001",
      nom: "NGOUABI",
      prenom: "Alain",
      dateNaissance: "2000-01-01",
      sexe: "M" as const,
      telephone: "066000000",
      whatsapp: "066000000",
      email: "alain@test.cg",
      adresse: "Brazzaville",
      niveau: "Bac",
      formation: "informatique" as const,
      modules: ["mod-1"],
      dateInscription: "2025-09-02",
      statutPaiement: "paye" as const,
      statut: "actif" as const,
      academicYearId: "ay-2025-2026",
      anneeScolaire: "2025-2026",
    };
    db.students.push(student);

    const retrieved = db.students.find((s) => s.academicYearId === "ay-2025-2026");
    expect(retrieved).toBeDefined();
    expect(retrieved?.nom).toBe("NGOUABI");
    expect(retrieved?.anneeScolaire).toBe("2025-2026");
  });

  it("valide la règle absolue : le SuperAdmin n'est jamais bloqué par une restriction de module", () => {
    const db = emptyDB([]);
    const restriction = db.moduleRestrictions?.find((r) => r.moduleKey === "ia");
    if (restriction) {
      restriction.bloque = true;
      restriction.roles = ["superadmin", "admin", "student", "teacher"];
    }

    const superAdmin: User = {
      id: "u-superadmin-1",
      username: "superadmin",
      password: "pwd",
      role: "superadmin",
      name: "Direction Générale",
      createdAt: "2025-01-01",
    };

    // Règle de vérification
    const isBlocked = (targetUser: User, modKey: string) => {
      if (targetUser.role === "superadmin") return false;
      const r = db.moduleRestrictions?.find((x) => x.moduleKey === modKey);
      if (!r || !r.bloque) return false;
      if (r.roles?.includes(targetUser.role)) return true;
      if (r.userIds?.includes(targetUser.id)) return true;
      return false;
    };

    expect(isBlocked(superAdmin, "ia")).toBe(false);
  });

  it("bloque l'accès à un module pour un rôle cible et fournit la raison", () => {
    const db = emptyDB([]);
    const evalRestriction = db.moduleRestrictions?.find((r) => r.moduleKey === "evaluations");
    if (evalRestriction) {
      evalRestriction.bloque = true;
      evalRestriction.roles = ["student"];
      evalRestriction.raison = "Session d'examen fermée pour maintenance du barème.";
    }

    const student: User = {
      id: "u-student-1",
      username: "student1",
      password: "pwd",
      role: "student",
      name: "Apprenant Test",
      createdAt: "2025-01-01",
    };

    const teacher: User = {
      id: "u-teacher-1",
      username: "teacher1",
      password: "pwd",
      role: "teacher",
      name: "Enseignant Test",
      createdAt: "2025-01-01",
    };

    const checkAccess = (targetUser: User, modKey: string) => {
      if (targetUser.role === "superadmin") return { blocked: false, reason: "" };
      const r = db.moduleRestrictions?.find((x) => x.moduleKey === modKey);
      if (!r || !r.bloque) return { blocked: false, reason: "" };
      if (r.roles?.includes(targetUser.role)) return { blocked: true, reason: r.raison };
      if (r.userIds?.includes(targetUser.id)) return { blocked: true, reason: r.raison };
      return { blocked: false, reason: "" };
    };

    const studentCheck = checkAccess(student, "evaluations");
    expect(studentCheck.blocked).toBe(true);
    expect(studentCheck.reason).toBe("Session d'examen fermée pour maintenance du barème.");

    const teacherCheck = checkAccess(teacher, "evaluations");
    expect(teacherCheck.blocked).toBe(false);
  });
});
