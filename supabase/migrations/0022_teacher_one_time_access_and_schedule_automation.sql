-- =========================================================================
-- 0022_teacher_one_time_access_and_schedule_automation.sql
-- 1. Accès à usage unique (One-Time Token) pour formateurs via WhatsApp
-- 2. Finalisation et personnalisation du profil formateur au premier accès
-- 3. Automatisation de l'échéancier financier des apprenants en 2 tranches
-- =========================================================================

-- 1. RPC de consommation atomique et expiration immédiate du jeton formateur
CREATE OR REPLACE FUNCTION public.consume_teacher_access_token(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_teacher RECORD;
  v_profile RECORD;
BEGIN
  -- Recherche du jeton valide, non consommé et non expiré
  SELECT * INTO v_inv
  FROM public.account_invitations
  WHERE token = trim(p_token)
    AND used_at IS NULL
    AND expires_at > now();

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'TOKEN_INVALID_OR_ALREADY_USED',
      'message', 'Ce lien d''accès à usage unique a déjà été utilisé ou a expiré. Veuillez vous connecter avec votre identifiant et votre mot de passe.'
    );
  END IF;

  -- Invalidation immédiate et atomique (usage unique garanti dès la première tentative)
  UPDATE public.account_invitations
  SET used_at = now()
  WHERE id = v_inv.id;

  -- Récupération du formateur et du profil associé
  SELECT * INTO v_teacher FROM public.teachers WHERE id = v_inv.target_id;
  IF v_teacher.user_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_teacher.user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', v_teacher.id,
    'user_id', v_teacher.user_id,
    'nom', v_teacher.nom,
    'prenom', v_teacher.prenom,
    'email', COALESCE(v_teacher.email, v_profile.email, v_inv.email, ''),
    'phone', COALESCE(v_teacher.phone, v_profile.phone, v_inv.phone, ''),
    'username', COALESCE(v_profile.username, ''),
    'must_change_password', COALESCE(v_profile.must_change_password, true)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_teacher_access_token(TEXT) TO anon, authenticated;

-- 2. RPC pour finaliser le profil formateur lors du premier accès
CREATE OR REPLACE FUNCTION public.complete_teacher_first_access(
  p_teacher_id TEXT,
  p_user_id UUID,
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validation minimale du mot de passe
  IF length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le mot de passe doit contenir au moins 6 caractères.');
  END IF;

  -- 1. Mise à jour de auth.users si p_user_id existe
  IF p_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt(trim(p_new_password), gen_salt('bf')),
        email = COALESCE(NULLIF(trim(p_email), ''), email),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = p_user_id;

    -- Mise à jour du profil public
    UPDATE public.profiles
    SET email = COALESCE(NULLIF(trim(p_email), ''), email),
        must_change_password = false,
        active = true,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- 2. Mise à jour de la table teachers
  IF p_teacher_id IS NOT NULL THEN
    UPDATE public.teachers
    SET email = COALESCE(NULLIF(trim(p_email), ''), email),
        updated_at = now()
    WHERE id = p_teacher_id;
  END IF;

  -- 3. Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
  VALUES (
    p_user_id,
    'TEACHER_INITIAL_SETUP',
    'teachers',
    p_teacher_id,
    'Activation réussie et mot de passe initial personnalisé par l''enseignant'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Profil et mot de passe enregistrés avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_teacher_first_access(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- 3. RPC d'automatisation des tranches d'échéancier financier (Frais de formation en 2 tranches de 50%)
CREATE OR REPLACE FUNCTION public.generate_student_payment_schedule(
  p_student_id TEXT,
  p_tuition_total NUMERIC,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_half NUMERIC;
  v_due1 DATE;
  v_due2 DATE;
BEGIN
  IF p_tuition_total <= 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Aucun frais de formation à échelonner.');
  END IF;

  -- Si un échéancier existe déjà pour cet apprenant, ne pas dupliquer
  IF EXISTS (SELECT 1 FROM public.payment_schedules WHERE student_id = p_student_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Échéancier déjà existant.');
  END IF;

  v_half := round(p_tuition_total / 2.0);
  v_due1 := COALESCE(p_start_date, CURRENT_DATE) + INTERVAL '30 days';
  v_due2 := COALESCE(p_start_date, CURRENT_DATE) + INTERVAL '60 days';

  -- Tranche 1 (50% après 1 mois)
  INSERT INTO public.payment_schedules (
    student_id, installment_number, label, amount, paid_amount, due_date, status
  ) VALUES (
    p_student_id, 1, 'Tranche 1 (50% des cours — après 1 mois)', v_half, 0, v_due1, 'pending'
  );

  -- Tranche 2 (50% restant avant la fin de formation)
  INSERT INTO public.payment_schedules (
    student_id, installment_number, label, amount, paid_amount, due_date, status
  ) VALUES (
    p_student_id, 2, 'Tranche 2 (Solde restant — fin de formation)', (p_tuition_total - v_half), 0, v_due2, 'pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'tuition_total', p_tuition_total,
    'tranche_1', v_half,
    'due_date_1', v_due1,
    'tranche_2', (p_tuition_total - v_half),
    'due_date_2', v_due2
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_student_payment_schedule(TEXT, NUMERIC, DATE) TO authenticated, anon;
