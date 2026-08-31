-- Migration 0015: Optimisation financière complète, échéancier en 2 tranches, tarification hybride & sécurité
-- Conforme au rapport d'audit technique SENTINELLES NUMÉRIQUES (Sections 4 à 27)

BEGIN;

-- 1. Table des règles tarifaires officielles (pricing_rules & pricing_packages)
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'UNIT_PRICE' CHECK (mode IN ('UNIT_PRICE', 'PACKAGE')),
  registration_fee NUMERIC(12,2) NOT NULL DEFAULT 5000.00 CHECK (registration_fee >= 0),
  module_unit_price NUMERIC(12,2) NOT NULL DEFAULT 3500.00 CHECK (module_unit_price >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_code TEXT NOT NULL REFERENCES public.pricing_rules(formation_code) ON DELETE CASCADE,
  module_count INTEGER NOT NULL CHECK (module_count > 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed officiel des règles tarifaires
INSERT INTO public.pricing_rules (formation_code, mode, registration_fee, module_unit_price, active)
VALUES
  ('informatique', 'UNIT_PRICE', 5000.00, 3500.00, true),
  ('industriel', 'PACKAGE', 5000.00, 0.00, true)
ON CONFLICT (formation_code) DO UPDATE SET
  mode = EXCLUDED.mode,
  registration_fee = EXCLUDED.registration_fee,
  module_unit_price = EXCLUDED.module_unit_price,
  updated_at = now();

DELETE FROM public.pricing_packages WHERE formation_code = 'industriel';
INSERT INTO public.pricing_packages (formation_code, module_count, amount, label)
VALUES
  ('industriel', 3, 5000.00, 'Forfait 3 modules'),
  ('industriel', 6, 10000.00, 'Forfait 6 modules'),
  ('industriel', 12, 20000.00, 'Forfait 12 modules');

-- 2. Table de l'échéancier en deux tranches (payment_schedules)
CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  invoice_id TEXT,
  installment_number INTEGER NOT NULL CHECK (installment_number IN (1, 2)),
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'impaye' CHECK (status IN ('impaye', 'partiel', 'paye', 'retard')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_student ON public.payment_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date ON public.payment_schedules(due_date);

-- RLS pour payment_schedules
ALTER TABLE public.payment_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_schedules_read_all ON public.payment_schedules;
CREATE POLICY payment_schedules_read_all
  ON public.payment_schedules FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    OR student_id = public.current_student_id()
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS payment_schedules_write_staff ON public.payment_schedules;
CREATE POLICY payment_schedules_write_staff
  ON public.payment_schedules FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3. Fonction officielle de calcul de montant (Audit Section 17)
CREATE OR REPLACE FUNCTION public.calculate_registration_amount(
  p_formation_code TEXT,
  p_module_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule public.pricing_rules%ROWTYPE;
  v_module_count INTEGER := 0;
  v_invalid_count INTEGER := 0;
  v_reg_fee NUMERIC(12,2) := 5000.00;
  v_module_total NUMERIC(12,2) := 0.00;
  v_total NUMERIC(12,2) := 0.00;
  v_pkg RECORD;
  v_inst1 NUMERIC(12,2) := 0.00;
  v_inst2 NUMERIC(12,2) := 0.00;
BEGIN
  IF p_formation_code IS NULL OR p_formation_code = '' THEN
    RAISE EXCEPTION 'Le code formation est obligatoire.';
  END IF;

  -- 1. Récupérer la règle tarifaire
  SELECT * INTO v_rule FROM public.pricing_rules WHERE formation_code = p_formation_code AND active = true;
  IF NOT FOUND THEN
    v_reg_fee := 5000.00;
  ELSE
    v_reg_fee := v_rule.registration_fee;
  END IF;

  -- 2. Vérifier l'appartenance stricte de chaque module à la formation
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    v_module_count := array_length(p_module_ids, 1);

    SELECT count(*) INTO v_invalid_count
    FROM public.modules
    WHERE id = ANY(p_module_ids)
      AND formation <> p_formation_code;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Certains modules sélectionnés n''appartiennent pas à la formation %', p_formation_code;
    END IF;
  END IF;

  -- 3. Calcul selon le mode tarifaire
  IF v_rule.mode = 'UNIT_PRICE' THEN
    -- Mode unitaire (ex: Génie Informatique : 3500 / module)
    v_module_total := v_module_count * COALESCE(v_rule.module_unit_price, 3500.00);
  ELSIF v_rule.mode = 'PACKAGE' THEN
    -- Mode forfait (ex: Génie Industriel : 3 mod = 5000, 6 mod = 10000, 12 mod = 20000)
    IF v_module_count = 0 THEN
      v_module_total := 0.00;
    ELSE
      -- Chercher le forfait exact ou le plus proche
      SELECT * INTO v_pkg
      FROM public.pricing_packages
      WHERE formation_code = p_formation_code AND module_count = v_module_count AND active = true;

      IF FOUND THEN
        v_module_total := v_pkg.amount;
      ELSE
        -- Prorata basé sur le palier inférieur le plus proche ou formule de base
        SELECT * INTO v_pkg
        FROM public.pricing_packages
        WHERE formation_code = p_formation_code AND module_count <= v_module_count AND active = true
        ORDER BY module_count DESC LIMIT 1;

        IF FOUND AND v_pkg.module_count > 0 THEN
          v_module_total := round((v_pkg.amount / v_pkg.module_count) * v_module_count);
        ELSE
          v_module_total := round((5000.00 / 3) * v_module_count);
        END IF;
      END IF;
    END IF;
  ELSE
    v_module_total := v_module_count * 3500.00;
  END IF;

  v_total := v_reg_fee + v_module_total;

  -- Calcul de l'échéancier en deux tranches (Section 7)
  -- Tranche 1 (à l'inscription) : Frais d'inscription + 50% de la formation
  -- Tranche 2 (à J+30) : 50% restant de la formation
  v_inst1 := v_reg_fee + round(v_module_total / 2);
  v_inst2 := v_total - v_inst1;

  RETURN jsonb_build_object(
    'formation_code', p_formation_code,
    'module_count', v_module_count,
    'registration_fee', v_reg_fee,
    'module_total', v_module_total,
    'total', v_total,
    'installment_1', v_inst1,
    'installment_2', v_inst2
  );
END;
$$;

-- 4. Sécurisation de submit_registration avec validation d'appartenance des modules (Audit Section 14)
CREATE OR REPLACE FUNCTION public.submit_registration(
  p_nom TEXT,
  p_prenom TEXT,
  p_telephone TEXT,
  p_whatsapp TEXT,
  p_email TEXT,
  p_niveau TEXT,
  p_formation_code TEXT,
  p_module_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg_id UUID;
  v_pricing JSONB;
  v_mod_id UUID;
  v_invalid_count INTEGER := 0;
BEGIN
  -- Validations de base
  IF coalesce(trim(p_nom), '') = '' OR coalesce(trim(p_prenom), '') = '' THEN
    RAISE EXCEPTION 'Le nom et le prénom sont obligatoires.';
  END IF;

  IF coalesce(trim(p_telephone), '') = '' THEN
    RAISE EXCEPTION 'Le numéro de téléphone est obligatoire.';
  END IF;

  IF coalesce(trim(p_formation_code), '') = '' THEN
    RAISE EXCEPTION 'La formation choisie est obligatoire.';
  END IF;

  -- Validation d'appartenance des modules
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    SELECT count(*) INTO v_invalid_count
    FROM public.modules
    WHERE id = ANY(p_module_ids) AND formation <> p_formation_code;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Sécurité : un ou plusieurs modules sélectionnés ne correspondent pas à la formation %', p_formation_code;
    END IF;
  END IF;

  -- Calcul certifié du montant par le moteur officiel
  v_pricing := public.calculate_registration_amount(p_formation_code, p_module_ids);

  -- Création de la pré-inscription
  INSERT INTO public.registrations (
    nom, prenom, telephone, whatsapp, email, niveau, formation, statut, date
  ) VALUES (
    trim(p_nom),
    trim(p_prenom),
    trim(p_telephone),
    trim(coalesce(p_whatsapp, p_telephone)),
    NULLIF(trim(p_email), ''),
    coalesce(p_niveau, 'Débutant'),
    p_formation_code,
    'en_attente',
    to_char(now(), 'YYYY-MM-DD')
  )
  RETURNING id INTO v_reg_id;

  -- Association des modules
  IF p_module_ids IS NOT NULL THEN
    FOREACH v_mod_id IN ARRAY p_module_ids LOOP
      INSERT INTO public.registration_modules (registration_id, module_id)
      VALUES (v_reg_id, v_mod_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', v_reg_id,
    'status', 'en_attente',
    'pricing', v_pricing
  );
END;
$$;

-- 5. Confirmation transactionnelle avec génération d'échéances (Audit Section 6, 7 & 18)
CREATE OR REPLACE FUNCTION public.confirm_registration_transactional(
  p_registration_id UUID,
  p_student_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg public.registrations%ROWTYPE;
  v_mod_ids UUID[];
  v_pricing JSONB;
  v_inv_inscription_id TEXT;
  v_inv_formation_id TEXT;
  v_today DATE := CURRENT_DATE;
  v_due_month DATE := CURRENT_DATE + INTERVAL '30 days';
BEGIN
  -- Vérifier rôle staff
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.';
  END IF;

  -- Récupérer la pré-inscription
  SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pré-inscription introuvable.';
  END IF;

  -- Récupérer les modules
  SELECT array_agg(module_id) INTO v_mod_ids
  FROM public.registration_modules
  WHERE registration_id = p_registration_id;

  -- Calculer les montants officiels
  v_pricing := public.calculate_registration_amount(v_reg.formation, v_mod_ids);

  -- 1. Marquer la pré-inscription comme confirmée
  UPDATE public.registrations
  SET statut = 'confirmee', updated_at = now()
  WHERE id = p_registration_id;

  -- 2. Facture d'inscription (5 000 FCFA)
  IF (v_pricing->>'registration_fee')::numeric > 0 THEN
    v_inv_inscription_id := 'INV-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
    INSERT INTO public.invoices (
      id, student_id, type, amount, status, date, due_date, description, created_by
    ) VALUES (
      v_inv_inscription_id,
      p_student_id,
      'inscription',
      (v_pricing->>'registration_fee')::numeric,
      'impaye',
      v_today,
      v_today,
      'Frais d''inscription obligatoire — ' || v_reg.formation,
      auth.uid()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 3. Facture de formation
  IF (v_pricing->>'module_total')::numeric > 0 THEN
    v_inv_formation_id := 'INV-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
    INSERT INTO public.invoices (
      id, student_id, type, amount, status, date, due_date, description, created_by
    ) VALUES (
      v_inv_formation_id,
      p_student_id,
      'formation',
      (v_pricing->>'module_total')::numeric,
      'impaye',
      v_today,
      v_due_month,
      'Frais de formation (' || (v_pricing->>'module_count') || ' module(s)) — ' || v_reg.formation,
      auth.uid()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Échéancier en 2 tranches (payment_schedules)
  -- Tranche 1 (à l'inscription)
  INSERT INTO public.payment_schedules (
    student_id, invoice_id, installment_number, label, amount, paid_amount, due_date, status
  ) VALUES (
    p_student_id,
    v_inv_formation_id,
    1,
    'Tranche 1 (Inscription + 1ère tranche)',
    (v_pricing->>'installment_1')::numeric,
    0,
    v_today,
    'impaye'
  );

  -- Tranche 2 (à J+30)
  IF (v_pricing->>'installment_2')::numeric > 0 THEN
    INSERT INTO public.payment_schedules (
      student_id, invoice_id, installment_number, label, amount, paid_amount, due_date, status
    ) VALUES (
      p_student_id,
      v_inv_formation_id,
      2,
      'Tranche 2 (Solde formation)',
      (v_pricing->>'installment_2')::numeric,
      0,
      v_due_month,
      'impaye'
    );
  END IF;

  -- 5. Journaliser dans audit_logs
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'CONFIRM_REGISTRATION_TRANSACTIONAL',
    jsonb_build_object(
      'registration_id', p_registration_id,
      'student_id', p_student_id,
      'pricing', v_pricing
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'pricing', v_pricing
  );
END;
$$;

-- 6. Enregistrement d'un paiement avec lettrage d'échéance et audit log (Audit Section 8)
CREATE OR REPLACE FUNCTION public.record_student_payment_v2(
  p_student_id TEXT,
  p_amount NUMERIC,
  p_method TEXT,
  p_reference TEXT,
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
  v_remaining_to_allocate NUMERIC := p_amount;
  v_sched RECORD;
  v_allocate NUMERIC;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Action réservée au personnel administratif.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du paiement doit être supérieur à 0.';
  END IF;

  -- Vérifier unicité de la référence
  IF p_reference IS NOT NULL AND p_reference <> '' THEN
    IF EXISTS (SELECT 1 FROM public.payments WHERE reference = p_reference) THEN
      RAISE EXCEPTION 'Cette référence de transaction (%) existe déjà.', p_reference;
    END IF;
  END IF;

  -- 1. Créer le paiement
  v_payment_id := 'PAY-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
  INSERT INTO public.payments (
    id, student_id, invoice_id, amount, method, reference, date, notes
  ) VALUES (
    v_payment_id,
    p_student_id,
    p_invoice_id,
    p_amount,
    p_method,
    p_reference,
    to_char(now(), 'YYYY-MM-DD'),
    p_notes
  );

  -- 2. Lettrage automatique des tranches d'échéances
  FOR v_sched IN
    SELECT * FROM public.payment_schedules
    WHERE student_id = p_student_id AND status <> 'paye'
    ORDER BY installment_number ASC
  LOOP
    IF v_remaining_to_allocate <= 0 THEN
      EXIT;
    END IF;

    v_allocate := LEAST(v_remaining_to_allocate, (v_sched.amount - v_sched.paid_amount));

    UPDATE public.payment_schedules
    SET
      paid_amount = paid_amount + v_allocate,
      status = CASE
        WHEN (paid_amount + v_allocate) >= amount THEN 'paye'
        ELSE 'partiel'
      END,
      updated_at = now()
    WHERE id = v_sched.id;

    v_remaining_to_allocate := v_remaining_to_allocate - v_allocate;
  END LOOP;

  -- 3. Audit log
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'RECORD_PAYMENT',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'student_id', p_student_id,
      'amount', p_amount,
      'method', p_method,
      'reference', p_reference
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'allocated_amount', p_amount
  );
END;
$$;

COMMIT;
