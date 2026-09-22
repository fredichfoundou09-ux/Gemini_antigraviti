import { AssessmentQuestion, QuestionType } from "../types";

export interface ParsedMarkdownAssessment {
  titre: string;
  description: string;
  consignes: string;
  duree: number;
  bareme: number;
  questions: AssessmentQuestion[];
  rawText: string;
}

export function parseMarkdownAssessment(mdContent: string): ParsedMarkdownAssessment {
  const lines = mdContent.split(/\r?\n/);
  let titre = "Évaluation sans titre";
  let description = "";
  let consignes = "";
  let duree = 45;
  let bareme = 20;

  const rawQuestions: Array<{
    title: string;
    points: number;
    type?: QuestionType;
    options: string[];
    correct: string[];
    numericValue?: number;
    explanation?: string;
  }> = [];

  let currentQ: {
    title: string;
    points: number;
    type?: QuestionType;
    options: string[];
    correct: string[];
    numericValue?: number;
    explanation?: string;
  } | null = null;

  let inConsignes = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Titre principal
    if (line.startsWith("# ") && titre === "Évaluation sans titre") {
      titre = line.replace(/^#\s+/, "").trim();
      continue;
    }

    // Détection métadonnées
    const dureeMatch = line.match(/(?:dur[eé]e)\s*[:=]\s*(\d+)\s*(?:min|h|heure)/i);
    if (dureeMatch) {
      const val = parseInt(dureeMatch[1], 10);
      duree = line.toLowerCase().includes("h") ? val * 60 : val;
    }

    const baremeMatch = line.match(/(?:bar[eè]me|total|note max(?:imale)?)\s*[:=]\s*(\d+(?:[.,]\d+)?)/i);
    if (baremeMatch) {
      bareme = parseFloat(baremeMatch[1].replace(",", "."));
    }

    // Consignes
    if (line.match(/^##?\s*(?:consignes|instructions)/i)) {
      inConsignes = true;
      continue;
    }

    if (inConsignes && (line.startsWith("#") || line.match(/^(?:Q\d+|\d+[\.\)])/i))) {
      inConsignes = false;
    }

    if (inConsignes && line) {
      consignes += (consignes ? "\n" : "") + line.replace(/^>\s*/, "");
      continue;
    }

    // Début d'une nouvelle question
    // Ex: "1. Quel est...", "Q1: Qu'est-ce que...", "### Question 1 (2 pts) : ..."
    const qMatch = line.match(/^(?:#{2,4}\s+)?(?:question\s*\d+|q\d+|\d+)(?:\s*[\(\[][^\)\]]+[\)\]])?\s*[\.\:\)]\s*(.+)/i);
    if (qMatch) {
      if (currentQ) {
        rawQuestions.push(currentQ);
      }

      let qText = qMatch[1].trim();
      let pts = 1;

      // Détection points avant les deux-points : "Question 1 (2 pts) :"
      const prePtsMatch = line.match(/(?:question\s*\d+|q\d+|\d+)\s*[\(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?)\s*[\)\]]/i);
      if (prePtsMatch) {
        pts = parseFloat(prePtsMatch[1].replace(",", "."));
      }

      // Détection points dans l'intitulé : "(2 pts)", "[3 points]"
      const ptsMatch = qText.match(/[\(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?)\s*[\)\]]/i);
      if (ptsMatch) {
        pts = parseFloat(ptsMatch[1].replace(",", "."));
        qText = qText.replace(ptsMatch[0], "").trim();
      }

      currentQ = {
        title: qText,
        points: pts,
        options: [],
        correct: [],
      };
      continue;
    }

    if (!currentQ) {
      if (line && !line.startsWith("#") && !description) {
        description = line;
      }
      continue;
    }

    // Choix QCM / Vrai-Faux : "A) ...", "a. ...", "- [ ] ...", "- [x] ..."
    const choiceMatch = line.match(/^(?:[A-Da-d][\.\)]|\-\s*\[([ xX])\]|\-\s*\([ xX]?\))\s*(.+)/);
    if (choiceMatch) {
      const isChecked = choiceMatch[1] && choiceMatch[1].trim().toLowerCase() === "x";
      const optText = choiceMatch[2].trim();
      currentQ.options.push(optText);
      if (isChecked) {
        currentQ.correct.push(optText);
      }
      continue;
    }

    // Détection de bonne réponse explicite : "Réponse : B", "Bonne réponse : Vrai"
    const ansMatch = line.match(/^(?:bonne\s+)?r[eé]ponse(?:\s+attendue)?\s*[:=]\s*(.+)/i);
    if (ansMatch) {
      const ansVal = ansMatch[1].trim();
      // Si la réponse est une lettre A, B, C, D et qu'on a des options
      const letterMatch = ansVal.match(/^([A-D])(?:\s*[\.\:\)]|$)/i);
      if (letterMatch && currentQ.options.length > 0) {
        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
        if (currentQ.options[idx]) {
          currentQ.correct.push(currentQ.options[idx]);
        } else {
          currentQ.correct.push(ansVal);
        }
      } else if (ansVal.includes(",") || ansVal.includes(";")) {
        // Choix multiples: "A, C"
        const letters = ansVal.split(/[,;]/).map((s) => s.trim().toUpperCase());
        letters.forEach((l) => {
          const idx = l.charCodeAt(0) - 65;
          if (currentQ!.options[idx]) {
            currentQ!.correct.push(currentQ!.options[idx]);
          } else {
            currentQ!.correct.push(l);
          }
        });
      } else {
        currentQ.correct.push(ansVal);
      }
      continue;
    }

    // Explication : "Explication : ..."
    const expMatch = line.match(/^(?:explication|justification|note)\s*[:=]\s*(.+)/i);
    if (expMatch) {
      currentQ.explanation = expMatch[1].trim();
      continue;
    }

    // Valeur numérique : "Valeur numérique : 42"
    const numMatch = line.match(/^(?:valeur\s+num[eé]rique|r[eé]sultat)\s*[:=]\s*(\-?\d+(?:[.,]\d+)?)/i);
    if (numMatch) {
      currentQ.numericValue = parseFloat(numMatch[1].replace(",", "."));
      currentQ.type = "numerique";
      continue;
    }

    // Ligne complémentaire sur l'intitulé de la question en cours
    if (line && !currentQ.options.length && !currentQ.correct.length) {
      currentQ.title += " " + line;
    }
  }

  if (currentQ) {
    rawQuestions.push(currentQ);
  }

  // Normalisation des types de questions
  const questions: AssessmentQuestion[] = rawQuestions.map((q, idx) => {
    let type: QuestionType = "courte";
    const lowerTitle = q.title.toLowerCase();

    if (q.numericValue !== undefined || lowerTitle.startsWith("calculer") || lowerTitle.includes("combien")) {
      type = "numerique";
    } else if (q.options.length === 2 && (
      (q.options[0].toLowerCase().includes("vrai") && q.options[1].toLowerCase().includes("faux")) ||
      (q.options[1].toLowerCase().includes("vrai") && q.options[0].toLowerCase().includes("faux"))
    )) {
      type = "vf";
    } else if (q.options.length > 0) {
      type = q.correct.length > 1 ? "qcm_multiple" : "qcm";
    } else if (lowerTitle.includes("expliquez") || lowerTitle.includes("décrivez") || lowerTitle.includes("développez") || lowerTitle.length > 120) {
      type = "longue";
    }

    // Assurer que Vrai/Faux a des options standard
    const options = type === "vf"
      ? ["Vrai", "Faux"]
      : q.options;

    return {
      id: `MQ-${idx + 1}-${Date.now().toString(36)}`,
      question: q.title,
      type,
      options,
      choices: options.map((opt, optIdx) => ({
        id: `c-${optIdx + 1}`,
        texte: opt,
        estCorrecte: q.correct.includes(opt),
      })),
      bonneReponse: q.correct[0] || (type === "vf" ? "Vrai" : ""),
      bonnesReponses: q.correct,
      valeurNumerique: q.numericValue,
      points: q.points || 1,
      explication: q.explanation || "",
      ordre: idx + 1,
      obligatoire: true,
    };
  });

  return {
    titre,
    description,
    consignes,
    duree,
    bareme: bareme || Math.max(20, questions.reduce((acc, q) => acc + q.points, 0)),
    questions,
    rawText: mdContent,
  };
}
