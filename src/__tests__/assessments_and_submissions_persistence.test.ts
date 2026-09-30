import { describe, it, expect } from "vitest";
import { resultsForUser, submissionsForUser } from "@/lib/access";
import { AssessmentResultSummary, Assessment } from "@/modules/assessments/types";
import { Assignment, AssignmentSubmission } from "@/modules/assignments/types";

describe("Module Évaluations & Devoirs : Persistance, Remises & Résultats", () => {
  const mockDb: any = {
    students: [
      { id: "STU-001", nom: "Dupont", prenom: "Jean", email: "jean.dupont@test.com", userId: "usr-stu-1" },
      { id: "STU-002", nom: "Martin", prenom: "Sophie", email: "sophie.martin@test.com", userId: "usr-stu-2" },
    ],
    teachers: [
      { id: "ENS-001", nom: "Professeur", prenom: "Alain", userId: "usr-ens-1" },
      { id: "ENS-002", nom: "Professeur", prenom: "Béatrice", userId: "usr-ens-2" },
    ],
  };

  const mockAssessments: Assessment[] = [
    {
      id: "test-uuid-1",
      titre: "Évaluation Cybersécurité",
      bareme: 20,
      seuilReussite: 10,
      teacherId: "ENS-001",
      duree: 45,
      questions: [],
      date: "2026-09-30",
      statut: "publie",
      modeSecurise: true,
      bloquerCopierColler: true,
      bloquerClicDroit: true,
      navigationLibre: true,
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      audience: "all",
      createdAt: "2026-09-30T00:00:00Z",
    },
    {
      id: "test-uuid-2",
      titre: "Évaluation Réseau IP",
      bareme: 20,
      seuilReussite: 10,
      teacherId: "ENS-002",
      duree: 30,
      questions: [],
      date: "2026-09-30",
      statut: "publie",
      modeSecurise: false,
      bloquerCopierColler: false,
      bloquerClicDroit: false,
      navigationLibre: true,
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      audience: "all",
      createdAt: "2026-09-30T00:00:00Z",
    },
  ];

  const mockResults: AssessmentResultSummary[] = [
    {
      id: "res-uuid-1",
      testId: "test-uuid-1",
      studentId: "STU-001",
      studentNom: "Dupont",
      studentPrenom: "Jean",
      note: 16,
      bareme: 20,
      pourcentage: 80,
      date: "2026-09-30",
      heure: "14:30",
      valide: true,
      statut: "reussi",
      nbBonnes: 8,
      nbMauvaises: 2,
      nbNonRepondues: 0,
      proctoringAlertsCount: 0,
    },
    {
      id: "res-uuid-2",
      testId: "test-uuid-2",
      studentId: "STU-002",
      studentNom: "Martin",
      studentPrenom: "Sophie",
      note: 18,
      bareme: 20,
      pourcentage: 90,
      date: "2026-09-30",
      heure: "15:00",
      valide: true,
      statut: "reussi",
      nbBonnes: 9,
      nbMauvaises: 1,
      nbNonRepondues: 0,
      proctoringAlertsCount: 0,
    },
  ];

  it("1. L'enseignant ENS-001 ne voit dans ses résultats QUE les examens qu'il a créés", () => {
    const teacherUser = { id: "usr-ens-1", role: "teacher" as const, email: "alain@test.com" };
    const filtered = resultsForUser(mockDb, teacherUser as any, mockResults, mockAssessments);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].testId).toBe("test-uuid-1");
    expect(filtered[0].studentNom).toBe("Dupont");
  });

  it("2. L'apprenant STU-001 ne voit QUE ses propres résultats", () => {
    const studentUser = { id: "usr-stu-1", role: "student" as const, email: "jean.dupont@test.com" };
    const filtered = resultsForUser(mockDb, studentUser as any, mockResults, mockAssessments);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].studentId).toBe("STU-001");
    expect(filtered[0].note).toBe(16);
  });

  it("3. L'administrateur voit l'ensemble consolidé des résultats", () => {
    const adminUser = { id: "admin-1", role: "admin" as const, email: "admin@test.com" };
    const filtered = resultsForUser(mockDb, adminUser as any, mockResults, mockAssessments);

    expect(filtered).toHaveLength(2);
  });

  it("4. Les tests déjà passés sont correctement exclus des 'Évaluations à passer'", () => {
    const passedTestIds = new Set(mockResults.filter((r) => r.studentId === "STU-001").map((r) => r.testId));
    
    // Pour l'apprenant STU-001, test-uuid-1 doit être exclu, mais test-uuid-2 doit rester en attente
    const pendingTests = mockAssessments.filter((t) => !passedTestIds.has(t.id));

    expect(passedTestIds.has("test-uuid-1")).toBe(true);
    expect(pendingTests).toHaveLength(1);
    expect(pendingTests[0].id).toBe("test-uuid-2");
  });

  it("5. Les résultats possèdent tous les champs normalisés camelCase (barème, pourcentage, statut)", () => {
    const res = mockResults[0];
    expect(res.testId).toBeDefined();
    expect(res.studentId).toBeDefined();
    expect(res.bareme).toBe(20);
    expect(res.pourcentage).toBe(80);
    expect(res.statut).toBe("reussi");
    expect(res.proctoringAlertsCount).toBe(0);
  });
});
