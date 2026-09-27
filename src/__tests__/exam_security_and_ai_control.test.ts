import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { canUserAccessAi, saveAiPolicy, DEFAULT_AI_POLICY } from '../lib/ai/aiAccessControl';

const memoryLocalStore: Record<string, string> = {};
const memorySessionStore: Record<string, string> = {};

beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryLocalStore[key] ?? null,
    setItem: (key: string, val: string) => { memoryLocalStore[key] = String(val); },
    removeItem: (key: string) => { delete memoryLocalStore[key]; },
    clear: () => { for (const k of Object.keys(memoryLocalStore)) delete memoryLocalStore[k]; },
  };
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => memorySessionStore[key] ?? null,
    setItem: (key: string, val: string) => { memorySessionStore[key] = String(val); },
    removeItem: (key: string) => { delete memorySessionStore[key]; },
    clear: () => { for (const k of Object.keys(memorySessionStore)) delete memorySessionStore[k]; },
  };
});

describe('Phase 9 - Mode Examen Sécurisé et Contrôle Multi-Niveaux de l\'IA (Sections 24, 25)', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    (globalThis as any).sessionStorage.clear();
    saveAiPolicy(DEFAULT_AI_POLICY);
  });

  it('interdit strictement l\'assistant IA pendant une épreuve d\'examen ou d\'évaluation (Priorité Examen)', () => {
    // Cas normal : admin a accès à l'IA
    const normalCheck = canUserAccessAi({ id: 'usr-admin', role: 'admin' });
    expect(normalCheck.allowed).toBe(true);

    // Démarrage de l'examen sécurisé
    sessionStorage.setItem('sn_in_exam', 'true');

    // Pendant l'examen : l'accès IA est formellement bloqué même pour un profil connecté
    const examCheck = canUserAccessAi({ id: 'usr-student', role: 'student' });
    expect(examCheck.allowed).toBe(false);
    expect(examCheck.reason).toContain('strictement interdit pendant le déroulement d\'un examen');

    // Fin d'examen
    sessionStorage.removeItem('sn_in_exam');
    const afterExamCheck = canUserAccessAi({ id: 'usr-admin', role: 'admin' });
    expect(afterExamCheck.allowed).toBe(true);
  });

  it('applique les restrictions de rôle (Ex: IA interdite aux apprenants mais autorisée aux admins)', () => {
    saveAiPolicy({
      disabledRoles: ['student'],
    });

    const studentCheck = canUserAccessAi({ id: 'std-1', role: 'student' });
    expect(studentCheck.allowed).toBe(false);
    expect(studentCheck.reason).toContain('restreint pour le rôle « student »');

    const adminCheck = canUserAccessAi({ id: 'adm-1', role: 'admin' });
    expect(adminCheck.allowed).toBe(true);
  });

  it('applique la désactivation globale au niveau Système avec priorité absolue', () => {
    saveAiPolicy({
      systemEnabled: false,
    });

    // Même un superadmin est bloqué si l'IA est désactivée au niveau système
    const superadminCheck = canUserAccessAi({ id: 'sa-1', role: 'superadmin' });
    expect(superadminCheck.allowed).toBe(false);
    expect(superadminCheck.reason).toContain('désactivé au niveau du système');
  });

  it('bloque un utilisateur individuel ciblé par identifiant', () => {
    saveAiPolicy({
      disabledUserIds: ['user-blocked-99'],
    });

    const blockedCheck = canUserAccessAi({ id: 'user-blocked-99', role: 'teacher' });
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.reason).toContain('suspendu par un administrateur');

    const otherTeacherCheck = canUserAccessAi({ id: 'user-other', role: 'teacher' });
    expect(otherTeacherCheck.allowed).toBe(true);
  });
});
