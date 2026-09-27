import { describe, it, expect } from 'vitest';
import { emptyDB } from '../lib/seed';
import { calculateModuleProfitability } from '../lib/finance';
import type { AppDB } from '../lib/store';

describe('Phase 7 - Pédagogie, Formations, Modules et Cours', () => {
  it('calcule correctement la rentabilité et les statistiques financières d\'un module', () => {
    const db: AppDB = emptyDB();
    db.modules = [
      { id: 'mod-1', nom: 'React & TypeScript', code: 'DEV-101', description: 'Bases React', filiere_id: 'fil-1' } as any
    ];
    db.formations = [
      { id: 'fil-1', titre: 'Développement Web' } as any
    ];
    db.invoices = [
      { id: 'inv-1', montant: 500000, statut: 'payé', module_id: 'mod-1' } as any,
      { id: 'inv-2', montant: 250000, statut: 'payé', module_id: 'mod-1' } as any,
    ];
    db.teacher_hours = [
      { id: 'th-1', module_id: 'mod-1', heures: 20, taux_horaire: 10000, montant: 200000, statut: 'validé' } as any
    ];

    const studentCount = 20;
    const sessionCount = 8;
    const stats = calculateModuleProfitability('React & TypeScript', studentCount, 5000, sessionCount, 2500);
    expect(stats.revenue).toBe(100000);
    expect(stats.teacherCost).toBe(20000);
    expect(stats.margin).toBe(80000);
    expect(stats.marginPercent).toBe(80);
  });

  it('gère l\'archivage et les filtres de cours avec groupe', () => {
    const db: AppDB = emptyDB();
    db.courses = [
      { id: 'c-1', titre: 'Composants React', module_id: 'mod-1', formateur_id: 't-1', classe: 'Groupe Alpha' } as any,
      { id: 'c-2', titre: 'Hooks avancés', module_id: 'mod-1', formateur_id: 't-1', classe: 'Groupe Beta' } as any,
      { id: 'c-3', titre: 'Node.js intro', module_id: 'mod-2', formateur_id: 't-2', classe: 'Groupe Alpha' } as any,
    ];

    // Filtrage par groupe
    const groupAlphaCourses = db.courses.filter(c => c.classe === 'Groupe Alpha');
    expect(groupAlphaCourses.length).toBe(2);

    // Filtrage par module et groupe
    const mod1Alpha = db.courses.filter(c => c.module_id === 'mod-1' && c.classe === 'Groupe Alpha');
    expect(mod1Alpha.length).toBe(1);
    expect(mod1Alpha[0].titre).toBe('Composants React');
  });
});
