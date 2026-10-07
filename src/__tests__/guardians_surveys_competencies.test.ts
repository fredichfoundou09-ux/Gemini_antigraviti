import { describe, it, expect, vi, beforeEach } from "vitest";
import { guardianService } from "@/modules/guardians/services/guardianService";
import { surveyService, generateAnonymousHash } from "@/modules/surveys/services/surveyService";
import { competencyService } from "@/modules/competencies/services/competencyService";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("Phase 4 — N5 Portail Tuteurs + N6 Enquêtes de satisfaction + N7 Compétences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("N5 — Portail Parents & Tuteurs (Isolation & Consentement)", () => {
    it("ne retourne que les apprenants associés avec un consentement valide et actif", async () => {
      const mockLinks = [
        {
          id: "link-1",
          guardian_id: "G-100",
          student_id: "STU-01",
          can_view_grades: true,
          can_view_attendance: true,
          can_view_finances: false,
          is_active: true,
          consent_revoked_at: null,
        },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: mockLinks, error: null }),
      });

      const res = await guardianService.getGuardianPortalData("G-100");
      expect(res.links).toHaveLength(1);
      expect(res.links[0].student_id).toBe("STU-01");
      expect(res.links[0].can_view_grades).toBe(true);
      expect(res.links[0].can_view_finances).toBe(false);
    });

    it("révoque le consentement et coupe immédiatement l'accès", async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await guardianService.revokeConsent("link-1");
      expect(res.success).toBe(true);
    });
  });

  describe("N6 — Enquêtes de satisfaction (Anonymat & Seuil 5 réponses)", () => {
    it("génère des empreintes de hachage anonymes déterministes et non réversibles", async () => {
      const hash1 = await generateAnonymousHash("STU_100", "SURV_01");
      const hash2 = await generateAnonymousHash("STU_100", "SURV_01");
      const hash3 = await generateAnonymousHash("STU_101", "SURV_01");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).not.toContain("STU_100");
    });

    it("masque les résultats agrégés si le nombre de réponses est inférieur au seuil de 5", async () => {
      const mockSurvey = {
        id: "surv-1",
        title: "Évaluation Sécurité",
        min_responses_for_aggregation: 5,
        questions: [{ id: "q-1", question_text: "Qualité des TP" }],
      };

      const mockResponses = [
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h1", rating_value: 5 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h2", rating_value: 4 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h3", rating_value: 4 },
      ]; // Seulement 3 répondants distincts

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "surveys") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockSurvey, error: null }),
          };
        }
        if (table === "survey_responses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockResponses, error: null }),
          };
        }
        return {};
      });

      const res = await surveyService.getAggregatedResults("surv-1");
      expect(res.is_aggregated).toBe(false);
      expect(res.total_respondents).toBe(3);
      expect(res.reason).toContain("Seuil d'anonymat non atteint (3/5 réponses requises)");
    });

    it("calcule les moyennes et distributions dès que le seuil de 5 réponses est atteint", async () => {
      const mockSurvey = {
        id: "surv-1",
        title: "Évaluation Pédagogique",
        min_responses_for_aggregation: 5,
        questions: [{ id: "q-1", question_text: "Clarté du cours" }],
      };

      const mockResponses = [
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h1", rating_value: 5 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h2", rating_value: 5 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h3", rating_value: 4 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h4", rating_value: 4 },
        { survey_id: "surv-1", question_id: "q-1", respondent_hash: "h5", rating_value: 4 },
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "surveys") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockSurvey, error: null }),
          };
        }
        if (table === "survey_responses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockResponses, error: null }),
          };
        }
        return {};
      });

      const res = await surveyService.getAggregatedResults("surv-1");
      expect(res.is_aggregated).toBe(true);
      expect(res.total_respondents).toBe(5);
      expect(res.average_score).toBe(4.4);
      expect(res.questions_summary[0].distribution?.[5]).toBe(2);
      expect(res.questions_summary[0].distribution?.[4]).toBe(3);
    });
  });

  describe("N7 — Référentiel de Compétences & Livret", () => {
    it("applique l'acquisition automatique via la fonction evaluate_student_competency", async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: {
          student_id: "STU-01",
          competency_id: "COMP-01",
          score: 85,
          status: "mastered",
        },
        error: null,
      });

      const res = await competencyService.evaluateCompetency("STU-01", "COMP-01", 85);
      expect(res.success).toBe(true);
      expect(res.data.status).toBe("mastered");
    });

    it("valide manuellement une compétence par un enseignant", async () => {
      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await competencyService.validateManuallyByTeacher(
        "STU-01",
        "COMP-SEC-02",
        "teacher-user-uuid",
        "acquired"
      );
      expect(res.success).toBe(true);
    });

    it("génère les données consolidées du livret avec taux d'acquisition", () => {
      const student = { id: "STU-01", nom: "Mpassi", prenom: "Jean", formation: "Cybersécurité" };
      const progressList: any[] = [
        {
          id: "p1",
          competency_id: "C1",
          status: "acquired",
          competency: { id: "C1", code: "SEC-1", nom: "Audit Réseau", domaine: "Cybersécurité" },
        },
        {
          id: "p2",
          competency_id: "C2",
          status: "mastered",
          competency: { id: "C2", code: "SEC-2", nom: "Cryptographie", domaine: "Cybersécurité" },
        },
        {
          id: "p3",
          competency_id: "C3",
          status: "in_progress",
          competency: { id: "C3", code: "DEV-1", nom: "React & Node", domaine: "Développement" },
        },
        {
          id: "p4",
          competency_id: "C4",
          status: "not_acquired",
          competency: { id: "C4", code: "DEV-2", nom: "Bases de données", domaine: "Développement" },
        },
      ];

      const booklet = competencyService.generateBookletData(student, progressList);
      expect(booklet.totalCompetencies).toBe(4);
      expect(booklet.acquiredCompetencies).toBe(2);
      expect(booklet.acquisitionRate).toBe(50);
      expect(Object.keys(booklet.domains)).toEqual(["Cybersécurité", "Développement"]);
      expect(booklet.domains["Cybersécurité"]).toHaveLength(2);
    });
  });
});
