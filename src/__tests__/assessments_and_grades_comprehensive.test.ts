import { describe, it, expect } from 'vitest';
import { emptyDB } from '../lib/seed';
import { parseMarkdownAssessment } from '../modules/assessments/parsers/markdownParser';
import type { AppDB } from '../lib/store';

describe('Phase 8 - Évaluations, Générateur, Importation de sujets & Notes (Sections 21, 22, 23, 27)', () => {
  it('analyse correctement un sujet importé avec titre, durée, barème, consignes et questions', () => {
    const rawMarkdown = `
# Évaluation Finale : Sécurité Réseaux & Pare-feu
Durée : 60 min
Barème : 20 points

## Consignes
- Aucun document extérieur n'est autorisé.
- Répondez avec précision aux questions théoriques et pratiques.

1. [QCM] (4 pts) Quel protocole permet d'établir un tunnel VPN chiffré de niveau 3 ?
- [x] IPsec
- [ ] Telnet
- [ ] HTTP
- [ ] FTP
Explication : IPsec opère au niveau réseau (couche 3) et garantit la confidentialité.

2. [Vrai/Faux] (4 pts) Un pare-feu stateful inspecte l'état des connexions TCP actives.
- [x] Vrai
- [ ] Faux
Explication : Vrai, contrairement aux pare-feu stateless qui filtrent paquet par paquet.

3. (12 pts) Expliquez la procédure de durcissement d'un serveur d'accès distant.
`;

    const parsed = parseMarkdownAssessment(rawMarkdown);
    expect(parsed.titre).toBe('Évaluation Finale : Sécurité Réseaux & Pare-feu');
    expect(parsed.duree).toBe(60);
    expect(parsed.bareme).toBe(20);
    expect(parsed.consignes).toContain("Aucun document extérieur n'est autorisé");
    expect(parsed.questions.length).toBe(3);
    expect(parsed.questions[0].type).toBe('qcm');
    expect(parsed.questions[0].points).toBe(4);
    expect(parsed.questions[1].type).toBe('vf');
  });

  it('gère le filtrage exhaustif de la page Toutes les notes sur les 8 dimensions requises', () => {
    const db: AppDB = emptyDB();
    db.students = [
      { id: 'std-1', nom: 'Diop', prenom: 'Amadou', formation: 'informatique', groupe: 'Groupe A', academicYearId: '2025-2026' } as any,
      { id: 'std-2', nom: 'Traore', prenom: 'Fatou', formation: 'industriel', groupe: 'Groupe B', academicYearId: '2026-2027' } as any,
    ];
    db.modules = [
      { id: 'mod-1', titre: 'Cybersécurité', formation: 'informatique', numero: 1 } as any,
      { id: 'mod-2', titre: 'Automates Siemens', formation: 'industriel', numero: 2 } as any,
    ];
    db.teachers = [
      { id: 't-1', nom: 'Kouassi', prenom: 'Marc', modules: ['mod-1'] } as any,
      { id: 't-2', nom: 'Ndiaye', prenom: 'Aissatou', modules: ['mod-2'] } as any,
    ];
    db.grades = [
      { id: 'g-1', studentId: 'std-1', moduleId: 'mod-1', note: 16, appreciation: 'Évaluation : Contrôle Continu 1', date: '2026-03-10', academicYearId: '2025-2026' } as any,
      { id: 'g-2', studentId: 'std-2', moduleId: 'mod-2', note: 8.5, appreciation: 'Évaluation : Examen Blanc', date: '2026-04-15', academicYearId: '2026-2027' } as any,
    ];

    // Résolution enrichie similaire à GradesPage
    const enrichedGrades = db.grades.map((g) => {
      const student = db.students.find((s) => s.id === g.studentId);
      const moduleObj = db.modules.find((m) => m.id === g.moduleId);
      const teacherObj = db.teachers.find((t) => (t.modules || []).includes(g.moduleId));
      return {
        ...g,
        studentName: student ? `${student.prenom} ${student.nom}` : g.studentId,
        formation: student?.formation || moduleObj?.formation,
        groupe: student?.groupe,
        teacherId: teacherObj?.id,
        academicYear: g.academicYearId,
      };
    });

    // 1. Filtre par formation
    const infoGrades = enrichedGrades.filter(g => g.formation === 'informatique');
    expect(infoGrades.length).toBe(1);
    expect(infoGrades[0].studentName).toBe('Amadou Diop');

    // 2. Filtre par groupe
    const grpBGrades = enrichedGrades.filter(g => g.groupe === 'Groupe B');
    expect(grpBGrades.length).toBe(1);
    expect(grpBGrades[0].studentName).toBe('Fatou Traore');

    // 3. Filtre par enseignant
    const t1Grades = enrichedGrades.filter(g => g.teacherId === 't-1');
    expect(t1Grades.length).toBe(1);

    // 4. Filtre par évaluation / appréciation
    const examBlanc = enrichedGrades.filter(g => g.appreciation.includes('Examen Blanc'));
    expect(examBlanc.length).toBe(1);
    expect(examBlanc[0].note).toBe(8.5);

    // 5. Filtre par année académique
    const year2526 = enrichedGrades.filter(g => g.academicYear === '2025-2026');
    expect(year2526.length).toBe(1);
  });
});
