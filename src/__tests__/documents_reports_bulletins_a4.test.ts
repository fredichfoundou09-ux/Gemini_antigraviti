import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBulletin } from '@/lib/bulletin';
import { emptyDB } from '@/lib/seed';
import type { DB } from '@/lib/types';
import * as ui from '@/lib/ui';

describe('Phase 14 : Documents, Rapports et Bulletins A4 stricts', () => {
  let db: DB;
  let printedTitle: string = '';
  let printedHtml: string = '';

  beforeEach(() => {
    db = emptyDB();
    db.academicYears = [
      { id: 'ay-2025-2026', label: '2025-2026', dateDebut: '2025-09-01', dateFin: '2026-07-31', statut: 'active', isDefault: true },
    ];
    db.modules = [
      { id: 'm-1', numero: 1, titre: 'Algorithmique & Structures de Données', formation: 'informatique', volumeHoraire: 40 },
      { id: 'm-2', numero: 2, titre: 'Cybersécurité & Réseaux', formation: 'informatique', volumeHoraire: 35 },
    ] as any;
    db.students = [
      {
        id: 'ETU-2026-001',
        nom: 'Kaboré',
        prenom: 'Ibrahim',
        email: 'ibrahim@example.com',
        formation: 'informatique',
        statut: 'actif',
        academicYearId: 'ay-2025-2026',
        modules: ['m-1', 'm-2'],
      } as any,
    ];
    db.grades = [
      { id: 'g-1', studentId: 'ETU-2026-001', moduleId: 'm-1', note: 16.5, appreciation: 'Excellent travail', date: '2026-03-10' } as any,
      { id: 'g-2', studentId: 'ETU-2026-001', moduleId: 'm-2', note: 14.0, appreciation: 'Très bonne maîtrise', date: '2026-03-11' } as any,
    ];
    db.attendance = [
      { id: 'att-1', studentId: 'ETU-2026-001', date: '2026-03-10', statut: 'present', seanceId: 's-1' } as any,
      { id: 'att-2', studentId: 'ETU-2026-001', date: '2026-03-11', statut: 'present', seanceId: 's-2' } as any,
    ];

    // Intercepter printHTML
    vi.spyOn(ui, 'printHTML').mockImplementation((title: string, html: string) => {
      printedTitle = title;
      printedHtml = html;
    });
  });

  describe('Conformité A4 stricte du Bulletin Officiel (Section 18 & 41)', () => {
    it('génère un bulletin avec toutes les informations légales, l année académique et sans emojis', () => {
      generateBulletin(db, 'ETU-2026-001', 'Semestre 1', '2025-2026');

      expect(printedTitle).toContain('Bulletin Officiel — Ibrahim Kaboré');
      expect(printedHtml).toBeDefined();

      // Vérifier le format A4 portrait
      expect(printedHtml).toContain('size: A4 portrait');

      // Vérifier l'en-tête officiel
      expect(printedHtml).toContain('SENTINELLES NUMÉRIQUES');
      expect(printedHtml).toContain('BULLETIN OFFICIEL DE NOTES');
      expect(printedHtml).toContain('ANNÉE ACADÉMIQUE 2025-2026');
      expect(printedHtml).toContain('Semestre 1');

      // Identification de l'apprenant
      expect(printedHtml).toContain('KABORÉ Ibrahim');
      expect(printedHtml).toContain('ETU-2026-001');
      expect(printedHtml).toContain('Génie Informatique');

      // Modules et notes
      expect(printedHtml).toContain('Algorithmique & Structures de Données');
      expect(printedHtml).toContain('16.5 / 20');
      expect(printedHtml).toContain('Très Bien');
      expect(printedHtml).toContain('Cybersécurité & Réseaux');
      expect(printedHtml).toContain('14.0 / 20');

      // Moyenne et décision (16.5 + 14) / 2 = 15.25 => ADMIS
      expect(printedHtml).toContain('15.25 / 20');
      expect(printedHtml).toContain('ADMIS');

      // Signatures officielles
      expect(printedHtml).toContain('Direction des Études');
      expect(printedHtml).toContain('Direction de l\'Établissement');

      // Absence totale d'emojis dans le HTML officiel
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(printedHtml)).toBe(false);
    });

    it('attribue correctement la mention AJOURNÉ en cas de moyenne < 10', () => {
      // Notes faibles
      db.grades = [
        { id: 'g-1', studentId: 'ETU-2026-001', moduleId: 'm-1', note: 8.0, appreciation: 'Difficultés', date: '2026-03-10' } as any,
        { id: 'g-2', studentId: 'ETU-2026-001', moduleId: 'm-2', note: 7.5, appreciation: 'Insuffisant', date: '2026-03-11' } as any,
      ];

      generateBulletin(db, 'ETU-2026-001');

      expect(printedHtml).toContain('7.75 / 20');
      expect(printedHtml).toContain('AJOURNÉ');
      expect(printedHtml).toContain('Un renforcement dans les matières fondamentales est requis');
    });

    it('calcule rigoureusement le taux d assiduité de l apprenant', () => {
      db.attendance = [
        { id: 'att-1', studentId: 'ETU-2026-001', date: '2026-03-10', statut: 'present', seanceId: 's-1' } as any,
        { id: 'att-2', studentId: 'ETU-2026-001', date: '2026-03-11', statut: 'absent', seanceId: 's-2' } as any,
        { id: 'att-3', studentId: 'ETU-2026-001', date: '2026-03-12', statut: 'present', seanceId: 's-3' } as any,
        { id: 'att-4', studentId: 'ETU-2026-001', date: '2026-03-13', statut: 'retard', seanceId: 's-4' } as any,
      ];

      generateBulletin(db, 'ETU-2026-001');

      // Total 4 séances, 2 présents => 50 %
      expect(printedHtml).toContain('50 %');
      expect(printedHtml).toContain('2 séances suivies');
      expect(printedHtml).toContain('1 absence(s) / 1 retard(s)');
    });
  });
});
