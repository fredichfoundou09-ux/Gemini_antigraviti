import { describe, it, expect } from "vitest";
import { parseMarkdownAssessment } from "../modules/assessments/parsers/markdownParser";
import { detectColumnMapping, convertRowsToQuestions } from "../modules/assessments/parsers/excelParser";
import {
  validateAssessmentForPublication,
  sanitizeAssessmentForStudent,
  evaluateAnswersLocally,
} from "../modules/assessments/services/assessmentService";
import { Assessment, AssessmentQuestion } from "../modules/assessments/types";
import { generateAssessmentDocx } from "../modules/assessments/exporters/docxExport";
import { generateAssessmentPdf } from "../modules/assessments/exporters/pdfExport";

describe("Assessments Module - Tests & Évaluations", () => {
  describe("Markdown Parser", () => {
    it("should parse metadata, title, duration and questions from markdown", () => {
      const sampleMd = `# Évaluation Cybersécurité et Réseaux

Durée: 45 min
Barème: 20 pts

## Consignes
Veuillez lire attentivement les énoncés avant de répondre.

### Question 1 (2 pts) : Quel protocole sécurise le transport web HTTP ?
A) SSH
B) FTP
C) HTTPS
D) Telnet
Bonne réponse: C
Explication: HTTPS utilise TLS pour chiffrer les échanges HTTP.

### Question 2 (3 pts) : Principes fondamentaux de la sécurité
-[x] Confidentialité
-[x] Intégrité
-[ ] Complexité
-[x] Disponibilité
Explication: La triade CIA regroupe Confidentialité, Intégrité et Disponibilité.

### Question 3 (1 pt) : Le protocole DNS utilise par défaut le port UDP 53
A) Vrai
B) Faux
Bonne réponse: Vrai
Explication: Le port standard pour les requêtes DNS est UDP 53.

### Question 4 (4 pts) : Expliquez le fonctionnement d'une attaque Man-in-the-Middle (MitM)

### Question 5 (2 pts) : Port d'écoute SSH standard
Valeur numérique: 22
Explication: Le port standard IANA pour SSH est 22.
`;

      const result = parseMarkdownAssessment(sampleMd);

      expect(result.titre).toBe("Évaluation Cybersécurité et Réseaux");
      expect(result.duree).toBe(45);
      expect(result.bareme).toBe(20);
      expect(result.consignes).toContain("Veuillez lire attentivement");
      expect(result.questions).toHaveLength(5);

      // Question 1 : QCM
      const q1 = result.questions[0];
      expect(q1.type).toBe("qcm");
      expect(q1.options).toEqual(["SSH", "FTP", "HTTPS", "Telnet"]);
      expect(q1.bonneReponse).toBe("HTTPS"); // parsed from letter C
      expect(q1.points).toBe(2);
      expect(q1.explication).toContain("HTTPS utilise TLS");

      // Question 2 : QCM multiple
      const q2 = result.questions[1];
      expect(q2.type).toBe("qcm_multiple");
      expect(q2.options).toContain("Confidentialité");
      expect(q2.options).toContain("Intégrité");
      expect(q2.options).toContain("Complexité");
      expect(q2.options).toContain("Disponibilité");
      expect(q2.bonnesReponses).toEqual(["Confidentialité", "Intégrité", "Disponibilité"]);
      expect(q2.points).toBe(3);

      // Question 3 : V/F
      const q3 = result.questions[2];
      expect(q3.type).toBe("vf");
      expect(q3.bonneReponse).toBe("Vrai");

      // Question 4 : Réponse longue
      const q4 = result.questions[3];
      expect(q4.type).toBe("longue");
      expect(q4.points).toBe(4);

      // Question 5 : Numérique
      const q5 = result.questions[4];
      expect(q5.type).toBe("numerique");
      expect(q5.valeurNumerique).toBe(22);
    });
  });

  describe("Excel Column Detection & Parsing", () => {
    it("should detect standard and alternative column names", () => {
      const sampleHeaders = [
        "Énoncé",
        "Type de question",
        "Choix A",
        "Choix B",
        "Choix C",
        "Bonne Réponse",
        "Points",
        "Feedback",
      ];

      const { mapping } = detectColumnMapping(sampleHeaders);
      expect(mapping.questionCol).toBe("Énoncé");
      expect(mapping.typeCol).toBe("Type de question");
      expect(mapping.optionsCols).toEqual(["Choix A", "Choix B", "Choix C"]);
      expect(mapping.reponseCol).toBe("Bonne Réponse");
      expect(mapping.pointsCol).toBe("Points");
      expect(mapping.explicationCol).toBe("Feedback");
    });

    it("should convert table rows into structured assessment questions", () => {
      const rows = [
        {
          "Question": "Quel est le code de statut HTTP pour 'Non trouvé' ?",
          "Type": "QCM",
          "Option A": "200",
          "Option B": "401",
          "Option C": "404",
          "Option D": "500",
          "Bonne Réponse": "C",
          "Points": 2,
          "Explication": "404 Not Found est le statut standard.",
        },
        {
          "Question": "Un pare-feu protège le réseau contre les accès non autorisés.",
          "Type": "V/F",
          "Option A": "Vrai",
          "Option B": "Faux",
          "Bonne Réponse": "Vrai",
          "Points": 1,
          "Explication": "C'est la définition première d'un pare-feu.",
        },
      ];

      const { mapping } = detectColumnMapping(Object.keys(rows[0]));
      const questions = convertRowsToQuestions(rows, mapping);

      expect(questions).toHaveLength(2);
      expect(questions[0].question).toContain("Non trouvé");
      expect(questions[0].options).toHaveLength(4);
      expect(questions[0].bonneReponse).toBe("404"); // Resolved letter C to "404"
      expect(questions[1].type).toBe("vf");
      expect(questions[1].bonneReponse).toBe("Vrai");
    });
  });

  describe("Publication Validation Checklist", () => {
    const mockAssessment: Assessment = {
      id: "test-assess-1",
      titre: "Évaluation Finale",
      description: "Test de compétences",
      moduleId: "MOD-CYBER-01",
      formation: "informatique",
      teacherId: "TCH-001",
      date: "2026-09-22",
      duree: 30,
      bareme: 20,
      seuilReussite: 10,
      difficulte: "moyen",
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      consignes: "Veuillez répondre à toutes les questions calmement.",
      statut: "brouillon",
      audience: "all",
      modeSecurise: true,
      bloquerCopierColler: true,
      bloquerClicDroit: true,
      navigationLibre: true,
      questions: [
        {
          id: "q-1",
          testId: "test-assess-1",
          question: "Quelle commande Linux liste les fichiers d'un dossier ?",
          type: "qcm",
          options: ["ls", "cd", "pwd", "mkdir"],
          bonneReponse: "ls",
          points: 10,
          ordre: 1,
        },
        {
          id: "q-2",
          testId: "test-assess-1",
          question: "Expliquez la différence entre TCP et UDP.",
          type: "longue",
          points: 10,
          ordre: 2,
        },
      ],
    };

    it("should approve publication for a complete and valid assessment", () => {
      const validation = validateAssessmentForPublication(mockAssessment);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should block publication if mandatory fields are missing", () => {
      const incomplete: Assessment = {
        ...mockAssessment,
        titre: "", // Missing title
        duree: 0, // Invalid duration
        questions: [], // No questions
      };

      const validation = validateAssessmentForPublication(incomplete);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("should block publication if a QCM has no choices or no answer", () => {
      const invalidQcm: Assessment = {
        ...mockAssessment,
        questions: [
          {
            id: "q-invalid",
            testId: "test-assess-1",
            question: "Question sans options",
            type: "qcm",
            options: [], // Missing options
            bonneReponse: "", // Missing answer
            points: 5,
            ordre: 1,
          },
        ],
      };

      const validation = validateAssessmentForPublication(invalidQcm);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("options"))).toBe(true);
    });
  });

  describe("Security: Student Data Sanitization (Anti-Leak)", () => {
    it("MUST strip all correct answers and explanations before sending to student", () => {
      const fullAssessment: Assessment = {
        id: "eval-secret",
        titre: "Évaluation Secrète",
        moduleId: "MOD-01",
        teacherId: "TCH-001",
        statut: "publie",
        date: "2026-09-22",
        duree: 20,
        bareme: 10,
        seuilReussite: 5,
        difficulte: "moyen",
        tentatives: 1,
        afficherCorrections: false,
        validationRequise: false,
        audience: "all",
        modeSecurise: true,
        bloquerCopierColler: true,
        bloquerClicDroit: true,
        navigationLibre: true,
        questions: [
          {
            id: "q-secret-1",
            testId: "eval-secret",
            question: "Quel est le port HTTPS ?",
            type: "qcm",
            options: ["80", "443", "8080"],
            bonneReponse: "443", // LEAK RISK IF EXPOSED!
            explication: "Le port standard est 443.", // LEAK RISK
            points: 5,
            ordre: 1,
          },
          {
            id: "q-secret-2",
            testId: "eval-secret",
            question: "Sélectionnez les ports de messagerie",
            type: "qcm_multiple",
            options: ["25", "110", "143", "3306"],
            bonnesReponses: ["25", "110", "143"], // LEAK RISK
            bonneReponse: "25, 110, 143",
            explication: "3306 est MySQL.",
            points: 5,
            ordre: 2,
          },
          {
            id: "q-secret-3",
            testId: "eval-secret",
            question: "Quelle est la valeur de PI arrondie à 2 décimales ?",
            type: "numerique",
            valeurNumerique: 3.14, // LEAK RISK
            toleranceNumerique: 0.01,
            bonneReponse: "3.14",
            points: 5,
            ordre: 3,
          },
        ],
      };

      const sanitized = sanitizeAssessmentForStudent(fullAssessment);

      // Verify overall metadata preserved
      expect(sanitized.id).toBe("eval-secret");
      expect(sanitized.titre).toBe("Évaluation Secrète");
      expect(sanitized.questions).toHaveLength(3);

      // Verify that NO question contains sensitive keys
      for (const q of sanitized.questions) {
        expect(q.bonneReponse).toBeUndefined();
        expect(q.bonnesReponses).toBeUndefined();
        expect(q.valeurNumerique).toBeUndefined();
        expect(q.toleranceNumerique).toBeUndefined();
        expect(q.explication).toBeUndefined();
      }
    });
  });

  describe("Evaluation Engine", () => {
    const questions: AssessmentQuestion[] = [
      {
        id: "q1",
        testId: "t1",
        question: "QCM test",
        type: "qcm",
        options: ["A", "B", "C"],
        bonneReponse: "B",
        points: 4,
        ordre: 1,
      },
      {
        id: "q2",
        testId: "t1",
        question: "QCM multiple test",
        type: "qcm_multiple",
        options: ["Alpha", "Beta", "Gamma"],
        bonnesReponses: ["Alpha", "Gamma"],
        points: 6,
        ordre: 2,
      },
      {
        id: "q3",
        testId: "t1",
        question: "Vrai/Faux test",
        type: "vf",
        bonneReponse: "Vrai",
        points: 2,
        ordre: 3,
      },
      {
        id: "q4",
        testId: "t1",
        question: "Question numérique test",
        type: "numerique",
        valeurNumerique: 100,
        toleranceNumerique: 5,
        points: 3,
        ordre: 4,
      },
      {
        id: "q5",
        testId: "t1",
        question: "Question réponse longue test",
        type: "longue",
        points: 5,
        ordre: 5,
      },
    ];

    it("should accurately score correct answers", () => {
      const userAnswers: Record<string, string | string[] | number> = {
        q1: "B",
        q2: ["Alpha", "Gamma"],
        q3: "Vrai",
        q4: 103, // Within tolerance [95, 105]
        q5: "Texte explicatif développé...",
      };

      const result = evaluateAnswersLocally(questions, userAnswers, 20, 10);

      // Total earned on auto questions: 4 + 6 + 2 + 3 = 15 out of 20 totalPoints
      // Scale: (15 / 20) * 20 = 15 / 20
      expect(result.note).toBe(15);
      expect(result.pourcentage).toBe(75);
      expect(result.nbBonnes).toBe(4);
      expect(result.requiresManual).toBe(true);

      const q1Detail = result.details.find((d) => d.questionId === "q1");
      expect(q1Detail?.correct).toBe(true);
      expect(q1Detail?.pointsObtenus).toBe(4);

      const q4Detail = result.details.find((d) => d.questionId === "q4");
      expect(q4Detail?.correct).toBe(true);
      expect(q4Detail?.pointsObtenus).toBe(3);

      const q5Detail = result.details.find((d) => d.questionId === "q5");
      expect(q5Detail?.statutCorrection).toBe("en_attente");
      expect(q5Detail?.pointsObtenus).toBe(0);
    });

    it("should handle incorrect answers and numerical out of tolerance", () => {
      const userAnswers: Record<string, string | string[] | number> = {
        q1: "A", // False
        q2: ["Alpha"], // Missing Gamma
        q3: "Faux", // False
        q4: 110, // Outside tolerance [95, 105]
      };

      const result = evaluateAnswersLocally(questions, userAnswers, 20, 10);

      expect(result.note).toBe(0);
      expect(result.pourcentage).toBe(0);
      expect(result.statut).toBe("echoue");
      expect(result.nbMauvaises).toBe(4);
    });
  });

  describe("Document Exporters (DOCX & PDF)", () => {
    const exportableAssessment: Assessment = {
      id: "eval-export",
      titre: "Évaluation Système et Réseaux",
      description: "Examen de certification",
      moduleId: "MOD-SYSTEM-01",
      teacherId: "TCH-001",
      formation: "informatique",
      date: "2026-09-22",
      duree: 60,
      bareme: 20,
      seuilReussite: 10,
      difficulte: "difficile",
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      statut: "publie",
      audience: "all",
      modeSecurise: true,
      bloquerCopierColler: true,
      bloquerClicDroit: true,
      navigationLibre: true,
      consignes: "Calculatrice interdite. Téléphones éteints.",
      questions: [
        {
          id: "qx-1",
          testId: "eval-export",
          question: "Qu'est-ce qu'un socket réseau ?",
          type: "qcm",
          options: [
            "Une combinaison IP et Port",
            "Un câble physique",
            "Un type de mémoire RAM",
          ],
          bonneReponse: "Une combinaison IP et Port",
          explication: "Le socket identifie de manière unique une communication point à point.",
          points: 10,
          ordre: 1,
        },
        {
          id: "qx-2",
          testId: "eval-export",
          question: "Expliquez le routage dynamique OSPF.",
          type: "longue",
          points: 10,
          ordre: 2,
        },
      ],
    };

    it("should generate DOCX blobs for both student and teacher versions", async () => {
      const studentBlob = await generateAssessmentDocx(exportableAssessment, { isTeacherVersion: false });
      expect(studentBlob).toBeInstanceOf(Blob);
      expect(studentBlob.size).toBeGreaterThan(500);

      const teacherBlob = await generateAssessmentDocx(exportableAssessment, { isTeacherVersion: true });
      expect(teacherBlob).toBeInstanceOf(Blob);
      expect(teacherBlob.size).toBeGreaterThan(500);
    });

    it("should generate PDF documents for both student and teacher versions", () => {
      const studentPdf = generateAssessmentPdf(exportableAssessment, { isTeacherVersion: false });
      expect(studentPdf).toBeDefined();
      const studentOutput = studentPdf.output("blob");
      expect(studentOutput.size).toBeGreaterThan(500);

      const teacherPdf = generateAssessmentPdf(exportableAssessment, { isTeacherVersion: true });
      expect(teacherPdf).toBeDefined();
      const teacherOutput = teacherPdf.output("blob");
      expect(teacherOutput.size).toBeGreaterThan(500);
    });
  });
});
