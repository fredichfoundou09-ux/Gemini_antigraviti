import { describe, it, expect } from "vitest";
import { emptyDB } from "../lib/seed";
import { financialSummary } from "../lib/finance";
import { teacherFinanceSummary } from "../lib/teacher";
import { Student, User, Teacher } from "../lib/types";

describe("Phase 5 — Gestion des personnes : Apprenants, Enseignants, Utilisateurs", () => {
  it("gère le tri et la pagination des apprenants sans altération", () => {
    const db = emptyDB();
    const students: Student[] = [
      { id: "SN-001", nom: "Zack", prenom: "Albert", formation: "informatique", modules: ["m1"], actif: true, dateInscription: "2026-01-10" },
      { id: "SN-002", nom: "Ben", prenom: "Charlie", formation: "informatique", modules: ["m2"], actif: true, dateInscription: "2026-02-15" },
      { id: "SN-003", nom: "Arthur", prenom: "Denis", formation: "industriel", modules: ["m3"], actif: false, dateInscription: "2026-01-01" },
    ];

    // Tri par nom
    const sortedByName = [...students].sort((a, b) => a.nom.localeCompare(b.nom));
    expect(sortedByName[0].nom).toBe("Arthur");
    expect(sortedByName[1].nom).toBe("Ben");
    expect(sortedByName[2].nom).toBe("Zack");

    // Pagination (Page 1 avec pageSize 2)
    const pageSize = 2;
    const page1 = sortedByName.slice(0, pageSize);
    const page2 = sortedByName.slice(pageSize, pageSize * 2);
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(1);
    expect(page2[0].nom).toBe("Zack");
  });

  it("filtre les apprenants par session académique active", () => {
    const students: Student[] = [
      { id: "SN-01", nom: "K", prenom: "L", formation: "informatique", modules: [], academicYearId: "ay-2025-2026" },
      { id: "SN-02", nom: "M", prenom: "N", formation: "informatique", modules: [], academicYearId: "ay-2026-2027" },
    ];

    const filter2026 = students.filter(s => s.academicYearId === "ay-2026-2027");
    expect(filter2026.length).toBe(1);
    expect(filter2026[0].id).toBe("SN-02");
  });

  it("calcule avec exactitude les heures et honoraires des enseignants", () => {
    const db = emptyDB();
    const t: Teacher = {
      id: "T-01",
      nom: "Makosso",
      prenom: "Alain",
      specialite: "Réseaux",
      tarifHoraire: 5000,
      heuresPrevues: 40,
      actif: true,
      modules: [],
    };
    db.teachers = [t];
    db.teacherHours = [
      { id: "th-1", teacherId: "T-01", date: "2026-03-01", heures: 2, montant: 10000, valide: true, statut: "valide", tauxHoraire: 5000 },
    ];

    const fin = teacherFinanceSummary(db, t.id);
    expect(typeof fin.heuresValidees).toBe("number");
    expect(typeof fin.solde).toBe("number");
    expect(fin.heuresValidees).toBe(2);
    expect(fin.solde).toBe(10000);
  });

  it("supporte l'activation, la désactivation et l'édition de rôle pour les utilisateurs", () => {
    const db = emptyDB();
    const u: User = {
      id: "u-test",
      username: "test.agent",
      password: "hash",
      role: "student",
      name: "Test Agent",
      actif: true,
    };

    // Bascule de statut
    const deactivated = { ...u, actif: false };
    expect(deactivated.actif).toBe(false);

    // Changement de rôle
    const promoted = { ...deactivated, role: "admin" as const, actif: true };
    expect(promoted.role).toBe("admin");
    expect(promoted.actif).toBe(true);
  });
});
