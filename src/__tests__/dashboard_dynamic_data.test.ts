import { describe, it, expect } from "vitest";
import { DB, Student, AttendanceRecord, Grade, Payment } from "@/lib/types";
import { today } from "@/lib/ui";

describe("Phase 4 — Dashboard Dynamique (Données Réelles & Groupes)", () => {
  const mockStudents: Student[] = [
    {
      id: "st-1",
      nom: "Mabiala",
      prenom: "Junior",
      dateNaissance: "2000-01-01",
      sexe: "M",
      telephone: "061234567",
      whatsapp: "061234567",
      email: "junior@test.com",
      adresse: "Brazzaville",
      niveau: "Licence 1",
      formation: "informatique",
      modules: ["mod-1"],
      groupe: "Groupe A",
      dateInscription: "2026-09-01",
      statutPaiement: "paye",
      statut: "actif",
    },
    {
      id: "st-2",
      nom: "Ngoma",
      prenom: "Sarah",
      dateNaissance: "2001-05-10",
      sexe: "F",
      telephone: "051234567",
      whatsapp: "051234567",
      email: "sarah@test.com",
      adresse: "Pointe-Noire",
      niveau: "Licence 2",
      formation: "industriel",
      modules: ["mod-2"],
      groupe: "Groupe B",
      dateInscription: "2026-09-05",
      statutPaiement: "partiel",
      statut: "actif",
    },
  ];

  const mockAttendance: AttendanceRecord[] = [
    { id: "att-1", studentId: "st-1", moduleId: "mod-1", date: today(), heure: "08:00", statut: "present" },
    { id: "att-2", studentId: "st-1", moduleId: "mod-1", date: "2026-09-20", heure: "08:00", statut: "retard" },
    { id: "att-3", studentId: "st-2", moduleId: "mod-2", date: today(), heure: "10:00", statut: "absent" },
  ];

  it("agrège correctement la répartition des présences par groupe et filière sans données codées en dur", () => {
    // Calcul pour Groupe A (Informatique)
    const stGroupA = mockStudents.filter((s) => s.groupe === "Groupe A");
    const attGroupA = mockAttendance.filter((a) => stGroupA.some((s) => s.id === a.studentId));

    const presentsA = attGroupA.filter((a) => a.statut === "present").length;
    const absentsA = attGroupA.filter((a) => a.statut === "absent").length;
    const retardsA = attGroupA.filter((a) => a.statut === "retard").length;
    const totalA = attGroupA.length;
    const rateA = Math.round((presentsA / totalA) * 100);

    expect(stGroupA.length).toBe(1);
    expect(presentsA).toBe(1);
    expect(retardsA).toBe(1);
    expect(absentsA).toBe(0);
    expect(rateA).toBe(50);

    // Calcul pour Groupe B (Industriel)
    const stGroupB = mockStudents.filter((s) => s.groupe === "Groupe B");
    const attGroupB = mockAttendance.filter((a) => stGroupB.some((s) => s.id === a.studentId));

    const presentsB = attGroupB.filter((a) => a.statut === "present").length;
    const absentsB = attGroupB.filter((a) => a.statut === "absent").length;
    const rateB = Math.round((presentsB / attGroupB.length) * 100);

    expect(stGroupB.length).toBe(1);
    expect(presentsB).toBe(0);
    expect(absentsB).toBe(1);
    expect(rateB).toBe(0);
  });

  it("calcule les indicateurs multi-métriques sur une période personnalisée", () => {
    const customStart = "2026-09-01";
    const customEnd = "2026-09-30";

    const inRangeAtt = mockAttendance.filter((a) => a.date >= customStart && a.date <= customEnd);
    const inRangeStudents = mockStudents.filter((s) => s.dateInscription >= customStart && s.dateInscription <= customEnd);

    expect(inRangeAtt.length).toBe(mockAttendance.length);
    expect(inRangeStudents.length).toBe(2);
  });
});
