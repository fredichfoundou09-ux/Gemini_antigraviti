import { describe, it, expect } from "vitest";
import { generatePrintableExamSheet, generateClassGradeRoster } from "../modules/assessments/exporters/printableExamPdf";
import { Assessment } from "../modules/assessments/types";

describe("Pillar 1: Paper & Hybrid Exams Exporter", () => {
  const sampleAssessment: Assessment = {
    id: "test-eval-a4-01",
    titre: "Épreuve Officielle de Cybersécurité et Réseaux",
    description: "Examen sur table en amphithéâtre",
    moduleId: "mod-cyber",
    teacherId: "tch-01",
    questions: [
      {
        id: "q1",
        question: "Expliquez le principe d'une attaque Man-in-the-Middle (MITM) et proposez deux contre-mesures.",
        type: "longue",
        points: 8,
        ordre: 1,
      },
      {
        id: "q2",
        question: "Quel protocole garantit l'intégrité et la confidentialité des échanges web ?",
        type: "qcm",
        options: ["HTTP", "HTTPS / TLS", "FTP", "Telnet"],
        bonneReponse: "HTTPS / TLS",
        points: 4,
        ordre: 2,
      },
      {
        id: "q3",
        question: "Un pare-feu stateless analyse l'état dynamique des sessions TCP.",
        type: "vf",
        options: ["Vrai", "Faux"],
        bonneReponse: "Faux",
        points: 4,
        ordre: 3,
      },
      {
        id: "q4",
        question: "Donnez le port par défaut du protocole SSH.",
        type: "numerique",
        valeurNumerique: 22,
        points: 4,
        ordre: 4,
      }
    ],
    date: "2026-10-15",
    duree: 120,
    bareme: 20,
    seuilReussite: 10,
    difficulte: "difficile",
    tentatives: 1,
    afficherCorrections: false,
    validationRequise: true,
    statut: "publie",
    audience: "module",
    formatEpreuve: "papier",
    consignes: "Documents interdits. Téléphones éteints dans les sacs.",
    documentsAutorises: false,
    calculatriceAutorisee: false,
    scannedCopiesAllowed: true,
    modeSecurise: true,
    bloquerCopierColler: true,
    bloquerClicDroit: true,
    navigationLibre: true,
  };

  const sampleStudents = [
    { id: "stu-1", nom: "MOUKALA", prenom: "Grace", email: "grace.m@example.com", formation: "Cyber 1" },
    { id: "stu-2", nom: "NGOMA", prenom: "Kevin", email: "kevin.n@example.com", formation: "Cyber 1" },
    { id: "stu-3", nom: "BAH", prenom: "Aissatou", email: "aissatou.b@example.com", formation: "Cyber 1" },
  ];

  it("generates a valid printable exam A4 document without throwing", () => {
    const doc = generatePrintableExamSheet(sampleAssessment, {
      moduleName: "Sécurité des Systèmes d'Information",
      schoolName: "Institut Supérieur Sentinelles Numériques",
    });
    expect(doc).toBeDefined();
    // jsPDF produces an internal buffer
    const output = doc.output("datauristring");
    expect(output).toContain("data:application/pdf");
  });

  it("generates a class attendance and grade roster PDF without throwing", () => {
    const doc = generateClassGradeRoster(sampleAssessment, sampleStudents, {
      moduleName: "Sécurité des Systèmes d'Information",
      schoolName: "Institut Supérieur Sentinelles Numériques",
    });
    expect(doc).toBeDefined();
    const output = doc.output("datauristring");
    expect(output).toContain("data:application/pdf");
  });
});

describe("Pillar 2: Question-by-Question Manual Grading Logic", () => {
  it("calculates live total note and validates pass/fail thresholds", () => {
    const questions = [
      { id: "q1", points: 8 },
      { id: "q2", points: 4 },
      { id: "q3", points: 4 },
      { id: "q4", points: 4 },
    ];
    const manualGrades: Record<string, number> = {
      q1: 6.5,
      q2: 4,
      q3: 0,
      q4: 4,
    };

    const totalScore = questions.reduce((sum, q) => sum + (manualGrades[q.id] ?? 0), 0);
    const bareme = 20;
    const seuilReussite = 10;
    const isSuccess = totalScore >= seuilReussite;
    const pourcentage = Math.round((totalScore / bareme) * 100);

    expect(totalScore).toBe(14.5);
    expect(isSuccess).toBe(true);
    expect(pourcentage).toBe(73);
  });
});

describe("Pillar 3: Communication Matrix and Exam Blackout Rules", () => {
  const currentStudent = {
    id: "stu-1",
    nom: "MOUKALA",
    prenom: "Grace",
    role: "student",
    formation: "Licence 3 Cyber",
  };

  const allUsers = [
    { id: "adm-1", nom: "ADMIN", prenom: "Central", role: "admin" },
    { id: "tch-cyber", nom: "PROF", prenom: "Cyber", role: "teacher" },
    { id: "tch-design", nom: "PROF", prenom: "Design", role: "teacher" },
    { id: "stu-peer-same", nom: "NGOMA", prenom: "Kevin", role: "student", formation: "Licence 3 Cyber" },
    { id: "stu-peer-other", nom: "LOUBA", prenom: "Aline", role: "student", formation: "Master 1 IA" },
  ];

  const studentEnrolledModules = ["mod-cyber"];
  const teacherModules: Record<string, string[]> = {
    "tch-cyber": ["mod-cyber"],
    "tch-design": ["mod-design"],
  };

  it("restricts student recipients to admin and assigned module teachers", () => {
    // Communication Policy: default (allow peer to peer = false for testing isolation)
    const policy = {
      allowStudentToStudent: false,
      restrictStudentToSameGroup: true,
      examBlackout: false,
    };

    const allowedRecipients = allUsers.filter((u) => {
      if (u.id === currentStudent.id) return false;
      if (u.role === "admin" || u.role === "superadmin") return true;
      if (u.role === "teacher") {
        const tMods = teacherModules[u.id] || [];
        return tMods.some((m) => studentEnrolledModules.includes(m));
      }
      if (u.role === "student") {
        if (!policy.allowStudentToStudent) return false;
        if (policy.restrictStudentToSameGroup) {
          return u.formation === currentStudent.formation;
        }
        return true;
      }
      return false;
    });

    const recipientIds = allowedRecipients.map((r) => r.id);
    expect(recipientIds).toContain("adm-1");
    expect(recipientIds).toContain("tch-cyber");
    expect(recipientIds).not.toContain("tch-design"); // Not their teacher
    expect(recipientIds).not.toContain("stu-peer-same"); // Student-to-student is disabled
    expect(recipientIds).not.toContain("stu-peer-other");
  });

  it("allows peer-to-peer strictly inside the same cohort when enabled", () => {
    const policy = {
      allowStudentToStudent: true,
      restrictStudentToSameGroup: true,
      examBlackout: false,
    };

    const allowedRecipients = allUsers.filter((u) => {
      if (u.id === currentStudent.id) return false;
      if (u.role === "admin" || u.role === "superadmin") return true;
      if (u.role === "teacher") {
        const tMods = teacherModules[u.id] || [];
        return tMods.some((m) => studentEnrolledModules.includes(m));
      }
      if (u.role === "student") {
        if (!policy.allowStudentToStudent) return false;
        if (policy.restrictStudentToSameGroup) {
          return u.formation === currentStudent.formation;
        }
        return true;
      }
      return false;
    });

    const recipientIds = allowedRecipients.map((r) => r.id);
    expect(recipientIds).toContain("stu-peer-same"); // Same cohort
    expect(recipientIds).not.toContain("stu-peer-other"); // Different cohort blocked
  });

  it("blocks message dispatching when examBlackout is active", () => {
    const policy = {
      allowStudentToStudent: true,
      restrictStudentToSameGroup: true,
      examBlackout: true,
    };

    const canSendMessages = (userRole: string) => {
      if (userRole === "admin" || userRole === "superadmin") return true;
      if (policy.examBlackout && userRole === "student") return false;
      return true;
    };

    expect(canSendMessages("student")).toBe(false);
    expect(canSendMessages("admin")).toBe(true);
  });
});
