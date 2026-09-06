-- Migration 0033: Gestion financière des formateurs, Avances & Bulletins de rémunération
-- Aligné sur le Plan d'Enrichissement Fonctionnel Final v2.0 (Sections 21 à 28, 54, 63)

BEGIN;

-- 1. Table des avances sur rémunération des formateurs (teacher_advances)
CREATE TABLE IF NOT EXISTS public.teacher_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROUVE' CHECK (status IN ('EN_ATTENTE', 'APPROUVE', 'REFUSE', 'DEDUIT')),
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_advances_teacher ON public.teacher_advances(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_advances_date ON public.teacher_advances(date);

ALTER TABLE public.teacher_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_advances_read_policy ON public.teacher_advances;
CREATE POLICY teacher_advances_read_policy ON public.teacher_advances
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS teacher_advances_write_staff ON public.teacher_advances;
CREATE POLICY teacher_advances_write_staff ON public.teacher_advances
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 2. Table des bulletins de rémunération officiels (teacher_payslips)
CREATE TABLE IF NOT EXISTS public.teacher_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_ref TEXT NOT NULL UNIQUE,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  period_month TEXT NOT NULL, -- Ex: '2026-09'
  modules_taught TEXT[],
  sessions_count INTEGER NOT NULL DEFAULT 0 CHECK (sessions_count >= 0),
  hours_count NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (hours_count >= 0),
  rate_per_session NUMERIC(12,2) NOT NULL DEFAULT 2500.00 CHECK (rate_per_session >= 0),
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  advances_deducted NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (advances_deducted >= 0),
  net_payable NUMERIC(12,2) NOT NULL CHECK (net_payable >= 0),
  status TEXT NOT NULL DEFAULT 'VALIDE' CHECK (status IN ('EN_ATTENTE', 'VALIDE', 'PAYE', 'ANNULE')),
  generated_by TEXT,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_payslips_teacher ON public.teacher_payslips(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payslips_period ON public.teacher_payslips(period_month);

ALTER TABLE public.teacher_payslips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_payslips_read_policy ON public.teacher_payslips;
CREATE POLICY teacher_payslips_read_policy ON public.teacher_payslips
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS teacher_payslips_write_staff ON public.teacher_payslips;
CREATE POLICY teacher_payslips_write_staff ON public.teacher_payslips
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3. Séquence pour les bulletins de rémunération : SN-PAIE-YYYY-XXXXXX
CREATE SEQUENCE IF NOT EXISTS public.payslip_number_seq START WITH 101;

-- 4. Fonction RPC pour générer un bulletin de rémunération formateur
CREATE OR REPLACE FUNCTION public.generate_teacher_payslip_v2(
  p_teacher_id TEXT,
  p_period_month TEXT, -- Format YYYY-MM
  p_rate_per_session NUMERIC DEFAULT 2500.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_teacher RECORD;
  v_sessions_count INTEGER := 0;
  v_hours_count NUMERIC(6,2) := 0;
  v_gross NUMERIC(12,2) := 0;
  v_advances NUMERIC(12,2) := 0;
  v_net NUMERIC(12,2) := 0;
  v_payslip_ref TEXT;
  v_seq BIGINT;
  v_year TEXT := substring(p_period_month from 1 for 4);
  v_modules TEXT[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Seul le personnel administratif peut émettre un bulletin de rémunération.';
  END IF;

  SELECT t.*, u.nom as user_nom, u.prenom as user_prenom
  INTO v_teacher
  FROM public.teachers t
  LEFT JOIN public.users u ON u.id = t.user_id
  WHERE t.id = p_teacher_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formateur introuvable (ID: %)', p_teacher_id;
  END IF;

  -- 1. Calcul des séances validées pour le mois (statut = 'valide' ou 'validé')
  SELECT
    COUNT(*),
    COALESCE(SUM(heures), 0)
  INTO v_sessions_count, v_hours_count
  FROM public.teacher_hours
  WHERE teacher_id = p_teacher_id
    AND to_char(date, 'YYYY-MM') = p_period_month
    AND lower(statut) IN ('valide', 'validé', 'validee');

  -- Montant brut (2 500 FCFA / séance par défaut)
  v_gross := v_sessions_count * p_rate_per_session;

  -- 2. Avances approuvées pour ce mois
  SELECT COALESCE(SUM(amount), 0)
  INTO v_advances
  FROM public.teacher_advances
  WHERE teacher_id = p_teacher_id
    AND to_char(date, 'YYYY-MM') = p_period_month
    AND status IN ('APPROUVE', 'DEDUIT');

  v_net := GREATEST(v_gross - v_advances, 0);

  -- Modules enseignés
  SELECT ARRAY_AGG(DISTINCT module_id)
  INTO v_modules
  FROM public.teacher_hours
  WHERE teacher_id = p_teacher_id
    AND to_char(date, 'YYYY-MM') = p_period_month;

  -- 3. Référence bulletin SN-PAIE-YYYY-XXXXXX
  v_seq := nextval('public.payslip_number_seq');
  v_payslip_ref := 'SN-PAIE-' || v_year || '-' || lpad(v_seq::text, 6, '0');

  -- 4. Insérer ou mettre à jour le bulletin
  INSERT INTO public.teacher_payslips (
    payslip_ref,
    teacher_id,
    teacher_name,
    period_month,
    modules_taught,
    sessions_count,
    hours_count,
    rate_per_session,
    gross_amount,
    advances_deducted,
    net_payable,
    status,
    generated_by
  ) VALUES (
    v_payslip_ref,
    p_teacher_id,
    COALESCE(v_teacher.nom || ' ' || v_teacher.prenom, v_teacher.user_nom || ' ' || v_teacher.user_prenom, 'Formateur'),
    p_period_month,
    v_modules,
    v_sessions_count,
    v_hours_count,
    p_rate_per_session,
    v_gross,
    v_advances,
    v_net,
    'VALIDE',
    auth.uid()::text
  );

  -- 5. Audit
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details, created_at)
  VALUES (
    auth.uid(),
    'PAYSLIP_GENERATED',
    'teacher_payslips',
    v_payslip_ref,
    jsonb_build_object(
      'teacher_id', p_teacher_id,
      'period', p_period_month,
      'sessions', v_sessions_count,
      'gross', v_gross,
      'net', v_net
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payslip_ref', v_payslip_ref,
    'teacher_name', COALESCE(v_teacher.nom || ' ' || v_teacher.prenom, v_teacher.user_nom || ' ' || v_teacher.user_prenom, 'Formateur'),
    'period', p_period_month,
    'sessions_count', v_sessions_count,
    'rate_per_session', p_rate_per_session,
    'gross_amount', v_gross,
    'advances_deducted', v_advances,
    'net_payable', v_net
  );
END;
$$;

COMMIT;
