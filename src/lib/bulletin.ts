/**
 * Génération de bulletins de notes en HTML imprimable.
 * Utilise la même infrastructure que les reçus de paiement existants.
 */
import type { DB } from "./types";
import { printHTML, money } from "./ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function generateBulletin(db: DB, studentId: string, periode?: string) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return;

  const grades = db.grades.filter((g) => g.studentId === studentId);
  const modules = db.modules.filter((m) => student.modules.includes(m.id));
  const average = grades.length
    ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(2)
    : "—";

  const periodeStr = periode || format(new Date(), "'Période du' d MMMM yyyy", { locale: fr });

  const rows = modules.map((mod) => {
    const grade = grades.find((g) => g.moduleId === mod.id);
    const note = grade ? `${grade.note}/20` : "—";
    const appr = grade?.appreciation || "—";
    const mention = grade ? (grade.note >= 16 ? "TB" : grade.note >= 14 ? "B" : grade.note >= 12 ? "AB" : grade.note >= 10 ? "P" : "I") : "—";
    return `<tr style="border-bottom:1px solid #1d2b45">
      <td style="padding:8px 4px;font-size:13px">${mod.numero}. ${mod.titre}</td>
      <td style="padding:8px;text-align:center;font-weight:bold;font-size:14px;color:${grade && grade.note >= 10 ? "#00FF88" : "#FF174F"}">${note}</td>
      <td style="padding:8px;text-align:center;font-size:12px;color:#FFB300">${mention}</td>
      <td style="padding:8px;font-size:12px;color:#8A94A6">${appr}</td>
    </tr>`;
  }).join("");

  const attestations = db.attendance.filter((a) => a.studentId === studentId);
  const present = attestations.filter((a) => a.statut === "present").length;
  const absent = attestations.filter((a) => a.statut === "absent").length;
  const retards = attestations.filter((a) => a.statut === "retard").length;

  const decision = parseFloat(average) >= 10
    ? "ADMIS(E)"
    : average === "—" ? "EN COURS" : "AJOURNÉ(E)";
  const decisionColor = parseFloat(average) >= 10 ? "#00FF88" : "#FF174F";

  const invoice = db.invoices.filter((i) => i.studentId === studentId).reduce((a, i) => a + i.montant, 0);
  const paid = db.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.montant, 0);

  printHTML(`Bulletin — ${student.prenom} ${student.nom}`, `
    <div style="max-width:800px;margin:0 auto;padding:20px">
      <!-- En-tête -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #00E5FF;padding-bottom:16px;margin-bottom:20px">
        <div>
          <h1 style="color:#00E5FF;letter-spacing:3px;font-size:18px;margin:0">SENTINELLES NUMÉRIQUES</h1>
          <p style="color:#8A94A6;font-size:12px;margin:4px 0">Centre de Formation — Génie Informatique & Génie Industriel</p>
        </div>
        <div style="text-align:right">
          <p style="color:#8A94A6;font-size:11px;text-transform:uppercase;letter-spacing:2px">Bulletin de notes</p>
          <p style="color:#F5F7FA;font-size:12px;font-weight:bold">${periodeStr}</p>
        </div>
      </div>

      <!-- Infos apprenant -->
      <div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:16px;margin-bottom:20px">
        <div class="grid" style="display:grid;grid-template-columns:1fr 1fr 1fr">
          <div><p class="label">Apprenant</p><p style="font-weight:800;font-size:16px">${student.prenom} ${student.nom}</p></div>
          <div><p class="label">N° Apprenant</p><p class="font-mono">${student.id}</p></div>
          <div><p class="label">Formation</p><p style="font-weight:700;color:#00E5FF">${student.formation === "informatique" ? "Génie Informatique" : "Génie Industriel"}</p></div>
        </div>
      </div>

      <!-- Notes -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:rgba(0,229,255,0.08)">
            <th style="padding:10px 4px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A94A6">Module</th>
            <th style="padding:10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A94A6">Note</th>
            <th style="padding:10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A94A6">Mention</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8A94A6">Appréciation</th>
          </tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='4' style='padding:20px;text-align:center;color:#8A94A6'>Aucune note enregistrée</td></tr>"}</tbody>
        <tfoot>
          <tr style="background:rgba(0,229,255,0.1);font-weight:bold">
            <td style="padding:10px 4px;font-size:14px">Moyenne générale</td>
            <td style="padding:10px;text-align:center;font-size:18px;color:${parseFloat(average) >= 10 ? "#00FF88" : "#FF174F"}">${average}</td>
            <td></td>
            <td style="padding:10px;font-size:14px;color:${decisionColor}">${decision}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Présences -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="border:1px solid #1d2b45;border-radius:8px;padding:12px;text-align:center">
          <p class="label">Présences</p><p style="font-size:24px;font-weight:800;color:#00FF88">${present}</p>
        </div>
        <div style="border:1px solid #1d2b45;border-radius:8px;padding:12px;text-align:center">
          <p class="label">Absences</p><p style="font-size:24px;font-weight:800;color:#FF174F">${absent}</p>
        </div>
        <div style="border:1px solid #1d2b45;border-radius:8px;padding:12px;text-align:center">
          <p class="label">Retards</p><p style="font-size:24px;font-weight:800;color:#FFB300">${retards}</p>
        </div>
      </div>

      <!-- Finance résumé -->
      <div class="row"><span>Montant dû</span><span>${money(invoice)}</span></div>
      <div class="row"><span>Montant payé</span><span class="green">${money(paid)}</span></div>
      <div class="row"><span>Solde</span><span style="color:${invoice - paid > 0 ? "#FF174F" : "#00FF88"}">${money(Math.max(0, invoice - paid))}</span></div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:32px;padding-top:16px;border-top:1px solid #1d2b45">
        <div style="text-align:center"><p style="border-top:1px solid #00E5FF;padding-top:6px;font-size:11px;color:#8A94A6">Responsable du Centre</p></div>
        <div style="text-align:center"><p style="border-top:1px solid #00E5FF;padding-top:6px;font-size:11px;color:#8A94A6">Signature et cachet</p></div>
      </div>
      <p style="text-align:center;margin-top:16px;color:#8A94A6;font-size:11px">Bulletin généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — SENTINELLES NUMÉRIQUES</p>
    </div>
  `);
}
