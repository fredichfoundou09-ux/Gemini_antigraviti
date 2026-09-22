import { jsPDF } from "jspdf";
import { Assessment } from "../types";

export interface PdfExportOptions {
  includeSolutions: boolean;
  moduleName?: string;
  teacherName?: string;
}

export function generateAssessmentPdf(
  assessment: Assessment,
  options: PdfExportOptions
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const isTeacherVersion = options.includeSolutions;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      renderPageHeader();
    }
  };

  const renderPageHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(14, 165, 233); // Cyan SENTINEL'S
    doc.text("SENTINEL’S ACADEMY", margin, cursorY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Système d'évaluation des Sentinelles Numériques", margin, cursorY + 4);

    const versionText = isTeacherVersion ? "CORRIGÉ / PROFESSEUR" : "ÉPREUVE / ÉTUDIANT";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (isTeacherVersion) {
      doc.setTextColor(239, 68, 68); // Rouge
    } else {
      doc.setTextColor(16, 185, 129); // Vert
    }
    doc.text(versionText, pageWidth - margin, cursorY + 2, { align: "right" });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY + 7, pageWidth - margin, cursorY + 7);
    cursorY += 12;
  };

  // Header 1ère page
  renderPageHeader();

  // Titre épreuve
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  const titleLines = doc.splitTextToSize(assessment.titre, contentWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += titleLines.length * 7 + 2;

  // Boîte métadonnées
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cursorY, contentWidth, 22, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text(`Module : ${options.moduleName || assessment.moduleId || "Général"}`, margin + 4, cursorY + 6);
  doc.text(`Formateur : ${options.teacherName || "—"}`, margin + 4, cursorY + 12);
  doc.text(`Durée : ${assessment.duree} minutes`, margin + 4, cursorY + 18);

  const col2X = margin + contentWidth / 2;
  doc.text(`Nombre de questions : ${assessment.questions.length}`, col2X, cursorY + 6);
  doc.text(`Barème total : /${assessment.bareme} pts (Seuil : ${assessment.seuilReussite} pts)`, col2X, cursorY + 12);
  doc.text(`Date : ${assessment.date || new Date().toISOString().slice(0, 10)}`, col2X, cursorY + 18);

  cursorY += 28;

  // Consignes
  if (assessment.consignes) {
    checkPageBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Consignes générales :", margin, cursorY);
    cursorY += 5;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const consigneLines = doc.splitTextToSize(assessment.consignes, contentWidth);
    doc.text(consigneLines, margin, cursorY);
    cursorY += consigneLines.length * 4.5 + 4;
  }

  // Cartouche étudiant
  if (!isTeacherVersion) {
    checkPageBreak(16);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, cursorY, contentWidth, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Nom : __________________________________", margin + 4, cursorY + 7);
    doc.text("Prénom : __________________________________", margin + contentWidth / 2, cursorY + 7);
    cursorY += 18;
  }

  // Section Questions
  checkPageBreak(15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("ÉPREUVE", margin, cursorY);
  cursorY += 6;

  assessment.questions.forEach((q, qIdx) => {
    checkPageBreak(25);

    // Titre de la question
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    const qHeader = `${qIdx + 1}. ${q.question} (${q.points} pt${q.points > 1 ? "s" : ""})`;
    const qLines = doc.splitTextToSize(qHeader, contentWidth);
    doc.text(qLines, margin, cursorY);
    cursorY += qLines.length * 4.5 + 2;

    // Options QCM / VF
    if (q.type === "qcm" || q.type === "qcm_multiple" || q.type === "vf") {
      const opts = q.options && q.options.length > 0 ? q.options : q.type === "vf" ? ["Vrai", "Faux"] : [];
      opts.forEach((opt, oIdx) => {
        checkPageBreak(6);
        const letter = String.fromCharCode(65 + oIdx);
        const isGood = isTeacherVersion && (
          opt === q.bonneReponse ||
          (q.bonnesReponses && q.bonnesReponses.includes(opt))
        );

        doc.setFont("helvetica", isGood ? "bold" : "normal");
        doc.setFontSize(8.5);
        if (isGood) {
          doc.setTextColor(16, 185, 129);
        } else {
          doc.setTextColor(71, 85, 105);
        }

        const optText = `[  ] ${letter}) ${opt}${isGood ? "  ✓ [BONNE RÉPONSE]" : ""}`;
        doc.text(optText, margin + 4, cursorY);
        cursorY += 5;
      });
    } else if (q.type === "courte") {
      checkPageBreak(10);
      if (isTeacherVersion) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(16, 185, 129);
        doc.text(`Réponse attendue : ${q.bonneReponse || "—"}`, margin + 4, cursorY);
        cursorY += 5;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Réponse : ____________________________________________________________________", margin + 4, cursorY);
        cursorY += 6;
      }
    } else if (q.type === "longue") {
      checkPageBreak(18);
      if (isTeacherVersion) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(16, 185, 129);
        doc.text("Critères de notation / réponse type :", margin + 4, cursorY);
        cursorY += 4.5;
        doc.setFont("helvetica", "italic");
        doc.setTextColor(71, 85, 105);
        const expLines = doc.splitTextToSize(q.explication || q.bonneReponse || "Évaluation selon les notions clés du cours.", contentWidth - 8);
        doc.text(expLines, margin + 4, cursorY);
        cursorY += expLines.length * 4 + 3;
      } else {
        doc.setDrawColor(226, 232, 240);
        doc.rect(margin + 4, cursorY, contentWidth - 8, 16);
        cursorY += 19;
      }
    } else if (q.type === "numerique") {
      checkPageBreak(10);
      if (isTeacherVersion) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(16, 185, 129);
        doc.text(`Valeur attendue : ${q.valeurNumerique ?? q.bonneReponse} (tolérance ±${q.toleranceNumerique || 0})`, margin + 4, cursorY);
        cursorY += 5;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Valeur numérique : ________________________", margin + 4, cursorY);
        cursorY += 6;
      }
    }

    if (isTeacherVersion && q.explication) {
      checkPageBreak(8);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(59, 130, 246);
      doc.text(`Explication : ${q.explication}`, margin + 4, cursorY);
      cursorY += 5;
    }

    cursorY += 3;
  });

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
