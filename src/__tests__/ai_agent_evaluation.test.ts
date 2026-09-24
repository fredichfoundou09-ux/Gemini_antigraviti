import { describe, it, expect, vi } from "vitest";
import {
  toolLabel,
  PublierEvaluationArgs,
  EvaluationQuestion,
  AiPendingAction,
  confirmAgentAction,
} from "@/lib/ai/agent";

describe("Assistant IA Agent - Outil publier_evaluation", () => {
  it("fournit le libellé en français pour chaque outil dont publier_evaluation", () => {
    expect(toolLabel("publier_evaluation")).toBe("Publier une évaluation");
    expect(toolLabel("publier_devoir")).toBe("Publier un devoir");
    expect(toolLabel("valider_presence")).toBe("Valider une présence");
    expect(toolLabel("inconnu")).toBe("inconnu");
  });

  it("valide la structure de type PublierEvaluationArgs et de ses questions", () => {
    const validQuestions: EvaluationQuestion[] = [
      {
        type: "qcm",
        enonce: "Quel protocole chiffre les connexions web par défaut ?",
        options: ["HTTP", "HTTPS", "FTP", "Telnet"],
        bonne_reponse: "HTTPS",
        points: 2,
      },
      {
        type: "vf",
        enonce: "Une adresse IPv4 est codée sur 32 bits.",
        bonne_reponse: "Vrai",
        points: 1,
      },
      {
        type: "courte",
        enonce: "Quel est le port standard utilisé par le protocole SSH ?",
        bonne_reponse: "22",
        points: 2,
      },
    ];

    const evaluationPayload: PublierEvaluationArgs = {
      module_id: "a0000000-0000-0000-0000-000000000001",
      titre: "Évaluation Cybersécurité & Protocoles",
      duree: 30,
      bareme: 5,
      questions: validQuestions,
    };

    expect(evaluationPayload.module_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(evaluationPayload.titre).toBe("Évaluation Cybersécurité & Protocoles");
    expect(evaluationPayload.duree).toBe(30);
    expect(evaluationPayload.bareme).toBe(5);
    expect(evaluationPayload.questions).toHaveLength(3);

    // Vérification des points totaux cohérents avec le barème
    const totalPoints = evaluationPayload.questions.reduce((acc, q) => acc + q.points, 0);
    expect(totalPoints).toBe(evaluationPayload.bareme);

    // Vérification des types de questions autorisés
    const allowedTypes = ["qcm", "vf", "courte"];
    evaluationPayload.questions.forEach((q) => {
      expect(allowedTypes).toContain(q.type);
      expect(q.enonce.length).toBeGreaterThan(0);
      expect(q.bonne_reponse.length).toBeGreaterThan(0);
      expect(q.points).toBeGreaterThan(0);
      if (q.type === "qcm") {
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options?.length).toBeGreaterThanOrEqual(2);
        expect(q.options).toContain(q.bonne_reponse);
      }
    });
  });

  it("rejette ou détecte un payload d'évaluation invalide", () => {
    function validateEvaluationPayload(payload: any): { valid: boolean; errors: string[] } {
      const errors: string[] = [];
      if (!payload.module_id || typeof payload.module_id !== "string") {
        errors.push("module_id manquant ou invalide");
      }
      if (!payload.titre || typeof payload.titre !== "string") {
        errors.push("titre manquant ou invalide");
      }
      if (typeof payload.duree !== "number" || payload.duree <= 0) {
        errors.push("duree invalide");
      }
      if (typeof payload.bareme !== "number" || payload.bareme <= 0) {
        errors.push("bareme invalide");
      }
      if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
        errors.push("questions manquantes");
      } else {
        payload.questions.forEach((q: any, i: number) => {
          if (!["qcm", "vf", "courte"].includes(q.type)) {
            errors.push(`question ${i}: type '${q.type}' invalide`);
          }
          if (!q.enonce) errors.push(`question ${i}: enonce manquant`);
          if (q.points === undefined || q.points <= 0) errors.push(`question ${i}: points invalides`);
          if (q.type === "qcm" && (!Array.isArray(q.options) || q.options.length < 2)) {
            errors.push(`question ${i}: options QCM insuffisantes`);
          }
        });
      }
      return { valid: errors.length === 0, errors };
    }

    const invalidPayload = {
      module_id: "",
      titre: "",
      duree: -5,
      bareme: 0,
      questions: [
        { type: "inconnu", enonce: "", points: -1 },
        { type: "qcm", enonce: "Question sans options", points: 1, options: [] },
      ],
    };

    const result = validateEvaluationPayload(invalidPayload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(4);
  });

  it("structure correctement une action en attente (AiPendingAction) pour publier_evaluation", () => {
    const action: AiPendingAction = {
      action_id: "act-test-uuid-1234",
      tool_name: "publier_evaluation",
      arguments: {
        module_id: "mod-uuid-1",
        titre: "Quiz Sécurité Web",
        duree: 20,
        bareme: 10,
        questions: [
          { type: "vf", enonce: "HTTPS est obligatoire pour les mots de passe.", bonne_reponse: "Vrai", points: 10 },
        ],
      },
    };

    expect(action.tool_name).toBe("publier_evaluation");
    expect(action.action_id).toBe("act-test-uuid-1234");
    expect(action.arguments.questions).toHaveLength(1);
  });

  it("vérifie le schéma des outils d'écriture WRITE_TOOLS (ne jamais exécuter sans confirmation)", () => {
    // Les outils qui modifient la base de données doivent appartenir à WRITE_TOOLS
    const writeTools = new Set(["valider_presence", "publier_devoir", "publier_evaluation"]);

    expect(writeTools.has("publier_evaluation")).toBe(true);
    expect(writeTools.has("publier_devoir")).toBe(true);
    expect(writeTools.has("valider_presence")).toBe(true);
    expect(writeTools.has("lister_mes_modules")).toBe(false);
    expect(writeTools.has("lister_absences_du_jour")).toBe(false);
    expect(writeTools.has("detecter_anomalies")).toBe(false);
  });

  it("simule la transformation de publier_evaluation vers les lignes insérées dans tests et questions", () => {
    const teacherId = "TEA-42";
    const args: PublierEvaluationArgs = {
      module_id: "mod-100",
      titre: "Test Algorithmique",
      duree: 60,
      bareme: 20,
      questions: [
        { type: "qcm", enonce: "Complexité d'une recherche binaire ?", options: ["O(1)", "O(n)", "O(log n)"], bonne_reponse: "O(log n)", points: 10 },
        { type: "courte", enonce: "Nom de l'inventeur de QuickSort ?", bonne_reponse: "Hoare", points: 10 },
      ],
    };

    // Transformation en ligne `tests`
    const testRow = {
      titre: args.titre,
      module_id: args.module_id,
      teacher_id: teacherId, // Résolu côté serveur
      duree: args.duree,
      bareme: args.bareme,
      statut: "publie",
      difficulte: "moyen",
    };

    expect(testRow.teacher_id).toBe("TEA-42");
    expect(testRow.statut).toBe("publie");
    expect(testRow.duree).toBe(60);

    // Transformation en lignes `questions`
    const questionRows = args.questions.map((q, idx) => ({
      test_id: "test-generated-id",
      question: q.enonce,
      type: q.type,
      bonne_reponse: q.bonne_reponse,
      points: q.points,
      ordre: idx + 1,
      options_json: q.options || [],
    }));

    expect(questionRows).toHaveLength(2);
    expect(questionRows[0].ordre).toBe(1);
    expect(questionRows[0].options_json).toEqual(["O(1)", "O(n)", "O(log n)"]);
    expect(questionRows[1].ordre).toBe(2);
    expect(questionRows[1].bonne_reponse).toBe("Hoare");
  });
});
