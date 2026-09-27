import { Award, BookOpen, Download, Users, Wallet, Printer, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, PageHead, Stat, printHTML, money, today } from "@/lib/ui";
import { exportCsv, exportJsonAsExcel } from "@/lib/export";

export function ReportsPage() {
  const { db } = useStore();

  const totalStudents = db.students.length;
  const activeStudents = db.students.filter((s) => s.statut === "actif").length;
  const infoStudents = db.students.filter((s) => s.formation === "informatique").length;
  const indStudents = db.students.filter((s) => s.formation === "industriel").length;

  const totalTeachers = db.teachers.length;
  const activeTeachers = db.teachers.filter((t) => t.actif !== false).length;
  const totalModules = db.modules.length;

  const totalAttRecords = db.attendance.length;
  const totalPresents = db.attendance.filter((a) => a.statut === "present").length;
  const totalAbsents = db.attendance.filter((a) => a.statut === "absent").length;
  const totalRetards = db.attendance.filter((a) => a.statut === "retard").length;
  const attendanceRate = totalAttRecords > 0 ? Math.round((totalPresents / totalAttRecords) * 100) : 0;

  const totalInvoiced = db.invoices.reduce((a, b) => a + Number(b.montant || 0), 0);
  const totalPaid = db.payments.reduce((a, p) => a + Number(p.montant || 0), 0);
  const totalDue = Math.max(0, totalInvoiced - totalPaid);

  const totalCertificates = db.certificates.length;
  const totalScholarships = db.scholarships.length;

  const rows = [
    { categorie: "Pédagogie", indicateur: "Apprenants inscrits", valeur: totalStudents },
    { categorie: "Pédagogie", indicateur: "Apprenants actifs", valeur: activeStudents },
    { categorie: "Pédagogie", indicateur: "Filière Génie Informatique", valeur: infoStudents },
    { categorie: "Pédagogie", indicateur: "Filière Génie Industriel", valeur: indStudents },
    { categorie: "Pédagogie", indicateur: "Enseignants / Formateurs", valeur: totalTeachers },
    { categorie: "Pédagogie", indicateur: "Modules au catalogue", valeur: totalModules },
    { categorie: "Présence", indicateur: "Emargements enregistrés", valeur: totalAttRecords },
    { categorie: "Présence", indicateur: "Présences effectives", valeur: totalPresents },
    { categorie: "Présence", indicateur: "Absences constatées", valeur: totalAbsents },
    { categorie: "Présence", indicateur: "Taux d assiduité", valeur: `${attendanceRate}%` },
    { categorie: "Finances", indicateur: "Total facturé", valeur: money(totalInvoiced) },
    { categorie: "Finances", indicateur: "Total encaissé", valeur: money(totalPaid) },
    { categorie: "Finances", indicateur: "Reste à recouvrer", valeur: money(totalDue) },
    { categorie: "Institutionnel", indicateur: "Certificats émis", valeur: totalCertificates },
    { categorie: "Institutionnel", indicateur: "Bourses attribuées", valeur: totalScholarships },
  ];

  const printReportPDF = () => {
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111827; max-width: 800px; margin: 0 auto; line-height: 1.4;">
        <div style="border: 2px solid #111827; padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #111827; padding-bottom: 12px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 14pt; font-weight: bold; letter-spacing: 0.5px;">SENTINELLES NUMERIQUES</div>
              <div style="font-size: 10pt; color: #4b5563;">ETABLISSEMENT D ENSEIGNEMENT ET DE FORMATION PROFESSIONNELLE</div>
              <div style="font-size: 9pt; color: #6b7280; margin-top: 4px;">RAPPORT ADMINISTRATIF ET PEDAGOGIQUE GLOBAL</div>
            </div>
            <div style="text-align: right; font-size: 9pt;">
              <div>Date d emission : <strong>${today()}</strong></div>
              <div>Exercice : <strong>2026</strong></div>
              <div>Statut : <strong>Officiel</strong></div>
            </div>
          </div>

          <div style="font-size: 10pt; margin-bottom: 16px;">
            Le present document synthetise l ensemble des indicateurs de gestion pedagogique, d assiduite, de tresorerie et de scolarite pour la periode en cours.
          </div>

          <!-- TABLEAU 1 : EFFECTIFS ET PEDAGOGIE -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 11pt; font-weight: bold; background-color: #f3f4f6; border: 1px solid #d1d5db; border-bottom: none; padding: 6px 10px;">
              1. EFFECTIFS ET DISPOSITIF PEDAGOGIQUE
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background-color: #f9fafb; border-bottom: 1px solid #d1d5db;">
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Indicateur</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Valeur constatee</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Apprenants inscrits</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${totalStudents}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Apprenants actifs</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${activeStudents}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Filiere Genie Informatique</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${infoStudents}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Filiere Genie Industriel</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${indStudents}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Formateurs et enseignants enregistres</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalTeachers}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Modules d enseignement dispenses</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalModules}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- TABLEAU 2 : ASSIDUITE ET EMARGEMENTS -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 11pt; font-weight: bold; background-color: #f3f4f6; border: 1px solid #d1d5db; border-bottom: none; padding: 6px 10px;">
              2. ASSIDUITE ET SUIVI DES PRESENCES
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background-color: #f9fafb; border-bottom: 1px solid #d1d5db;">
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Categorie de pointage</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Nombre d enregistrements</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Proportion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Presences conformes</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${totalPresents}</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${attendanceRate}%</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Absences constatees</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalAbsents}</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalAttRecords > 0 ? Math.round((totalAbsents / totalAttRecords) * 100) : 0}%</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Retards signales</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalRetards}</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right;">${totalAttRecords > 0 ? Math.round((totalRetards / totalAttRecords) * 100) : 0}%</td>
                </tr>
                <tr style="background-color: #f9fafb; font-weight: bold;">
                  <td style="border: 1px solid #d1d5db; padding: 6px 10px;">Total des pointages de presence</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">${totalAttRecords}</td>
                  <td style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- TABLEAU 3 : RECOUVREMENT ET FINANCES -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 11pt; font-weight: bold; background-color: #f3f4f6; border: 1px solid #d1d5db; border-bottom: none; padding: 6px 10px;">
              3. TRESORERIE ET RECOUVREMENT DES SCOLARITES
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background-color: #f9fafb; border-bottom: 1px solid #d1d5db;">
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Poste comptable</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Montant en FCFA</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Montant total facture</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${money(totalInvoiced)}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Montant total encaisse</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${money(totalPaid)}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Solde restant du (a recouvrer)</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${money(totalDue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- TABLEAU 4 : CERTIFICATIONS ET DISPOSITIFS SOCIAUX -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11pt; font-weight: bold; background-color: #f3f4f6; border: 1px solid #d1d5db; border-bottom: none; padding: 6px 10px;">
              4. CERTIFICATIONS ET BOURSES D ETUDES
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #d1d5db;">
              <thead>
                <tr style="background-color: #f9fafb; border-bottom: 1px solid #d1d5db;">
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: left;">Dispositif</th>
                  <th style="border: 1px solid #d1d5db; padding: 6px 10px; text-align: right;">Nombre attribue</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Certificats professionnels et attestations delivres</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${totalCertificates}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px;">Bourses d etudes et aides attribuees</td>
                  <td style="border: 1px solid #d1d5db; padding: 5px 10px; text-align: right; font-weight: bold;">${totalScholarships}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- BLOC SIGNATURES -->
          <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 14px; border-top: 1px solid #111827; font-size: 9pt;">
            <div style="width: 45%; text-align: center;">
              <div>La Direction Pedagogique</div>
              <div style="height: 50px;"></div>
              <div>Signature et cachet</div>
            </div>
            <div style="width: 45%; text-align: center;">
              <div>L Administration Generale</div>
              <div style="height: 50px;"></div>
              <div>Visa administratif</div>
            </div>
          </div>
        </div>
      </div>
    `;

    printHTML(`Rapport_Administratif_${today()}`, html);
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Rapports d'activité"
        subtitle="Rapports pédagogiques, financiers, administratifs et institutionnels"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={printReportPDF} className="bg-cyan-500 hover:bg-cyan-400 text-[#05070E] font-bold">
              <Printer size={15} /> Imprimer le rapport (PDF)
            </Btn>
            <Btn variant="outline" onClick={() => exportCsv("rapports-sentinelles", rows)}>
              <Download size={14} /> Exporter CSV
            </Btn>
            <Btn variant="outline" onClick={() => exportJsonAsExcel("rapports-sentinelles", rows)}>
              <Download size={14} /> Exporter Excel
            </Btn>
          </div>
        }
      />

      {/* 4 KPIs Clés en haut */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Users size={20} />} label="Apprenants" value={totalStudents} />
        <Stat icon={<BookOpen size={20} />} label="Modules" value={totalModules} />
        <Stat icon={<Wallet size={20} />} label="Encaissements" value={money(totalPaid)} />
        <Stat icon={<Award size={20} />} label="Certificats" value={totalCertificates} />
      </div>

      {/* Présentation sous forme de tableaux structurés (Conforme Point 23 et 4.5) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tableau 1 : Dispositif Pédagogique */}
        <Card className="p-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h3 className="font-display text-sm font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={16} /> Effectifs & Pédagogie
            </h3>
            <span className="text-xs font-mono text-slate-400 font-bold">{totalStudents} apprenants</span>
          </div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 text-slate-300">Apprenants inscrits</td>
                <td className="py-2.5 text-right font-mono font-bold text-white">{totalStudents}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Apprenants actifs</td>
                <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{activeStudents}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Génie Informatique</td>
                <td className="py-2.5 text-right font-mono text-red-300">{infoStudents}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Génie Industriel</td>
                <td className="py-2.5 text-right font-mono text-cyan-300">{indStudents}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Corps enseignant (formateurs)</td>
                <td className="py-2.5 text-right font-mono text-slate-200">{totalTeachers}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Modules d'enseignement</td>
                <td className="py-2.5 text-right font-mono text-slate-200">{totalModules}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Tableau 2 : Assiduité & Présence */}
        <Card className="p-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h3 className="font-display text-sm font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} /> Assiduité & Émargements
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-300">{attendanceRate}% assiduité</span>
          </div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 text-slate-300">Total des pointages</td>
                <td className="py-2.5 text-right font-mono font-bold text-white">{totalAttRecords}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Présences conformes</td>
                <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{totalPresents} ({attendanceRate}%)</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Absences constatées</td>
                <td className="py-2.5 text-right font-mono font-bold text-red-400">{totalAbsents}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Retards signalés</td>
                <td className="py-2.5 text-right font-mono text-amber-300">{totalRetards}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Tableau 3 : Trésorerie & Recouvrement */}
        <Card className="p-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h3 className="font-display text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Wallet size={16} /> Trésorerie & Recouvrement
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-300">{money(totalPaid)}</span>
          </div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 text-slate-300">Montant total facturé</td>
                <td className="py-2.5 text-right font-mono font-bold text-white">{money(totalInvoiced)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Montant total encaissé</td>
                <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{money(totalPaid)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Reste à recouvrer</td>
                <td className="py-2.5 text-right font-mono font-bold text-amber-300">{money(totalDue)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Tableau 4 : Certifications & Bourses */}
        <Card className="p-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h3 className="font-display text-sm font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <Award size={16} /> Certifications & Bourses
            </h3>
            <span className="text-xs font-mono font-bold text-purple-300">{totalCertificates} certificat(s)</span>
          </div>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 text-slate-300">Certificats officiels émis</td>
                <td className="py-2.5 text-right font-mono font-bold text-white">{totalCertificates}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-300">Bourses d'études accordées</td>
                <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{totalScholarships}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}