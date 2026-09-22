import * as XLSX from "xlsx";
import { AssessmentQuestion, QuestionType } from "../types";

export interface ColumnMapping {
  questionCol: string;
  typeCol?: string;
  optionsCols: string[];
  reponseCol?: string;
  pointsCol?: string;
  explicationCol?: string;
  numeriqueCol?: string;
}

export interface ParsedExcelResult {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  detectedMapping: ColumnMapping;
  isAmbiguous: boolean;
  questions: AssessmentQuestion[];
}

// Détection intelligente des colonnes selon des motifs usuels
export function detectColumnMapping(headers: string[]): { mapping: ColumnMapping; isAmbiguous: boolean } {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  let questionCol = "";
  let typeCol = "";
  let reponseCol = "";
  let pointsCol = "";
  let explicationCol = "";
  let numeriqueCol = "";
  const optionsCols: string[] = [];

  headers.forEach((h) => {
    const nh = norm(h);

    if (!questionCol && (nh.includes("question") || nh.includes("intitule") || nh.includes("enonce") || nh.includes("libelle") || nh === "q")) {
      questionCol = h;
    } else if (!typeCol && (nh.includes("type") || nh.includes("format") || nh.includes("genre"))) {
      typeCol = h;
    } else if (!reponseCol && (nh.includes("reponse") || nh.includes("correct") || nh.includes("corrige") || nh.includes("solution") || nh === "r")) {
      reponseCol = h;
    } else if (!pointsCol && (nh.includes("point") || nh.includes("bareme") || nh.includes("note") || nh === "pts")) {
      pointsCol = h;
    } else if (!explicationCol && (nh.includes("expli") || nh.includes("justif") || nh.includes("remarque") || nh.includes("feedback"))) {
      explicationCol = h;
    } else if (!numeriqueCol && (nh.includes("valeur") || nh.includes("nombre") || nh.includes("chiffre"))) {
      numeriqueCol = h;
    } else if (
      nh.includes("choix") ||
      nh.includes("option") ||
      nh.includes("rep_") ||
      /^[a-e]$/i.test(nh) ||
      /^choix\s*[a-e1-5]/i.test(nh) ||
      /^option\s*[a-e1-5]/i.test(nh)
    ) {
      optionsCols.push(h);
    }
  });

  const isAmbiguous = !questionCol || (optionsCols.length === 0 && !reponseCol);

  return {
    mapping: {
      questionCol: questionCol || headers[0] || "",
      typeCol: typeCol || undefined,
      optionsCols,
      reponseCol: reponseCol || undefined,
      pointsCol: pointsCol || undefined,
      explicationCol: explicationCol || undefined,
      numeriqueCol: numeriqueCol || undefined,
    },
    isAmbiguous,
  };
}

export function convertRowsToQuestions(rows: Record<string, any>[], mapping: ColumnMapping): AssessmentQuestion[] {
  const norm = (s: string) => String(s || "").trim().toLowerCase();

  return rows.map((row, idx) => {
    const qText = String(row[mapping.questionCol] || `Question ${idx + 1}`).trim();
    const rawType = mapping.typeCol ? norm(row[mapping.typeCol]) : "";
    const rawPoints = mapping.pointsCol ? parseFloat(String(row[mapping.pointsCol]).replace(",", ".")) : 1;
    const points = isNaN(rawPoints) || rawPoints <= 0 ? 1 : rawPoints;
    const explication = mapping.explicationCol ? String(row[mapping.explicationCol] || "").trim() : "";

    // Récupérer les options
    const options: string[] = [];
    mapping.optionsCols.forEach((col) => {
      const val = row[col];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        options.push(String(val).trim());
      }
    });

    const rawReponse = mapping.reponseCol ? String(row[mapping.reponseCol] || "").trim() : "";

    // Déterminer le type
    let type: QuestionType = "qcm";
    if (rawType.includes("vf") || rawType.includes("vrai") || rawType.includes("faux")) {
      type = "vf";
    } else if (rawType.includes("multiple") || rawType.includes("mult")) {
      type = "qcm_multiple";
    } else if (rawType.includes("court") || rawType === "courte") {
      type = "courte";
    } else if (rawType.includes("long") || rawType === "longue" || rawType.includes("ouverte") || rawType.includes("texte")) {
      type = "longue";
    } else if (rawType.includes("num") || rawType.includes("chiffre") || rawType.includes("calcul")) {
      type = "numerique";
    } else if (options.length === 0) {
      if (rawReponse && !isNaN(Number(rawReponse))) {
        type = "numerique";
      } else {
        type = "courte";
      }
    } else if (options.length === 2 && options.some((o) => norm(o) === "vrai") && options.some((o) => norm(o) === "faux")) {
      type = "vf";
    }

    // Bonne réponse
    let bonneReponse = "";
    let bonnesReponses: string[] = [];
    let valeurNumerique: number | undefined;

    if (type === "numerique") {
      const parsedNum = parseFloat(rawReponse.replace(",", "."));
      if (!isNaN(parsedNum)) valeurNumerique = parsedNum;
      bonneReponse = rawReponse;
    } else if (type === "vf") {
      bonneReponse = norm(rawReponse).startsWith("v") ? "Vrai" : "Faux";
    } else if (type === "qcm" || type === "qcm_multiple") {
      // Si la réponse est une lettre A, B, C, D
      const letterIndex = rawReponse.toUpperCase().charCodeAt(0) - 65;
      if (letterIndex >= 0 && letterIndex < options.length && rawReponse.length === 1) {
        bonneReponse = options[letterIndex];
        bonnesReponses = [options[letterIndex]];
      } else if (rawReponse.includes(",") || rawReponse.includes(";")) {
        // Choix multiples
        type = "qcm_multiple";
        const tokens = rawReponse.split(/[,;]/).map((t) => t.trim());
        bonnesReponses = tokens.map((token) => {
          const lIdx = token.toUpperCase().charCodeAt(0) - 65;
          if (lIdx >= 0 && lIdx < options.length && token.length === 1) {
            return options[lIdx];
          }
          return token;
        });
        bonneReponse = bonnesReponses[0] || "";
      } else {
        // Recherche correspondance dans les options
        const match = options.find((o) => norm(o) === norm(rawReponse));
        bonneReponse = match || rawReponse;
        bonnesReponses = [bonneReponse];
      }
    } else {
      bonneReponse = rawReponse;
    }

    const finalOptions = type === "vf" ? ["Vrai", "Faux"] : options;

    return {
      id: `EQ-${idx + 1}-${Date.now().toString(36)}`,
      question: qText,
      type,
      options: finalOptions,
      choices: finalOptions.map((opt, oIdx) => ({
        id: `c-${oIdx + 1}`,
        texte: opt,
        estCorrecte: bonnesReponses.includes(opt) || opt === bonneReponse,
      })),
      bonneReponse,
      bonnesReponses,
      valeurNumerique,
      points,
      explication,
      ordre: idx + 1,
      obligatoire: true,
    };
  });
}

export async function parseExcelAssessment(file: File): Promise<ParsedExcelResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames;
  const selectedSheet = sheetNames[0] || "Feuille 1";
  const worksheet = workbook.Sheets[selectedSheet];

  // Extraction JSON avec en-têtes bruts
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
  if (jsonData.length === 0) {
    return {
      sheetNames,
      selectedSheet,
      headers: [],
      rows: [],
      detectedMapping: { questionCol: "", optionsCols: [] },
      isAmbiguous: true,
      questions: [],
    };
  }

  const headers = Object.keys(jsonData[0]);
  const { mapping, isAmbiguous } = detectColumnMapping(headers);
  const questions = convertRowsToQuestions(jsonData, mapping);

  return {
    sheetNames,
    selectedSheet,
    headers,
    rows: jsonData,
    detectedMapping: mapping,
    isAmbiguous,
    questions,
  };
}
