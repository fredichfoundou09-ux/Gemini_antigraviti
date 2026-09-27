/**
 * Génération de bulletins de notes académiques officiels en format imprimable.
 * Conforme aux standards d'impression sobres et rigoureux :
 * - Structure rectangulaire nette avec cadres et séparations au trait noir
 * - Typographie unique (sans-serif sobre et lisible)
 * - Aucune surcharge : aucun emoji, aucun tiret décoratif
 * - Format calibré pour tenir rigoureusement sur une page unique A4
 */
import type { DB } from "./types";
import { printHTML } from "./ui";

export function generateBulletin(db: DB, studentId: string, periode?: string, academicYearLabel?: string) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return;

  const currentYear = academicYearLabel ||
    (student.academicYearId ? db.academicYears?.find((y) => y.id === student.academicYearId)?.label : undefined) ||
    db.academicYears?.find((y) => y.isDefault)?.label ||
    "2025-2026";

  const grades = db.grades.filter((g) => g.studentId === studentId);
  const modules = db.modules.filter((m) => student.modules.includes(m.id));

  const average = grades.length
    ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(2)
    : "Non calculée";

  const rows = modules.map((mod) => {
    const grade = grades.find((g) => g.moduleId === mod.id);
    const note = grade ? `${grade.note.toFixed(1)} / 20` : "Non noté";
    const appr = grade?.appreciation && grade.appreciation !== "—" ? grade.appreciation : "Non renseignée";
    const mention = grade
      ? grade.note >= 16
        ? "Très Bien"
        : grade.note >= 14
        ? "Bien"
        : grade.note >= 12
        ? "Assez Bien"
        : grade.note >= 10
        ? "Passable"
        : "Insuffisant"
      : "En attente";

    return `<tr style="border-bottom:1px solid #000000">
      <td style="padding:6px 8px;font-size:11px;font-weight:600;border-right:1px solid #000000">${mod.numero}. ${mod.titre}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid #000000">${note}</td>
      <td style="padding:6px 8px;text-align:center;font-size:11px;border-right:1px solid #000000">${mention}</td>
      <td style="padding:6px 8px;font-size:10.5px">${appr}</td>
    </tr>`;
  }).join("");

  const attestations = db.attendance.filter((a) => a.studentId === studentId);
  const present = attestations.filter((a) => a.statut === "present").length;
  const absent = attestations.filter((a) => a.statut === "absent").length;
  const retards = attestations.filter((a) => a.statut === "retard").length;
  const totalSessions = present + absent + retards;
  const tauxPresence = totalSessions > 0 ? `${Math.round((present / totalSessions) * 100)} %` : "100 %";

  const numAvg = parseFloat(average);
  const decision = !isNaN(numAvg)
    ? numAvg >= 10
      ? "ADMIS"
      : "AJOURNÉ"
    : "SESSION EN COURS";

  const filiereLabel = student.formation === "informatique" ? "Génie Informatique" : "Génie Industriel";
  const periodeMention = periode ? `<div style="font-size:11px;font-weight:600;margin-top:2px">${periode}</div>` : "";

  printHTML(`Bulletin Officiel — ${student.prenom} ${student.nom}`, `
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
        color: #000000 !important;
        background: #ffffff !important;
        line-height: 1.35;
        margin: 0;
        padding: 0;
      }
      * {
        box-sizing: border-box;
      }
      .bulletin-container {
        max-width: 100%;
        margin: 0 auto;
        padding: 4px;
        page-break-inside: avoid;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
    </style>

    <div class="bulletin-container">
      <!-- En-tête Institutionnel -->
      <table style="width:100%;border-bottom:2px solid #000000;padding-bottom:8px;margin-bottom:12px">
        <tr>
          <td style="vertical-align:top;border:none;padding:0">
            <div style="font-size:15px;font-weight:900;letter-spacing:1px;text-transform:uppercase">SENTINELLES NUMÉRIQUES</div>
            <div style="font-size:11px;font-weight:600;color:#333333">Centre d'Enseignement Supérieur et de Formation Professionnelle</div>
            <div style="font-size:10px;color:#555555">Programme National d'Excellence ENIA 2.0</div>
          </td>
          <td style="vertical-align:top;text-align:right;border:none;padding:0">
            <div style="font-size:13px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase">BULLETIN OFFICIEL DE NOTES</div>
            <div style="font-size:10.5px;font-weight:700;color:#000000;margin-top:2px">ANNÉE ACADÉMIQUE ${currentYear}</div>
            ${periodeMention}
          </td>
        </tr>
      </table>

      <!-- Cadre d'identification stricte de l'apprenant -->
      <table style="width:100%;border:1px solid #000000;margin-bottom:12px;background:#ffffff">
        <tr>
          <td style="width:40%;padding:6px 10px;border-right:1px solid #000000;border-bottom:1px solid #000000">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Nom et Prénom</div>
            <div style="font-size:13px;font-weight:800">${student.nom.toUpperCase()} ${student.prenom}</div>
          </td>
          <td style="width:30%;padding:6px 10px;border-right:1px solid #000000;border-bottom:1px solid #000000">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Numéro Matricule</div>
            <div style="font-size:12px;font-weight:700;font-family:monospace">${student.id}</div>
          </td>
          <td style="width:30%;padding:6px 10px;border-bottom:1px solid #000000">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Filière d'Études</div>
            <div style="font-size:12px;font-weight:700">${filiereLabel}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border-right:1px solid #000000">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Statut de l'étudiant</div>
            <div style="font-size:11px;font-weight:700">Inscrit régulier</div>
          </td>
          <td style="padding:6px 10px;border-right:1px solid #000000">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Taux d'assiduité global</div>
            <div style="font-size:11px;font-weight:700">${tauxPresence} (${present} séances suivies)</div>
          </td>
          <td style="padding:6px 10px">
            <div style="font-size:9.5px;text-transform:uppercase;color:#555555;font-weight:600">Discipline & Absences</div>
            <div style="font-size:11px;font-weight:700">${absent} absence(s) / ${retards} retard(s)</div>
          </td>
        </tr>
      </table>

      <!-- Tableau détaillé des résultats académiques -->
      <table style="width:100%;border:1px solid #000000;margin-bottom:12px">
        <thead>
          <tr style="background:#f2f2f2;border-bottom:1px solid #000000">
            <th style="padding:7px 8px;text-align:left;font-size:10.5px;text-transform:uppercase;border-right:1px solid #000000;width:44%">Module d'enseignement</th>
            <th style="padding:7px 8px;text-align:center;font-size:10.5px;text-transform:uppercase;border-right:1px solid #000000;width:16%">Note sur 20</th>
            <th style="padding:7px 8px;text-align:center;font-size:10.5px;text-transform:uppercase;border-right:1px solid #000000;width:16%">Mention</th>
            <th style="padding:7px 8px;text-align:left;font-size:10.5px;text-transform:uppercase;width:24%">Appréciation pédagogique</th>
          </tr>
        </thead>
        <tbody>
          ${rows || "<tr><td colspan='4' style='padding:12px;text-align:center;font-size:11px'>Aucune note enregistrée</td></tr>"}
        </tbody>
        <tfoot>
          <tr style="background:#f9f9f9;border-top:1.5px solid #000000">
            <td style="padding:8px;font-size:12px;font-weight:800;border-right:1px solid #000000">MOYENNE GÉNÉRALE DU SEMESTRE</td>
            <td style="padding:8px;text-align:center;font-size:13px;font-weight:900;border-right:1px solid #000000">${average} / 20</td>
            <td style="padding:8px;text-align:center;font-size:11px;font-weight:800;border-right:1px solid #000000">DÉCISION</td>
            <td style="padding:8px;font-size:12px;font-weight:900">${decision}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Cadre d'assiduité et d'évaluation continue -->
      <table style="width:100%;border:1px solid #000000;margin-bottom:14px">
        <tr>
          <td style="padding:8px 12px;border:none">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;margin-bottom:3px">Observations du Conseil des Enseignants</div>
            <div style="font-size:11px;color:#222222">
              ${
                !isNaN(numAvg) && numAvg >= 14
                  ? "Excellents résultats et grande régularité dans le travail. Félicitations du corps professoral."
                  : !isNaN(numAvg) && numAvg >= 10
                  ? "Résultats satisfaisants. Les compétences requises pour la poursuite du cycle sont validées."
                  : "Résultats insuffisants. Un renforcement dans les matières fondamentales est requis."
              }
            </div>
          </td>
        </tr>
      </table>

      <!-- Cadre de validation et signatures officielles -->
      <table style="width:100%;border:1px solid #000000;margin-top:10px">
        <tr>
          <td style="width:50%;padding:10px 14px;border-right:1px solid #000000;vertical-align:top;height:85px">
            <div style="font-size:10.5px;font-weight:800;text-transform:uppercase">Direction des Études</div>
            <div style="font-size:9.5px;color:#555555;margin-top:2px">Visa pédagogique</div>
          </td>
          <td style="width:50%;padding:10px 14px;vertical-align:top;height:85px">
            <div style="font-size:10.5px;font-weight:800;text-transform:uppercase">Direction de l'Établissement</div>
            <div style="font-size:9.5px;color:#555555;margin-top:2px">Signature et Sceau officiel</div>
          </td>
        </tr>
      </table>
    </div>
  `);
}
