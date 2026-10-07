-- Migration 0064: Modules N2 (Centre de notifications multicanal) & N3 (Radar de risque de décrochage)
-- Automatisation, mode explicable, traçabilité et intégration du tableau de bord

-- ============================================================================
-- 1. MODULE N2 : CENTRE DE NOTIFICATIONS MULTICANAL
-- ============================================================================

-- 1.1 Modèles de notifications paramétrables
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['push', 'email']::text[],
  subject_template text NOT NULL,
  body_template text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}'::text[],
  mode text NOT NULL DEFAULT 'hybrid' CHECK (mode IN ('automatic', 'manual', 'hybrid')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_templates_read" ON public.notification_templates;
CREATE POLICY "notification_templates_read" ON public.notification_templates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "notification_templates_staff_all" ON public.notification_templates;
CREATE POLICY "notification_templates_staff_all" ON public.notification_templates
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Modèles préconfigurés
INSERT INTO public.notification_templates (code, title, channels, subject_template, body_template, variables, mode)
VALUES
  (
    'payment_reminder',
    'Relance d''échéance de scolarité',
    ARRAY['whatsapp', 'email', 'push']::text[],
    'Rappel d''échéance de paiement : {{label}}',
    'Bonjour {{student_name}}, nous vous rappelons que l''échéance pour {{label}} de {{amount}} FCFA arrive à échéance le {{due_date}}. Merci de régulariser auprès de l''administration.',
    ARRAY['student_name', 'label', 'amount', 'due_date']::text[],
    'hybrid'
  ),
  (
    'assignment_deadline',
    'Échéance imminente de devoir',
    ARRAY['push', 'whatsapp']::text[],
    'Devoir à rendre : {{assignment_title}}',
    'Attention {{student_name}}, le devoir {{assignment_title}} pour le module {{module_title}} doit être rendu avant le {{due_date}}.',
    ARRAY['student_name', 'assignment_title', 'module_title', 'due_date']::text[],
    'automatic'
  ),
  (
    'assessment_published',
    'Publication de résultats',
    ARRAY['push', 'email']::text[],
    'Nouvelle note disponible : {{test_title}}',
    'Félicitations {{student_name}}, votre note pour l''examen {{test_title}} a été publiée : {{score}}/{{total_points}}.',
    ARRAY['student_name', 'test_title', 'score', 'total_points']::text[],
    'automatic'
  ),
  (
    'absence_alert',
    'Alerte d''absence répétée',
    ARRAY['whatsapp', 'email', 'push']::text[],
    'Alerte assiduité : {{consecutive_absences}} absences consécutives',
    'Bonjour {{student_name}}, l''administration a constaté {{consecutive_absences}} absences consécutives au cours de {{module_title}}. Merci de contacter votre formateur.',
    ARRAY['student_name', 'consecutive_absences', 'module_title']::text[],
    'hybrid'
  )
ON CONFLICT (code) DO NOTHING;

-- 1.2 File d'envoi unifiée (Outbox)
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_name text,
  recipient_contact text, -- email, tel ou push token
  channel text NOT NULL CHECK (channel IN ('push', 'email', 'whatsapp', 'sms')),
  template_code text REFERENCES public.notification_templates(code) ON DELETE SET NULL,
  subject text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'prepared')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_sched ON public.notification_outbox(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_outbox_recipient ON public.notification_outbox(recipient_id);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_outbox_staff_all" ON public.notification_outbox;
CREATE POLICY "notification_outbox_staff_all" ON public.notification_outbox
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "notification_outbox_user_select" ON public.notification_outbox;
CREATE POLICY "notification_outbox_user_select" ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- 1.3 Préférences utilisateur
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled_channels text[] NOT NULL DEFAULT ARRAY['push', 'email']::text[],
  quiet_hours_start text DEFAULT '22:00',
  quiet_hours_end text DEFAULT '07:00',
  notify_grades boolean NOT NULL DEFAULT true,
  notify_assignments boolean NOT NULL DEFAULT true,
  notify_payments boolean NOT NULL DEFAULT true,
  notify_absences boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_user_all" ON public.notification_preferences;
CREATE POLICY "notification_preferences_user_all" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- ============================================================================
-- 2. MODULE N3 : RADAR DE RISQUE DE DÉCROCHAGE (Early Warning Engine)
-- ============================================================================

-- 2.1 Table des scores de risque explicables
CREATE TABLE IF NOT EXISTS public.risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  level text NOT NULL CHECK (level IN ('faible', 'modere', 'eleve', 'critique')),
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  academic_year_id uuid,
  CONSTRAINT uq_risk_scores_student UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON public.risk_scores(level);
CREATE INDEX IF NOT EXISTS idx_risk_scores_score ON public.risk_scores(score DESC);

ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;

-- Visibilité : réservée aux enseignants et au staff (l'apprenant ne voit pas son score de risque)
DROP POLICY IF EXISTS "risk_scores_staff_select" ON public.risk_scores;
CREATE POLICY "risk_scores_staff_select" ON public.risk_scores
  FOR SELECT TO authenticated
  USING (
    public.is_staff() OR
    EXISTS (
      SELECT 1 FROM public.teachers tch
      WHERE tch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "risk_scores_staff_write" ON public.risk_scores;
CREATE POLICY "risk_scores_staff_write" ON public.risk_scores
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 2.2 Table de suivi et interventions pédagogiques
CREATE TABLE IF NOT EXISTS public.student_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('appel', 'convocation', 'tutorat', 'remediation', 'entretien_tuteur')),
  note text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_cours', 'resolu', 'archive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_followups_read" ON public.student_followups;
CREATE POLICY "student_followups_read" ON public.student_followups
  FOR SELECT TO authenticated
  USING (
    public.is_staff() OR
    EXISTS (
      SELECT 1 FROM public.teachers tch
      WHERE tch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "student_followups_write" ON public.student_followups;
CREATE POLICY "student_followups_write" ON public.student_followups
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR
    EXISTS (
      SELECT 1 FROM public.teachers tch
      WHERE tch.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff() OR
    EXISTS (
      SELECT 1 FROM public.teachers tch
      WHERE tch.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. PROCÉDURES DE CALCUL ET TRAITEMENT
-- ============================================================================

-- 3.1 Moteur de calcul transparent et explicable du risque de décrochage
CREATE OR REPLACE FUNCTION public.compute_risk_scores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student record;
  v_score numeric(5,2);
  v_level text;
  v_factors jsonb;
  v_absences_count int;
  v_missing_assignments int;
  v_unpaid_invoices int;
  v_avg_grade numeric(5,2);
  v_updated_count int := 0;
  v_high_risk_count int := 0;
BEGIN
  -- Boucle sur tous les apprenants actifs non archivés
  FOR v_student IN
    SELECT s.id, s.first_name, s.last_name, s.formation_id, s.academic_year_id
    FROM public.students s
    WHERE s.deleted_at IS NULL
  LOOP
    v_score := 0;
    v_factors := '[]'::jsonb;

    -- Facteur 1 : Absences (40 points max)
    SELECT count(*) INTO v_absences_count
    FROM public.attendance a
    WHERE a.student_id = v_student.id AND a.statut = 'absent';

    IF v_absences_count >= 5 THEN
      v_score := v_score + 40;
      v_factors := v_factors || jsonb_build_object(
        'code', 'absences_critique',
        'poids', 40,
        'label', v_absences_count || ' absences enregistrées (taux d''assiduité critique)'
      );
    ELSIF v_absences_count >= 3 THEN
      v_score := v_score + 25;
      v_factors := v_factors || jsonb_build_object(
        'code', 'absences_eleve',
        'poids', 25,
        'label', v_absences_count || ' absences enregistrées'
      );
    ELSIF v_absences_count >= 1 THEN
      v_score := v_score + 10;
      v_factors := v_factors || jsonb_build_object(
        'code', 'absences_modere',
        'poids', 10,
        'label', v_absences_count || ' absence constatée'
      );
    END IF;

    -- Facteur 2 : Devoirs manquants ou non remis (30 points max)
    SELECT count(*) INTO v_missing_assignments
    FROM public.assignments a
    WHERE a.deleted_at IS NULL
      AND a.due_date < now()
      AND NOT EXISTS (
        SELECT 1 FROM public.assignment_submissions sub
        WHERE sub.assignment_id = a.id AND sub.student_id = v_student.id AND sub.deleted_at IS NULL
      );

    IF v_missing_assignments >= 3 THEN
      v_score := v_score + 30;
      v_factors := v_factors || jsonb_build_object(
        'code', 'devoirs_non_remis_critique',
        'poids', 30,
        'label', v_missing_assignments || ' devoirs non remis après échéance'
      );
    ELSIF v_missing_assignments >= 1 THEN
      v_score := v_score + (v_missing_assignments * 10);
      v_factors := v_factors || jsonb_build_object(
        'code', 'devoirs_non_remis',
        'poids', (v_missing_assignments * 10),
        'label', v_missing_assignments || ' devoir(s) en retard ou non remis'
      );
    END IF;

    -- Facteur 3 : Retard de paiement / impayés (15 points max)
    SELECT count(*) INTO v_unpaid_invoices
    FROM public.invoices i
    WHERE i.student_id = v_student.id
      AND i.deleted_at IS NULL
      AND i.due_date IS NOT NULL
      AND i.due_date < current_date;

    IF v_unpaid_invoices >= 1 THEN
      v_score := v_score + 15;
      v_factors := v_factors || jsonb_build_object(
        'code', 'impaye_retard',
        'poids', 15,
        'label', v_unpaid_invoices || ' facture(s) en retard de paiement'
      );
    END IF;

    -- Facteur 4 : Moyenne générale des notes (15 points max)
    SELECT coalesce(avg(score * 20.0 / nullif(total_points, 0)), 20) INTO v_avg_grade
    FROM public.test_results tr
    WHERE tr.student_id = v_student.id AND tr.deleted_at IS NULL;

    IF v_avg_grade < 10 THEN
      v_score := v_score + 15;
      v_factors := v_factors || jsonb_build_object(
        'code', 'moyenne_insuffisante',
        'poids', 15,
        'label', 'Moyenne générale inférieure à 10/20 (' || round(v_avg_grade, 1) || '/20)'
      );
    ELSIF v_avg_grade < 12 THEN
      v_score := v_score + 8;
      v_factors := v_factors || jsonb_build_object(
        'code', 'moyenne_fragile',
        'poids', 8,
        'label', 'Moyenne générale fragile (' || round(v_avg_grade, 1) || '/20)'
      );
    END IF;

    -- Plafonnement à 100
    IF v_score > 100 THEN v_score := 100; END IF;

    -- Détermination du niveau explicite
    IF v_score >= 70 THEN
      v_level := 'critique';
      v_high_risk_count := v_high_risk_count + 1;
    ELSIF v_score >= 45 THEN
      v_level := 'eleve';
      v_high_risk_count := v_high_risk_count + 1;
    ELSIF v_score >= 20 THEN
      v_level := 'modere';
    ELSE
      v_level := 'faible';
    END IF;

    -- Enregistrement ou mise à jour
    INSERT INTO public.risk_scores (
      student_id,
      score,
      level,
      factors,
      calculated_at,
      academic_year_id
    ) VALUES (
      v_student.id,
      v_score,
      v_level,
      v_factors,
      now(),
      v_student.academic_year_id
    )
    ON CONFLICT (student_id) DO UPDATE SET
      score = EXCLUDED.score,
      level = EXCLUDED.level,
      factors = EXCLUDED.factors,
      calculated_at = now(),
      academic_year_id = EXCLUDED.academic_year_id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Journalisation d'audit
  INSERT INTO public.audit_logs (action, entity_type, description, metadata)
  VALUES (
    'COMPUTE_RISK_SCORES',
    'risk_scores',
    'Recalcul du radar de risque effectué pour ' || v_updated_count || ' apprenant(s). Alertes élevées/critiques: ' || v_high_risk_count,
    jsonb_build_object('updated', v_updated_count, 'high_risk', v_high_risk_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'updated_students', v_updated_count,
    'high_risk_count', v_high_risk_count,
    'calculated_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_risk_scores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_risk_scores() TO authenticated, service_role;

-- 3.2 Ajout sécurisé d'une notification dans l'Outbox
CREATE OR REPLACE FUNCTION public.queue_notification(
  p_recipient_id uuid,
  p_channel text,
  p_template_code text,
  p_subject text,
  p_content text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_outbox_id uuid;
  v_name text := 'Destinataire';
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_recipient_id;

  INSERT INTO public.notification_outbox (
    recipient_id,
    recipient_name,
    channel,
    template_code,
    subject,
    content,
    status,
    metadata
  ) VALUES (
    p_recipient_id,
    v_name,
    p_channel,
    p_template_code,
    p_subject,
    p_content,
    'pending',
    p_metadata
  ) RETURNING id INTO v_outbox_id;

  RETURN jsonb_build_object('success', true, 'outbox_id', v_outbox_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.queue_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_notification(uuid, text, text, text, text, jsonb) TO authenticated, service_role;

-- 3.3 Mise à jour des drapeaux de fonctionnalités
UPDATE public.site_settings
SET data = jsonb_set(
  jsonb_set(
    coalesce(data, '{}'::jsonb),
    '{feature_flags,notifications}',
    'true'::jsonb,
    true
  ),
  '{feature_flags,risk_radar}',
  'true'::jsonb,
  true
),
updated_at = now()
WHERE id = 'default';
