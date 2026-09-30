-- ============================================================
-- 0058_harden_assessment_rpcs.sql
-- Sécurisation des fonctions RPC d'évaluation et devoirs :
-- 1. Révocation de l'accès public / anon, attribution à authenticated & service_role
-- 2. search_path strict (public, pg_temp)
-- 3. Vérification d'identité et de propriété (enseignant propriétaire ou staff)
-- 4. Suppression des valeurs par défaut dangereuses ('ENS-004', module au hasard, etc.)
-- 5. Recalcul serveur de la note dans submit_assessment_result_safe et utilisation de reponse_donnee
-- ============================================================

-- 1. Sauvegarde / Publication sécurisée d'une Évaluation (Test)
CREATE OR REPLACE FUNCTION public.upsert_test_safe(
  p_test jsonb,
  p_questions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_test_id uuid;
  v_module_id uuid;
  v_teacher_id text;
  v_caller_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_existing_teacher_id text;
  v_statut text;
  v_q jsonb;
  v_idx int := 0;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  v_is_staff := public.is_staff();

  -- 1. Résolution et vérification de l'ID du test
  BEGIN
    IF (p_test->>'id') IS NOT NULL AND (p_test->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_test_id := (p_test->>'id')::uuid;
    ELSE
      v_test_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_test_id := gen_random_uuid();
  END;

  -- Si le test existe déjà, vérifier les droits de modification
  IF EXISTS (SELECT 1 FROM public.tests WHERE id = v_test_id) THEN
    SELECT teacher_id INTO v_existing_teacher_id FROM public.tests WHERE id = v_test_id;
    IF NOT v_is_staff THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = v_existing_teacher_id AND t.user_id = v_caller_uid
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé : vous n''êtes pas le formateur propriétaire de cette évaluation');
      END IF;
    END IF;
  END IF;

  -- 2. Résolution du formateur (teacher_id)
  IF v_is_staff THEN
    IF (p_test->>'teacher_id') IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.teachers WHERE id = (p_test->>'teacher_id')) THEN
        v_teacher_id := p_test->>'teacher_id';
      ELSIF EXISTS (SELECT 1 FROM public.teachers WHERE user_id::text = (p_test->>'teacher_id')) THEN
        SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id::text = (p_test->>'teacher_id') LIMIT 1;
      END IF;
    END IF;

    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_caller_uid LIMIT 1;
    END IF;

    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_caller_uid LIMIT 1;
    IF v_teacher_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte enseignant non trouvé pour cet utilisateur');
    END IF;
  END IF;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enseignant introuvable');
  END IF;

  -- 3. Résolution du module_id
  IF (p_test->>'module_id') IS NOT NULL AND (p_test->>'module_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_module_id FROM public.modules WHERE id = (p_test->>'module_id')::uuid;
  END IF;

  IF v_module_id IS NULL AND (p_test->>'module_id') IS NOT NULL THEN
    SELECT id INTO v_module_id FROM public.modules WHERE titre ILIKE (p_test->>'module_id') LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Module introuvable ou non spécifié');
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

  -- 5. Synchronisation des questions si fournies
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

-- 2. Sauvegarde / Publication sécurisée d'un Devoir (Assignment)
CREATE OR REPLACE FUNCTION public.upsert_assignment_safe(
  p_assignment jsonb,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asg_id uuid;
  v_module_id uuid;
  v_teacher_id text;
  v_caller_uid uuid := auth.uid();
  v_is_staff boolean := false;
  v_existing_teacher_id text;
  v_statut text;
  v_att jsonb;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  v_is_staff := public.is_staff();

  -- 1. Résolution et vérification de l'ID du devoir
  BEGIN
    IF (p_assignment->>'id') IS NOT NULL AND (p_assignment->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_asg_id := (p_assignment->>'id')::uuid;
    ELSE
      v_asg_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_asg_id := gen_random_uuid();
  END;

  -- Si le devoir existe déjà, vérifier les droits
  IF EXISTS (SELECT 1 FROM public.assignments WHERE id = v_asg_id) THEN
    SELECT teacher_id INTO v_existing_teacher_id FROM public.assignments WHERE id = v_asg_id;
    IF NOT v_is_staff THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = v_existing_teacher_id AND t.user_id = v_caller_uid
      ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Accès refusé : vous n''êtes pas le formateur propriétaire de ce devoir');
      END IF;
    END IF;
  END IF;

  -- 2. Résolution du formateur
  IF v_is_staff THEN
    IF (p_assignment->>'teacher_id') IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.teachers WHERE id = (p_assignment->>'teacher_id')) THEN
        v_teacher_id := p_assignment->>'teacher_id';
      ELSIF EXISTS (SELECT 1 FROM public.teachers WHERE user_id::text = (p_assignment->>'teacher_id')) THEN
        SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id::text = (p_assignment->>'teacher_id') LIMIT 1;
      END IF;
    END IF;

    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_caller_uid LIMIT 1;
    END IF;

    IF v_teacher_id IS NULL THEN
      SELECT id INTO v_teacher_id FROM public.teachers LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_caller_uid LIMIT 1;
    IF v_teacher_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte formateur non trouvé pour cet utilisateur');
    END IF;
  END IF;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enseignant introuvable');
  END IF;

  -- 3. Résolution module_id
  IF (p_assignment->>'module_id') IS NOT NULL AND (p_assignment->>'module_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_module_id FROM public.modules WHERE id = (p_assignment->>'module_id')::uuid;
  END IF;

  IF v_module_id IS NULL AND (p_assignment->>'module_id') IS NOT NULL THEN
    SELECT id INTO v_module_id FROM public.modules WHERE titre ILIKE (p_assignment->>'module_id') LIMIT 1;
  END IF;

  IF v_module_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Module introuvable ou non spécifié');
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

  -- 5. Pièces jointes si fournies
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

-- 3. Suppression sécurisée d'une évaluation
CREATE OR REPLACE FUNCTION public.delete_test_safe(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_teacher_id text;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  IF NOT public.is_staff() THEN
    SELECT teacher_id INTO v_teacher_id FROM public.tests WHERE id = p_test_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = v_teacher_id AND t.user_id = v_caller_uid
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès refusé : vous n''êtes pas autorisé à supprimer cette évaluation');
    END IF;
  END IF;

  DELETE FROM public.test_answers WHERE result_id IN (SELECT id FROM public.test_results WHERE test_id = p_test_id);
  DELETE FROM public.test_results WHERE test_id = p_test_id;
  DELETE FROM public.assessment_proctoring_logs WHERE test_id = p_test_id;
  DELETE FROM public.assessment_attempts WHERE test_id = p_test_id;
  DELETE FROM public.questions WHERE test_id = p_test_id;
  DELETE FROM public.tests WHERE id = p_test_id;

  RETURN jsonb_build_object('success', true, 'id', p_test_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. Suppression sécurisée d'un devoir
CREATE OR REPLACE FUNCTION public.delete_assignment_safe(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_teacher_id text;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  IF NOT public.is_staff() THEN
    SELECT teacher_id INTO v_teacher_id FROM public.assignments WHERE id = p_assignment_id;
    IF NOT EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = v_teacher_id AND t.user_id = v_caller_uid
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès refusé : vous n''êtes pas autorisé à supprimer ce devoir');
    END IF;
  END IF;

  DELETE FROM public.assignment_submission_files WHERE submission_id IN (
    SELECT id FROM public.assignment_submissions WHERE assignment_id = p_assignment_id
  );
  DELETE FROM public.assignment_submissions WHERE assignment_id = p_assignment_id;
  DELETE FROM public.assignment_attachments WHERE assignment_id = p_assignment_id;
  DELETE FROM public.assignments WHERE id = p_assignment_id;

  RETURN jsonb_build_object('success', true, 'id', p_assignment_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. Suppression sécurisée d'une remise
CREATE OR REPLACE FUNCTION public.delete_submission_safe(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_asg_id uuid;
  v_teacher_id text;
  v_student_id text;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  IF NOT public.is_staff() THEN
    SELECT assignment_id, student_id INTO v_asg_id, v_student_id
    FROM public.assignment_submissions WHERE id = p_submission_id;

    SELECT teacher_id INTO v_teacher_id FROM public.assignments WHERE id = v_asg_id;

    IF NOT (
      EXISTS (SELECT 1 FROM public.teachers WHERE id = v_teacher_id AND user_id = v_caller_uid)
      OR EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id AND user_id = v_caller_uid)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès refusé : vous ne pouvez pas supprimer cette remise');
    END IF;
  END IF;

  DELETE FROM public.assignment_submission_files WHERE submission_id = p_submission_id;
  DELETE FROM public.assignment_submissions WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true, 'id', p_submission_id::text);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 6. Enregistrement sécurisé du résultat d'examen (submit_assessment_result_safe)
CREATE OR REPLACE FUNCTION public.submit_assessment_result_safe(
  p_result jsonb,
  p_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result_id uuid;
  v_test_id uuid;
  v_student_id text;
  v_caller_uid uuid := auth.uid();
  v_test record;
  v_q record;
  v_ans_map jsonb := '{}'::jsonb;
  v_ans_elem jsonb;
  v_ans_val text;
  v_total_points numeric := 0;
  v_earned_points numeric := 0;
  v_is_correct boolean;
  v_note numeric;
  v_bareme numeric := 20;
  v_pct numeric;
  v_date text;
  v_heure text;
  v_valide boolean;
  v_statut text;
  v_q_points numeric;
  v_q_id_text text;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise pour enregistrer un résultat');
  END IF;

  -- 1. Résolution de l'ID du résultat
  BEGIN
    IF (p_result->>'id') IS NOT NULL AND (p_result->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_result_id := (p_result->>'id')::uuid;
    ELSE
      v_result_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_result_id := gen_random_uuid();
  END;

  -- 2. Résolution stricte du test_id
  IF (p_result->>'testId') IS NOT NULL AND (p_result->>'testId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_test_id := (p_result->>'testId')::uuid;
  ELSIF (p_result->>'test_id') IS NOT NULL AND (p_result->>'test_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_test_id := (p_result->>'test_id')::uuid;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Identifiant d''évaluation invalide ou manquant');
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = v_test_id;
  IF v_test.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Évaluation introuvable en base de données');
  END IF;

  v_bareme := COALESCE(v_test.bareme, (p_result->>'bareme')::numeric, 20);

  -- 3. Résolution stricte de l'apprenant (student_id lié à l'utilisateur connecté)
  IF public.is_staff() AND (p_result->>'studentId') IS NOT NULL THEN
    v_student_id := p_result->>'studentId';
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id) THEN
      SELECT id INTO v_student_id FROM public.students WHERE user_id::text = (p_result->>'studentId') LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_student_id FROM public.students WHERE user_id = v_caller_uid LIMIT 1;
  END IF;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil apprenant introuvable pour ce compte');
  END IF;

  -- 4. Préparer le dictionnaire des réponses
  IF jsonb_typeof(p_answers) = 'array' THEN
    FOR v_ans_elem IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
      IF (v_ans_elem->>'questionId') IS NOT NULL THEN
        v_ans_map := jsonb_set(
          v_ans_map,
          ARRAY[v_ans_elem->>'questionId'],
          to_jsonb(COALESCE(v_ans_elem->>'reponseDonnee', v_ans_elem->>'valeur', ''))
        );
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_answers) = 'object' THEN
    v_ans_map := p_answers;
  END IF;

  -- 5. Recalcul côté serveur de la note et des points à partir des questions officielles
  FOR v_q IN
    SELECT id, type, points, bonne_reponse, bonnes_reponses_json, valeur_numerique, tolerance_numerique
    FROM public.questions
    WHERE test_id = v_test_id
    ORDER BY ordre
  LOOP
    v_q_points := COALESCE(v_q.points, 1);
    v_total_points := v_total_points + v_q_points;
    v_q_id_text := v_q.id::text;
    v_ans_val := COALESCE(v_ans_map->>v_q_id_text, '');
    v_is_correct := false;

    IF v_ans_val <> '' THEN
      IF v_q.type IN ('qcm', 'vf') THEN
        v_is_correct := (trim(lower(v_ans_val)) = trim(lower(COALESCE(v_q.bonne_reponse, ''))));
      ELSIF v_q.type = 'numerique' THEN
        DECLARE
          v_num numeric;
        BEGIN
          v_num := replace(trim(v_ans_val), ',', '.')::numeric;
          IF abs(v_num - COALESCE(v_q.valeur_numerique, 0)) <= COALESCE(v_q.tolerance_numerique, 0) THEN
            v_is_correct := true;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          v_is_correct := false;
        END;
      ELSIF v_q.type = 'courte' THEN
        IF COALESCE(v_q.bonne_reponse, '') <> '' THEN
          v_is_correct := (trim(lower(v_ans_val)) = trim(lower(v_q.bonne_reponse)));
        END IF;
      END IF;
    END IF;

    IF v_is_correct THEN
      v_earned_points := v_earned_points + v_q_points;
    END IF;
  END LOOP;

  IF v_total_points <= 0 THEN
    v_total_points := 1;
  END IF;

  v_note := round((v_earned_points / v_total_points) * v_bareme, 1);
  v_pct := round((v_earned_points / v_total_points) * 100);
  v_date := COALESCE(p_result->>'date', to_char(now(), 'YYYY-MM-DD'));
  v_heure := COALESCE(p_result->>'heure', to_char(now(), 'HH24:MI'));
  v_valide := NOT COALESCE(v_test.validation_requise, false);
  v_statut := CASE WHEN v_note >= COALESCE(v_test.seuil_reussite, (v_bareme / 2.0)) THEN 'reussi' ELSE 'echoue' END;

  -- 6. Insertion / Mise à jour dans public.test_results
  INSERT INTO public.test_results (
    id,
    test_id,
    student_id,
    note,
    pourcentage,
    date,
    heure,
    valide,
    statut
  ) VALUES (
    v_result_id,
    v_test_id,
    v_student_id,
    v_note,
    v_pct,
    v_date::timestamptz,
    v_heure,
    v_valide,
    v_statut
  )
  ON CONFLICT (id) DO UPDATE SET
    note = EXCLUDED.note,
    pourcentage = EXCLUDED.pourcentage,
    date = EXCLUDED.date,
    heure = EXCLUDED.heure,
    valide = EXCLUDED.valide,
    statut = EXCLUDED.statut;

  -- 7. Insertion des réponses individuelles dans test_answers
  FOR v_q IN
    SELECT id, type, points, bonne_reponse
    FROM public.questions
    WHERE test_id = v_test_id
  LOOP
    v_q_id_text := v_q.id::text;
    v_ans_val := COALESCE(v_ans_map->>v_q_id_text, '');
    v_is_correct := false;

    IF v_ans_val <> '' AND v_q.type IN ('qcm', 'vf') THEN
      v_is_correct := (trim(lower(v_ans_val)) = trim(lower(COALESCE(v_q.bonne_reponse, ''))));
    END IF;

    INSERT INTO public.test_answers (
      result_id,
      question_id,
      reponse,
      reponse_donnee,
      correct,
      points_obtenus
    ) VALUES (
      v_result_id,
      v_q.id,
      v_ans_val,
      v_ans_val,
      v_is_correct,
      CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_result_id::text,
    'testId', v_test_id::text,
    'studentId', v_student_id,
    'note', v_note,
    'bareme', v_bareme,
    'pourcentage', v_pct,
    'statut', v_statut
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 8. Droits d'exécution stricts : aucun accès anon/public
REVOKE EXECUTE ON FUNCTION public.upsert_test_safe(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_test_safe(jsonb, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_assignment_safe(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_assignment_safe(jsonb, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_test_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_safe(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_assignment_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_assignment_safe(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_submission_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_submission_safe(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.submit_assessment_result_safe(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment_result_safe(jsonb, jsonb) TO authenticated, service_role;
