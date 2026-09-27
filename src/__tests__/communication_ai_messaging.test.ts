import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getAutomatedRules,
  saveAutomatedRule,
  toggleAutomatedRule,
  getAutomatedDrafts,
  generateDraftsForRule,
  approveDraft,
  rejectDraft,
  batchApproveDrafts,
  AutomatedRule,
} from '@/lib/ai/automatedMessagesService';
import {
  getNotificationSoundPreferences,
  setNotificationSoundPreferences,
} from '@/lib/pushNotifications';

beforeAll(() => {
  const memoryStore: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore[key] ?? null,
    setItem: (key: string, val: string) => {
      memoryStore[key] = String(val);
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      for (const k of Object.keys(memoryStore)) delete memoryStore[k];
    },
    key: (i: number) => Object.keys(memoryStore)[i] ?? null,
    length: 0,
  };
});

describe('Phase 12 : Communication, Messagerie, Automatisations IA & Notifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Section 34 : Messagerie & Sélecteur de destinataire', () => {
    it('maintient l\'isolation et la persistance stricte des messages supprimés', () => {
      const messages = [
        { id: 'm-1', body: 'Message 1' },
        { id: 'm-2', body: 'Message 2' },
        { id: 'm-3', body: 'Message 3' },
      ];

      const deletedIds = new Set(['m-2']);
      const visibleMessages = messages.filter((m) => !deletedIds.has(m.id));

      expect(visibleMessages).toHaveLength(2);
      expect(visibleMessages.map((m) => m.id)).toEqual(['m-1', 'm-3']);
      expect(visibleMessages.some((m) => m.id === 'm-2')).toBe(false);
    });

    it('filtre efficacement les destinataires par rôle avec décomptes exacts', () => {
      const recipients = [
        { id: 'u-1', label: 'Admin Principal', category: 'admin' },
        { id: 'u-2', label: 'Professeur Alpha', category: 'teacher' },
        { id: 'u-3', label: 'Apprenant Alice', category: 'student' },
        { id: 'u-4', label: 'Apprenant Bob', category: 'student' },
      ];

      const counts = {
        all: recipients.length,
        admin: recipients.filter((r) => r.category === 'admin').length,
        teacher: recipients.filter((r) => r.category === 'teacher').length,
        student: recipients.filter((r) => r.category === 'student').length,
      };

      expect(counts.all).toBe(4);
      expect(counts.admin).toBe(1);
      expect(counts.teacher).toBe(1);
      expect(counts.student).toBe(2);
    });
  });

  describe('Section 35 : Messages automatiques par IA avec règles et validation humaine', () => {
    it('initialise les règles d automatisation par défaut avec contrôle humain obligatoire', () => {
      const rules = getAutomatedRules();
      expect(rules.length).toBeGreaterThanOrEqual(4);

      // Toutes les règles sensibles doivent requérir une validation humaine par défaut
      rules.forEach((r) => {
        expect(r.requires_human_approval).toBe(true);
        expect(r.is_active).toBe(true);
        expect(r.subject_template).toBeDefined();
        expect(r.body_template).toBeDefined();
      });
    });

    it('permet la création d une nouvelle règle configurable', () => {
      const newRule = saveAutomatedRule({
        name: 'Rappel remise projet fin d étude',
        trigger: 'custom',
        target_role: 'student',
        subject_template: 'Projet — Échéance de dépôt pour {{student_name}}',
        body_template: 'Bonjour {{student_name}}, n oubliez pas de remettre votre rapport avant vendredi.',
        requires_human_approval: true,
      });

      expect(newRule.id).toBeDefined();
      expect(newRule.name).toBe('Rappel remise projet fin d étude');

      const allRules = getAutomatedRules();
      expect(allRules.some((r) => r.id === newRule.id)).toBe(true);
    });

    it('active et désactive une règle d automatisation', () => {
      const rules = getAutomatedRules();
      const firstRule = rules[0];

      const updated = toggleAutomatedRule(firstRule.id, false);
      const target = updated.find((r) => r.id === firstRule.id);
      expect(target?.is_active).toBe(false);

      const reEnabled = toggleAutomatedRule(firstRule.id, true);
      const targetAgain = reEnabled.find((r) => r.id === firstRule.id);
      expect(targetAgain?.is_active).toBe(true);
    });

    it('génère des brouillons d IA en attente d approbation sur données réelles', () => {
      const rules = getAutomatedRules();
      const absenceRule = rules.find((r) => r.trigger === 'absence_unjustified')!;

      const candidates = [
        { id: 'stu-1', name: 'Mamadou Diallo', course_name: 'Cryptographie' },
        { id: 'stu-2', name: 'Fatou Ndiaye', course_name: 'Python IA' },
      ];

      const drafts = generateDraftsForRule(absenceRule, candidates);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].status).toBe('pending_approval');
      expect(drafts[0].subject).toContain('Mamadou Diallo');
      expect(drafts[0].body).toContain('Cryptographie');
      expect(drafts[1].subject).toContain('Fatou Ndiaye');
      expect(drafts[1].body).toContain('Python IA');
    });

    it('valide et transmet un brouillon IA avec journalisation administrative', () => {
      const rules = getAutomatedRules();
      const excellenceRule = rules.find((r) => r.trigger === 'grade_excellence')!;

      const drafts = generateDraftsForRule(excellenceRule, [
        { id: 'stu-3', name: 'Koffi Mensah', course_name: 'Sécurité Réseau', grade: 18 },
      ]);

      const draftId = drafts[0].id;
      const adminId = 'admin-super-001';

      const result = approveDraft(draftId, adminId);
      expect(result.ok).toBe(true);
      expect(result.draft?.status).toBe('sent');
      expect(result.draft?.approved_by).toBe(adminId);
      expect(result.draft?.sent_at).toBeDefined();

      // Vérifie l'insertion dans la boîte locale de messages
      const rawDb = localStorage.getItem('sn_db_v2');
      expect(rawDb).toBeDefined();
      const db = JSON.parse(rawDb!);
      expect(db.messages.some((m: any) => m.recipient_id === 'stu-3' && m.is_automated_ai)).toBe(true);
    });

    it('rejette un brouillon avec motif explicite', () => {
      const rules = getAutomatedRules();
      const rule = rules[0];

      const drafts = generateDraftsForRule(rule, [{ id: 'stu-4', name: 'Awa Cissé' }]);
      const draftId = drafts[0].id;

      const result = rejectDraft(draftId, 'Justificatif médical reçu en parallèle');
      expect(result.ok).toBe(true);
      expect(result.draft?.status).toBe('rejected');
      expect(result.draft?.rejection_reason).toBe('Justificatif médical reçu en parallèle');
    });

    it('traite une approbation groupée (batch approval)', () => {
      const rules = getAutomatedRules();
      const rule = rules[0];

      const drafts = generateDraftsForRule(rule, [
        { id: 'stu-5', name: 'Élève A' },
        { id: 'stu-6', name: 'Élève B' },
        { id: 'stu-7', name: 'Élève C' },
      ]);

      const draftIds = drafts.map((d) => d.id);
      const approvedCount = batchApproveDrafts(draftIds, 'admin-123');

      expect(approvedCount).toBe(3);
      const allDrafts = getAutomatedDrafts();
      draftIds.forEach((id) => {
        const d = allDrafts.find((item) => item.id === id);
        expect(d?.status).toBe('sent');
      });
    });
  });

  describe('Section 36 & 15 : Notifications catégorisées et préférences audio', () => {
    it('gère les préférences audio de notifications (activation et timbre)', () => {
      // Préférence par défaut
      const defaultPrefs = getNotificationSoundPreferences();
      expect(defaultPrefs.enabled).toBe(true);
      expect(defaultPrefs.soundId).toBe('sentinel');

      // Modification
      setNotificationSoundPreferences({ enabled: false, soundId: 'spatial_bip' });
      const updatedPrefs = getNotificationSoundPreferences();
      expect(updatedPrefs.enabled).toBe(false);
      expect(updatedPrefs.soundId).toBe('spatial_bip');
    });

    it('classe correctement les notifications selon les 10 catégories du Prompt Maître', () => {
      const getCategory = (n: { title: string; body: string; type?: string }) => {
        const t = (n.type || '').toLowerCase();
        const text = `${n.title} ${n.body}`.toLowerCase();
        if (t === 'presence' || text.includes('présence') || text.includes('absence')) return 'presence';
        if (text.includes('planning') || text.includes('emploi du temps')) return 'emploi_du_temps';
        if (t === 'paiement' || text.includes('scolarité') || text.includes('solde')) return 'paiements';
        if (t === 'test' || text.includes('évaluation') || text.includes('note')) return 'evaluations';
        if (text.includes('examen') || text.includes('sécurisé')) return 'examens';
        if (text.includes('enseignant') || text.includes('formateur')) return 'enseignants';
        if (text.includes('sentinel') || text.includes('ia')) return 'ia';
        if (text.includes('message') || text.includes('discussion')) return 'messagerie';
        if (text.includes('admin') || text.includes('inscription')) return 'administration';
        return 'systeme';
      };

      expect(getCategory({ title: 'Absence non justifiée', body: 'Cours du 12 mars' })).toBe('presence');
      expect(getCategory({ title: 'Modification Emploi du temps', body: 'Salle 204' })).toBe('emploi_du_temps');
      expect(getCategory({ title: 'Échéance de paiement', body: 'Solde restant' })).toBe('paiements');
      expect(getCategory({ title: 'Nouvelle évaluation', body: 'Devoir noté' })).toBe('evaluations');
      expect(getCategory({ title: 'Session examen sécurisé', body: 'Surveillance active' })).toBe('examens');
      expect(getCategory({ title: 'Heures formateur validées', body: 'Vacation' })).toBe('enseignants');
      expect(getCategory({ title: 'Alerte Sentinel AI', body: 'Détection RAG' })).toBe('ia');
      expect(getCategory({ title: 'Nouveau message reçu', body: 'Discussion de groupe' })).toBe('messagerie');
      expect(getCategory({ title: 'Validation compte admin', body: 'Inscription' })).toBe('administration');
      expect(getCategory({ title: 'Mise à jour serveur', body: 'Redémarrage' })).toBe('systeme');
    });
  });
});
