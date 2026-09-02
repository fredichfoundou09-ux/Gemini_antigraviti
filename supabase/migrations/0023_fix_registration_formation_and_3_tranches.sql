-- =========================================================================
-- 0023_fix_registration_formation_and_3_tranches.sql
-- 1. Correction de la colonne formation_id dans registrations et modules
-- 2. Mise à niveau de submit_registration et calculate_registration_amount
-- 3. Échéancier officiel en 3 tranches (Inscription, Tranche 1 à 1 mois, Tranche 2 fin)
-- =========================================================================

-- 1. Recalcul certifié avec 3 tranches officielles et résolution correcte de formation_id
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
  v_formation_id UUID;
  v_rule public.pricing_rules%ROWTYPE;
  v_module_count INTEGER := 0;
  v_invalid_count INTEGER := 0;
  v_reg_fee NUMERIC(12,2) := 5000.00;
  v_module_total NUMERIC(12,2) := 0.00;
  v_total NUMERIC(12,2) := 0.00;
  v_pkg RECORD;
  v_tranche1 NUMERIC(12,2) := 0.00;
  v_tranche2 NUMERIC(12,2) := 0.00;
  v_tranche3 NUMERIC(12,2) := 0.00;
BEGIN
  IF p_formation_code IS NULL OR trim(p_formation_code) = '' THEN
    RAISE EXCEPTION 'Le code formation est obligatoire.';
  END IF;

  -- 1. Résolution de la formation
  SELECT id INTO v_formation_id
  FROM public.formations
  WHERE code = lower(trim(p_formation_code))
  LIMIT 1;

  IF v_formation_id IS NULL THEN
    RAISE EXCEPTION 'Formation % introuvable.', p_formation_code;
  END IF;

  -- 2. Récupérer la règle tarifaire si présente
  SELECT * INTO v_rule
  FROM public.pricing_rules
  WHERE formation_code = lower(trim(p_formation_code)) AND active = true;

  IF NOT FOUND THEN
    v_reg_fee := 5000.00;
  ELSE
    v_reg_fee := v_rule.registration_fee;
  END IF;

  -- 3. Vérifier l'appartenance stricte de chaque module à la formation
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    v_module_count := array_length(p_module_ids, 1);

    SELECT count(*) INTO v_invalid_count
    FROM public.modules
    WHERE id = ANY(p_module_ids)
      AND formation_id <> v_formation_id;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Certains modules sélectionnés n''appartiennent pas à la formation %', p_formation_code;
    END IF;
  END IF;

  -- 4. Calcul du montant des cours selon le mode
  IF lower(trim(p_formation_code)) = 'industriel' THEN
    -- Génie Industriel : barème officiel par packs
    IF v_module_count = 0 THEN
      v_module_total := 0.00;
    ELSIF v_module_count <= 3 THEN
      v_module_total := 5000.00;
    ELSIF v_module_count <= 6 THEN
      v_module_total := 10000.00;
    ELSE
      v_module_total := 20000.00;
    END IF;
  ELSE
    -- Génie Informatique : 3 500 FCFA par module
    v_module_total := v_module_count * 3500.00;
  END IF;

  v_total := v_reg_fee + v_module_total;

  -- 5. Échéancier officiel en 3 tranches :
  -- Tranche 1 : Frais d'inscription (5 000 FCFA) à l'inscription avant le début des cours
  -- Tranche 2 : 50% des cours à régler après 1 mois
  -- Tranche 3 : Solde restant des cours à régler avant la fin de la formation
  v_tranche1 := v_reg_fee;
  v_tranche2 := round(v_module_total / 2.0);
  v_tranche3 := v_module_total - v_tranche2;

  RETURN jsonb_build_object(
    'registration_fee', v_reg_fee,
    'module_total', v_module_total,
    'total', v_total,
    'module_count', v_module_count,
    'tranche_1', v_tranche1,
    'tranche_2', v_tranche2,
    'tranche_3', v_tranche3,
    'installment_1', v_tranche1,
    'installment_2', v_tranche2,
    'installment_3', v_tranche3
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_registration_amount(TEXT, UUID[]) TO anon, authenticated;


-- 2. Correction complète de submit_registration
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
  v_formation_id UUID;
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

  -- Résolution de formation_id
  SELECT id INTO v_formation_id
  FROM public.formations
  WHERE code = lower(trim(p_formation_code))
  LIMIT 1;

  IF v_formation_id IS NULL THEN
    RAISE EXCEPTION 'La formation % est invalide.', p_formation_code;
  END IF;

  -- Validation d'appartenance des modules
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    SELECT count(*) INTO v_invalid_count
    FROM public.modules
    WHERE id = ANY(p_module_ids)
      AND formation_id <> v_formation_id;

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'Sécurité : un ou plusieurs modules sélectionnés ne correspondent pas à la formation choisie.';
    END IF;
  END IF;

  -- Calcul certifié du montant par le moteur officiel
  v_pricing := public.calculate_registration_amount(p_formation_code, p_module_ids);

  -- Création de la pré-inscription avec formation_id
  INSERT INTO public.registrations (
    nom, prenom, telephone, whatsapp, email, niveau, formation_id, statut, date
  ) VALUES (
    trim(p_nom),
    trim(p_prenom),
    trim(p_telephone),
    trim(coalesce(p_whatsapp, p_telephone)),
    NULLIF(trim(p_email), ''),
    coalesce(p_niveau, 'Débutant'),
    v_formation_id,
    'en_attente',
    CURRENT_DATE
  )
  RETURNING id INTO v_reg_id;

  -- Association des modules choisis
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

GRANT EXECUTE ON FUNCTION public.submit_registration(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) TO anon, authenticated;


-- 3. Correction de confirm_registration_transactional pour utiliser formation_id
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
  v_formation_code TEXT;
  v_mod_ids UUID[];
  v_pricing JSONB;
  v_inv_inscription_id TEXT;
  v_inv_formation_id TEXT;
  v_today DATE := CURRENT_DATE;
  v_due_month DATE := CURRENT_DATE + INTERVAL '30 days';
  v_due_final DATE := CURRENT_DATE + INTERVAL '60 days';
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

  -- Récupérer le code formation
  SELECT code INTO v_formation_code FROM public.formations WHERE id = v_reg.formation_id;

  -- Récupérer les modules
  SELECT array_agg(module_id) INTO v_mod_ids
  FROM public.registration_modules
  WHERE registration_id = p_registration_id;

  -- Calculer les montants officiels
  v_pricing := public.calculate_registration_amount(v_formation_code, v_mod_ids);

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
      'Frais d''inscription obligatoire — ' || COALESCE(v_formation_code, 'formation'),
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
      'Frais de formation (' || (v_pricing->>'module_count') || ' module(s)) — ' || COALESCE(v_formation_code, 'formation'),
      auth.uid()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Échéancier officiel en 3 tranches (payment_schedules)
  -- Tranche 1 : Frais d'inscription (à régler au démarrage)
  INSERT INTO public.payment_schedules (
    student_id, installment_number, label, amount, paid_amount, due_date, status
  ) VALUES (
    p_student_id,
    1,
    'Tranche 1 (Frais d''inscription — avant début des cours)',
    (v_pricing->>'tranche_1')::numeric,
    0,
    v_today,
    'pending'
  );

  -- Tranche 2 : 50% des cours (après 1 mois)
  IF (v_pricing->>'tranche_2')::numeric > 0 THEN
    INSERT INTO public.payment_schedules (
      student_id, installment_number, label, amount, paid_amount, due_date, status
    ) VALUES (
      p_student_id,
      2,
      'Tranche 2 (50% des cours — après 1 mois)',
      (v_pricing->>'tranche_2')::numeric,
      0,
      v_due_month,
      'pending'
    );
  END IF;

  -- Tranche 3 : Solde restant des cours (avant fin de formation)
  IF (v_pricing->>'tranche_3')::numeric > 0 THEN
    INSERT INTO public.payment_schedules (
      student_id, installment_number, label, amount, paid_amount, due_date, status
    ) VALUES (
      p_student_id,
      3,
      'Tranche 3 (Solde restant des cours — fin de formation)',
      (v_pricing->>'tranche_3')::numeric,
      0,
      v_due_final,
      'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'student_id', p_student_id,
    'pricing', v_pricing
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_registration_transactional(UUID, TEXT) TO authenticated;
