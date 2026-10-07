import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riskService, RiskScore } from '@/modules/students/services/riskService';
import { notificationService, OutboxItem } from '@/modules/notifications/services/notificationService';
import { supabase } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Phase 2 — Notifications Multicanal (N2) & Radar de Risque de Décrochage (N3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module N3 : Radar de Risque de Décrochage (Early Warning Engine)', () => {
    it('calcule et retourne le score de risque avec des facteurs explicatifs transparents', async () => {
      const mockRiskScore: RiskScore = {
        id: 'r-1',
        student_id: 'STD-001',
        score: 65,
        level: 'eleve',
        factors: [
          { code: 'absences_eleve', poids: 25, label: '3 absences enregistrées' },
          { code: 'devoirs_non_remis', poids: 20, label: '2 devoirs en retard ou non remis' },
          { code: 'impaye_retard', poids: 15, label: '1 facture en retard de paiement' },
        ],
        calculated_at: '2026-10-07T00:00:00Z',
        student: {
          first_name: 'Amadou',
          last_name: 'Diop',
          email: 'amadou@example.com',
          formation_id: 'informatique',
        },
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [mockRiskScore],
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValueOnce(mockQuery);

      const res = await riskService.getRiskScores();
      expect(supabase.from).toHaveBeenCalledWith('risk_scores');
      expect(res.data).toHaveLength(1);
      expect(res.data[0].level).toBe('eleve');
      expect(res.data[0].factors).toHaveLength(3);
      expect(res.data[0].factors[0].label).toContain('3 absences');
    });

    it('exécute la procédure de recalcul automatique (compute_risk_scores)', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: {
          success: true,
          updated_students: 15,
          high_risk_count: 3,
        },
        error: null,
      });

      const res = await riskService.computeRiskScores();
      expect(supabase.rpc).toHaveBeenCalledWith('compute_risk_scores');
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(15);
      expect(res.highRiskCount).toBe(3);
    });

    it('ajoute et met à jour une intervention pédagogique pour rétention (student_followups)', async () => {
      const mockInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'f-100' },
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValueOnce(mockInsert);

      const addRes = await riskService.addFollowup({
        student_id: 'STD-001',
        type: 'appel',
        note: 'Prise de contact pour motif absences',
        due_date: '2026-10-10',
        status: 'ouvert',
      });

      expect(addRes.success).toBe(true);
      expect(addRes.followupId).toBe('f-100');

      const mockUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValueOnce({
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValueOnce(mockUpdate);

      const updateRes = await riskService.updateFollowupStatus('f-100', 'resolu');
      expect(updateRes.success).toBe(true);
    });
  });

  describe('Module N2 : Centre de Notifications Multicanal', () => {
    it('récupère et met à jour les modèles de notification (notification_templates)', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          code: 'payment_reminder',
          title: 'Relance d’échéance de scolarité',
          channels: ['whatsapp', 'email'],
          subject_template: 'Rappel {{label}}',
          body_template: 'Bonjour {{student_name}}, montant dû {{amount}} FCFA',
          variables: ['student_name', 'label', 'amount'],
          mode: 'hybrid',
          is_active: true,
        },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: mockTemplates,
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValueOnce(mockQuery);

      const res = await notificationService.getTemplates();
      expect(res.data).toHaveLength(1);
      expect(res.data[0].code).toBe('payment_reminder');

      const mockUpdate = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValueOnce({
          error: null,
        }),
      };
      (supabase.from as any).mockReturnValueOnce(mockUpdate);

      const updateRes = await notificationService.updateTemplate('payment_reminder', {
        mode: 'automatic',
      });
      expect(updateRes.success).toBe(true);
    });

    it('génère un lien direct WhatsApp pré-rempli pour envoi manuel / hybride', () => {
      const item: OutboxItem = {
        id: 'out-1',
        recipient_id: 'user-1',
        recipient_name: 'Fatou Traore',
        recipient_contact: '+242 06 123 45 67',
        channel: 'whatsapp',
        subject: 'Rappel de scolarité',
        content: 'Merci de régulariser la tranche 2.',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        scheduled_for: '2026-10-07T00:00:00Z',
        created_at: '2026-10-07T00:00:00Z',
      };

      const link = notificationService.generateDirectSendLink(item);
      expect(link).toContain('https://wa.me/242061234567');
      expect(link).toContain(encodeURIComponent('*Rappel de scolarité*'));
      expect(link).toContain(encodeURIComponent('Merci de régulariser la tranche 2.'));
    });

    it('génère un lien mailto pour envoi e-mail direct', () => {
      const item: OutboxItem = {
        id: 'out-2',
        recipient_id: 'user-2',
        recipient_name: 'Amadou Diop',
        recipient_contact: 'amadou@example.com',
        channel: 'email',
        subject: 'Devoir Cyber',
        content: 'Échéance demain.',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        scheduled_for: '2026-10-07T00:00:00Z',
        created_at: '2026-10-07T00:00:00Z',
      };

      const link = notificationService.generateDirectSendLink(item);
      expect(link).toContain('mailto:amadou@example.com');
      expect(link).toContain('subject=Devoir%20Cyber');
    });

    it('insère un message dans la file outbox (queue_notification RPC)', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, outbox_id: 'out-3' },
        error: null,
      });

      const res = await notificationService.queueNotification({
        recipient_id: 'u-1',
        channel: 'push',
        template_code: 'assessment_published',
        subject: 'Note publiée',
        content: 'Votre note est de 16/20',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('queue_notification', {
        p_recipient_id: 'u-1',
        p_channel: 'push',
        p_template_code: 'assessment_published',
        p_subject: 'Note publiée',
        p_content: 'Votre note est de 16/20',
        p_metadata: {},
      });
      expect(res.success).toBe(true);
      expect(res.outboxId).toBe('out-3');
    });
  });
});
