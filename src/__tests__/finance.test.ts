import { describe, it, expect } from "vitest";

interface Invoice {
  id: string;
  studentId: string;
  montant: number;
  dueDate?: string;
}

interface Payment {
  id: string;
  studentId: string;
  montant: number;
  observation?: string;
}

function calculateFinance(invoices: Invoice[], payments: Payment[], todayStr: string) {
  const totalDu = invoices.reduce((acc, i) => acc + (i.montant || 0), 0);
  const totalPaye = payments.reduce((acc, p) => acc + (p.montant || 0), 0);
  const solde = Math.max(0, totalDu - totalPaye);

  let statut: "paye" | "partiel" | "impaye" | "retard" = "impaye";
  if (totalPaye <= 0) {
    statut = "impaye";
  } else if (totalPaye >= totalDu && totalDu > 0) {
    statut = "paye";
  } else {
    statut = "partiel";
  }

  if (statut !== "paye") {
    const overdue = invoices.some((i) => i.dueDate && i.dueDate < todayStr);
    if (overdue) statut = "retard";
  }

  return { totalDu, totalPaye, solde, statut };
}

describe("Finance and Ledger Reconciliation (Audit 4.2)", () => {
  it("calcule un statut impaye pour un apprenant sans versement", () => {
    const invoices: Invoice[] = [{ id: "INV-1", studentId: "STU-1", montant: 150000 }];
    const payments: Payment[] = [];
    const res = calculateFinance(invoices, payments, "2026-09-01");
    expect(res.totalDu).toBe(150000);
    expect(res.totalPaye).toBe(0);
    expect(res.solde).toBe(150000);
    expect(res.statut).toBe("impaye");
  });

  it("calcule un statut partiel pour un acompte", () => {
    const invoices: Invoice[] = [{ id: "INV-1", studentId: "STU-1", montant: 150000 }];
    const payments: Payment[] = [{ id: "PAY-1", studentId: "STU-1", montant: 50000 }];
    const res = calculateFinance(invoices, payments, "2026-09-01");
    expect(res.totalPaye).toBe(50000);
    expect(res.solde).toBe(100000);
    expect(res.statut).toBe("partiel");
  });

  it("calcule un statut retard si la date d'échéance est passée et le solde non nul", () => {
    const invoices: Invoice[] = [
      { id: "INV-1", studentId: "STU-1", montant: 150000, dueDate: "2026-08-15" },
    ];
    const payments: Payment[] = [{ id: "PAY-1", studentId: "STU-1", montant: 50000 }];
    const res = calculateFinance(invoices, payments, "2026-09-01");
    expect(res.statut).toBe("retard");
  });

  it("gère l'annulation par écriture inverse sans effacement de trace comptable", () => {
    const invoices: Invoice[] = [{ id: "INV-1", studentId: "STU-1", montant: 150000 }];
    const payments: Payment[] = [
      { id: "PAY-1", studentId: "STU-1", montant: 50000 },
      // Écriture inverse d'annulation
      { id: "PAY-2", studentId: "STU-1", montant: -50000, observation: "[ANNULATION] Erreur saisie" },
    ];
    const res = calculateFinance(invoices, payments, "2026-09-01");
    expect(res.totalPaye).toBe(0);
    expect(res.solde).toBe(150000);
    expect(res.statut).toBe("impaye");
  });

  it("calcule le statut payé lorsque l'intégralité est couverte", () => {
    const invoices: Invoice[] = [{ id: "INV-1", studentId: "STU-1", montant: 150000 }];
    const payments: Payment[] = [
      { id: "PAY-1", studentId: "STU-1", montant: 100000 },
      { id: "PAY-2", studentId: "STU-1", montant: 50000 },
    ];
    const res = calculateFinance(invoices, payments, "2026-09-01");
    expect(res.totalPaye).toBe(150000);
    expect(res.solde).toBe(0);
    expect(res.statut).toBe("paye");
  });
});
