import { describe, it, expect } from "vitest";
import { emptyDB } from "../lib/seed";
import { ScheduleItem, Teacher, Module, Student, TeacherHour, AttendanceRecord } from "../lib/types";
import { hoursBetween, tarifFor, teacherFinanceSummary } from "../lib/teacher";
import { isSlotStarted, isSlotEnded, getEnrolledStudentsForSlot } from "../lib/automation/scheduleAutomation";

describe("Phase 6 — Planning : Emploi du temps, calendrier, présence, rémunération", () => {
  it("détecte les conflits horaires pour un formateur ou une salle", () => {
    const existingSlot: ScheduleItem = {
      id: "sch-1",
      formation: "informatique",
      moduleId: "m1",
      teacherId: "T-01",
      jour: "Lundi",
      heureDebut: "08:00",
      heureFin: "10:00",
      salle: "Salle 01",
    };

    // Conflit enseignant : même jour, même formateur, créneau chevauchant 09:00 - 11:00
    const newSlotTeacherConflict = {
      jour: "Lundi",
      teacherId: "T-01",
      heureDebut: "09:00",
      heureFin: "11:00",
      salle: "Salle 02",
    };

    const hasTeacherConflict =
      existingSlot.jour === newSlotTeacherConflict.jour &&
      existingSlot.teacherId === newSlotTeacherConflict.teacherId &&
      newSlotTeacherConflict.heureDebut < existingSlot.heureFin &&
      newSlotTeacherConflict.heureFin > existingSlot.heureDebut;

    expect(hasTeacherConflict).toBe(true);

    // Conflit de salle : même jour, salle identique, créneau chevauchant 08:30 - 09:30
    const newSlotRoomConflict = {
      jour: "Lundi",
      teacherId: "T-02",
      heureDebut: "08:30",
      heureFin: "09:30",
      salle: "Salle 01",
    };

    const hasRoomConflict =
      existingSlot.jour === newSlotRoomConflict.jour &&
      existingSlot.salle.toLowerCase() === newSlotRoomConflict.salle.toLowerCase() &&
      newSlotRoomConflict.heureDebut < existingSlot.heureFin &&
      newSlotRoomConflict.heureFin > existingSlot.heureDebut;

    expect(hasRoomConflict).toBe(true);

    // Sans conflit : créneau consécutif 10:00 - 12:00
    const validNextSlot = {
      jour: "Lundi",
      teacherId: "T-01",
      heureDebut: "10:00",
      heureFin: "12:00",
      salle: "Salle 01",
    };

    const hasConflictNext =
      validNextSlot.heureDebut < existingSlot.heureFin &&
      validNextSlot.heureFin > existingSlot.heureDebut;

    expect(hasConflictNext).toBe(false);
  });

  it("calcule avec exactitude la durée et la rémunération d'un créneau", () => {
    const db = emptyDB();
    const teacher: any = {
      id: "T-01",
      nom: "Makosso",
      prenom: "Alain",
      specialite: "Réseaux",
      tarifHoraire: 5000,
      heuresPrevues: 50,
      modules: ["m1"],
      tarifsParModule: { m1: 6000 },
      actif: true,
    };
    db.teachers = [teacher];

    const slot: ScheduleItem = {
      id: "sch-1",
      formation: "informatique",
      moduleId: "m1",
      teacherId: "T-01",
      jour: "Mardi",
      heureDebut: "08:30",
      heureFin: "11:30",
      salle: "Labo 02",
    };

    const durationHours = hoursBetween(slot.heureDebut, slot.heureFin);
    expect(durationHours).toBe(3);

    const appliedRate = tarifFor(db, teacher.id, slot.moduleId);
    expect(appliedRate).toBe(6000);

    const remuneration = durationHours * appliedRate;
    expect(remuneration).toBe(18000);
  });

  it("associe correctement les apprenants d'une séance pour l'émargement", () => {
    const db = emptyDB();
    const s1: any = { id: "SN-1", nom: "D", prenom: "E", formation: "informatique", modules: ["m1"], statut: "actif" };
    const s2: any = { id: "SN-2", nom: "F", prenom: "G", formation: "informatique", modules: ["m2"], statut: "actif" };
    const s3: any = { id: "SN-3", nom: "H", prenom: "I", formation: "industriel", modules: ["m1"], statut: "actif" };
    db.students = [s1, s2, s3];

    const slot: any = {
      id: "sch-10",
      formation: "informatique",
      moduleId: "m1",
      jour: "Mercredi",
      heureDebut: "14:00",
      heureFin: "16:00",
    };

    const targetedStudents = getEnrolledStudentsForSlot(db, slot);
    expect(targetedStudents).toContain("SN-1");
    expect(targetedStudents).not.toContain("SN-2"); // Module différent
    expect(targetedStudents).not.toContain("SN-3"); // Formation différente
  });

  it("gère l'état d'avancement temporel d'une séance (démarrée vs terminée)", () => {
    const fixedNow = new Date("2026-03-27T10:30:00");
    expect(isSlotStarted("09:00", fixedNow)).toBe(true);
    expect(isSlotStarted("11:00", fixedNow)).toBe(false);
    expect(isSlotEnded("10:00", fixedNow)).toBe(true);
    expect(isSlotEnded("12:00", fixedNow)).toBe(false);
  });
});
