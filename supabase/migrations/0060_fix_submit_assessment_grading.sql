-- ============================================================
-- 0060_fix_submit_assessment_grading.sql
-- Correction et fiabilisation de la notation serveur (submit_assessment) :
-- 1. QCM multiple : comparaison insensible à l'ordre (ensembles)
-- 2. Numérique : support de la virgule décimale et robustesse de parsing
-- 3. Réponse courte : égalité stricte, trim/lower, pas de sous-chaînes erronées,
--    et bascule en correction manuelle 'en_attente' si la bonne réponse n'est pas renseignée
-- 4. Écriture synchronisée dans reponse_donnee et reponse
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_assessment(
  p_attempt_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt record;
  v_test record;
  v_student record;
  v_q record;
  v_ans_val text;
  v_total_points numeric := 0;
  v_earned_points numeric := 0;
  v_note numeric := 0;
  v_bareme numeric := 20;
  v_pct numeric := 0;
  v_statut text;
  v_needs_manual boolean := false;
  v_now timestamptz := now();
  v_duree_sec int := 0;
  v_result_id uuid;
  v_is_correct boolean;
  v_caller_uid uuid := auth.uid();
BEGIN
  -- Vérifier la tentative
  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tentative introuvable');
  END IF;

  IF v_attempt.statut IN ('corrige', 'soumis') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tentative déjà clôturée');
  END IF;

  -- Vérifier l'appartenance de la tentative
  IF v_caller_uid IS NOT NULL AND NOT public.is_staff() THEN
    SELECT * INTO v_student FROM public.students WHERE id = v_attempt.student_id;
    IF v_student.user_id <> v_caller_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé à cette tentative');
    END IF;
  ELSE
    SELECT * INTO v_student FROM public.students WHERE id = v_attempt.student_id;
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = v_attempt.test_id;
  IF v_test.bareme IS NOT NULL AND v_test.bareme > 0 THEN
    v_bareme := v_test.bareme;
  END IF;

  v_duree_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_attempt.heure_debut))::int);

  -- Créer le test_result consolidé
  INSERT INTO public.test_results (
    test_id, student_id, note, pourcentage, date, heure, valide, statut
  ) VALUES (
    v_test.id, v_student.id, 0, 0, v_now, to_char(v_now, 'HH24:MI'),
    NOT COALESCE(v_test.validation_requise, false), 'echoue'
  ) RETURNING id INTO v_result_id;

  -- Boucler sur les questions avec règles de correction corrigées
  FOR v_q IN
    SELECT id, type, bonne_reponse, points, options_json, bonnes_reponses_json, valeur_numerique, tolerance_numerique
    FROM public.questions
    WHERE test_id = v_test.id
    ORDER BY ordre
  LOOP
    v_total_points := v_total_points + COALESCE(v_q.points, 1);
    v_ans_val := COALESCE(p_answers->>v_q.id::text, '');
    v_is_correct := false;

    IF v_q.type = 'longue' THEN
      v_needs_manual := true;
      INSERT INTO public.test_answers (
        result_id, question_id, attempt_id, reponse, reponse_donnee, reponse_longue, correct, points_obtenus, statut_correction
      ) VALUES (
        v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, v_ans_val, false, 0, 'en_attente'
      );
    ELSIF v_q.type = 'numerique' THEN
      DECLARE
        v_num_input numeric;
        v_diff numeric;
      BEGIN
        IF v_ans_val <> '' THEN
          v_num_input := replace(trim(v_ans_val), ',', '.')::numeric;
          v_diff := abs(v_num_input - COALESCE(v_q.valeur_numerique, 0));
          IF v_diff <= COALESCE(v_q.tolerance_numerique, 0) THEN
            v_is_correct := true;
            v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_is_correct := false;
      END;

      INSERT INTO public.test_answers (
        result_id, question_id, attempt_id, reponse, reponse_donnee, correct, points_obtenus, statut_correction
      ) VALUES (
        v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, v_is_correct,
        CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
      );
    ELSIF v_q.type = 'qcm_multiple' THEN
      DECLARE
        v_selected_arr jsonb := COALESCE(p_answers->(v_q.id::text), '[]'::jsonb);
        v_expected_arr jsonb := COALESCE(v_q.bonnes_reponses_json, '[]'::jsonb);
        v_sel_items text[];
        v_exp_items text[];
      BEGIN
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_selected_arr) ORDER BY 1) INTO v_sel_items;
        SELECT ARRAY(SELECT jsonb_array_elements_text(v_expected_arr) ORDER BY 1) INTO v_exp_items;

        IF v_sel_items IS NOT NULL AND v_exp_items IS NOT NULL AND v_sel_items = v_exp_items AND array_length(v_sel_items, 1) > 0 THEN
          v_is_correct := true;
          v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
        END IF;

        INSERT INTO public.test_answers (
          result_id, question_id, attempt_id, reponse, reponse_donnee, choix_multiples, correct, points_obtenus, statut_correction
        ) VALUES (
          v_result_id, v_q.id, p_attempt_id, v_selected_arr::text, v_selected_arr::text, v_selected_arr, v_is_correct,
          CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
        );
      END;
    ELSE
      -- QCM simple, Vrai/Faux ou réponse courte
      IF v_q.type IN ('qcm', 'vf') THEN
        IF v_ans_val <> '' AND trim(lower(v_ans_val)) = trim(lower(COALESCE(v_q.bonne_reponse, ''))) THEN
          v_is_correct := true;
          v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
        END IF;

        INSERT INTO public.test_answers (
          result_id, question_id, attempt_id, reponse, reponse_donnee, correct, points_obtenus, statut_correction
        ) VALUES (
          v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, v_is_correct,
          CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
        );
      ELSE
        -- Réponse courte
        IF COALESCE(trim(v_q.bonne_reponse), '') = '' THEN
          v_needs_manual := true;
          INSERT INTO public.test_answers (
            result_id, question_id, attempt_id, reponse, reponse_donnee, correct, points_obtenus, statut_correction
          ) VALUES (
            v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, false, 0, 'en_attente'
          );
        ELSE
          IF v_ans_val <> '' AND trim(lower(v_ans_val)) = trim(lower(v_q.bonne_reponse)) THEN
            v_is_correct := true;
            v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
          END IF;

          INSERT INTO public.test_answers (
            result_id, question_id, attempt_id, reponse, reponse_donnee, correct, points_obtenus, statut_correction
          ) VALUES (
            v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, v_is_correct,
            CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_total_points <= 0 THEN v_total_points := 1; END IF;
  v_note := round((v_earned_points / v_total_points) * v_bareme, 1);
  v_pct := round((v_earned_points / v_total_points) * 100);
  v_statut := CASE WHEN v_note >= COALESCE(v_test.seuil_reussite, (v_bareme / 2.0)) THEN 'reussi' ELSE 'echoue' END;

  -- Mettre à jour le test_result
  UPDATE public.test_results
  SET note = v_note, pourcentage = v_pct, statut = v_statut
  WHERE id = v_result_id;

  -- Mettre à jour la tentative
  UPDATE public.assessment_attempts
  SET
    statut = CASE WHEN v_needs_manual THEN 'soumis' ELSE 'corrige' END,
    heure_fin_reelle = v_now,
    duree_utilisee_secondes = v_duree_sec,
    reponses_temporaires = p_answers,
    note_totale = v_note,
    pourcentage = v_pct,
    correction_manuelle_requise = v_needs_manual,
    updated_at = v_now
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', p_attempt_id,
    'result_id', v_result_id,
    'note', v_note,
    'bareme', v_bareme,
    'pourcentage', v_pct,
    'statut', v_statut,
    'needs_manual_grading', v_needs_manual
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated, service_role;
