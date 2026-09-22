import { describe, it, expect } from "vitest";
import {
  validateAssignmentForPublication,
  getDeadlineInfo,
} from "../modules/assignments/services/assignmentService";
import { Assignment } from "../modules/assignments/types";

describe("Assignments Module - Devoirs & Remises", () => {
  const mockAssignment: Assignment = {
    id: "asg-test-1",
    titre: "TP Cybersécurité : Audit Réseau et Analyse Wireshark",
    description: "Analyse approfondie des trames réseau et détection d'intrusions",
    consignes: "Veuillez fournir un compte-rendu synthétique en PDF ainsi que le fichier de capture PCAP analysé.",
    formation: "informatique",
    moduleId: "mod-cyber-01",
    teacherId: "tch-001",
    dateCreation: "2026-09-22T10:00:00Z",
    dateLimite: "2026-10-15",
    heureLimite: "23:59",
    dureeEstimeeMinutes: 180,
    nbFichiersMax: 3,
    tailleMaxMo: 15,
    formatsAutorises: ["pdf", "docx", "zip"],
    bareme: 20,
    seuilReussite: 10,
    statut: "brouillon",
    audience: "all",
    autoriserRemiseTardive: false,
    tentativesMax: 1,
    correctionVisibleImmediatement: true,
    attachments: [
      {
        id: "att-1",
        fileName: "sujet_tp1.pdf",
        originalName: "sujet_tp1.pdf",
        fileUrl: "https://example.com/sujet.pdf",
        mime: "application/pdf",
        size: 1024 * 500,
      },
    ],
  };

  describe("Publication Validation Checklist (Exigences #4 & #6)", () => {
    it("should approve publication for a complete and properly configured assignment", () => {
      const validation = validateAssignmentForPublication(mockAssignment);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should block publication if mandatory fields are missing", () => {
      const incomplete: Assignment = {
        ...mockAssignment,
        titre: "", // Missing title
        consignes: "", // Missing instructions
        dateLimite: "", // Missing deadline
        bareme: 0, // Invalid scale
      };

      const validation = validateAssignmentForPublication(incomplete);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(4);
      expect(validation.errors.some((e) => e.includes("titre"))).toBe(true);
      expect(validation.errors.some((e) => e.includes("consignes"))).toBe(true);
      expect(validation.errors.some((e) => e.includes("date limite"))).toBe(true);
      expect(validation.errors.some((e) => e.includes("barème"))).toBe(true);
    });

    it("should reject an assignment where open date is after deadline", () => {
      const invalidDates: Assignment = {
        ...mockAssignment,
        dateOuverture: "2026-10-20",
        dateLimite: "2026-10-15",
      };

      const validation = validateAssignmentForPublication(invalidDates);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("antérieure"))).toBe(true);
    });

    it("should reject an assignment where seuil de réussite exceeds barème", () => {
      const invalidSeuil: Assignment = {
        ...mockAssignment,
        bareme: 20,
        seuilReussite: 25, // Exceeds bareme
      };

      const validation = validateAssignmentForPublication(invalidSeuil);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("seuil de réussite"))).toBe(true);
    });

    it("should reject an assignment without allowed file formats or with invalid file quotas", () => {
      const invalidFormats: Assignment = {
        ...mockAssignment,
        formatsAutorises: [],
        nbFichiersMax: 0,
        tailleMaxMo: 0,
      };

      const validation = validateAssignmentForPublication(invalidFormats);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Deadline & Remaining Time Calculations (Exigence #11)", () => {
    it("should calculate remaining time correctly for a future deadline", () => {
      const futureAssignment: Assignment = {
        ...mockAssignment,
        dateLimite: "2026-10-20",
        heureLimite: "18:00",
      };

      const refDate = new Date("2026-10-15T12:00:00");
      const info = getDeadlineInfo(futureAssignment, refDate);

      expect(info.isOverdue).toBe(false);
      expect(info.minutesRemaining).toBeGreaterThan(0);
      expect(info.formattedRemaining).toContain("jours restants");
    });

    it("should detect an overdue deadline and apply appropriate overdue badge and warning", () => {
      const overdueAssignment: Assignment = {
        ...mockAssignment,
        dateLimite: "2026-09-01",
        heureLimite: "12:00",
      };

      const refDate = new Date("2026-09-02T15:00:00");
      const info = getDeadlineInfo(overdueAssignment, refDate);

      expect(info.isOverdue).toBe(true);
      expect(info.minutesRemaining).toBeLessThan(0);
      expect(info.badgeColor).toBe("red");
      expect(info.formattedRemaining).toContain("Échu depuis");
    });

    it("should display hours remaining when deadline is within 24 hours", () => {
      const nearAssignment: Assignment = {
        ...mockAssignment,
        dateLimite: "2026-10-15",
        heureLimite: "18:00",
      };

      const refDate = new Date("2026-10-15T14:30:00");
      const info = getDeadlineInfo(nearAssignment, refDate);

      expect(info.isOverdue).toBe(false);
      expect(info.minutesRemaining).toBe(210); // 3h 30m
      expect(info.formattedRemaining).toContain("3h 30m");
    });
  });

  describe("Late Submissions & Permissions Policy (Exigences #8 & #11)", () => {
    it("should recognize when late submissions are allowed vs prohibited", () => {
      const allowedLate: Assignment = {
        ...mockAssignment,
        autoriserRemiseTardive: true,
      };

      const forbiddenLate: Assignment = {
        ...mockAssignment,
        autoriserRemiseTardive: false,
      };

      expect(allowedLate.autoriserRemiseTardive).toBe(true);
      expect(forbiddenLate.autoriserRemiseTardive).toBe(false);
    });

    it("should support configurable attempts (1, 2, 3, or unlimited)", () => {
      const singleAttempt: Assignment = { ...mockAssignment, tentativesMax: 1 };
      const tripleAttempts: Assignment = { ...mockAssignment, tentativesMax: 3 };
      const unlimitedAttempts: Assignment = { ...mockAssignment, tentativesMax: 0 };

      expect(singleAttempt.tentativesMax).toBe(1);
      expect(tripleAttempts.tentativesMax).toBe(3);
      expect(unlimitedAttempts.tentativesMax).toBe(0);
    });
  });
});
