import { describe, it, expect } from "vitest";

interface Slot {
  jour: string;
  heureDebut: string;
  heureFin: string;
  teacherId: string;
  salle?: string;
  date?: string;
}

function checkTeacherConflict(existing: Slot[], newSlot: Slot): boolean {
  if (newSlot.heureDebut >= newSlot.heureFin) return true; // horaire invalide
  return existing.some((s) => {
    if (s.jour !== newSlot.jour) return false;
    if (s.teacherId !== newSlot.teacherId) return false;
    if (s.date && newSlot.date && s.date !== newSlot.date) return false;
    // Chevauchement horaire : début1 < fin2 ET fin1 > début2
    return newSlot.heureDebut < s.heureFin && newSlot.heureFin > s.heureDebut;
  });
}

function checkRoomConflict(existing: Slot[], newSlot: Slot): boolean {
  if (!newSlot.salle || !newSlot.salle.trim()) return false;
  return existing.some((s) => {
    if (s.jour !== newSlot.jour) return false;
    if (!s.salle || s.salle.trim().toLowerCase() !== newSlot.salle.trim().toLowerCase()) return false;
    if (s.date && newSlot.date && s.date !== newSlot.date) return false;
    return newSlot.heureDebut < s.heureFin && newSlot.heureFin > s.heureDebut;
  });
}

describe("Schedule Conflict Detection (Audit 4.1)", () => {
  const existingSlots: Slot[] = [
    {
      jour: "Lundi",
      heureDebut: "08:00",
      heureFin: "10:00",
      teacherId: "ENS-001",
      salle: "Salle 01",
    },
    {
      jour: "Lundi",
      heureDebut: "10:00",
      heureFin: "12:00",
      teacherId: "ENS-002",
      salle: "Labo Cyber",
    },
  ];

  it("doit refuser un créneau où heureDebut >= heureFin", () => {
    const invalid: Slot = {
      jour: "Lundi",
      heureDebut: "11:00",
      heureFin: "09:00",
      teacherId: "ENS-001",
    };
    expect(checkTeacherConflict(existingSlots, invalid)).toBe(true);
  });

  it("doit détecter un conflit si le même enseignant a un cours chevauchant", () => {
    const conflict: Slot = {
      jour: "Lundi",
      heureDebut: "09:00",
      heureFin: "11:00",
      teacherId: "ENS-001",
      salle: "Salle 03",
    };
    expect(checkTeacherConflict(existingSlots, conflict)).toBe(true);
  });

  it("doit autoriser des cours consécutifs pour le même enseignant sans chevauchement", () => {
    const consecutive: Slot = {
      jour: "Lundi",
      heureDebut: "10:00",
      heureFin: "12:00",
      teacherId: "ENS-001",
      salle: "Salle 02",
    };
    expect(checkTeacherConflict(existingSlots, consecutive)).toBe(false);
  });

  it("doit détecter un conflit si la même salle est réservée en même temps", () => {
    const roomConflict: Slot = {
      jour: "Lundi",
      heureDebut: "08:30",
      heureFin: "09:30",
      teacherId: "ENS-003",
      salle: "Salle 01",
    };
    expect(checkRoomConflict(existingSlots, roomConflict)).toBe(true);
  });

  it("doit autoriser une salle différente sur la même plage horaire", () => {
    const allowed: Slot = {
      jour: "Lundi",
      heureDebut: "08:00",
      heureFin: "10:00",
      teacherId: "ENS-003",
      salle: "Salle 04",
    };
    expect(checkRoomConflict(existingSlots, allowed)).toBe(false);
  });
});
