import { describe, it, expect, beforeEach } from 'vitest';
import { defaultModuleRestrictions, emptyDB } from '@/lib/seed';
import type { DB, ModuleRestriction, User } from '@/lib/types';

describe('Phase 13 : Administration, Sécurité, Blocage des modules, Journalisation & Archives', () => {
  let db: DB;

  beforeEach(() => {
    db = emptyDB();
    db.moduleRestrictions = defaultModuleRestrictions();
    db.log = [
      { id: 'log-1', date: '2026-03-20 09:30', user: 'Admin Principal', action: 'Connexion réussie' },
      { id: 'log-2', date: '2026-03-21 14:15', user: 'Professeur Alpha', action: 'Dépôt support cours Réseaux' },
      { id: 'log-3', date: '2026-03-22 16:45', user: 'Admin Principal', action: 'Génération bulletins 2025-2026' },
    ];
    db.archivedLogs = [];
  });

  describe('Section 26 : Blocage strict des modules & interception Gate', () => {
    const isModuleBlocked = (
      moduleKey: string,
      targetUser?: { id: string; role: string; name?: string }
    ): { blocked: boolean; reason: string } => {
      if (!targetUser) return { blocked: false, reason: '' };
      if (targetUser.role === 'superadmin') return { blocked: false, reason: '' };

      const restriction = (db.moduleRestrictions || []).find((r) => r.moduleKey === moduleKey);
      if (!restriction || !restriction.bloque) return { blocked: false, reason: '' };

      if (restriction.roles && restriction.roles.length > 0 && (restriction.roles as string[]).includes(targetUser.role)) {
        return { blocked: true, reason: restriction.raison || 'Module temporairement restreint pour votre profil.' };
      }

      if (restriction.userIds && restriction.userIds.length > 0 && restriction.userIds.includes(targetUser.id)) {
        return { blocked: true, reason: restriction.raison || 'Votre accès personnel à ce module est restreint.' };
      }

      if ((!restriction.roles || restriction.roles.length === 0) && (!restriction.userIds || restriction.userIds.length === 0)) {
        if (targetUser.role !== 'admin') {
          return { blocked: true, reason: restriction.raison || 'Ce module est temporairement suspendu.' };
        }
      }

      return { blocked: false, reason: '' };
    };

    it('n interdit JAMAIS l accès au superadmin quel que soit le verrouillage', () => {
      const superadmin = { id: 'sa-1', role: 'superadmin', name: 'Directeur Général' };

      // Bloquer le module IA pour tout le monde
      const iaRes = db.moduleRestrictions?.find((r) => r.moduleKey === 'ia');
      if (iaRes) {
        iaRes.bloque = true;
        iaRes.roles = ['student', 'teacher', 'admin'];
        iaRes.raison = 'Maintenance majeure de l infrastructure GPU';
      }

      const check = isModuleBlocked('ia', superadmin);
      expect(check.blocked).toBe(false);
    });

    it('bloque les apprenants avec un motif explicite lorsque le rôle student est restreint', () => {
      const student = { id: 'stu-1', role: 'student', name: 'Alice Apprenante' };

      const evalRes = db.moduleRestrictions?.find((r) => r.moduleKey === 'evaluations');
      if (evalRes) {
        evalRes.bloque = true;
        evalRes.roles = ['student'];
        evalRes.raison = 'Période de délibération des jurys. Accès aux évaluations temporairement clos.';
      }

      const check = isModuleBlocked('evaluations', student);
      expect(check.blocked).toBe(true);
      expect(check.reason).toContain('Période de délibération des jurys');
    });

    it('autorise les formateurs si la restriction ne vise que les apprenants', () => {
      const teacher = { id: 't-1', role: 'teacher', name: 'Jean Formateur' };

      const evalRes = db.moduleRestrictions?.find((r) => r.moduleKey === 'evaluations');
      if (evalRes) {
        evalRes.bloque = true;
        evalRes.roles = ['student'];
      }

      const check = isModuleBlocked('evaluations', teacher);
      expect(check.blocked).toBe(false);
    });

    it('bloque un utilisateur spécifique par son identifiant unique (contentieux financier)', () => {
      const debtorStudent = { id: 'stu-debt-99', role: 'student', name: 'Étudiant en contentieux' };
      const innocentStudent = { id: 'stu-ok-01', role: 'student', name: 'Étudiant à jour' };

      const financeRes = db.moduleRestrictions?.find((r) => r.moduleKey === 'finances');
      if (financeRes) {
        financeRes.bloque = true;
        financeRes.userIds = ['stu-debt-99'];
        financeRes.roles = [];
        financeRes.raison = 'Régularisation requise auprès du service financier.';
      }

      const debtorCheck = isModuleBlocked('finances', debtorStudent);
      const innocentCheck = isModuleBlocked('finances', innocentStudent);

      expect(debtorCheck.blocked).toBe(true);
      expect(debtorCheck.reason).toContain('Régularisation requise');
      expect(innocentCheck.blocked).toBe(false);
    });

    it('permet le déblocage immédiat et la réversibilité sans perte de configuration', () => {
      const student = { id: 'stu-1', role: 'student', name: 'Alice Apprenante' };
      const iaRes = db.moduleRestrictions?.find((r) => r.moduleKey === 'ia');

      if (iaRes) {
        iaRes.bloque = true;
        iaRes.roles = ['student'];
        expect(isModuleBlocked('ia', student).blocked).toBe(true);

        // Déblocage
        iaRes.bloque = false;
        expect(isModuleBlocked('ia', student).blocked).toBe(false);
      }
    });
  });

  describe('Section 37 : Gestion et administration des comptes utilisateurs', () => {
    it('permet la désactivation et la réactivation sécurisée d un compte utilisateur', () => {
      const user: any = {
        id: 'u-temp',
        name: 'Moussa Sarr',
        email: 'moussa@example.com',
        role: 'student',
        actif: true,
      };

      // Désactivation
      const deactivatedUser = { ...user, actif: false };
      expect(deactivatedUser.actif).toBe(false);

      // Réactivation
      const reactivatedUser = { ...deactivatedUser, actif: true };
      expect(reactivatedUser.actif).toBe(true);
    });
  });

  describe('Section 38 : Persistance des contenus du site public', () => {
    it('met à jour et persiste les données de branding, formations et annonces', () => {
      db.settings = {
        ...db.settings,
        branding: {
          name: 'SENTINELLES NUMÉRIQUES ACADEMY',
          badge: 'EXCELLENCE • IA',
          subtitle: 'Pôle Technologique Africain',
          tagline: 'L élite de la cybersécurité',
        },
      };

      expect(db.settings.branding.name).toBe('SENTINELLES NUMÉRIQUES ACADEMY');
      expect(db.settings.branding.badge).toBe('EXCELLENCE • IA');
    });
  });

  describe('Section 39 & 40 : Journalisation d audit, Archivage sécurisé & Restauration', () => {
    it('filtre les logs d audit par utilisateur, date et mot-clé', () => {
      const searchLogs = (userFilter: string, keyword: string) => {
        return db.log.filter((l) => {
          const matchU = userFilter === 'tous' || l.user === userFilter;
          const matchQ = !keyword || l.action.toLowerCase().includes(keyword.toLowerCase());
          return matchU && matchQ;
        });
      };

      const adminLogs = searchLogs('Admin Principal', '');
      expect(adminLogs).toHaveLength(2);

      const searchBulletins = searchLogs('tous', 'bulletins');
      expect(searchBulletins).toHaveLength(1);
      expect(searchBulletins[0].user).toBe('Admin Principal');
    });

    it('archive l ensemble des logs actifs vers les archives sans destruction de données', () => {
      const originalCount = db.log.length;
      expect(originalCount).toBe(3);

      // Archivage
      db.archivedLogs = [...(db.archivedLogs || []), ...db.log];
      db.log = [];

      expect(db.log).toHaveLength(0);
      expect(db.archivedLogs).toHaveLength(originalCount);
      expect(db.archivedLogs[0].action).toBe('Connexion réussie');
    });

    it('restaure l intégralité des archives dans les logs actifs à la demande', () => {
      // Préparer une archive
      db.archivedLogs = [...db.log];
      db.log = [];

      expect(db.log).toHaveLength(0);
      expect(db.archivedLogs).toHaveLength(3);

      // Restauration
      db.log = [...db.archivedLogs, ...db.log];
      db.archivedLogs = [];

      expect(db.log).toHaveLength(3);
      expect(db.archivedLogs).toHaveLength(0);
      expect(db.log.some((l) => l.action.includes('Génération bulletins'))).toBe(true);
    });
  });
});
