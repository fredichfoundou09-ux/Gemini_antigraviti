import { DB, FinancialStatus, FinancialSummary, Invoice, Payment } from "./types";

/** Calcule le résumé financier d'un apprenant à partir des factures et paiements. */
export function financialSummary(db: DB, studentId: string): FinancialSummary {
  const invoices = db.invoices.filter((i) => i.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));
  const payments = db.payments.filter((p) => p.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));
  const totalDu = invoices.reduce((a, i) => a + (i.montant || 0), 0);
  const totalPaye = payments.reduce((a, p) => a + (p.montant || 0), 0);
  const solde = Math.max(0, totalDu - totalPaye);
  let statut: FinancialStatus = "impaye";
  if (totalDu === 0 && totalPaye === 0) statut = "impaye";
  else if (totalPaye <= 0) statut = "impaye";
  else if (totalPaye >= totalDu && totalDu > 0) statut = "paye";
  else statut = "partiel";
  // "retard" si une facture avec dueDate dépassée n'est pas totalement couverte
  const today = new Date().toISOString().slice(0, 10);
  if (statut !== "paye") {
    const overdue = invoices.some((i) => i.dueDate && i.dueDate < today);
    if (overdue) statut = "retard";
  }
  return { totalDu, totalPaye, solde, statut, invoices, payments };
}

/** Répartit un paiement sur la facture ouverte la plus ancienne. Retourne l'invoiceId choisi. */
export function pickInvoiceFor(db: DB, studentId: string, type: Invoice["type"]): Invoice | undefined {
  const summary = financialSummary(db, studentId);
  return summary.invoices.find((i) => i.type === type) ?? summary.invoices[0];
}

/** Calcule le reste dû sur une facture donnée (paiements affectés). */
export function invoiceBalance(db: DB, invoiceId: string): { paid: number; balance: number } {
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { paid: 0, balance: 0 };
  const paid = db.payments.filter((p) => p.invoiceId === invoiceId).reduce((a, p) => a + p.montant, 0);
  return { paid, balance: Math.max(0, inv.montant - paid) };
}

/** Génère la prochaine référence de reçu (REC-XXXX). */
export function nextReceiptRef(db: DB): string {
  const max = db.payments.reduce((acc, p) => {
    const m = (p.reference || "").match(/REC-(\d+)/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `REC-${String(max + 1).padStart(4, "0")}`;
}

/** Libellé lisible du statut financier. */
export function statusLabel(s: FinancialStatus): string {
  return s === "paye" ? "Payé" : s === "partiel" ? "Partiellement payé" : s === "retard" ? "En retard" : "Non payé";
}

/** Rétro-compat : totalPaid rapide pour un apprenant (pour l'UI). */
export function totalPaidOf(db: DB, studentId: string): number {
  return db.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.montant, 0);
}

/** Retourne le statut financier "vivant" pour l'apprenant (pour badges/tableaux). */
export function liveStatus(db: DB, studentId: string): FinancialStatus {
  return financialSummary(db, studentId).statut;
}

/** Ordonne les paiements du plus récent au plus ancien. */
export function sortedPayments(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? "")));
}
