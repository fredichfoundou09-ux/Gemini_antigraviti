-- Migration 0032: Moteur financier v2, Reçus normalisés (SN-REC-YYYY-XXXXXX), Clôtures financières journalières & audit
-- Aligné sur le Plan d'Enrichissement Fonctionnel Final v2.0 (Sections 4 à 20, 54, 55, 61, 62)

BEGIN;

-- 1. Séquence et table pour les reçus officiels (payment_receipts)
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START WITH 101;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_ref TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_matricule TEXT,
  formation_code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'ESPECES',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_ref TEXT,
  qr_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'ANNULE', 'REMBOURSE')),
  created_by TEXT,
  cancellation_reason TEXT,
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_student ON public.payment_receipts(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_ref ON public.payment_receipts(receipt_ref);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_date ON public.payment_receipts(payment_date);

-- RLS pour payment_receipts
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_read_policy ON public.payment_receipts;
CREATE POLICY receipts_read_policy ON public.payment_receipts
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR student_id = public.current_student_id()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS receipts_write_staff ON public.payment_receipts;
CREATE POLICY receipts_write_staff ON public.payment_receipts
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 2. Table des Clôtures Financières Journalières (daily_financial_closures)
CREATE TABLE IF NOT EXISTS public.daily_financial_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_date DATE NOT NULL UNIQUE,
  total_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_cash >= 0),
  total_mobile_money NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_mobile_money >= 0),
  total_transfer NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_transfer >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  payment_count INTEGER NOT NULL DEFAULT 0 CHECK (payment_count >= 0),
  status TEXT NOT NULL DEFAULT 'CLOTURE' CHECK (status IN ('OUVERT', 'CLOTURE')),
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closures_date ON public.daily_financial_closures(closure_date);

ALTER TABLE public.daily_financial_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS closures_read_staff ON public.daily_financial_closures;
CREATE POLICY closures_read_staff ON public.daily_financial_closures
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS closures_write_staff ON public.daily_financial_closures;
CREATE POLICY closures_write_staff ON public.daily_financial_closures
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3. Fonction pour générer le numéro de reçu normalisé SN-REC-YYYY-XXXXXX
CREATE OR REPLACE FUNCTION public.generate_receipt_ref()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq BIGINT;
  v_ref TEXT;
BEGIN
  v_seq := nextval('public.receipt_number_seq');
  v_ref := 'SN-REC-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  RETURN v_ref;
END;
$$;

-- 4. Fonction RPC d'enregistrement de paiement avec reçu normalisé et mise à jour d'échéancier
CREATE OR REPLACE FUNCTION public.record_student_payment_v3(
  p_student_id TEXT,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT DEFAULT '',
  p_invoice_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id TEXT;
  v_receipt_ref TEXT;
  v_student RECORD;
  v_rem_amount NUMERIC := p_amount;
  v_sched RECORD;
  v_allocated NUMERIC;
  v_qr_payload TEXT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Seul le personnel autorisé peut encaisser un paiement.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être supérieur à 0.';
  END IF;

  -- Récupérer l'apprenant
  SELECT s.*, u.nom as user_nom, u.prenom as user_prenom
  INTO v_student
  FROM public.students s
  LEFT JOIN public.users u ON u.id = s.user_id
  WHERE s.id = p_student_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apprenant introuvable (ID: %)', p_student_id;
  END IF;

  -- 1. Insérer le paiement
  v_payment_id := 'PAY-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || substring(md5(random()::text) from 1 for 4);
  INSERT INTO public.payments (id, student_id, invoice_id, montant, date, mode, reference, notes, created_at)
  VALUES (
    v_payment_id,
    p_student_id,
    p_invoice_id,
    p_amount,
    CURRENT_DATE,
    COALESCE(p_method, 'ESPECES'),
    p_reference,
    p_notes,
    now()
  );

  -- 2. Mettre à jour l'échéancier en 2 tranches (impaye / partiel / paye)
  FOR v_sched IN
    SELECT * FROM public.payment_schedules
    WHERE student_id = p_student_id AND status != 'paye'
    ORDER BY installment_number ASC
  LOOP
    IF v_rem_amount <= 0 THEN
      EXIT;
    END IF;

    v_allocated := LEAST(v_rem_amount, v_sched.amount - v_sched.paid_amount);
    IF v_allocated > 0 THEN
      UPDATE public.payment_schedules
      SET
        paid_amount = paid_amount + v_allocated,
        status = CASE
          WHEN paid_amount + v_allocated >= amount THEN 'paye'
          ELSE 'partiel'
        END,
        updated_at = now()
      WHERE id = v_sched.id;

      v_rem_amount := v_rem_amount - v_allocated;
    END IF;
  END LOOP;

  -- 3. Mettre à jour la facture associée si présente
  IF p_invoice_id IS NOT NULL THEN
    UPDATE public.invoices
    SET
      status = CASE
        WHEN (SELECT COALESCE(SUM(montant), 0) FROM public.payments WHERE invoice_id = p_invoice_id) >= montant THEN 'payee'
        ELSE 'partielle'
      END,
      updated_at = now()
    WHERE id = p_invoice_id;
  END IF;

  -- 4. Générer le reçu officiel SN-REC-YYYY-XXXXXX
  v_receipt_ref := public.generate_receipt_ref();
  v_qr_payload := jsonb_build_object(
    'ref', v_receipt_ref,
    'student', COALESCE(v_student.nom || ' ' || v_student.prenom, v_student.user_nom || ' ' || v_student.user_prenom, 'Apprenant'),
    'matricule', COALESCE(v_student.matricule, p_student_id),
    'amount', p_amount,
    'date', CURRENT_DATE,
    'sig', 'SENTINELLES-OFFICIAL-VERIFIED'
  )::text;

  INSERT INTO public.payment_receipts (
    receipt_ref,
    payment_id,
    student_id,
    student_name,
    student_matricule,
    formation_code,
    amount,
    payment_method,
    payment_date,
    transaction_ref,
    qr_payload,
    created_by
  ) VALUES (
    v_receipt_ref,
    v_payment_id,
    p_student_id,
    COALESCE(v_student.nom || ' ' || v_student.prenom, v_student.user_nom || ' ' || v_student.user_prenom, 'Apprenant'),
    v_student.matricule,
    COALESCE(v_student.formation, 'informatique'),
    p_amount,
    p_method,
    CURRENT_DATE,
    p_reference,
    v_qr_payload,
    auth.uid()::text
  );

  -- 5. Audit de la transaction
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details, created_at)
  VALUES (
    auth.uid(),
    'PAYMENT_RECORDED',
    'payment',
    v_payment_id,
    jsonb_build_object(
      'receipt_ref', v_receipt_ref,
      'student_id', p_student_id,
      'amount', p_amount,
      'method', p_method,
      'reference', p_reference
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'receipt_ref', v_receipt_ref,
    'amount', p_amount,
    'date', CURRENT_DATE
  );
END;
$$;

-- 5. Fonction RPC pour annuler un paiement avec motif obligatoire et audit (Section 17)
CREATE OR REPLACE FUNCTION public.cancel_payment_v2(
  p_payment_id TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Seul le personnel autorisé peut annuler un paiement.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Un motif d''annulation valide est obligatoire.';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement introuvable (ID: %)', p_payment_id;
  END IF;

  -- Mettre à jour le reçu lié
  UPDATE public.payment_receipts
  SET
    status = 'ANNULE',
    cancellation_reason = p_reason,
    cancelled_by = auth.uid()::text,
    cancelled_at = now()
  WHERE payment_id = p_payment_id;

  -- Audit log de l'annulation
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details, created_at)
  VALUES (
    auth.uid(),
    'PAYMENT_CANCELLED',
    'payment',
    p_payment_id,
    jsonb_build_object(
      'old_amount', v_payment.montant,
      'student_id', v_payment.student_id,
      'reason', p_reason
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'cancelled_at', now()
  );
END;
$$;

-- 6. Fonction RPC pour effectuer la clôture journalière (Section 18)
CREATE OR REPLACE FUNCTION public.execute_daily_closure(
  p_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cash NUMERIC := 0.00;
  v_momo NUMERIC := 0.00;
  v_trans NUMERIC := 0.00;
  v_total NUMERIC := 0.00;
  v_count INTEGER := 0;
  v_closure_id UUID;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Permission refusée: seul le personnel autorisé peut clôturer une journée financière.';
  END IF;

  -- Calculer les encaissements du jour
  SELECT
    COALESCE(SUM(CASE WHEN lower(mode) LIKE '%espece%' OR lower(mode) = 'cash' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN lower(mode) LIKE '%mobile%' OR lower(mode) LIKE '%momo%' OR lower(mode) LIKE '%airtel%' OR lower(mode) LIKE '%mtn%' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN lower(mode) LIKE '%virement%' OR lower(mode) LIKE '%banque%' THEN montant ELSE 0 END), 0),
    COALESCE(SUM(montant), 0),
    COUNT(*)
  INTO v_cash, v_momo, v_trans, v_total, v_count
  FROM public.payments
  WHERE date = p_date;

  INSERT INTO public.daily_financial_closures (
    closure_date,
    total_cash,
    total_mobile_money,
    total_transfer,
    total_amount,
    payment_count,
    status,
    closed_by,
    notes,
    updated_at
  ) VALUES (
    p_date,
    v_cash,
    v_momo,
    v_trans,
    v_total,
    v_count,
    'CLOTURE',
    auth.uid()::text,
    p_notes,
    now()
  )
  ON CONFLICT (closure_date) DO UPDATE SET
    total_cash = EXCLUDED.total_cash,
    total_mobile_money = EXCLUDED.total_mobile_money,
    total_transfer = EXCLUDED.total_transfer,
    total_amount = EXCLUDED.total_amount,
    payment_count = EXCLUDED.payment_count,
    status = 'CLOTURE',
    closed_by = EXCLUDED.closed_by,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_closure_id;

  -- Audit log de clôture
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details, created_at)
  VALUES (
    auth.uid(),
    'FINANCIAL_CLOSURE_EXECUTED',
    'daily_financial_closures',
    v_closure_id::text,
    jsonb_build_object(
      'date', p_date,
      'total_amount', v_total,
      'payment_count', v_count
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'closure_id', v_closure_id,
    'date', p_date,
    'total_amount', v_total,
    'total_cash', v_cash,
    'total_mobile_money', v_momo,
    'total_transfer', v_trans,
    'payment_count', v_count
  );
END;
$$;

COMMIT;
