import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsApp } from "../components/ContactButtons";
import {
  teachersOfModule,
  teachersOfStudent,
  getTeachersOfStudent,
  studentsOfTeacher,
  getStudentsOfTeacher,
  getTeacherModuleIds,
} from "../lib/access";
import { DB, Teacher, Student } from "../lib/types";

describe("Normalisation WhatsApp - normalizePhoneForWhatsApp", () => {
  it("retourne null pour des numéros vides ou non fournis", () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp("   ")).toBeNull();
  });

  it("retourne null pour les numéros trop courts", () => {
    expect(normalizePhoneForWhatsApp("12345")).toBeNull();
    expect(normalizePhoneForWhatsApp("abc")).toBeNull();
  });

  it("formate correctement un numéro local Congo commençant par 0 (9 chiffres)", () => {
    expect(normalizePhoneForWhatsApp("06 999 12 34")).toBe("24269991234");
    expect(normalizePhoneForWhatsApp("05-555-55-55")).toBe("24255555555");
  });

  it("formate correctement un numéro local Congo de 8 chiffres sans le zéro initial", () => {
    expect(normalizePhoneForWhatsApp("69991234")).toBe("24269991234");
    expect(normalizePhoneForWhatsApp("55555555")).toBe("24255555555");
  });

  it("préserve un numéro Congo débutant déjà par l'indicatif 242 ou +242", () => {
    expect(normalizePhoneForWhatsApp("+242 06 999 12 34")).toBe("242069991234");
    expect(normalizePhoneForWhatsApp("00242 06 999 12 34")).toBe("242069991234");
  });

  it("préserve les numéros internationaux d'autres pays (France, RDC, etc.)", () => {
    expect(normalizePhoneForWhatsApp("+33 6 12 34 56 78")).toBe("33612345678");
    expect(normalizePhoneForWhatsApp("+243 81 234 5678")).toBe("243812345678");
  });
});

describe("Liaison pédagogique Formateurs ↔ Apprenants", () => {
  const mockTeacher1: Teacher = {
    id: "ENS-001",
    userId: "user-t1",
    nom: "MOUKOKO",
    prenom: "Jean",
    email: "jean@sentinelles.cg",
    phone: "069991122",
    specialite: "Python & Data",
    statut: "actif",
    modules: ["MOD-PY"],
    volumeHoraire: 40,
    actif: true,
  };

  const mockTeacher2: Teacher = {
    id: "ENS-002",
    userId: "user-t2",
    nom: "NZAMBA",
    prenom: "Claire",
    email: "claire@sentinelles.cg",
    phone: "055553344",
    specialite: "Réseaux & Sécurité",
    statut: "actif",
    modules: ["MOD-NET"],
    volumeHoraire: 30,
    actif: true,
  };

  const mockStudent1: Student = {
    id: "SN-2026-00001",
    userId: "user-s1",
    nom: "OKEMBA",
    prenom: "Arnaud",
    email: "arnaud@test.cg",
    telephone: "068882233",
    formation: "informatique",
    statut: "inscrit",
    modules: ["MOD-PY", "MOD-NET"],
    dateInscription: "2026-01-01",
    paiements: [],
  };

  const mockStudent2: Student = {
    id: "SN-2026-00002",
    userId: "user-s2",
    nom: "LOUBAMBA",
    prenom: "Grace",
    email: "grace@test.cg",
    telephone: "057778899",
    formation: "gestion",
    statut: "inscrit",
    modules: ["MOD-GESTION"],
    dateInscription: "2026-01-02",
    paiements: [],
  };

  const mockDB: DB = {
    teachers: [mockTeacher1, mockTeacher2],
    students: [mockStudent1, mockStudent2],
    modules: [
      { id: "MOD-PY", formation: "informatique", numero: 1, titre: "Python", volumeHoraire: 40, coefficient: 2, notions: [] },
      { id: "MOD-NET", formation: "informatique", numero: 2, titre: "Réseaux", volumeHoraire: 30, coefficient: 2, notions: [] },
      { id: "MOD-GESTION", formation: "gestion", numero: 1, titre: "Comptabilité", volumeHoraire: 20, coefficient: 1, notions: [] },
    ],
    courses: [
      { id: "c1", moduleId: "MOD-PY", teacherId: "ENS-001", titre: "Intro Python", type: "cours", publie: true, date: "2026-01-10", audience: "tous" },
    ],
    schedule: [
      { id: "s1", moduleId: "MOD-PY", teacherId: "ENS-001", jour: "Lundi", heureDebut: "08:00", heureFin: "10:00", salle: "Lab 1", audience: "tous" },
      { id: "s2", moduleId: "MOD-NET", teacherId: "ENS-002", jour: "Mardi", heureDebut: "10:00", heureFin: "12:00", salle: "Lab 2", audience: "tous" },
    ],
    users: [],
    grades: [],
    attendance: [],
    submissions: [],
    tests: [],
    invoices: [],
    scholarships: [],
    certificates: [],
    messages: [],
    notifications: [],
    siteContent: {} as any,
    auditLogs: [],
  };

  it("teachersOfModule résout les enseignants d'un module donné", () => {
    const teachers = teachersOfModule(mockDB, "MOD-PY");
    expect(teachers.length).toBe(1);
    expect(teachers[0].id).toBe("ENS-001");

    const teachersNet = teachersOfModule(mockDB, "MOD-NET");
    expect(teachersNet.length).toBe(1);
    expect(teachersNet[0].id).toBe("ENS-002");

    const teachersInconnu = teachersOfModule(mockDB, "MOD-INEXISTANT");
    expect(teachersInconnu).toEqual([]);
  });

  it("teachersOfStudent et getTeachersOfStudent retournent tous les enseignants de l'apprenant", () => {
    const teachersContext = teachersOfStudent(mockDB, "SN-2026-00001");
    expect(teachersContext.length).toBe(2);

    const pureTeachers = getTeachersOfStudent(mockDB, "SN-2026-00001");
    expect(pureTeachers.map((t) => t.id).sort()).toEqual(["ENS-001", "ENS-002"]);

    // Apprenant sans aucun formateur assigné à ses modules
    const noTeachers = getTeachersOfStudent(mockDB, "SN-2026-00002");
    expect(noTeachers).toEqual([]);

    // Apprenant inexistant -> pas de crash
    expect(getTeachersOfStudent(mockDB, "NON-EXISTENT")).toEqual([]);
  });

  it("studentsOfTeacher et getStudentsOfTeacher retournent tous les apprenants d'un formateur", () => {
    const studentsT1 = getStudentsOfTeacher(mockDB, "ENS-001");
    expect(studentsT1.length).toBe(1);
    expect(studentsT1[0].id).toBe("SN-2026-00001");

    const studentsT2 = getStudentsOfTeacher(mockDB, "ENS-002");
    expect(studentsT2.length).toBe(1);
    expect(studentsT2[0].id).toBe("SN-2026-00001");

    // Formateur sans apprenants
    const fakeTeacher: Teacher = {
      id: "ENS-099",
      nom: "SOLO",
      prenom: "Test",
      statut: "actif",
      modules: ["MOD-INUTILISE"],
      volumeHoraire: 0,
      actif: true,
    };
    const customDB = { ...mockDB, teachers: [...mockDB.teachers, fakeTeacher] };
    const noStudents = getStudentsOfTeacher(customDB, "ENS-099");
    expect(noStudents).toEqual([]);

    // Formateur inexistant -> pas de crash
    expect(getStudentsOfTeacher(mockDB, "NON-EXISTENT")).toEqual([]);
  });
});
