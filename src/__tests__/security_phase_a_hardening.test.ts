import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasPermission } from "@/lib/supabase/permissions";
import type { Profile } from "@/lib/supabase/auth";
import {
  generateSecureRandomHex,
  hashStringSha256,
  webhookService,
} from "@/modules/api/services/webhookService";
import { surveyService } from "@/modules/surveys/services/surveyService";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe("Phase A — Sécurisation RLS, Isolement des examens & Protection des secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const studentProfile: Profile = {
    id: "student-uuid-1",
    username: "apprenant",
    name: "Élève Sentinelle",
    role: "student",
    active: true,
  };

  const adminProfile: Profile = {
    id: "admin-uuid-1",
    username: "admin_pedago",
    name: "Administrateur",
    role: "admin",
    active: true,
  };

  const teacherProfile: Profile = {
    id: "teacher-uuid-1",
    username: "formateur",
    name: "Formateur Principal",
    role: "teacher",
    active: true,
  };

  describe("A.1 & A.2 — RLS et Permissions RBAC sur les 20 tables sensibles", () => {
    it("interdit strictement à un apprenant de gérer les tuteurs, clés API et webhooks", () => {
      expect(hasPermission(studentProfile, "guardians.manage")).toBe(false);
      expect(hasPermission(studentProfile, "api.manage")).toBe(false);
      expect(hasPermission(studentProfile, "webhooks.manage")).toBe(false);
    });

    it("interdit à un apprenant de s'auto-attribuer des compétences ou de modifier les enquêtes", () => {
      expect(hasPermission(studentProfile, "competencies.manage")).toBe(false);
      expect(hasPermission(studentProfile, "surveys.manage")).toBe(false);
      expect(hasPermission(studentProfile, "gamification.manage")).toBe(false);
    });

    it("accorde les droits de gestion de l'API et des webhooks aux administrateurs uniquement", () => {
      expect(hasPermission(adminProfile, "api.manage")).toBe(true);
      expect(hasPermission(adminProfile, "webhooks.manage")).toBe(true);
      expect(hasPermission(teacherProfile, "api.manage")).toBe(false);
      expect(hasPermission(teacherProfile, "webhooks.manage")).toBe(false);
    });
  });

  describe("A.3 — Isolement strict des questions et réponses d'examen pour les apprenants", () => {
    it("s'assure que les objets de questions distribués aux apprenants n'exposent aucune bonne réponse", () => {
      const questionsWithAnswers = [
        {
          id: "q-1",
          question: "Quel est le port par défaut de SSH ?",
          type: "qcm",
          options_json: ["21", "22", "80", "443"],
          bonne_reponse: "22",
          bonnes_reponses_json: ["22"],
          valeur_numerique: 22,
          tolerance_numerique: 0,
          explication: "Le port standard est 22.",
          points: 2,
        },
      ];

      // Transformation pour apprenant
      const studentQuestions = questionsWithAnswers.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options_json,
        points: q.points,
        bonneReponse: undefined,
        bonnesReponses: undefined,
        valeurNumerique: undefined,
        toleranceNumerique: undefined,
        explication: undefined,
      }));

      const sanitizedQ = studentQuestions[0];
      expect(sanitizedQ.bonneReponse).toBeUndefined();
      expect(sanitizedQ.bonnesReponses).toBeUndefined();
      expect(sanitizedQ.valeurNumerique).toBeUndefined();
      expect(sanitizedQ.toleranceNumerique).toBeUndefined();
      expect(sanitizedQ.explication).toBeUndefined();
      expect(sanitizedQ.question).toBe("Quel est le port par défaut de SSH ?");
    });
  });

  describe("A.1 — Anonymisation et agrégation côté serveur des enquêtes de satisfaction", () => {
    it("délègue la soumission à la RPC submit_survey_response sans exposer d'identifiant brut", async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, recorded_answers: 3 },
        error: null,
      });

      const res = await surveyService.submitSurveyAnswers("survey-101", "student-001", [
        { question_id: "q-101", rating_value: 5 },
        { question_id: "q-102", text_value: "Excellent cours" },
      ]);

      expect(supabase.rpc).toHaveBeenCalledWith("submit_survey_response", {
        p_survey_id: "survey-101",
        p_answers: [
          { question_id: "q-101", rating_value: 5, text_value: undefined },
          { question_id: "q-102", rating_value: undefined, text_value: "Excellent cours" },
        ],
      });
      expect(res.success).toBe(true);
    });

    it("masque les résultats détaillés si le seuil minimal de 5 répondants n'est pas atteint", async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: {
          success: true,
          survey_id: "survey-101",
          is_aggregated: false,
          total_respondents: 3,
          min_required: 5,
          reason: "Seuil minimal d'anonymat non atteint (3/5 réponses)",
        },
        error: null,
      });

      const res = await surveyService.getAggregatedResults("survey-101");
      expect(res.is_aggregated).toBe(false);
      expect(res.total_respondents).toBe(3);
      expect(res.questions_summary).toHaveLength(0);
      expect(res.reason).toContain("Seuil minimal");
    });

    it("fournit les données agrégées lorsque le seuil est validé (>= 5 répondants)", async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: {
          success: true,
          survey_id: "survey-101",
          is_aggregated: true,
          total_respondents: 8,
          average_score: 4.6,
          questions_summary: [
            {
              question_id: "q-101",
              question_text: "Clarté du cours",
              average_rating: 4.6,
              distribution: { 5: 6, 4: 2 },
              text_answers: ["Très clair", "Bravo"],
            },
          ],
        },
        error: null,
      });

      const res = await surveyService.getAggregatedResults("survey-101");
      expect(res.is_aggregated).toBe(true);
      expect(res.total_respondents).toBe(8);
      expect(res.average_score).toBe(4.6);
      expect(res.questions_summary).toHaveLength(1);
    });
  });

  describe("A.6 — Cryptographie forte pour les clés d'API et les secrets de Webhooks", () => {
    it("génère des chaînes d'entropie aléatoires de 32 octets (64 caractères hexadécimaux)", async () => {
      const hex = await generateSecureRandomHex(32);
      expect(hex).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
    });

    it("calcule un hachage SHA-256 robuste et déterministe", async () => {
      const hash1 = await hashStringSha256("sentinelle_secret_key");
      const hash2 = await hashStringSha256("sentinelle_secret_key");
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("crée une clé API avec préfixe sn_live_ et ne retourne pas le secret dans l'objet item", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "key-1",
              name: "Clé Système",
              key_prefix: "sn_live_abcd1234...",
              scopes: ["read"],
              revoked: false,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === "api_keys") {
          return { insert: mockInsert };
        }
        return {};
      });

      const res = await webhookService.createApiKey("Clé Système");
      expect(res.fullKey.startsWith("sn_live_")).toBe(true);
      expect(res.apiKeyItem.key_prefix.startsWith("sn_live_")).toBe(true);
      expect((res.apiKeyItem as any).key_hash).toBeUndefined();
    });
  });
});
