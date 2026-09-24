import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  assignmentsFor,
  assessmentsFor,
  submissionsForUser,
  resultsForUser,
  coursesFor,
  teacherCanManageCourse,
  studentCanSeeCourse,
  resolveTeacherForUser,
} from "@/lib/access";
import { DB, User, Student, Teacher, Course } from "@/lib/types";
import { Assignment, AssignmentSubmission } from "@/modules/assignments/types";
import { Assessment, AssessmentResultSummary } from "@/modules/assessments/types";

describe("AUDIT DE SÉCURITÉ & REMÉDIATION RLS (SUPABASE CZX)", () => {
  const dbMock: DB = {
    users: [
      { id: "admin-uid", email: "admin@sentinels.com", name: "Admin", role: "admin", active: true },
      { id: "teacher-1-uid", email: "teacher1@sentinels.com", name: "Prof Alpha", role: "teacher", active: true },
      { id: "teacher-2-uid", email: "teacher2@sentinels.com", name: "Prof Beta", role: "teacher", active: true },
      { id: "student-a-uid", email: "studentA@sentinels.com", name: "Alice", role: "student", active: true },
      { id: "student-b-uid", email: "studentB@sentinels.com", name: "Bob", role: "student", active: true },
    ],
    students: [
      {
        id: "STU-A",
        userId: "student-a-uid",
        nom: "Dupont",
        prenom: "Alice",
        email: "studentA@sentinels.com",
        formation: "informatique",
        modules: ["MOD-CYBER"],
      },
      {
        id: "STU-B",
        userId: "student-b-uid",
        nom: "Martin",
        prenom: "Bob",
        email: "studentB@sentinels.com",
        formation: "industriel",
        modules: ["MOD-ROBOT"],
      },
    ] as any[],
    teachers: [
      {
        id: "TEA-1",
        userId: "teacher-1-uid",
        nom: "Alpha",
        prenom: "Prof",
        email: "teacher1@sentinels.com",
        specialite: "Cybersécurité",
        modules: ["MOD-CYBER"],
      },
      {
        id: "TEA-2",
        userId: "teacher-2-uid",
        nom: "Beta",
        prenom: "Prof",
        email: "teacher2@sentinels.com",
        specialite: "Robotique",
        modules: ["MOD-ROBOT"],
      },
    ] as any[],
    modules: [
      { id: "MOD-CYBER", titre: "Sécurité Réseau", formation: "informatique" },
      { id: "MOD-ROBOT", titre: "Automatisme Industriel", formation: "industriel" },
    ] as any[],
    courses: [
      {
        id: "CRS-1",
        titre: "Sécurité Offensive",
        moduleId: "MOD-CYBER",
        teacherId: "TEA-1",
        publie: true,
        type: "cours",
      },
      {
        id: "CRS-2",
        titre: "Automates Siemens",
        moduleId: "MOD-ROBOT",
        teacherId: "TEA-2",
        publie: true,
        type: "cours",
      },
    ] as any[],
    schedule: [],
    grades: [],
    attendance: [],
    payments: [],
    notifications: [],
    tests: [],
  } as unknown as DB;

  const mockAssignments: Assignment[] = [
    {
      id: "ASG-ALPHA",
      titre: "TP Audit RLS",
      moduleId: "MOD-CYBER",
      teacherId: "TEA-1",
      bareme: 20,
      statut: "publie",
      audience: "module",
    } as any,
    {
      id: "ASG-BETA",
      titre: "TP Automate API",
      moduleId: "MOD-ROBOT",
      teacherId: "TEA-2",
      bareme: 20,
      statut: "publie",
      audience: "module",
    } as any,
  ];

  const mockSubmissions: AssignmentSubmission[] = [
    {
      id: "SUB-A",
      assignmentId: "ASG-ALPHA",
      studentId: "STU-A",
      version: 1,
      statut: "note",
      note: 18,
      appreciation: "Excellent travail d'audit",
    } as any,
    {
      id: "SUB-B",
      assignmentId: "ASG-BETA",
      studentId: "STU-B",
      version: 1,
      statut: "rendu",
    } as any,
  ];

  const mockAssessments: Assessment[] = [
    {
      id: "TEST-ALPHA",
      titre: "Examen Pentest",
      moduleId: "MOD-CYBER",
      teacherId: "TEA-1",
      statut: "publie",
      duree: 60,
      bareme: 20,
      audience: "module",
    } as any,
    {
      id: "TEST-BETA",
      titre: "Examen Grafcet",
      moduleId: "MOD-ROBOT",
      teacherId: "TEA-2",
      statut: "publie",
      duree: 45,
      bareme: 20,
      audience: "module",
    } as any,
  ];

  const mockResults: AssessmentResultSummary[] = [
    {
      id: "RES-A",
      testId: "TEST-ALPHA",
      studentId: "STU-A",
      score: 19,
      total: 20,
      note: 19,
      statut: "corrige",
    } as any,
    {
      id: "RES-B",
      testId: "TEST-BETA",
      studentId: "STU-B",
      score: 14,
      total: 20,
      note: 14,
      statut: "corrige",
    } as any,
  ];

  // 1. Tests Sans Connexion (Anon)
  describe("1. Utilisateur non authentifié (anon)", () => {
    it("refuse tout accès aux devoirs pour un utilisateur non connecté", () => {
      expect(assignmentsFor(dbMock, null, mockAssignments)).toEqual([]);
    });

    it("refuse tout accès aux évaluations pour un utilisateur non connecté", () => {
      expect(assessmentsFor(dbMock, null, mockAssessments)).toEqual([]);
    });

    it("refuse tout accès aux remises et copies pour un utilisateur non connecté", () => {
      expect(submissionsForUser(dbMock, null, mockSubmissions, mockAssignments)).toEqual([]);
    });

    it("refuse tout accès aux résultats d'examens pour un utilisateur non connecté", () => {
      expect(resultsForUser(dbMock, null, mockResults, mockAssessments)).toEqual([]);
    });

    it("refuse tout accès aux cours internes pour un utilisateur non connecté", () => {
      expect(coursesFor(dbMock, null)).toEqual([]);
    });
  });

  // 2. Tests Apprenant A vs Apprenant B
  describe("2. Cloisonnement strict entre Apprenants (Alice vs Bob)", () => {
    const userAlice: User = {
      id: "student-a-uid",
      username: "alice",
      password: "",
      email: "studentA@sentinels.com",
      name: "Alice",
      role: "student",
      createdAt: "2026-01-01",
      actif: true,
    };

    const userBob: User = {
      id: "student-b-uid",
      username: "bob",
      password: "",
      email: "studentB@sentinels.com",
      name: "Bob",
      role: "student",
      createdAt: "2026-01-01",
      actif: true,
    };

    it("Alice ne peut voir que les devoirs de sa formation et ses modules", () => {
      const visible = assignmentsFor(dbMock, userAlice, mockAssignments);
      expect(visible.map((a) => a.id)).toContain("ASG-ALPHA");
      expect(visible.map((a) => a.id)).not.toContain("ASG-BETA");
    });

    it("Alice ne peut accéder QU'À SES PROPRES remises et notes (jamais celles de Bob)", () => {
      const visible = submissionsForUser(dbMock, userAlice, mockSubmissions, mockAssignments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("SUB-A");
      expect(visible[0].studentId).toBe("STU-A");
      expect(visible.some((s) => s.studentId === "STU-B")).toBe(false);
    });

    it("Bob ne peut accéder QU'À SES PROPRES remises et notes (jamais celles d'Alice)", () => {
      const visible = submissionsForUser(dbMock, userBob, mockSubmissions, mockAssignments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("SUB-B");
      expect(visible[0].studentId).toBe("STU-B");
      expect(visible.some((s) => s.studentId === "STU-A")).toBe(false);
    });

    it("Alice ne peut voir que ses propres résultats d'évaluation", () => {
      const visible = resultsForUser(dbMock, userAlice, mockResults, mockAssessments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("RES-A");
      expect(visible[0].studentId).toBe("STU-A");
    });

    it("Bob ne peut voir que ses propres résultats d'évaluation", () => {
      const visible = resultsForUser(dbMock, userBob, mockResults, mockAssessments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("RES-B");
      expect(visible[0].studentId).toBe("STU-B");
    });
  });

  // 3. Tests Formateur (Isolation stricte Formateur 1 vs Formateur 2)
  describe("3. Cloisonnement strict entre Formateurs (Prof Alpha vs Prof Beta)", () => {
    const userTeacherAlpha: User = {
      id: "teacher-1-uid",
      username: "teacher1",
      password: "",
      email: "teacher1@sentinels.com",
      name: "Prof Alpha",
      role: "teacher",
      createdAt: "2026-01-01",
      actif: true,
    };

    const userTeacherBeta: User = {
      id: "teacher-2-uid",
      username: "teacher2",
      password: "",
      email: "teacher2@sentinels.com",
      name: "Prof Beta",
      role: "teacher",
      createdAt: "2026-01-01",
      actif: true,
    };

    it("Prof Alpha ne voit QUE ses propres devoirs créés", () => {
      const visible = assignmentsFor(dbMock, userTeacherAlpha, mockAssignments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("ASG-ALPHA");
      expect(visible.some((a) => a.id === "ASG-BETA")).toBe(false);
    });

    it("Prof Alpha ne voit QUE les remises d'étudiants liées à ses propres devoirs", () => {
      const visible = submissionsForUser(dbMock, userTeacherAlpha, mockSubmissions, mockAssignments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("SUB-A");
      expect(visible.some((s) => s.id === "SUB-B")).toBe(false);
    });

    it("Prof Beta ne voit QUE les remises d'étudiants liées à ses propres devoirs", () => {
      const visible = submissionsForUser(dbMock, userTeacherBeta, mockSubmissions, mockAssignments);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("SUB-B");
      expect(visible.some((s) => s.id === "SUB-A")).toBe(false);
    });

    it("Prof Alpha ne peut pas gérer les cours ou devoirs de Prof Beta", () => {
      const courseBeta = dbMock.courses.find((c) => c.id === "CRS-2")!;
      expect(teacherCanManageCourse(dbMock, "teacher-1-uid", courseBeta)).toBe(false);
    });
  });

  // 4. Tests Administrateur (Supervision globale)
  describe("4. Droits superviseur Administrateur", () => {
    const userAdmin: User = {
      id: "admin-uid",
      username: "admin",
      password: "",
      email: "admin@sentinels.com",
      name: "Admin",
      role: "admin",
      createdAt: "2026-01-01",
      actif: true,
    };

    it("L'administrateur conserve l'accès superviseur à tous les devoirs", () => {
      const visible = assignmentsFor(dbMock, userAdmin, mockAssignments);
      expect(visible.length).toBe(mockAssignments.length);
    });

    it("L'administrateur conserve l'accès superviseur à toutes les évaluations", () => {
      const visible = assessmentsFor(dbMock, userAdmin, mockAssessments);
      expect(visible.length).toBe(mockAssessments.length);
    });

    it("L'administrateur conserve l'accès superviseur à toutes les remises", () => {
      const visible = submissionsForUser(dbMock, userAdmin, mockSubmissions, mockAssignments);
      expect(visible.length).toBe(mockSubmissions.length);
    });

    it("L'administrateur conserve l'accès superviseur à tous les résultats", () => {
      const visible = resultsForUser(dbMock, userAdmin, mockResults, mockAssessments);
      expect(visible.length).toBe(mockResults.length);
    });
  });

  // 5. Validation de la migration 0044
  describe("5. Validation formelle du fichier de migration 0044", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "0044_security_advisor_remediation.sql"
    );

    it("le fichier de migration 0044 existe et n'est pas vide", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql.length).toBeGreaterThan(500);
    });

    it("active explicitement RLS sur learner_modules et trainer_modules", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/alter\s+table\s+if\s+exists\s+public\.learner_modules\s+enable\s+row\s+level\s+security/i);
      expect(sql).toMatch(/alter\s+table\s+if\s+exists\s+public\.trainer_modules\s+enable\s+row\s+level\s+security/i);
    });

    it("révoque les privilèges publics et anonymes sur learner_modules et trainer_modules", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.learner_modules\s+from\s+anon/i);
      expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.trainer_modules\s+from\s+anon/i);
    });

    it("supprime la clause permissive course_files_anon_upload de storage.objects", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"course_files_anon_upload"\s+on\s+storage\.objects/i);
    });

    it("protège le bucket de stockage submission-files en mode privé (public = false)", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/update\s+storage\.buckets\s+set\s+public\s*=\s*false\s+where\s+id\s*=\s*'submission-files'/i);
    });

    it("crée les index de performance requis pour les requêtes RLS", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      expect(sql).toMatch(/idx_assignments_teacher_id/i);
      expect(sql).toMatch(/idx_assignment_submissions_student_id/i);
      expect(sql).toMatch(/idx_test_results_student_id/i);
    });
  });
});
