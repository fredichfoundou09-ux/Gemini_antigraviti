import { Assessment, AssessmentQuestion, QuestionType } from "@/modules/assessments/types";

/**
 * Normalise des questions brutes provenant de l'IA (textes, listes, qcm) en structure AssessmentQuestion
 */
export function normalizeAiQuestions(rawQuestions: any[]): AssessmentQuestion[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return [
      {
        id: "q-1",
        question: "Expliquez les concepts clés abordés dans cette séance.",
        type: "longue",
        points: 10,
        ordre: 1,
      },
      {
        id: "q-2",
        question: "Donnez un exemple pratique de mise en application.",
        type: "courte",
        points: 10,
        ordre: 2,
      },
    ];
  }

  return rawQuestions.map((q, idx) => {
    if (typeof q === "string") {
      return {
        id: `q-${idx + 1}`,
        question: q,
        type: "courte" as QuestionType,
        points: 5,
        ordre: idx + 1,
      };
    }

    const type: QuestionType = (q.type as QuestionType) || (q.options ? "qcm" : "courte");
    return {
      id: q.id || `q-${idx + 1}`,
      question: q.question || q.enonce || q.title || `Question ${idx + 1}`,
      type,
      options: Array.isArray(q.options) ? q.options : undefined,
      bonneReponse: q.bonneReponse || q.correctAnswer || undefined,
      bonnesReponses: Array.isArray(q.bonnesReponses) ? q.bonnesReponses : undefined,
      explication: q.explication || q.explanation || undefined,
      points: Number(q.points || 5),
      ordre: idx + 1,
    };
  });
}

/**
 * Construit un objet Assessment à partir d'arguments d'action ou de résultat IA
 */
export function buildAssessmentFromAi(data: any): Assessment {
  const titre = data?.titre || data?.title || "Évaluation SENTINEL'S ACADEMY";
  const moduleId = data?.moduleId || data?.cours_id || "general";
  const teacherId = data?.teacherId || "sentinel-ai";
  const rawQuestions = data?.questions || data?.items || [];

  return {
    id: data?.id || `ai-eval-${Date.now()}`,
    titre,
    description: data?.description || data?.instructions || "Évaluation générée avec l'assistance de SENTINEL'S AI.",
    moduleId,
    teacherId,
    questions: normalizeAiQuestions(rawQuestions),
    date: new Date().toISOString().split("T")[0],
    duree: Number(data?.duree || data?.dureeMinutes || 60),
    bareme: Number(data?.bareme || data?.totalPoints || 20),
    seuilReussite: 10,
    difficulte: "moyen",
    tentatives: 1,
    afficherCorrections: false,
    validationRequise: false,
    modeSecurise: false,
    bloquerCopierColler: false,
    bloquerClicDroit: false,
    navigationLibre: true,
    statut: "publie",
    audience: "formation",
  };
}

/**
 * Déclenche le téléchargement du fichier DOCX généré
 */
export async function exportEvaluationToDocx(
  data: any,
  options: { includeSolutions?: boolean; moduleName?: string; teacherName?: string } = {}
): Promise<void> {
  const assessment = buildAssessmentFromAi(data);
  const { generateAssessmentDocx } = await import("@/modules/assessments/exporters/docxExport");
  const blob = await generateAssessmentDocx(assessment, {
    includeSolutions: options.includeSolutions ?? false,
    moduleName: options.moduleName || assessment.moduleId,
    teacherName: options.teacherName || "SENTINEL'S ACADEMY",
  });

  const sanitizedTitle = (assessment.titre || "evaluation")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const filename = `${sanitizedTitle}_${options.includeSolutions ? "corrige" : "epreuve"}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Déclenche le téléchargement du fichier PDF officiel généré
 */
export async function exportEvaluationToPdf(
  data: any,
  options: { includeSolutions?: boolean; moduleName?: string; teacherName?: string } = {}
): Promise<void> {
  const assessment = buildAssessmentFromAi(data);
  const { generateAssessmentPdf } = await import("@/modules/assessments/exporters/pdfExport");
  const pdfDoc = generateAssessmentPdf(assessment, {
    includeSolutions: options.includeSolutions ?? false,
    moduleName: options.moduleName || assessment.moduleId,
    teacherName: options.teacherName || "SENTINEL'S ACADEMY",
  });

  const sanitizedTitle = (assessment.titre || "evaluation")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  const filename = `${sanitizedTitle}_${options.includeSolutions ? "corrige" : "epreuve"}.pdf`;

  pdfDoc.save(filename);
}

