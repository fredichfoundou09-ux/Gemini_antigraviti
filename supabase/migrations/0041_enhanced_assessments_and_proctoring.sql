-- =========================================================================
-- 0041_enhanced_assessments_and_proctoring.sql
-- Module professionnel Tests & Évaluations de SENTINEL'S
-- 1. Évolution des tables tests et questions (statuts, types, audience, mode sécurisé)
-- 2. Création de assessment_attempts et assessment_proctoring_logs
-- 3. Création de assessment_documents (supports indépendants)
-- 4. RPCs sécurisées : passage d'examen, autosave, journalisation, notation
-- 5. RLS durci : secret absolu des bonnes réponses pour les étudiants
-- =========================================================================

BEGIN;

-- 1. Évolution de public.tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consignes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS seuil_reussite numeric(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'module',
  ADD COLUMN IF NOT EXISTS target_groupe text,
  ADD COLUMN IF NOT EXISTS target_student_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mode_securise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloquer_copier_coller boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bloquer_clic_droit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS navigation_libre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_publication timestamptz;

-- Contrainte de statut si non présente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tests_statut_check'
  ) THEN
    ALTER TABLE public.tests ADD CONSTRAINT tests_statut_check
      CHECK (statut IN ('brouillon', 'enregistre', 'publie', 'en_cours', 'termine', 'corrige', 'archive'));
  END IF;
END $$;

-- 2. Évolution de public.questions
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_type_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
    CHECK (type IN ('qcm', 'qcm_multiple', 'vf', 'courte', 'longue', 'numerique'));

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS options_json jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS bonnes_reponses_json jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS valeur_numerique numeric,
  ADD COLUMN IF NOT EXISTS tolerance_numerique numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS obligatoire boolean NOT NULL DEFAULT true;

-- 3. Table des tentatives d'examen (assessment_attempts)
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  heure_debut timestamptz NOT NULL DEFAULT now(),
  heure_fin_prevue timestamptz NOT NULL,
  heure_fin_reelle timestamptz,
  duree_utilisee_secondes int DEFAULT 0,
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'soumis', 'expire', 'corrige')),
  reponses_temporaires jsonb DEFAULT '{}',
  note_totale numeric(5,2),
  pourcentage numeric(5,2),
  correction_manuelle_requise boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_test_student
  ON public.assessment_attempts(test_id, student_id);

-- 4. Journal de surveillance anti-fraude (assessment_proctoring_logs)
CREATE TABLE IF NOT EXISTS public.assessment_proctoring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type_evenement text NOT NULL CHECK (type_evenement IN (
    'changement_onglet', 'perte_visibilite', 'sortie_plein_ecran',
    'tentative_copier_coller', 'clic_droit', 'expiration_temps',
    'reconnexion', 'deconnexion', 'touche_interdite'
  )),
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_attempt
  ON public.assessment_proctoring_logs(attempt_id);

-- 5. Documents indépendants rattachés aux cours / formations / évaluations
CREATE TABLE IF NOT EXISTS public.assessment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  description text DEFAULT '',
  formation_id uuid REFERENCES public.formations(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  target_groupe text,
  fichier_nom text NOT NULL,
  fichier_taille bigint NOT NULL DEFAULT 0,
  fichier_type text NOT NULL,
  fichier_url text NOT NULL,
  storage_key text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Évolution de public.test_answers pour notation manuelle
ALTER TABLE public.test_answers
  ADD COLUMN IF NOT EXISTS attempt_id uuid REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reponse_longue text,
  ADD COLUMN IF NOT EXISTS choix_multiples jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS note_manuelle numeric(5,2),
  ADD COLUMN IF NOT EXISTS commentaire_formateur text,
  ADD COLUMN IF NOT EXISTS statut_correction text NOT NULL DEFAULT 'auto' CHECK (statut_correction IN ('auto', 'en_attente', 'corrige'));

-- 6. Sécurité RLS
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_proctoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_documents ENABLE ROW LEVEL SECURITY;

-- Politiques pour assessment_attempts
DROP POLICY IF EXISTS "attempts_staff_and_teacher" ON public.assessment_attempts;
CREATE POLICY "attempts_staff_and_teacher" ON public.assessment_attempts
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = assessment_attempts.test_id AND te.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "attempts_student_self" ON public.assessment_attempts;
CREATE POLICY "attempts_student_self" ON public.assessment_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assessment_attempts.student_id AND s.user_id = auth.uid()
    )
  );

-- Politiques pour assessment_proctoring_logs
DROP POLICY IF EXISTS "proctoring_staff_and_teacher" ON public.assessment_proctoring_logs;
CREATE POLICY "proctoring_staff_and_teacher" ON public.assessment_proctoring_logs
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = assessment_proctoring_logs.test_id AND te.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "proctoring_student_insert" ON public.assessment_proctoring_logs;
CREATE POLICY "proctoring_student_insert" ON public.assessment_proctoring_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assessment_proctoring_logs.student_id AND s.user_id = auth.uid()
    )
  );

-- Politiques pour assessment_documents
DROP POLICY IF EXISTS "documents_read_auth" ON public.assessment_documents;
CREATE POLICY "documents_read_auth" ON public.assessment_documents
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "documents_write_staff_teacher" ON public.assessment_documents;
CREATE POLICY "documents_write_staff_teacher" ON public.assessment_documents
  FOR ALL TO authenticated
  USING (public.is_staff() OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()))
  WITH CHECK (public.is_staff() OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid()));

-- 7. RPC : Démarrage d'une tentative côté serveur avec calcul strict de fin
CREATE OR REPLACE FUNCTION public.start_assessment_attempt(
  p_test_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_student record;
  v_test record;
  v_existing_attempt record;
  v_attempt_count int;
  v_attempt_id uuid;
  v_now timestamptz := now();
  v_fin_prevue timestamptz;
  v_sanitized_questions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Profil étudiant introuvable pour ce compte.';
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
  IF v_test.id IS NULL THEN
    RAISE EXCEPTION 'Évaluation introuvable.';
  END IF;

  IF v_test.statut NOT IN ('publie', 'en_cours') THEN
    RAISE EXCEPTION 'Cette évaluation n''est pas actuellement ouverte.';
  END IF;

  -- Vérifier si une tentative est déjà en cours
  SELECT * INTO v_existing_attempt
  FROM public.assessment_attempts
  WHERE test_id = p_test_id AND student_id = v_student.id AND statut = 'en_cours'
  ORDER BY heure_debut DESC LIMIT 1;

  IF v_existing_attempt.id IS NOT NULL THEN
    -- Si la tentative est expirée selon l'horloge serveur
    IF now() >= v_existing_attempt.heure_fin_prevue THEN
      UPDATE public.assessment_attempts
      SET statut = 'expire', heure_fin_reelle = v_existing_attempt.heure_fin_prevue
      WHERE id = v_existing_attempt.id;
    ELSE
      -- Retourner la tentative en cours existante pour reprise après refresh
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question', q.question,
          'type', q.type,
          'options', q.options_json,
          'points', q.points,
          'ordre', q.ordre,
          'obligatoire', q.obligatoire
        ) ORDER BY q.ordre
      ) INTO v_sanitized_questions
      FROM public.questions q
      WHERE q.test_id = p_test_id;

      RETURN jsonb_build_object(
        'attempt_id', v_existing_attempt.id,
        'heure_debut', v_existing_attempt.heure_debut,
        'heure_fin_prevue', v_existing_attempt.heure_fin_prevue,
        'duree_minutes', v_test.duree,
        'reponses_temporaires', v_existing_attempt.reponses_temporaires,
        'questions', COALESCE(v_sanitized_questions, '[]'::jsonb),
        'resumed', true
      );
    END IF;
  END IF;

  -- Vérifier la limite de tentatives
  SELECT count(*) INTO v_attempt_count
  FROM public.assessment_attempts
  WHERE test_id = p_test_id AND student_id = v_student.id AND statut IN ('soumis', 'expire', 'corrige');

  IF v_attempt_count >= COALESCE(v_test.tentatives, 1) THEN
    RAISE EXCEPTION 'Nombre maximal de tentatives atteint (% sur %).', v_attempt_count, COALESCE(v_test.tentatives, 1);
  END IF;

  v_fin_prevue := v_now + (COALESCE(v_test.duree, 45) || ' minutes')::interval;

  INSERT INTO public.assessment_attempts (
    test_id, student_id, heure_debut, heure_fin_prevue, statut
  ) VALUES (
    p_test_id, v_student.id, v_now, v_fin_prevue, 'en_cours'
  ) RETURNING id INTO v_attempt_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'question', q.question,
      'type', q.type,
      'options', q.options_json,
      'points', q.points,
      'ordre', q.ordre,
      'obligatoire', q.obligatoire
    ) ORDER BY q.ordre
  ) INTO v_sanitized_questions
  FROM public.questions q
  WHERE q.test_id = p_test_id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'heure_debut', v_now,
    'heure_fin_prevue', v_fin_prevue,
    'duree_minutes', v_test.duree,
    'reponses_temporaires', '{}'::jsonb,
    'questions', COALESCE(v_sanitized_questions, '[]'::jsonb),
    'resumed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_assessment_attempt(uuid) TO authenticated;

-- 8. RPC : Sauvegarde automatique en cours d'examen (Autosave)
CREATE OR REPLACE FUNCTION public.save_assessment_progress(
  p_attempt_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_attempt record;
  v_student record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id;

  IF v_attempt.id IS NULL OR v_attempt.student_id <> v_student.id THEN
    RAISE EXCEPTION 'Tentative introuvable ou non autorisée.';
  END IF;

  IF v_attempt.statut <> 'en_cours' THEN
    RAISE EXCEPTION 'La tentative est déjà clôturée (%s).', v_attempt.statut;
  END IF;

  -- Si temps écoulé sur le serveur, verrouillage automatique
  IF now() > v_attempt.heure_fin_prevue THEN
    UPDATE public.assessment_attempts
    SET statut = 'expire', heure_fin_reelle = v_attempt.heure_fin_prevue, reponses_temporaires = p_answers, updated_at = now()
    WHERE id = p_attempt_id;

    RETURN jsonb_build_object('success', false, 'expired', true, 'message', 'Le temps imparti est écoulé.');
  END IF;

  UPDATE public.assessment_attempts
  SET reponses_temporaires = p_answers, updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object('success', true, 'saved_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_assessment_progress(uuid, jsonb) TO authenticated;

-- 9. RPC : Journalisation des événements de surveillance
CREATE OR REPLACE FUNCTION public.log_proctoring_event(
  p_attempt_id uuid,
  p_event_type text,
  p_details jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_attempt record;
  v_student record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id;

  IF v_attempt.id IS NULL OR v_attempt.student_id <> v_student.id THEN
    RAISE EXCEPTION 'Tentative invalide.';
  END IF;

  INSERT INTO public.assessment_proctoring_logs (
    attempt_id, test_id, student_id, type_evenement, details
  ) VALUES (
    p_attempt_id, v_attempt.test_id, v_student.id, p_event_type, p_details
  );

  RETURN jsonb_build_object('logged', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_proctoring_event(uuid, text, jsonb) TO authenticated;

-- 10. RPC : Soumission finale et correction automatique complète
CREATE OR REPLACE FUNCTION public.submit_assessment(
  p_attempt_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_attempt record;
  v_student record;
  v_test record;
  v_q record;
  v_result_id uuid;
  v_total_points numeric := 0;
  v_earned_points numeric := 0;
  v_bareme numeric := 20;
  v_note numeric;
  v_pct numeric;
  v_statut text;
  v_needs_manual boolean := false;
  v_ans_val text;
  v_is_correct boolean;
  v_duree_sec int;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id;

  IF v_attempt.id IS NULL OR v_attempt.student_id <> v_student.id THEN
    RAISE EXCEPTION 'Tentative invalide ou déjà soumise.';
  END IF;

  IF v_attempt.statut NOT IN ('en_cours', 'expire') THEN
    RAISE EXCEPTION 'Cette tentative a déjà été clôturée.';
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = v_attempt.test_id;
  IF v_test.bareme IS NOT NULL AND v_test.bareme > 0 THEN
    v_bareme := v_test.bareme;
  END IF;

  v_duree_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_attempt.heure_debut))::int);

  -- Créer le test_result consolidé pour compatibilité existante
  INSERT INTO public.test_results (
    test_id, student_id, note, pourcentage, date, heure, valide, statut
  ) VALUES (
    v_test.id, v_student.id, 0, 0, v_now, to_char(v_now, 'HH24:MI'),
    NOT COALESCE(v_test.validation_requise, false), 'echoue'
  ) RETURNING id INTO v_result_id;

  -- Boucler sur les questions avec correction automatique et détection des questions longues
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
        result_id, question_id, attempt_id, reponse_donnee, reponse_longue, correct, points_obtenus, statut_correction
      ) VALUES (
        v_result_id, v_q.id, p_attempt_id, v_ans_val, v_ans_val, false, 0, 'en_attente'
      );
    ELSIF v_q.type = 'numerique' THEN
      DECLARE
        v_num_input numeric;
        v_diff numeric;
      BEGIN
        v_num_input := v_ans_val::numeric;
        v_diff := abs(v_num_input - COALESCE(v_q.valeur_numerique, 0));
        IF v_diff <= COALESCE(v_q.tolerance_numerique, 0) THEN
          v_is_correct := true;
          v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_is_correct := false;
      END;

      INSERT INTO public.test_answers (
        result_id, question_id, attempt_id, reponse_donnee, correct, points_obtenus, statut_correction
      ) VALUES (
        v_result_id, v_q.id, p_attempt_id, v_ans_val, v_is_correct,
        CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
      );
    ELSIF v_q.type = 'qcm_multiple' THEN
      DECLARE
        v_selected_arr jsonb := COALESCE(p_answers->(v_q.id::text), '[]'::jsonb);
        v_expected_arr jsonb := COALESCE(v_q.bonnes_reponses_json, '[]'::jsonb);
      BEGIN
        IF v_selected_arr = v_expected_arr THEN
          v_is_correct := true;
          v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
        END IF;

        INSERT INTO public.test_answers (
          result_id, question_id, attempt_id, reponse_donnee, choix_multiples, correct, points_obtenus, statut_correction
        ) VALUES (
          v_result_id, v_q.id, p_attempt_id, v_selected_arr::text, v_selected_arr, v_is_correct,
          CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
        );
      END;
    ELSE
      -- QCM unique, Vrai/Faux ou réponse courte
      IF v_ans_val <> '' THEN
        IF v_q.type IN ('qcm', 'vf') THEN
          v_is_correct := (trim(lower(v_ans_val)) = trim(lower(v_q.bonne_reponse)));
        ELSE
          v_is_correct := (
            trim(lower(v_ans_val)) = trim(lower(v_q.bonne_reponse))
            OR position(trim(lower(v_ans_val)) IN trim(lower(v_q.bonne_reponse))) > 0
            OR position(trim(lower(v_q.bonne_reponse)) IN trim(lower(v_ans_val))) > 0
          );
        END IF;

        IF v_is_correct THEN
          v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
        END IF;
      END IF;

      INSERT INTO public.test_answers (
        result_id, question_id, attempt_id, reponse_donnee, correct, points_obtenus, statut_correction
      ) VALUES (
        v_result_id, v_q.id, p_attempt_id, v_ans_val, v_is_correct,
        CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END, 'auto'
      );
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

GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;

COMMIT;
