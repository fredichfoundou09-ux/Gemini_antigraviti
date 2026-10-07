import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trashService } from '@/modules/admin/services/trashService';
import { hasPermission } from '@/lib/supabase/permissions';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/auth';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Module N1 — Corbeille & Sauvegardes Système (Tests unitaires)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permissions RBAC pour la corbeille', () => {
    it('autorise les superadmins et admins à accéder à la corbeille et restaurer des éléments', () => {
      const superAdminProfile: Profile = {
        id: 'u-super',
        username: 'superadmin',
        name: 'Super Admin',
        role: 'superadmin',
        active: true,
      };
      const adminProfile: Profile = {
        id: 'u-admin',
        username: 'admin',
        name: 'Admin',
        role: 'admin',
        active: true,
      };

      expect(hasPermission(superAdminProfile, 'trash.read')).toBe(true);
      expect(hasPermission(superAdminProfile, 'trash.manage')).toBe(true);
      expect(hasPermission(superAdminProfile, 'trash.restore')).toBe(true);

      expect(hasPermission(adminProfile, 'trash.read')).toBe(true);
      expect(hasPermission(adminProfile, 'trash.manage')).toBe(true);
      expect(hasPermission(adminProfile, 'trash.restore')).toBe(true);
    });

    it('interdit aux étudiants de voir ou modifier la corbeille', () => {
      const studentProfile: Profile = {
        id: 'u-student',
        username: 'student',
        name: 'Student',
        role: 'student',
        active: true,
      };

      expect(hasPermission(studentProfile, 'trash.read')).toBe(false);
      expect(hasPermission(studentProfile, 'trash.manage')).toBe(false);
      expect(hasPermission(studentProfile, 'trash.restore')).toBe(false);
    });

    it('permet aux formateurs de consulter et restaurer leurs propres évaluations', () => {
      const teacherProfile: Profile = {
        id: 'u-teacher',
        username: 'teacher',
        name: 'Teacher',
        role: 'teacher',
        active: true,
      };

      expect(hasPermission(teacherProfile, 'trash.read')).toBe(true);
      expect(hasPermission(teacherProfile, 'trash.restore')).toBe(true);
      expect(hasPermission(teacherProfile, 'trash.manage')).toBe(false); // La purge définitive reste réservée au staff
    });
  });

  describe('Service Corbeille (trashService)', () => {
    it('récupère la liste des éléments placés en corbeille', async () => {
      const mockItems = [
        {
          id: 'test-123',
          entity_type: 'tests',
          label: 'Contrôle Continu Cyber',
          details: { type: 'qcm', total_points: 20 },
          deleted_at: '2026-10-07T00:00:00Z',
          deleted_by_name: 'Admin Principal',
        },
        {
          id: 'res-456',
          entity_type: 'test_results',
          label: 'Résultat de Amadou Diop',
          details: { score: 14, total_points: 20 },
          deleted_at: '2026-10-07T01:00:00Z',
          deleted_by_name: 'Formateur Alpha',
        },
      ];

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const res = await trashService.getTrashItems('tests');
      expect(supabase.rpc).toHaveBeenCalledWith('get_trash_items', { p_table: 'tests' });
      expect(res.data).toHaveLength(2);
      expect(res.data[0].label).toBe('Contrôle Continu Cyber');
      expect(res.error).toBeNull();
    });

    it('effectue un soft delete et trace le résultat', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, table: 'tests', id: 'test-123' },
        error: null,
      });

      const res = await trashService.softDeleteItem('tests', 'test-123');
      expect(supabase.rpc).toHaveBeenCalledWith('soft_delete_item', {
        p_table: 'tests',
        p_id: 'test-123',
      });
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it('restaure un élément en 1 clic sans perte de données', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, table: 'test_results', id: 'res-456' },
        error: null,
      });

      const res = await trashService.restoreItem('test_results', 'res-456');
      expect(supabase.rpc).toHaveBeenCalledWith('restore_item', {
        p_table: 'test_results',
        p_id: 'res-456',
      });
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it('exécute une purge définitive avec délai configurable', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, table: 'all', days_old: 30, purged_count: 5 },
        error: null,
      });

      const res = await trashService.purgeDeletedItems('all', 30);
      expect(supabase.rpc).toHaveBeenCalledWith('purge_deleted_items', {
        p_table: 'all',
        p_days_old: 30,
      });
      expect(res.success).toBe(true);
      expect(res.purgedCount).toBe(5);
    });

    it('gère correctement les erreurs de suppression ou de permissions refusées', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: false, error: 'Droits insuffisants pour supprimer cet examen' },
        error: null,
      });

      const res = await trashService.softDeleteItem('tests', 'forbidden-test');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Droits insuffisants pour supprimer cet examen');
    });
  });

  describe('Service Sauvegardes & Simulation', () => {
    it('génère un instantané de sauvegarde système', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, backup_id: 'b-999', status: 'completed' },
        error: null,
      });

      const res = await trashService.createSystemBackup('Sauvegarde mensuelle');
      expect(supabase.rpc).toHaveBeenCalledWith('create_system_backup', {
        p_title: 'Sauvegarde mensuelle',
      });
      expect(res.success).toBe(true);
      expect(res.backupId).toBe('b-999');
    });

    it('simule la restauration d’une sauvegarde sans altération destructrice', async () => {
      const mockSimulation = {
        backup_id: 'b-999',
        title: 'Sauvegarde mensuelle',
        created_at: '2026-10-07T00:00:00Z',
        status: 'simulation_passed',
        is_destructive: false,
        checks: {
          schema_compatible: true,
          rls_intact: true,
          tables_checked: ['students', 'invoices'],
          backup_record_counts: { students: 42, invoices: 100 },
        },
        current_record_counts: { students: 42, invoices: 100 },
        differences: {
          conflicts_detected: 0,
          missing_foreign_keys: 0,
          recommendation: "La restauration peut être exécutée en toute sécurité sans conflit d'intégrité.",
        },
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, simulation: mockSimulation },
        error: null,
      });

      const res = await trashService.simulateRestoreBackup('b-999');
      expect(supabase.rpc).toHaveBeenCalledWith('simulate_restore_backup', {
        p_backup_id: 'b-999',
      });
      expect(res.success).toBe(true);
      expect(res.simulation?.status).toBe('simulation_passed');
      expect(res.simulation?.is_destructive).toBe(false);
      expect(res.simulation?.differences.conflicts_detected).toBe(0);
    });
  });
});
