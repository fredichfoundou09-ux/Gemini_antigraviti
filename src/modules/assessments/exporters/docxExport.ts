import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from "docx";
import { Assessment } from "../types";

export interface DocxExportOptions {
  includeSolutions: boolean;
  moduleName?: string;
  teacherName?: string;
}

export async function generateAssessmentDocx(
  assessment: Assessment,
  options: DocxExportOptions
): Promise<Blob> {
  const isTeacherVersion = options.includeSolutions;
  const docTitle = assessment.titre;
  const versionLabel = isTeacherVersion
    ? "VERSION CORRIGÉE — ENSEIGNANT"
    : "DOCUMENT ÉPREUVE — APPRENANT";

  const children: (Paragraph | Table)[] = [];

  // En-tête officiel SENTINEL'S
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "SENTINEL’S ACADEMY",
          bold: true,
          size: 32,
          color: "0052CC",
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "PLATEFORME DES SENTINELLES NUMÉRIQUES",
          size: 18,
          color: "666666",
          font: "Arial",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: versionLabel,
          bold: true,
          size: 20,
          color: isTeacherVersion ? "D9381E" : "0F9D58",
          font: "Arial",
        }),
      ],
    })
  );

  // Tableau récapitulatif des métadonnées
  const metaRows = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Évaluation : ", bold: true }),
                new TextRun({ text: docTitle }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Module : ", bold: true }),
                new TextRun({ text: options.moduleName || assessment.moduleId || "—" }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Durée : ", bold: true }),
                new TextRun({ text: `${assessment.duree} minutes` }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Barème total : ", bold: true }),
                new TextRun({ text: `/${assessment.bareme} pts (Seuil : ${assessment.seuilReussite} pts)` }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Formateur : ", bold: true }),
                new TextRun({ text: options.teacherName || "—" }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows,
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] })
  );

  // Consignes
  if (assessment.consignes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 150, after: 100 },
        children: [new TextRun({ text: "Consignes générales", bold: true, size: 22 })],
      }),
      new Paragraph({
        spacing: { after: 250 },
        children: [new TextRun({ text: assessment.consignes, italics: true, color: "333333" })],
      })
    );
  }

  // Si version étudiant : cartouche nom et prénom
  if (!isTeacherVersion) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: "Nom de l'apprenant : ___________________" })] })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: "Prénom : ___________________" })] })],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 300 }, children: [] })
    );
  }

  // Questions
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 150 },
      children: [new TextRun({ text: `Questions (${assessment.questions.length})`, bold: true, size: 24 })],
    })
  );

  assessment.questions.forEach((q, index) => {
    // Intitulé
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `${index + 1}. ${q.question} `,
            bold: true,
            size: 20,
          }),
          new TextRun({
            text: `[${q.points} pt${q.points > 1 ? "s" : ""}]`,
            italics: true,
            color: "666666",
            size: 18,
          }),
        ],
      })
    );

    // Options QCM / VF
    if (q.type === "qcm" || q.type === "qcm_multiple" || q.type === "vf") {
      const opts = q.options && q.options.length > 0 ? q.options : q.type === "vf" ? ["Vrai", "Faux"] : [];
      opts.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        const isCorrect = isTeacherVersion && (
          opt === q.bonneReponse ||
          (q.bonnesReponses && q.bonnesReponses.includes(opt))
        );

        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 50 },
            children: [
              new TextRun({
                text: `${letter}) [  ] ${opt} `,
                bold: isCorrect,
                color: isCorrect ? "0F9D58" : "222222",
              }),
              ...(isCorrect ? [new TextRun({ text: "  ← (Bonne réponse)", bold: true, color: "0F9D58" })] : []),
            ],
          })
        );
      });
    } else if (q.type === "courte") {
      if (isTeacherVersion) {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Réponse attendue : ", bold: true, color: "0F9D58" }),
              new TextRun({ text: q.bonneReponse || "—", color: "0F9D58" }),
            ],
          })
        );
      } else {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 150 },
            children: [new TextRun({ text: "Réponse : ____________________________________________________" })],
          })
        );
      }
    } else if (q.type === "longue") {
      if (isTeacherVersion) {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Éléments de correction attendus : ", bold: true, color: "0F9D58" }),
              new TextRun({ text: q.explication || q.bonneReponse || "Évaluation selon les critères définis.", color: "0F9D58" }),
            ],
          })
        );
      } else {
        // Lignes vides pour la rédaction
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "........................................................................................................................................................................\n........................................................................................................................................................................\n........................................................................................................................................................................",
                color: "999999",
              }),
            ],
          })
        );
      }
    } else if (q.type === "numerique") {
      if (isTeacherVersion) {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Valeur numérique exacte : ", bold: true, color: "0F9D58" }),
              new TextRun({ text: `${q.valeurNumerique ?? q.bonneReponse}`, color: "0F9D58" }),
              ...(q.toleranceNumerique ? [new TextRun({ text: ` (tolérance ±${q.toleranceNumerique})`, italics: true })] : []),
            ],
          })
        );
      } else {
        children.push(
          new Paragraph({
            indent: { left: 400 },
            spacing: { after: 100 },
            children: [new TextRun({ text: "Valeur calculée : ________________________" })],
          })
        );
      }
    }

    // Explication pédagogique pour la version corrigée
    if (isTeacherVersion && q.explication) {
      children.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { after: 120 },
          children: [
            new TextRun({ text: "Explication : ", bold: true, color: "0052CC" }),
            new TextRun({ text: q.explication, italics: true, color: "444444" }),
          ],
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
