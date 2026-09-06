import { DB, FinancialStatus, FinancialSummary, Invoice, Payment } from "./types";

/**
 * MOTEUR FINANCIER OFFICIEL — SENTINELLES NUMÉRIQUES v2.0
 * Aligné sur le Plan d'Enrichissement Fonctionnel Final (Sections 4 à 28, 56 à 58)
 */

export const REGISTRATION_FEE = 5000; // 5 000 FCFA obligatoires et distincts
export const TEACHER_SESSION_RATE = 2500; // 2 500 FCFA / séance validée

/**
 * RÈGLES TARIFAIRES CONFIGURABLES (Sections 7, 8, 9)
 * - Génie Informatique : 3 500 FCFA / module
 * - Génie Industriel : Forfaits (3 mod = 5 000 FCFA, 6 mod = 10 000 FCFA, 12 mod = 20 000 FCFA)
 */
export function calculateFormationFees(
  formationCode: "informatique" | "industriel" | string,
  moduleCount: number,
  scholarshipPercent: number = 0
): {
  registrationFee: number;
  tuitionFee: number;
  discount: number;
  totalDue: number;
  tranche1: number;
  tranche2: number;
} {
  const regFee = REGISTRATION_FEE;
  let rawTuition = 0;

  if (formationCode === "industriel") {
    if (moduleCount <= 3) rawTuition = 5000;
    else if (moduleCount <= 6) rawTuition = 10000;
    else rawTuition = 20000;
  } else {
    // Génie Informatique ou unitaire par défaut
    rawTuition = Math.max(1, moduleCount) * 3500;
  }

  const discount = scholarshipPercent > 0 ? (rawTuition * scholarshipPercent) / 100 : 0;
  const tuitionFee = Math.max(0, rawTuition - discount);
  const totalDue = regFee + tuitionFee;

  // Répartition par défaut en 2 tranches (50% / 50% sur les frais de formation)
  const tranche1 = Math.round(tuitionFee / 2);
  const tranche2 = tuitionFee - tranche1;

  return {
    registrationFee: regFee,
    tuitionFee,
    discount,
    totalDue,
    tranche1,
    tranche2,
  };
}

/**
 * GÉNÉRATEUR D'ÉCHÉANCIER EN DEUX TRANCHES (Sections 10, 11, 12)
 * Tranche 1 : 1 mois après inscription
 * Tranche 2 : Avant la fin de formation (~ 2.5 mois après inscription)
 */
export function generateInstallmentSchedule(
  studentId: string,
  tuitionFee: number,
  startDateStr: string = new Date().toISOString().slice(0, 10)
): Array<{
  installmentNumber: number;
  label: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: "impaye" | "partiel" | "paye" | "retard";
}> {
  const startDate = new Date(startDateStr);
  
  // Date tranche 1 : +30 jours
  const d1 = new Date(startDate);
  d1.setDate(d1.getDate() + 30);

  // Date tranche 2 : +75 jours
  const d2 = new Date(startDate);
  d2.setDate(d2.getDate() + 75);

  const t1Amount = Math.round(tuitionFee / 2);
  const t2Amount = tuitionFee - t1Amount;

  return [
    {
      installmentNumber: 1,
      label: "Tranche 1 (50%)",
      amount: t1Amount,
      paidAmount: 0,
      dueDate: d1.toISOString().slice(0, 10),
      status: "impaye",
    },
    {
      installmentNumber: 2,
      label: "Tranche 2 (50%)",
      amount: t2Amount,
      paidAmount: 0,
      dueDate: d2.toISOString().slice(0, 10),
      status: "impaye",
    },
  ];
}

/**
 * DÉTECTION DES ALERTES D'ÉCHÉANCE FINANCIÈRE (Section 14)
 */
export interface ScheduleAlert {
  type: "urgent" | "warning" | "overdue" | "normal";
  daysRemaining: number;
  message: string;
  installmentLabel: string;
  amountDue: number;
}

export function detectScheduleAlerts(dueDate: string, remainingAmount: number): ScheduleAlert | null {
  if (remainingAmount <= 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      type: "overdue",
      daysRemaining: diffDays,
      message: `Paiement en retard de ${Math.abs(diffDays)} jour(s)`,
      installmentLabel: "Échéance dépassée",
      amountDue: remainingAmount,
    };
  } else if (diffDays === 0) {
    return {
      type: "urgent",
      daysRemaining: 0,
      message: "Échéance aujourd'hui !",
      installmentLabel: "Aujourd'hui",
      amountDue: remainingAmount,
    };
  } else if (diffDays <= 3) {
    return {
      type: "urgent",
      daysRemaining: diffDays,
      message: `Échéance critique dans ${diffDays} jour(s)`,
      installmentLabel: "J-3",
      amountDue: remainingAmount,
    };
  } else if (diffDays <= 7) {
    return {
      type: "warning",
      daysRemaining: diffDays,
      message: `Échéance à prévoir dans ${diffDays} jour(s)`,
      installmentLabel: "J-7",
      amountDue: remainingAmount,
    };
  }

  return {
    type: "normal",
    daysRemaining: diffDays,
    message: `Prochaine échéance dans ${diffDays} jours`,
    installmentLabel: `J-${diffDays}`,
    amountDue: remainingAmount,
  };
}

/** Calcule le résumé financier complet d'un apprenant à partir des factures, paiements et échéances. */
export function financialSummary(db: DB, studentId: string): FinancialSummary {
  const invoices = db.invoices.filter((i) => i.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));
  const payments = db.payments.filter((p) => p.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));
  const schedules = (db.paymentSchedules || []).filter((s) => s.studentId === studentId).sort((a, b) => a.installmentNumber - b.installmentNumber);
  
  const totalDu = invoices.reduce((a, i) => a + (i.montant || 0), 0);
  const totalPaye = payments.reduce((a, p) => a + (p.montant || 0), 0);
  const solde = Math.max(0, totalDu - totalPaye);
  
  let statut: FinancialStatus = "impaye";
  if (totalDu === 0 && totalPaye === 0) statut = "impaye";
  else if (totalPaye <= 0) statut = "impaye";
  else if (totalPaye >= totalDu && totalDu > 0) statut = "paye";
  else statut = "partiel";

  // "retard" si une facture ou tranche avec dueDate dépassée n'est pas totalement couverte
  const today = new Date().toISOString().slice(0, 10);
  if (statut !== "paye") {
    const overdue = invoices.some((i) => i.dueDate && i.dueDate < today) || schedules.some((s) => s.status !== "paye" && s.dueDate < today);
    if (overdue) statut = "retard";
  }

  return { totalDu, totalPaye, solde, reste: solde, statut, invoices, payments, schedules };
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

/**
 * GÉNÉRATEUR DE REÇU OFFICIEL NORMALISÉ : SN-REC-YYYY-XXXXXX (Section 16)
 */
export function nextReceiptRef(db: DB): string {
  const year = new Date().getFullYear();
  const max = db.payments.reduce((acc, p) => {
    const m = (p.reference || "").match(/SN-REC-\d{4}-(\d+)/) || (p.reference || "").match(/REC-(\d+)/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 100);
  return `SN-REC-${year}-${String(max + 1).padStart(6, "0")}`;
}

/**
 * GÉNÉRATEUR DE BULLETIN DE PAIE FORMATEUR : SN-PAIE-YYYY-XXXXXX (Section 26)
 */
export function nextPayslipRef(year: number = new Date().getFullYear(), counter: number = 101): string {
  return `SN-PAIE-${year}-${String(counter).padStart(6, "0")}`;
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

/**
 * CALCUL DE LA RENTABILITÉ D'UN MODULE (Section 56)
 * Revenus encaissés du module - Coûts des formateurs = Marge nette
 */
export function calculateModuleProfitability(
  moduleTitle: string,
  studentCount: number,
  unitRevenue: number = 3500,
  validatedSessionsCount: number = 4,
  sessionRate: number = TEACHER_SESSION_RATE
): {
  studentCount: number;
  revenue: number;
  teacherCost: number;
  margin: number;
  marginPercent: number;
} {
  const revenue = studentCount * unitRevenue;
  const teacherCost = validatedSessionsCount * sessionRate;
  const margin = revenue - teacherCost;
  const marginPercent = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

  return {
    studentCount,
    revenue,
    teacherCost,
    margin,
    marginPercent,
  };
}
