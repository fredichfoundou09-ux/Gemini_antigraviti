-- ============================================================
-- 0055_secure_definer_assessment_ops.sql
-- Fonctions RPC SECURITY DEFINER pour publication, enregistrement
-- et suppression infaillibles des évaluations et devoirs.
-- ============================================================

-- 1. Sauvegarde / Publication sécurisée d'une Évaluation (Test)
CREATE OR REPLACE FUNCTION public.upsert_test_safe(
  p_test jsonb,
  p_questions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_test_id uuid;
  v_module_id uuid;
  v_teacher_id text;
  v_statut text;
  v_q jsonb;
  v_idx int := 0;
BEGIN
  -- 1. Résolution de l'ID du test
  BEGIN
    IF (p_test->>'id') IS NOT NULL AND (p_test->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_test_id := (p_test->>'id')::uuid;
    ELSE
      v_test_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_test_id := gen_random_uuid();
  END;

  -- 2. Résolution du module_id valide
  BEGIN
    IF (p_test->>'module_id') IS NOT NULL AND (p_test->>'module_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v_module_id FROM public.modules WHERE id = (p_test->>'module_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_module_id := NULL;
  END;

  IF v_module_id IS NULL THEN
    SELECT id INTO v_module_id FROM public.modules WHERE titre ILIKE (p_test->>'module_id') LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    SELECT id INTO v_module_id FROM public.modules LIMIT 1;
  END IF;

  -- 3. Résolution teacher_id
  v_teacher_id := COALESCE(p_test->>'teacher_id', 'ENS-004');
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id::text = (p_test->>'teacher_id') LIMIT 1;
    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers LIMIT 1;
    END IF;
  END IF;

  v_statut := COALESCE(p_test->>'statut', 'publie');

  -- 4. Upsert dans public.tests
  INSERT INTO public.tests (
    id,
    titre,
    description,
    consignes,
    module_id,
    teacher_id,
    duree,
    bareme,
    seuil_reussite,
    difficulte,
    tentatives,
    afficher_corrections,
    validation_requise,
    statut,
    audience,
    target_groupe,
    target_student_ids,
    mode_securise,
    bloquer_copier_coller,
    bloquer_clic_droit,
    navigation_libre,
    date_debut,
    date_fin,
    date_publication
  ) VALUES (
    v_test_id,
    COALESCE(p_test->>'titre', 'Évaluation'),
    COALESCE(p_test->>'description', ''),
    COALESCE(p_test->>'consignes', 'Veuillez lire attentivement chaque consigne et répondre dans le temps imparti.'),
    v_module_id,
    v_teacher_id,
    COALESCE((p_test->>'duree')::int, 45),
    COALESCE((p_test->>'bareme')::numeric, 20),
    COALESCE((p_test->>'seuil_reussite')::numeric, 10),
    COALESCE(p_test->>'difficulte', 'moyen'),
    COALESCE((p_test->>'tentatives')::int, 1),
    COALESCE((p_test->>'afficher_corrections')::boolean, true),
    COALESCE((p_test->>'validation_requise')::boolean, false),
    v_statut,
    COALESCE(p_test->>'audience', 'all'),
    p_test->>'target_groupe',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_test->'target_student_ids', '[]'::jsonb))),
    COALESCE((p_test->>'mode_securise')::boolean, true),
    COALESCE((p_test->>'bloquer_copier_coller')::boolean, true),
    COALESCE((p_test->>'bloquer_clic_droit')::boolean, true),
    COALESCE((p_test->>'navigation_libre')::boolean, true),
    CASE WHEN p_test->>'date_debut' IS NOT NULL THEN (p_test->>'date_debut')::timestamptz ELSE NULL END,
    CASE WHEN p_test->>'date_fin' IS NOT NULL THEN (p_test->>'date_fin')::timestamptz ELSE NULL END,
    CASE WHEN v_statut IN ('publie', 'en_cours', 'ouvert') THEN COALESCE((p_test->>'date_publication')::timestamptz, now()) ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    consignes = EXCLUDED.consignes,
    module_id = EXCLUDED.module_id,
    teacher_id = EXCLUDED.teacher_id,
    duree = EXCLUDED.duree,
    bareme = EXCLUDED.bareme,
    seuil_reussite = EXCLUDED.seuil_reussite,
    difficulte = EXCLUDED.difficulte,
    tentatives = EXCLUDED.tentatives,
    afficher_corrections = EXCLUDED.afficher_corrections,
    validation_requise = EXCLUDED.validation_requise,
    statut = EXCLUDED.statut,
    audience = EXCLUDED.audience,
    target_groupe = EXCLUDED.target_groupe,
    target_student_ids = EXCLUDED.target_student_ids,
    mode_securise = EXCLUDED.mode_securise,
    bloquer_copier_coller = EXCLUDED.bloquer_copier_coller,
    bloquer_clic_droit = EXCLUDED.bloquer_clic_droit,
    navigation_libre = EXCLUDED.navigation_libre,
    date_debut = EXCLUDED.date_debut,
    date_fin = EXCLUDED.date_fin,
    date_publication = EXCLUDED.date_publication;

  -- 5. Synchronisation des questions
  IF jsonb_array_length(p_questions) > 0 THEN
    DELETE FROM public.questions WHERE test_id = v_test_id;

    FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
      v_idx := v_idx + 1;
      INSERT INTO public.questions (
        test_id,
        question,
        type,
        points,
        bonne_reponse,
        bonnes_reponses_json,
        options_json,
        valeur_numerique,
        tolerance_numerique,
        explication,
        ordre,
        obligatoire
      ) VALUES (
        v_test_id,
        COALESCE(v_q->>'question', 'Question ' || v_idx),
        COALESCE(v_q->>'type', 'qcm'),
        COALESCE((v_q->>'points')::numeric, 1),
        COALESCE(v_q->>'bonne_reponse', ''),
        COALESCE(v_q->'bonnes_reponses_json', '[]'::jsonb),
        COALESCE(v_q->'options_json', '[]'::jsonb),
        CASE WHEN v_q->>'valeur_numerique' IS NOT NULL THEN (v_q->>'valeur_numerique')::numeric ELSE NULL END,
        COALESCE((v_q->>'tolerance_numerique')::numeric, 0),
        COALESCE(v_q->>'explication', ''),
        v_idx,
        COALESCE((v_q->>'obligatoire')::boolean, true)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_test_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_test_safe(jsonb, jsonb) TO authenticated, anon;

-- 2. Sauvegarde / Publication sécurisée d'un Devoir (Assignment)
CREATE OR REPLACE FUNCTION public.upsert_assignment_safe(
  p_assignment jsonb,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_asg_id uuid;
  v_module_id uuid;
  v_teacher_id text;
  v_statut text;
  v_att jsonb;
BEGIN
  -- 1. Résolution de l'ID du devoir
  BEGIN
    IF (p_assignment->>'id') IS NOT NULL AND (p_assignment->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_asg_id := (p_assignment->>'id')::uuid;
    ELSE
      v_asg_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_asg_id := gen_random_uuid();
  END;

  -- 2. Résolution module_id
  BEGIN
    IF (p_assignment->>'module_id') IS NOT NULL AND (p_assignment->>'module_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v_module_id FROM public.modules WHERE id = (p_assignment->>'module_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_module_id := NULL;
  END;

  IF v_module_id IS NULL THEN
    SELECT id INTO v_module_id FROM public.modules WHERE titre ILIKE (p_assignment->>'module_id') LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    SELECT id INTO v_module_id FROM public.modules LIMIT 1;
  END IF;

  -- 3. Résolution teacher_id
  v_teacher_id := COALESCE(p_assignment->>'teacher_id', 'ENS-004');
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id) THEN
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id::text = (p_assignment->>'teacher_id') LIMIT 1;
    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers LIMIT 1;
    END IF;
  END IF;

  v_statut := COALESCE(p_assignment->>'statut', 'publie');

  -- 4. Upsert dans public.assignments
  INSERT INTO public.assignments (
    id,
    titre,
    description,
    consignes,
    formation,
    module_id,
    teacher_id,
    date_limite,
    heure_limite,
    duree_estimee_minutes,
    nb_fichiers_max,
    taille_max_mo,
    formats_autorises,
    bareme,
    seuil_reussite,
    statut,
    audience,
    target_groupe,
    target_student_ids,
    autoriser_remise_tardive,
    tentatives_max,
    correction_visible_immediatement,
    date_publication
  ) VALUES (
    v_asg_id,
    COALESCE(p_assignment->>'titre', 'Devoir'),
    p_assignment->>'description',
    COALESCE(p_assignment->>'consignes', 'Consignes : veuillez réaliser le devoir demandé et déposer vos livrables.'),
    p_assignment->>'formation',
    v_module_id,
    v_teacher_id,
    COALESCE((p_assignment->>'date_limite')::timestamptz, now() + interval '7 days'),
    COALESCE(p_assignment->>'heure_limite', '23:59'),
    (p_assignment->>'duree_estimee_minutes')::int,
    COALESCE((p_assignment->>'nb_fichiers_max')::int, 3),
    COALESCE((p_assignment->>'taille_max_mo')::int, 10),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_assignment->'formats_autorises', '["pdf", "docx"]'::jsonb))),
    COALESCE((p_assignment->>'bareme')::numeric, 20),
    COALESCE((p_assignment->>'seuil_reussite')::numeric, 10),
    v_statut,
    COALESCE(p_assignment->>'audience', 'all'),
    p_assignment->>'target_groupe',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_assignment->'target_student_ids', '[]'::jsonb))),
    COALESCE((p_assignment->>'autoriser_remise_tardive')::boolean, true),
    COALESCE((p_assignment->>'tentatives_max')::int, 1),
    COALESCE((p_assignment->>'correction_visible_immediatement')::boolean, false),
    CASE WHEN v_statut IN ('publie', 'ouvert') THEN COALESCE((p_assignment->>'date_publication')::timestamptz, now()) ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    consignes = EXCLUDED.consignes,
    formation = EXCLUDED.formation,
    module_id = EXCLUDED.module_id,
    teacher_id = EXCLUDED.teacher_id,
    date_limite = EXCLUDED.date_limite,
    heure_limite = EXCLUDED.heure_limite,
    duree_estimee_minutes = EXCLUDED.duree_estimee_minutes,
    nb_fichiers_max = EXCLUDED.nb_fichiers_max,
    taille_max_mo = EXCLUDED.taille_max_mo,
    formats_autorises = EXCLUDED.formats_autorises,
    bareme = EXCLUDED.bareme,
    seuil_reussite = EXCLUDED.seuil_reussite,
    statut = EXCLUDED.statut,
    audience = EXCLUDED.audience,
    target_groupe = EXCLUDED.target_groupe,
    target_student_ids = EXCLUDED.target_student_ids,
    autoriser_remise_tardive = EXCLUDED.autoriser_remise_tardive,
    tentatives_max = EXCLUDED.tentatives_max,
    correction_visible_immediatement = EXCLUDED.correction_visible_immediatement,
    date_publication = EXCLUDED.date_publication;

  -- 5. Pièces jointes
  IF jsonb_array_length(p_attachments) > 0 THEN
    DELETE FROM public.assignment_attachments WHERE assignment_id = v_asg_id;
    FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
      INSERT INTO public.assignment_attachments (
        assignment_id,
        file_name,
        original_name,
        file_url,
        mime,
        size,
        storage_path
      ) VALUES (
        v_asg_id,
        COALESCE(v_att->>'fileName', v_att->>'file_name', 'document'),
        COALESCE(v_att->>'originalName', v_att->>'original_name', 'document'),
        COALESCE(v_att->>'fileUrl', v_att->>'file_url', ''),
        COALESCE(v_att->>'mime', 'application/octet-stream'),
        COALESCE((v_att->>'size')::int, 0),
        v_att->>'storagePath'
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_asg_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_assignment_safe(jsonb, jsonb) TO authenticated, anon;

-- 3. Suppression sécurisée d'une remise
CREATE OR REPLACE FUNCTION public.delete_submission_safe(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.assignment_submission_files WHERE submission_id = p_submission_id;
  DELETE FROM public.assignment_submissions WHERE id = p_submission_id;
  RETURN jsonb_build_object('success', true, 'id', p_submission_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_submission_safe(uuid) TO authenticated, anon;
