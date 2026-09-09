import { describe, it, expect } from "vitest";
import { getTeacherModuleIds, teacherCanManageCourse, coursesFor, scheduleFor } from "@/lib/access";
import { DB, Teacher, Student, Module, Course, ScheduleItem } from "@/lib/types";

describe("Teacher Modules Resolution and Access Control", () => {
  const mockModules: Module[] = [
    {
      id: "MOD-01",
      numero: 1,
      titre: "Introduction à la Cybersécurité",
      formation: "informatique",
      icon: "shield",
      notions: ["Réseaux", "Menaces"],
    },
    {
      id: "MOD-02",
      numero: 2,
      titre: "Développement Web React",
      formation: "informatique",
      icon: "code",
      notions: ["React", "TypeScript"],
    },
    {
      id: "MOD-03",
      numero: 3,
      titre: "Gestion de Projet Agile",
      formation: "informatique",
      icon: "briefcase",
      notions: ["Scrum", "Kanban"],
    },
  ];

  const mockTeacher: Teacher = {
    id: "TCH-001",
    nom: "Kouassi",
    prenom: "Jean",
    specialite: "Cybersécurité",
    email: "jean.kouassi@sentinelles.ci",
    phone: "0102030405",
    modules: ["MOD-01"],
    userId: "USR-TCH-001",
  };

  const createMockDb = (overrides?: Partial<DB>): DB => ({
    users: [],
    students: [],
    teachers: [mockTeacher],
    modules: mockModules,
    schedule: [],
    courses: [],
    grades: [],
    attendance: [],
    payments: [],
    notifications: [],
    documents: [],
    logs: [],
    tests: [],
    testAttempts: [],
    certificates: [],
    submissions: [],
    studentArchives: [],
    messages: [],
    teacherHours: [],
    teacherPayments: [],
    ...overrides,
  } as unknown as DB);

  describe("getTeacherModuleIds", () => {
    it("doit retourner un tableau vide si l'enseignant est null ou indéfini", () => {
      const db = createMockDb();
      expect(getTeacherModuleIds(null, db)).toEqual([]);
      expect(getTeacherModuleIds(undefined, db)).toEqual([]);
    });

    it("doit renvoyer les modules explicitement attribués dans teacher.modules", () => {
      const db = createMockDb();
      const res = getTeacherModuleIds(mockTeacher, db);
      expect(res).toEqual(["MOD-01"]);
    });

    it("doit consolider les modules issus des cours assignés par teacherId", () => {
      const db = createMockDb({
        courses: [
          {
            id: "CRS-01",
            titre: "Atelier React Avancé",
            moduleId: "MOD-02",
            teacherId: "TCH-001",
            type: "cours",
            publie: true,
          } as Course,
        ],
      });
      const res = getTeacherModuleIds(mockTeacher, db);
      expect(res).toContain("MOD-01");
      expect(res).toContain("MOD-02");
      expect(res).toHaveLength(2);
    });

    it("doit consolider les modules issus des créneaux de planning (schedule)", () => {
      const db = createMockDb({
        schedule: [
          {
            id: "SCH-01",
            jour: "Lundi",
            heureDebut: "08:00",
            heureFin: "10:00",
            moduleId: "MOD-03",
            teacherId: "TCH-001",
            formation: "informatique",
            salle: "Salle 02",
          } as ScheduleItem,
        ],
      });
      const res = getTeacherModuleIds(mockTeacher, db);
      expect(res).toContain("MOD-01");
      expect(res).toContain("MOD-03");
      expect(res).toHaveLength(2);
    });

    it("doit dédupliquer les identifiants de modules récurrents", () => {
      const db = createMockDb({
        courses: [
          {
            id: "CRS-01",
            titre: "Sécurité Réseau",
            moduleId: "MOD-01",
            teacherId: "TCH-001",
            type: "cours",
            publie: true,
            description: "",
            content: "",
            date: "2026-09-09",
          } as Course,
        ],
        schedule: [
          {
            id: "SCH-01",
            jour: "Lundi",
            heureDebut: "08:00",
            heureFin: "10:00",
            moduleId: "MOD-01",
            teacherId: "TCH-001",
            formation: "informatique",
            salle: "Salle 01",
          } as ScheduleItem,
        ],
      });
      const res = getTeacherModuleIds(mockTeacher, db);
      expect(res).toEqual(["MOD-01"]);
    });

    it("ne doit PAS déclencher l'heuristique par défaut si aucun module n'est assigné", () => {
      const unassignedTeacher: Teacher = {
        ...mockTeacher,
        id: "TCH-EMPTY",
        modules: [],
        specialite: "Cybersécurité",
      };
      const db = createMockDb();
      const res = getTeacherModuleIds(unassignedTeacher, db);
      expect(res).toEqual([]);
    });

    it("doit utiliser l'heuristique basée sur la spécialité UNIQUEMENT si options.heuristic est activé", () => {
      const unassignedTeacher: Teacher = {
        ...mockTeacher,
        id: "TCH-HEURISTIC",
        modules: [],
        specialite: "Cybersécurité",
      };
      const db = createMockDb();
      const res = getTeacherModuleIds(unassignedTeacher, db, { heuristic: true });
      expect(res).toContain("MOD-01");
    });
  });

  describe("teacherCanManageCourse & coursesFor", () => {
    it("autorise un enseignant à gérer un cours s'il lui est assigné ou fait partie de ses modules consolidés", () => {
      const db = createMockDb();
      const courseInModule: Course = {
        id: "CRS-01",
        titre: "Intro Cyber",
        moduleId: "MOD-01",
        teacherId: "OTHER-TCH",
        type: "cours",
        publie: true,
        description: "",
        content: "",
        date: "2026-09-09",
      };
      const courseNotInModule: Course = {
        id: "CRS-02",
        titre: "Intro Agile",
        moduleId: "MOD-03",
        teacherId: "OTHER-TCH",
        type: "cours",
        publie: true,
        description: "",
        content: "",
        date: "2026-09-09",
      };

      expect(teacherCanManageCourse(db, "USR-TCH-001", courseInModule)).toBe(true);
      expect(teacherCanManageCourse(db, "USR-TCH-001", courseNotInModule)).toBe(false);
    });

    it("coursesFor retourne uniquement les cours de ses modules ou assignés", () => {
      const c1: Course = { id: "C1", titre: "C1", moduleId: "MOD-01", teacherId: "T1", type: "cours", publie: true, description: "", content: "", date: "2026-09-09" };
      const c2: Course = { id: "C2", titre: "C2", moduleId: "MOD-02", teacherId: "T2", type: "cours", publie: true, description: "", content: "", date: "2026-09-09" };
      const db = createMockDb({ courses: [c1, c2] });

      const user = { id: "USR-TCH-001", role: "teacher", email: "jean.kouassi@sentinelles.ci" } as any;
      const res = coursesFor(db, user);
      expect(res.map((c) => c.id)).toEqual(["C1"]);
    });
  });

  describe("TeacherStudents list and modal stats consistency", () => {
    const student1 = {
      id: "STU-001",
      nom: "Diallo",
      prenom: "Amadou",
      formation: "informatique",
      telephone: "0708091011",
      email: "amadou@example.com",
      statut: "actif",
      modules: ["MOD-01", "MOD-02"],
    } as unknown as Student;

    const student2 = {
      id: "STU-002",
      nom: "Kone",
      prenom: "Fatou",
      formation: "gestion_projets",
      telephone: "0708091012",
      email: "fatou@example.com",
      statut: "actif",
      modules: ["MOD-03"],
    } as unknown as Student;

    const studentWithoutModules = {
      id: "STU-003",
      nom: "Bamba",
      prenom: "Paul",
      formation: "informatique",
      telephone: "0708091013",
      statut: "actif",
      modules: undefined as any,
    } as unknown as Student;

    it("doit filtrer strictement les apprenants selon les modules consolidés de l'enseignant", () => {
      const db = createMockDb({
        students: [student1, student2, studentWithoutModules],
      });

      const teacherModuleIds = getTeacherModuleIds(mockTeacher, db);
      const myStudents = db.students.filter((s) =>
        (s.modules || []).some((mid) => teacherModuleIds.includes(mid))
      );

      expect(myStudents.map((s) => s.id)).toEqual(["STU-001"]);
    });

    it("ne plante pas et retourne 0 apprenant si l'enseignant n'a aucun module assigné", () => {
      const unassignedTeacher: Teacher = {
        ...mockTeacher,
        id: "TCH-NONE",
        modules: [],
        specialite: "Inconnu",
      };
      const db = createMockDb({
        students: [student1, student2],
      });

      const teacherModuleIds = getTeacherModuleIds(unassignedTeacher, db);
      expect(teacherModuleIds).toHaveLength(0);

      const myStudents = teacherModuleIds.length === 0
        ? []
        : db.students.filter((s) => (s.modules || []).some((mid) => teacherModuleIds.includes(mid)));

      expect(myStudents).toEqual([]);
    });

    it("calcule la présence et les notes de la fiche modal UNIQUEMENT sur les modules de l'enseignant", () => {
      const teacherModuleIds = ["MOD-01"];
      const attendance = [
        { id: "ATT-1", studentId: "STU-001", moduleId: "MOD-01", statut: "present", date: "2026-09-01" },
        { id: "ATT-2", studentId: "STU-001", moduleId: "MOD-01", statut: "absent", date: "2026-09-02" },
        // Présence dans un AUTRE module (ne doit pas être prise en compte pour ce formateur)
        { id: "ATT-3", studentId: "STU-001", moduleId: "MOD-02", statut: "present", date: "2026-09-03" },
      ] as any[];

      const grades = [
        { id: "GRD-1", studentId: "STU-001", moduleId: "MOD-01", note: 16, date: "2026-09-01" },
        // Note d'un autre module
        { id: "GRD-2", studentId: "STU-001", moduleId: "MOD-02", note: 8, date: "2026-09-02" },
      ] as any[];

      // Calcul tel qu'exécuté dans TeacherStudents avec teacherModuleIds
      const myAtts = attendance.filter((a) => a.studentId === "STU-001" && teacherModuleIds.includes(a.moduleId));
      const presents = myAtts.filter((a) => a.statut === "present").length;
      const absents = myAtts.filter((a) => a.statut === "absent").length;

      const myGrades = grades.filter((g) => g.studentId === "STU-001" && teacherModuleIds.includes(g.moduleId));
      const avgNote = (myGrades.reduce((a, b) => a + b.note, 0) / myGrades.length).toFixed(1);

      expect(myAtts).toHaveLength(2);
      expect(presents).toBe(1);
      expect(absents).toBe(1);
      expect(myGrades).toHaveLength(1);
      expect(avgNote).toBe("16.0");
    });
  });
});
