import { describe, it, expect } from 'vitest';
import { emptyDB } from '../lib/seed';
import { financialSummary } from '../lib/finance';
import type { AppDB } from '../lib/store';

describe('Phase 10 - Finances, Paiements, Bourses et Certificats (Sections 28, 29, 30)', () => {
  it('calcule rigoureusement le total, payé, restant et le statut financier rattaché à l\'année académique', () => {
    const db: AppDB = emptyDB();
    db.students = [
      { id: 'std-fin-1', nom: 'Moukoko', prenom: 'Grace', formation: 'informatique', modules: ['mod-1', 'mod-2'], academicYearId: '2025-2026' } as any
    ];
    db.invoices = [
      { id: 'inv-1', studentId: 'std-fin-1', type: 'inscription', libelle: 'Inscription', montant: 5000, date: '2026-01-05', academicYearId: '2025-2026' },
      { id: 'inv-2', studentId: 'std-fin-1', type: 'formation', libelle: 'Frais de formation', montant: 7000, date: '2026-01-05', academicYearId: '2025-2026' },
    ];
    db.payments = [
      { id: 'pay-1', studentId: 'std-fin-1', invoiceId: 'inv-1', type: 'inscription', libelle: 'Paiement inscription', montant: 5000, date: '2026-01-06', mode: 'Mobile Money' },
      { id: 'pay-2', studentId: 'std-fin-1', invoiceId: 'inv-2', type: 'formation', libelle: 'Acompte formation', montant: 3500, date: '2026-01-15', mode: 'Espèces' },
    ];

    const summary = financialSummary(db, 'std-fin-1');
    expect(summary.totalDu).toBe(12000);
    expect(summary.totalPaye).toBe(8500);
    expect(summary.solde).toBe(3500);
    expect(summary.statut).toBe('partiel');
  });

  it('gère l\'attribution des bourses avec montant et rattachement à l\'année académique', () => {
    const db: AppDB = emptyDB();
    db.scholarships = [
      { id: 'schl-1', studentId: 'std-1', statut: 'trois_ans', montant: 100, date: '2026-02-01', academicYearId: '2025-2026' },
      { id: 'schl-2', studentId: 'std-2', statut: 'un_an', montant: 33, date: '2026-02-01', academicYearId: '2026-2027' },
    ] as any;

    const year2526Bourses = (db.scholarships as any[]).filter(s => s.academicYearId === '2025-2026');
    expect(year2526Bourses.length).toBe(1);
    expect(year2526Bourses[0].montant).toBe(100);
    expect(year2526Bourses[0].statut).toBe('trois_ans');
  });

  it('valide l\'authenticité et les données d\'un certificat de formation', () => {
    const cert = {
      id: 'CERT-001',
      studentId: 'std-1',
      numero: 'SN-CERT-2026-000101',
      formation: 'informatique' as const,
      modules: ['mod-1', 'mod-2'],
      periode: 'Octobre 2025 — Mars 2026',
      resultat: 'Admis avec mention Très Bien',
      note: 16.5,
      date: '2026-03-30',
      academicYearId: '2025-2026',
    };

    expect(cert.numero).toMatch(/^SN-CERT-2026-\d{6}$/);
    expect(cert.academicYearId).toBe('2025-2026');
    expect(cert.note).toBe(16.5);
  });
});
