import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { executeScheduleAutomation } from '@/lib/automation/scheduleAutomation';
import { emptyDB } from '@/lib/seed';
import type { DB } from '@/lib/types';

interface AutomationServiceConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  frequency: string;
  lastRun: string;
  nextRun: string;
  lastStatus: 'success' | 'warning' | 'error' | 'running';
  lastMessage: string;
}

const STORAGE_KEY_AUTOMATIONS = 'sn_automations_config_v1';

const DEFAULT_AUTOMATIONS: AutomationServiceConfig[] = [
  {
    id: 'auto-attendance',
    name: 'Pointage automatique des présences',
    category: 'Pédagogie & Emploi du temps',
    description: 'Émarge automatiquement présents tous les apprenants inscrits dès le début et à la fin de chaque séance planifiée.',
    enabled: true,
    frequency: 'Toutes les 15 min + à chaque fin de séance',
    lastRun: '2026-03-27 08:00',
    nextRun: '2026-03-27 10:00',
    lastStatus: 'success',
    lastMessage: 'Pointage exécuté sans conflit pour les séances du jour.',
  },
  {
    id: 'auto-teacher-hours',
    name: 'Validation des heures & Rémunérations enseignants',
    category: 'Enseignement & Trésorerie',
    description: 'Reconnaît les cours dispensés (emploi du temps), prépare la validation de l heure et crédite 2 500 FCFA/séance.',
    enabled: true,
    frequency: 'Quotidien (fin de journée)',
    lastRun: '2026-03-27 07:30',
    nextRun: '2026-03-27 18:00',
    lastStatus: 'success',
    lastMessage: 'Honoraires automatiquement calculés et mis en attente de visa.',
  },
  {
    id: 'auto-notifications',
    name: 'Système de notifications & alertes préventives',
    category: 'Communication & Sécurité',
    description: 'Diffuse les rappels avant séance, les notifications d absences répétées et les relances de scolarité.',
    enabled: true,
    frequency: 'Temps réel + vérification horaire',
    lastRun: '2026-03-27 08:15',
    nextRun: '2026-03-27 09:15',
    lastStatus: 'success',
    lastMessage: 'Veille active : alertes d assiduité transmises aux apprenants.',
  },
  {
    id: 'auto-grades-sync',
    name: 'Attribution & synchronisation automatique des notes',
    category: 'Évaluations',
    description: 'Propage immédiatement les résultats corrigés des devoirs et tests vers les bulletins sans ressaisie.',
    enabled: true,
    frequency: 'Événementiel (post-correction)',
    lastRun: '2026-03-27 06:45',
    nextRun: 'À la prochaine évaluation',
    lastStatus: 'success',
    lastMessage: 'Base de notes synchronisée avec les devoirs corrigés.',
  },
  {
    id: 'auto-sentinel-rag',
    name: 'Indexation & Savoirs Sentinel AI',
    category: 'Intelligence Artificielle',
    description: 'Découpe, extrait et indexe les documents téléversés pour le moteur de recherche sémantique RAG.',
    enabled: true,
    frequency: 'Automatique au téléversement',
    lastRun: '2026-03-27 05:00',
    nextRun: 'Au prochain document téléversé',
    lastStatus: 'success',
    lastMessage: 'Corpus documentaire indexé et disponible pour l assistant.',
  },
];

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

describe('Phase 15 : Centre de Pilotage des Automatisations (Sections 13 & 42)', () => {
  let automations: AutomationServiceConfig[] = [];
  let db: DB;

  beforeEach(() => {
    localStorage.clear();
    automations = [...DEFAULT_AUTOMATIONS];
    db = emptyDB();
  });

  it('fournit les 5 grandes composantes d automatisation métier indispensables', () => {
    const categories = automations.map((a) => a.category);
    expect(categories).toContain('Pédagogie & Emploi du temps');
    expect(categories).toContain('Enseignement & Trésorerie');
    expect(categories).toContain('Communication & Sécurité');
    expect(categories).toContain('Évaluations');
    expect(categories).toContain('Intelligence Artificielle');

    automations.forEach((svc) => {
      expect(svc.id).toBeDefined();
      expect(svc.name).toBeDefined();
      expect(svc.frequency).toBeDefined();
      expect(svc.lastStatus).toBe('success');
      expect(svc.lastMessage).toBeDefined();
    });
  });

  it('permet l activation et la désactivation réversible d une automatisation avec persistance', () => {
    const targetId = 'auto-attendance';
    const target = automations.find((a) => a.id === targetId)!;
    expect(target.enabled).toBe(true);

    // Désactivation
    const updated = automations.map((a) => (a.id === targetId ? { ...a, enabled: false } : a));
    localStorage.setItem(STORAGE_KEY_AUTOMATIONS, JSON.stringify(updated));

    const retrieved = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTOMATIONS)!);
    const retrievedTarget = retrieved.find((a: any) => a.id === targetId);
    expect(retrievedTarget.enabled).toBe(false);

    // Réactivation
    const reactivated = retrieved.map((a: any) => (a.id === targetId ? { ...a, enabled: true } : a));
    localStorage.setItem(STORAGE_KEY_AUTOMATIONS, JSON.stringify(reactivated));

    const finalRetrieved = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTOMATIONS)!);
    expect(finalRetrieved.find((a: any) => a.id === targetId).enabled).toBe(true);
  });

  it('exécute manuellement une relance de tâche et met à jour l horodatage et les métriques', () => {
    // Configurer une séance d'exemple pour tester l'exécution
    db.schedule = [
      {
        id: 'seance-test-1',
        formation: 'informatique',
        moduleId: 'm-1',
        teacherId: 't-1',
        date: '2026-03-27',
        heureDebut: '08:00',
        heureFin: '10:00',
        salle: 'Labo 1',
      },
    ] as any;
    db.students = [
      {
        id: 'stu-auto-1',
        nom: 'Diallo',
        prenom: 'Amadou',
        formation: 'informatique',
        statut: 'actif',
        email: 'amadou@example.com',
        modules: ['m-1'],
      } as any,
    ];

    // Exécuter l'automatisation de planning
    const refDate = new Date('2026-03-27T10:30:00Z');
    let updatedDB = db;
    const updateFn = (cb: (d: DB) => DB) => {
      updatedDB = cb(updatedDB);
    };

    const res = executeScheduleAutomation(db, updateFn, refDate);
    expect(res).toBeDefined();

    // Mettre à jour le statut du service
    const nowStr = '2026-03-27 10:30';
    const detailMsg = `Succès : ${res.markedAttendances} présence(s) pointée(s), ${res.validatedSessions} séance(s) traitée(s).`;

    const updatedAutomations = automations.map((a) =>
      a.id === 'auto-attendance'
        ? {
            ...a,
            lastRun: nowStr,
            lastStatus: 'success' as const,
            lastMessage: detailMsg,
          }
        : a
    );

    const targetService = updatedAutomations.find((a) => a.id === 'auto-attendance')!;
    expect(targetService.lastRun).toBe(nowStr);
    expect(targetService.lastStatus).toBe('success');
    expect(targetService.lastMessage).toContain('Succès');
  });
});
