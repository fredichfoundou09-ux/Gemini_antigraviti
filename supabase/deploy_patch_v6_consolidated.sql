-- ==============================================================================
-- DEPLOY_PATCH_V6_CONSOLIDATED.SQL
-- Script consolidé de déploiement pour Supabase (Production)
-- Regroupe les migrations : 0057, 0058, 0059 et 0060
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. [0057] Correction des colonnes de test_answers
-- ------------------------------------------------------------------------------
ALTER TABLE public.test_answers
  ADD COLUMN IF NOT EXISTS reponse_donnee text;

UPDATE public.test_answers
   SET reponse_donnee = reponse
 WHERE reponse_donnee IS NULL AND reponse IS NOT NULL;

ALTER TABLE public.test_answers ALTER COLUMN reponse DROP NOT NULL;
ALTER TABLE public.test_answers ALTER COLUMN reponse SET DEFAULT '';

-- ------------------------------------------------------------------------------
-- 2. [0058] Sécurisation et durcissement des RPCs d'évaluation et devoirs
-- ------------------------------------------------------------------------------

-- 2.1 upsert_test_safe
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

  BEGIN
    IF (p_test->>'id') IS NOT NULL AND (p_test->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_test_id := (p_test->>'id')::uuid;
    ELSE
      v_test_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_test_id := gen_random_uuid();
  END;

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
      RETURN jsonb_build_object('success', false, 'error', 'Compte formateur non trouvé pour cet utilisateur');
    END IF;
  END IF;

  IF v_teacher_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enseignant introuvable');
  END IF;

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

  INSERT INTO public.tests (
    id, titre, description, consignes, module_id, teacher_id,
    duree, bareme, seuil_reussite, difficulte, tentatives,
    afficher_corrections, validation_requise, statut, audience,
    target_groupe, target_student_ids, mode_securise,
    bloquer_copier_coller, bloquer_clic_droit, navigation_libre,
    date_debut, date_fin, date_publication
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

  IF jsonb_array_length(p_questions) > 0 THEN
    DELETE FROM public.questions WHERE test_id = v_test_id;

    FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
      v_idx := v_idx + 1;
      INSERT INTO public.questions (
        test_id, question, type, points, bonne_reponse,
        bonnes_reponses_json, options_json, valeur_numerique,
        tolerance_numerique, explication, ordre, obligatoire
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

-- 2.2 upsert_assignment_safe
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

  BEGIN
    IF (p_assignment->>'id') IS NOT NULL AND (p_assignment->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_asg_id := (p_assignment->>'id')::uuid;
    ELSE
      v_asg_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_asg_id := gen_random_uuid();
  END;

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

  INSERT INTO public.assignments (
    id, titre, description, consignes, formation, module_id, teacher_id,
    date_limite, heure_limite, duree_estimee_minutes, nb_fichiers_max,
    taille_max_mo, formats_autorises, bareme, seuil_reussite, statut,
    audience, target_groupe, target_student_ids, autoriser_remise_tardive,
    tentatives_max, correction_visible_immediatement, date_publication
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

  IF jsonb_array_length(p_attachments) > 0 THEN
    DELETE FROM public.assignment_attachments WHERE assignment_id = v_asg_id;
    FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
      INSERT INTO public.assignment_attachments (
        assignment_id, file_name, original_name, file_url, mime, size, storage_path
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

-- 2.3 delete_test_safe
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

-- 2.4 delete_assignment_safe
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

-- 2.5 delete_submission_safe
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

-- 2.6 submit_assessment_result_safe
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

  BEGIN
    IF (p_result->>'id') IS NOT NULL AND (p_result->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_result_id := (p_result->>'id')::uuid;
    ELSE
      v_result_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_result_id := gen_random_uuid();
  END;

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

  INSERT INTO public.test_results (
    id, test_id, student_id, note, pourcentage, date, heure, valide, statut
  ) VALUES (
    v_result_id, v_test_id, v_student_id, v_note, v_pct,
    v_date::timestamptz, v_heure, v_valide, v_statut
  )
  ON CONFLICT (id) DO UPDATE SET
    note = EXCLUDED.note,
    pourcentage = EXCLUDED.pourcentage,
    date = EXCLUDED.date,
    heure = EXCLUDED.heure,
    valide = EXCLUDED.valide,
    statut = EXCLUDED.statut;

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
      result_id, question_id, reponse, reponse_donnee, correct, points_obtenus
    ) VALUES (
      v_result_id, v_q.id, v_ans_val, v_ans_val, v_is_correct,
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

-- Permissions d'exécution
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

-- ------------------------------------------------------------------------------
-- 3. [0059] Politiques RLS durcies pour questions et remises de devoirs
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.questions_apprenant
WITH (security_invoker = true)
AS
SELECT
  q.id,
  q.test_id,
  q.question,
  q.type,
  q.points,
  q.options_json,
  q.ordre,
  q.obligatoire
FROM public.questions q
JOIN public.tests t ON t.id = q.test_id
WHERE t.statut IN ('publie', 'en_cours', 'ouvert');

GRANT SELECT ON public.questions_apprenant TO authenticated;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_anon_read" ON public.questions;
DROP POLICY IF EXISTS "questions_staff_teacher_all" ON public.questions;
DROP POLICY IF EXISTS "questions_write_owner" ON public.questions;
DROP POLICY IF EXISTS "questions_read_authenticated" ON public.questions;

CREATE POLICY "questions_write_owner" ON public.questions
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = questions.test_id AND te.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = questions.test_id AND te.user_id = auth.uid()
    )
  );

CREATE POLICY "questions_read_authenticated" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = questions.test_id AND te.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tests t
      WHERE t.id = questions.test_id AND t.statut IN ('publie', 'en_cours', 'ouvert')
    )
  );

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_student_insert" ON public.assignment_submissions;
CREATE POLICY "submissions_student_insert" ON public.assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- 4. [0060] Correction et fiabilisation de submit_assessment
-- ------------------------------------------------------------------------------

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
  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tentative introuvable');
  END IF;

  IF v_attempt.statut IN ('corrige', 'soumis') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tentative déjà clôturée');
  END IF;

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

  INSERT INTO public.test_results (
    test_id, student_id, note, pourcentage, date, heure, valide, statut
  ) VALUES (
    v_test.id, v_student.id, 0, 0, v_now, to_char(v_now, 'HH24:MI'),
    NOT COALESCE(v_test.validation_requise, false), 'echoue'
  ) RETURNING id INTO v_result_id;

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
      IF v_q.type IN ('qcm', 'vf') THEN
        IF v_ans_val <> '' AND trim(lower(v_ans_val)) = trim(lower(COALESCE(v_q.bonne_reponse, '')))::text THEN
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

  UPDATE public.test_results
  SET note = v_note, pourcentage = v_pct, statut = v_statut
  WHERE id = v_result_id;

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

-- ==============================================================================
-- 10. NOTATION MANUELLE, BORDEREAU PAPIER, ET MODES AUTO/MANUEL/HYBRIDE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.grade_test_result(
  p_result_id uuid,
  p_grades jsonb DEFAULT '{}'::jsonb,
  p_comments jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_test_id uuid;
  v_teacher_id uuid;
  v_test_owner_uid uuid;
  v_bareme numeric;
  v_seuil numeric;
  v_total_points numeric := 0;
  v_total_max numeric := 0;
  v_pourcentage numeric := 0;
  v_statut text;
  v_q_id text;
  v_q_val text;
  v_comm text;
  v_num_note numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;

  SELECT tr.test_id INTO v_test_id
  FROM public.test_results tr
  WHERE tr.id = p_result_id;

  IF v_test_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Résultat introuvable');
  END IF;

  SELECT t.teacher_id, t.bareme, t.seuil_reussite
  INTO v_teacher_id, v_bareme, v_seuil
  FROM public.tests t
  WHERE t.id = v_test_id;

  IF v_teacher_id IS NOT NULL THEN
    SELECT te.user_id INTO v_test_owner_uid
    FROM public.teachers te
    WHERE te.id = v_teacher_id;
  END IF;

  IF v_role NOT IN ('admin', 'superadmin') AND (v_test_owner_uid IS NULL OR v_test_owner_uid <> v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé : vous devez être le formateur titulaire de cette épreuve.');
  END IF;

  FOR v_q_id IN SELECT jsonb_object_keys(p_grades)
  LOOP
    v_q_val := p_grades->>v_q_id;
    v_comm := p_comments->>v_q_id;
    BEGIN
      v_num_note := v_q_val::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_num_note := 0;
    END;

    UPDATE public.test_answers
    SET note_manuelle = v_num_note,
        commentaire_formateur = v_comm,
        statut_correction = 'corrige'
    WHERE result_id = p_result_id
      AND question_id = v_q_id::uuid;
  END LOOP;

  SELECT COALESCE(SUM(COALESCE(ta.note_manuelle, ta.points_obtenus, 0)), 0),
         COALESCE(SUM(COALESCE(q.points, 1)), 20)
  INTO v_total_points, v_total_max
  FROM public.test_answers ta
  LEFT JOIN public.questions q ON q.id = ta.question_id
  WHERE ta.result_id = p_result_id;

  IF v_bareme IS NULL OR v_bareme <= 0 THEN
    v_bareme := 20;
  END IF;

  IF v_total_max > 0 THEN
    v_total_points := ROUND(((v_total_points / v_total_max) * v_bareme)::numeric, 2);
    v_pourcentage := ROUND(((v_total_points / v_bareme) * 100)::numeric, 0);
  ELSE
    v_pourcentage := 0;
  END IF;

  IF v_seuil IS NULL THEN
    v_seuil := v_bareme / 2;
  END IF;

  IF v_total_points >= v_seuil THEN
    v_statut := 'reussi';
  ELSE
    v_statut := 'echoue';
  END IF;

  UPDATE public.test_results
  SET note = v_total_points,
      pourcentage = v_pourcentage,
      statut = v_statut,
      valide = true
  WHERE id = p_result_id;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', p_result_id,
    'note', v_total_points,
    'pourcentage', v_pourcentage,
    'statut', v_statut,
    'valide', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grade_test_result(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_test_result(uuid, jsonb, jsonb) TO authenticated, service_role;

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

  SELECT role INTO v_role FROM public.users WHERE id = v_caller_uid;
  SELECT teacher_id INTO v_teacher_id FROM public.tests WHERE id = v_test_id;

  IF v_teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_owner_uid FROM public.teachers WHERE id = v_teacher_id;
  END IF;

  IF v_role NOT IN ('admin', 'superadmin') AND (v_owner_uid IS NULL OR v_owner_uid <> v_caller_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Droits formateur titulaire ou administration requis');
  END IF;

  DELETE FROM public.test_answers WHERE result_id = p_result_id;
  DELETE FROM public.test_results WHERE id = p_result_id;

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

COMMIT;
