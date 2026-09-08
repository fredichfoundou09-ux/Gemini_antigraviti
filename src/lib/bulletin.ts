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
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:18px">
        <div>
          <h1 style="color:#0f172a;letter-spacing:2px;font-size:18px;font-weight:900;margin:0">SENTINELLES NUMÉRIQUES</h1>
          <p style="color:#475569;font-size:11.5px;margin:3px 0 0;font-weight:600">Centre de Formation — Génie Informatique & Génie Industriel (ENIA 2.0)</p>
        </div>
        <div style="text-align:right">
          <p style="color:#0f172a;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin:0">Bulletin Officiel de Notes</p>
          <p style="color:#334155;font-size:12px;font-weight:700;margin:2px 0 0">${periodeStr}</p>
        </div>
      </div>

      <!-- Infos apprenant -->
      <div style="background:#f8fafc;border:1.5px solid #0f172a;border-radius:6px;padding:14px 18px;margin-bottom:18px">
        <div class="grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div><p class="label">Apprenant</p><p style="font-weight:800;font-size:15px;color:#0f172a;margin:0">${student.prenom} ${student.nom}</p></div>
          <div><p class="label">N° Matricule</p><p class="font-mono" style="font-weight:700;color:#0f172a;margin:0">${student.id}</p></div>
          <div><p class="label">Filière d'Excellence</p><p style="font-weight:700;color:#0f172a;margin:0">${student.formation === "informatique" ? "Génie Informatique" : "Génie Industriel"}</p></div>
        </div>
      </div>

      <!-- Notes -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #0f172a">
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#0f172a">Module</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#0f172a">Note / 20</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#0f172a">Mention</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:#0f172a">Appréciation</th>
          </tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='4' style='padding:16px;text-align:center;color:#64748b'>Aucune note enregistrée</td></tr>"}</tbody>
        <tfoot>
          <tr style="background:#f8fafc;font-weight:bold;border-top:2px solid #0f172a">
            <td style="padding:10px 12px;font-size:13px;color:#0f172a">Moyenne générale</td>
            <td style="padding:10px 12px;text-align:center;font-size:16px;font-weight:900;color:#0f172a">${average} / 20</td>
            <td></td>
            <td style="padding:10px 12px;font-size:13px;font-weight:800;color:#0f172a">${decision}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Présences -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
        <div style="border:1.5px solid #0f172a;border-radius:6px;padding:10px;text-align:center;background:#fff">
          <p class="label">Séances Assistées</p><p style="font-size:20px;font-weight:900;color:#0f172a;margin:4px 0 0">${present}</p>
        </div>
        <div style="border:1.5px solid #0f172a;border-radius:6px;padding:10px;text-align:center;background:#fff">
          <p class="label">Absences</p><p style="font-size:20px;font-weight:900;color:#0f172a;margin:4px 0 0">${absent}</p>
        </div>
        <div style="border:1.5px solid #0f172a;border-radius:6px;padding:10px;text-align:center;background:#fff">
          <p class="label">Retards</p><p style="font-size:20px;font-weight:900;color:#0f172a;margin:4px 0 0">${retards}</p>
        </div>
      </div>

      <!-- Finance résumé -->
      <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:20px;background:#f8fafc">
        <div class="row" style="border-bottom:1px solid #e2e8f0;padding:6px 0"><span>Frais totaux de scolarité</span><span style="font-weight:700">${money(invoice)}</span></div>
        <div class="row" style="border-bottom:1px solid #e2e8f0;padding:6px 0"><span>Total versé à ce jour</span><span style="font-weight:800">${money(paid)}</span></div>
        <div class="row" style="padding:6px 0;font-weight:800"><span>Reste à payer</span><span>${money(Math.max(0, invoice - paid))}</span></div>
      </div>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;margin-top:28px;padding-top:14px;border-top:1.5px solid #0f172a">
        <div style="text-align:center;width:220px">
          <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 45px 0">Direction Pédagogique</p>
          <div style="border-top:1px solid #0f172a;padding-top:4px;font-size:10px;color:#64748b">Visa & Cachet</div>
        </div>
        <div style="text-align:center;width:220px">
          <p style="font-size:11px;font-weight:700;color:#0f172a;margin:0 0 45px 0">Direction Administrative</p>
          <div style="border-top:1px solid #0f172a;padding-top:4px;font-size:10px;color:#64748b">Signature Officielle</div>
        </div>
      </div>
      <p style="text-align:center;margin-top:20px;color:#64748b;font-size:10px">Document officiel généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — SENTINELLES NUMÉRIQUES</p>
    </div>
  `);
}
