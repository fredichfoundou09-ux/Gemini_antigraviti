import { jsPDF } from "jspdf";
import { Assessment } from "../types";

export interface PrintableExamOptions {
  schoolName?: string;
  moduleName?: string;
  teacherName?: string;
  academicYear?: string;
  classeOuGroupe?: string;
  includeAnswerLines?: boolean;
}

/**
 * Génère un sujet officiel d'examen A4 prêt à l'impression pour épreuves physiques / manuelles en classe.
 * Comporte un cartouche d'identification étudiant, un cadre officiel de notation et des zones de rédaction réglées.
 */
export function generatePrintableExamSheet(
  assessment: Assessment,
  options: PrintableExamOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      renderMiniHeader();
    }
  };

  const renderMiniHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`SENTINELLES NUMÉRIQUES — ÉPREUVE ÉCRITE : ${assessment.titre.toUpperCase()}`, margin, cursorY);
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, cursorY, { align: "right" });
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
    cursorY += 7;
  };

  // 1. En-tête institutionnel
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("ÉCOLE SUPÉRIEURE DE TECHNOLOGIES — SENTINELLES NUMÉRIQUES", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const sessionInfo = options.academicYear ? `Année Académique ${options.academicYear}` : "Session d'Évaluation Officielle";
  doc.text(`${sessionInfo} • Direction des Études & Scolarité`, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 6;
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.8);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);

  cursorY += 5;

  // 2. Titre de l'épreuve & métadonnées
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, cursorY, contentWidth, 18, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(margin, cursorY, contentWidth, 18, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(2, 132, 199);
  doc.text(assessment.titre, margin + 4, cursorY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const modTxt = options.moduleName ? `Module : ${options.moduleName}` : `Réf : ${assessment.moduleId}`;
  const enseignantTxt = options.teacherName ? ` • Formateur : ${options.teacherName}` : "";
  const groupeTxt = options.classeOuGroupe ? ` • Groupe : ${options.classeOuGroupe}` : "";
  doc.text(`${modTxt}${enseignantTxt}${groupeTxt}`, margin + 4, cursorY + 11);

  doc.setFont("helvetica", "bold");
  doc.text(`Durée : ${assessment.duree} min   •   Barème : ${assessment.bareme} pts   •   Seuil : ${assessment.seuilReussite}/${assessment.bareme}`, margin + 4, cursorY + 15.5);

  cursorY += 22;

  // 3. Cartouche d'Identification & Cadre de Notation (Double volet officiel)
  const boxWidth = (contentWidth - 4) / 2;
  const boxHeight = 28;

  // Volet gauche : identification candidat
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, cursorY, boxWidth, boxHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("IDENTIFICATION DE L'APPRENANT(E)", margin + 3, cursorY + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Nom & Prénom(s) : ..............................................................", margin + 3, cursorY + 10);
  doc.text("Matricule / Identifiant : .....................................................", margin + 3, cursorY + 15.5);
  doc.text("Classe / Groupe : ....................   Date : .........................", margin + 3, cursorY + 21);
  doc.text("Signature du candidat :", margin + 3, cursorY + 26);

  // Volet droit : cadre réservé au correcteur
  const rightX = margin + boxWidth + 4;
  doc.setFillColor(254, 242, 242);
  doc.rect(rightX, cursorY, boxWidth, boxHeight, "F");
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.4);
  doc.rect(rightX, cursorY, boxWidth, boxHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28);
  doc.text("CADRE RÉSERVÉ AU CORRECTEUR / EXAMINATEUR", rightX + 3, cursorY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(220, 38, 38);
  doc.text(`NOTE :  ....... / ${assessment.bareme}`, rightX + 6, cursorY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Appréciation : .................................................................", rightX + 3, cursorY + 20);
  doc.text("Visa / Signature du formateur : ....................................", rightX + 3, cursorY + 25);

  cursorY += boxHeight + 5;

  // 4. Consignes officielles d'examen
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 10, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, cursorY, contentWidth, 10, "S");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const docInfo = assessment.documentsAutorises ? "Documents autorisés : OUI" : "Aucun document autorisé";
  const calcInfo = assessment.calculatriceAutorisee ? " • Calculatrice : AUTORISÉE" : " • Calculatrice : INTERDITE";
  const customConsignes = assessment.consignes ? ` • ${assessment.consignes.slice(0, 75)}` : "";
  doc.text(`Règles de composition : ${docInfo}${calcInfo}${customConsignes}`, margin + 3, cursorY + 6);

  cursorY += 14;

  // 5. Questions du sujet avec zones de rédaction
  assessment.questions.forEach((q, idx) => {
    checkPageBreak(35);

    // Titre de question
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Question ${idx + 1} (${q.points} pt${q.points > 1 ? "s" : ""})`, margin, cursorY);

    cursorY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    const splitText = doc.splitTextToSize(q.question, contentWidth);
    doc.text(splitText, margin, cursorY);
    cursorY += splitText.length * 4.2;

    // Options QCM / VF si existantes
    if (q.type === "qcm" || q.type === "qcm_multiple" || q.type === "vf") {
      const opts = q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []);
      opts.forEach((opt, optIdx) => {
        checkPageBreak(7);
        doc.rect(margin + 4, cursorY - 3, 3.5, 3.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`${String.fromCharCode(65 + optIdx)}.  ${opt}`, margin + 10, cursorY);
        cursorY += 5;
      });
      cursorY += 2;
    } else {
      // Zone réglée de réponse manuscrite
      const linesCount = q.type === "longue" ? 6 : 3;
      checkPageBreak(linesCount * 6 + 4);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      for (let l = 0; l < linesCount; l++) {
        doc.line(margin + 2, cursorY + (l * 6), pageWidth - margin - 2, cursorY + (l * 6));
      }
      cursorY += (linesCount * 6) + 4;
    }

    cursorY += 3;
  });

  return doc;
}

/**
 * Génère la fiche d'émargement et bordereau de notes officiel de la classe pour saisie manuelle.
 */
export function generateClassGradeRoster(
  assessment: Assessment,
  students: Array<{ id: string; nom: string; prenom: string; matricule?: string; groupe?: string }>,
  options: { schoolName?: string; moduleName?: string; academicYear?: string } = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // En-tête
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("FICHE D'ÉMARGEMENT & BORDEREAU DE NOTES D'EXAMEN", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Épreuve : ${assessment.titre}  •  Barème : /${assessment.bareme} pts  •  ${options.moduleName || ""}`, pageWidth / 2, cursorY, { align: "center" });

  cursorY += 8;

  // En-tête du tableau
  const colWidths = [12, 30, 48, 25, 25, 40]; // N°, Matricule, Nom & Prénom, Émargement, Note, Observation
  const colTitles = ["N°", "Matricule", "Nom & Prénom", "Émargement", `Note /${assessment.bareme}`, "Observation"];

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 7, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, cursorY, contentWidth, 7, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  let curX = margin;
  colTitles.forEach((t, i) => {
    doc.text(t, curX + 2, cursorY + 4.5);
    curX += colWidths[i];
  });

  cursorY += 7;

  // Lignes étudiants
  students.forEach((stu, idx) => {
    if (cursorY + 8 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, cursorY, contentWidth, 7.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    let rowX = margin;
    doc.text(String(idx + 1), rowX + 2, cursorY + 5);
    rowX += colWidths[0];
    doc.text(stu.matricule || stu.id.slice(0, 10), rowX + 2, cursorY + 5);
    rowX += colWidths[1];
    doc.text(`${stu.nom.toUpperCase()} ${stu.prenom}`, rowX + 2, cursorY + 5);
    rowX += colWidths[2];
    // Émargement (vide pour signature)
    rowX += colWidths[3];
    // Note (vide pour écriture)
    rowX += colWidths[4];
    // Observation (vide)

    cursorY += 7.5;
  });

  return doc;
}
