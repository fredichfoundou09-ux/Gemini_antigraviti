-- Migration 0062: Procédures de notation papier, suppression fiable de résultat et modes auto/manuel/hybride

-- 1. Procédure de suppression sécurisée d'un résultat d'examen avec réinitialisation de tentative
CREATE OR REPLACE FUNCTION public.delete_test_result_safe(
  p_result_id uuid,
  p_reset_attempt boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role text;
  v_test_id uuid;
  v_student_id text;
  v_teacher_id text;
  v_owner_uid uuid;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT tr.test_id, tr.student_id INTO v_test_id, v_student_id
  FROM public.test_results tr
  WHERE tr.id = p_result_id;

  IF v_test_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Résultat introuvable');
  END IF;

  -- Vérifier les autorisations
  SELECT role INTO v_role FROM public.users WHERE id = v_caller_uid;
  SELECT teacher_id INTO v_teacher_id FROM public.tests WHERE id = v_test_id;

  IF v_teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_owner_uid FROM public.teachers WHERE id = v_teacher_id;
  END IF;

  IF v_role NOT IN ('admin', 'superadmin') AND (v_owner_uid IS NULL OR v_owner_uid <> v_caller_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Droits formateur titulaire ou administration requis');
  END IF;

  -- Supprimer les réponses associées
  DELETE FROM public.test_answers WHERE result_id = p_result_id;

  -- Supprimer le résultat
  DELETE FROM public.test_results WHERE id = p_result_id;

  -- Libérer la tentative pour autoriser une recomposition si demandé
  IF p_reset_attempt AND v_test_id IS NOT NULL AND v_student_id IS NOT NULL THEN
    DELETE FROM public.assessment_attempts
    WHERE test_id = v_test_id AND student_id = v_student_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', p_result_id,
    'attempt_reset', p_reset_attempt
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_test_result_safe(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_result_safe(uuid, boolean) TO authenticated, service_role;

-- 2. Procédure pour validation de bordereau papier en lot
CREATE OR REPLACE FUNCTION public.save_paper_results(
  p_test_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role text;
  v_test RECORD;
  v_owner_uid uuid;
  v_row jsonb;
  v_student_id text;
  v_note numeric;
  v_bareme numeric;
  v_pourcentage numeric;
  v_statut text;
  v_appreciation text;
  v_result_id uuid;
  v_saved_count int := 0;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
  IF v_test.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Évaluation introuvable');
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_caller_uid;
  IF v_test.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_owner_uid FROM public.teachers WHERE id = v_test.teacher_id;
  END IF;

  IF v_role NOT IN ('admin', 'superadmin') AND (v_owner_uid IS NULL OR v_owner_uid <> v_caller_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Droits formateur titulaire ou administration requis');
  END IF;

  v_bareme := COALESCE(v_test.bareme, 20);
  IF v_bareme <= 0 THEN v_bareme := 20; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_student_id := v_row->>'student_id';
    BEGIN
      v_note := (v_row->>'note')::numeric;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF v_student_id IS NULL OR v_note IS NULL THEN
      CONTINUE;
    END IF;

    v_appreciation := COALESCE(v_row->>'appreciation', 'Examen papier validé');
    v_pourcentage := ROUND(((v_note / v_bareme) * 100)::numeric, 0);
    IF v_note >= (v_bareme / 2) THEN
      v_statut := 'reussi';
    ELSE
      v_statut := 'echoue';
    END IF;

    SELECT id INTO v_result_id
    FROM public.test_results
    WHERE test_id = p_test_id AND student_id = v_student_id;

    IF v_result_id IS NOT NULL THEN
      UPDATE public.test_results
      SET note = v_note,
          pourcentage = v_pourcentage,
          statut = v_statut,
          valide = true,
          date = now()
      WHERE id = v_result_id;
    ELSE
      INSERT INTO public.test_results (
        test_id, student_id, note, pourcentage, date, heure, valide, statut
      ) VALUES (
        p_test_id, v_student_id, v_note, v_pourcentage, now(), to_char(now(), 'HH24:MI'), true, v_statut
      )
      RETURNING id INTO v_result_id;
    END IF;

    -- Report vers la table officielle des notes pour bulletin
    IF v_test.module_id IS NOT NULL THEN
      INSERT INTO public.grades (student_id, module_id, note, appreciation, date, created_by)
      VALUES (
        v_student_id,
        v_test.module_id,
        ROUND(((v_note / v_bareme) * 20)::numeric, 1),
        v_appreciation,
        CURRENT_DATE,
        v_caller_uid
      );
    END IF;

    v_saved_count := v_saved_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved_count', v_saved_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_paper_results(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_paper_results(uuid, jsonb) TO authenticated, service_role;

-- 3. Procédure upsert_grade_safe
CREATE OR REPLACE FUNCTION public.upsert_grade_safe(
  p_student_id text,
  p_module_id uuid,
  p_note numeric,
  p_appreciation text DEFAULT '',
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role text;
  v_grade_id uuid;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_caller_uid;
  IF v_role NOT IN ('admin', 'superadmin', 'formateur') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès réservé au corps enseignant et administratif');
  END IF;

  INSERT INTO public.grades (student_id, module_id, note, appreciation, date, created_by)
  VALUES (
    p_student_id,
    p_module_id,
    p_note,
    COALESCE(p_appreciation, ''),
    COALESCE(p_date, CURRENT_DATE),
    v_caller_uid
  )
  RETURNING id INTO v_grade_id;

  RETURN jsonb_build_object('success', true, 'grade_id', v_grade_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_grade_safe(text, uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_grade_safe(text, uuid, numeric, text, date) TO authenticated, service_role;

-- 4. Colonnes modes de correction, modes de publication et workflow
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS mode_correction text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS mode_publication text DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS date_publication_resultats timestamptz,
  ADD COLUMN IF NOT EXISTS anonymiser boolean DEFAULT false;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS mode_correction text DEFAULT 'manuel',
  ADD COLUMN IF NOT EXISTS mode_publication text DEFAULT 'apres_validation',
  ADD COLUMN IF NOT EXISTS date_publication_resultats timestamptz,
  ADD COLUMN IF NOT EXISTS anonymiser boolean DEFAULT false;

ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS workflow_statut text DEFAULT 'publie';
