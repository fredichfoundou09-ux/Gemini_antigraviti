import { describe, it, expect } from "vitest";
import { getTeacherModuleIds, teacherCanManageCourse, coursesFor, scheduleFor } from "@/lib/access";
import { DB, Teacher, Course, ScheduleItem, User } from "@/lib/types";

describe("Extended Access & Permission Boundaries", () => {
  const createTestDb = (overrides?: Partial<DB>): DB =>
    ({
      users: [],
      students: [],
      teachers: [],
      modules: [
        { id: "M1", numero: 1, titre: "Algorithmique", formation: "informatique" },
        { id: "M2", numero: 2, titre: "Réseaux & Sécurité", formation: "informatique" },
        { id: "M3", numero: 3, titre: "Automatisme", formation: "industriel" },
      ],
      courses: [],
      schedule: [],
      grades: [],
      attendance: [],
      payments: [],
      notifications: [],
      tests: [],
      ...overrides,
    } as unknown as DB);

  it("garantit qu'un formateur ne peut pas modifier un cours d'un autre formateur hors de ses modules", () => {
    const teacher: Teacher = {
      id: "T1",
      nom: "Dupont",
      prenom: "Jean",
      specialite: "Info",
      email: "jean@dupont.fr",
      phone: "0102030405",
      modules: ["M1"],
      userId: "U1",
    };

    const courseOutside: Course = {
      id: "C3",
      titre: "Automates programmables",
      moduleId: "M3",
      teacherId: "T2",
      type: "cours",
      publie: true,
      description: "",
      content: "",
      date: "2026-09-09",
    };

    const db = createTestDb({ teachers: [teacher] });
    expect(teacherCanManageCourse(db, "U1", courseOutside)).toBe(false);
  });

  it("autorise un formateur à gérer un cours s'il est désigné comme son enseignant direct même sans assignation de module", () => {
    const teacher: Teacher = {
      id: "T1",
      nom: "Dupont",
      prenom: "Jean",
      specialite: "Info",
      email: "jean@dupont.fr",
      phone: "0102030405",
      modules: [],
      userId: "U1",
    };

    const directCourse: Course = {
      id: "C1",
      titre: "Cours assigné direct",
      moduleId: "M1",
      teacherId: "T1",
      type: "cours",
      publie: true,
      description: "",
      content: "",
      date: "2026-09-09",
    };

    const db = createTestDb({ teachers: [teacher], courses: [directCourse] });
    expect(teacherCanManageCourse(db, "U1", directCourse)).toBe(true);
  });

  it("isole rigoureusement l'emploi du temps pour l'espace formateur", () => {
    const teacher: Teacher = {
      id: "T1",
      nom: "Dupont",
      prenom: "Jean",
      specialite: "Info",
      email: "jean@dupont.fr",
      phone: "0102030405",
      modules: ["M1"],
      userId: "U1",
    };

    const s1: ScheduleItem = {
      id: "S1",
      jour: "Lundi",
      heureDebut: "08:00",
      heureFin: "10:00",
      moduleId: "M1",
      teacherId: "T1",
      formation: "informatique",
      salle: "Salle A",
    };

    const s2: ScheduleItem = {
      id: "S2",
      jour: "Mardi",
      heureDebut: "10:00",
      heureFin: "12:00",
      moduleId: "M3",
      teacherId: "T2",
      formation: "industriel",
      salle: "Labo B",
    };

    const db = createTestDb({ teachers: [teacher], schedule: [s1, s2] });
    const user = { id: "U1", role: "teacher", email: "jean@dupont.fr" } as User;

    const visibleSchedule = scheduleFor(db, user);
    expect(visibleSchedule.map((s) => s.id)).toEqual(["S1"]);
    expect(visibleSchedule.some((s) => s.id === "S2")).toBe(false);
  });

  it("gère gracieusement le cas d'un enseignant sans aucun cours ni planning", () => {
    const isolatedTeacher: Teacher = {
      id: "T-EMPTY",
      nom: "Nouveau",
      prenom: "Formateur",
      specialite: "Inconnu",
      email: "new@teacher.cg",
      phone: "0000000000",
      modules: [],
      userId: "U-EMPTY",
    };

    const db = createTestDb({ teachers: [isolatedTeacher] });
    const user = { id: "U-EMPTY", role: "teacher", email: "new@teacher.cg" } as User;

    expect(getTeacherModuleIds(isolatedTeacher, db)).toEqual([]);
    expect(coursesFor(db, user)).toEqual([]);
    expect(scheduleFor(db, user)).toEqual([]);
  });
});
