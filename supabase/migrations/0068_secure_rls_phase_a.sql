-- ==============================================================================
-- Migration 0068 : PHASE A - SÉCURISATION RLS MAJEURE & ISOLATION DES EXAMENS
-- Corrige les failles P0 identifiées dans l'audit v8 :
-- 1. Remplacement des 20 politiques ouvertes (USING true) sur les tables de 0065, 0066, 0067
-- 2. Protection hermétique des examens (questions.bonne_reponse / explication masquées aux apprenants)
-- 3. Anonymisation côté serveur des enquêtes de satisfaction (submit_survey_response & get_survey_results >= 5)
-- 4. Protection des clés API et masquage du secret des webhooks
-- Idempotente, RLS stricte par rôle/propriété, SECURITY DEFINER avec search_path fixé
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. FONCTIONS UTILITAIRES DE RÔLE ET CONTEXTE (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_role() = 'teacher' OR EXISTS (
    SELECT 1 FROM public.teachers WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_role() = 'student' OR EXISTS (
    SELECT 1 FROM public.students WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated;

-- ==============================================================================
-- 2. SUPPRESSION DES 20 POLITIQUES OUVERTES DE 0065, 0066 ET 0067
-- ==============================================================================

DROP POLICY IF EXISTS guardians_authenticated_all ON public.guardians;
DROP POLICY IF EXISTS student_guardians_authenticated_all ON public.student_guardians;
DROP POLICY IF EXISTS guardian_access_logs_authenticated_all ON public.guardian_access_logs;
DROP POLICY IF EXISTS surveys_authenticated_all ON public.surveys;
DROP POLICY IF EXISTS survey_questions_authenticated_all ON public.survey_questions;
DROP POLICY IF EXISTS survey_responses_authenticated_all ON public.survey_responses;
DROP POLICY IF EXISTS competencies_authenticated_all ON public.competencies;
DROP POLICY IF EXISTS module_competencies_authenticated_all ON public.module_competencies;
DROP POLICY IF EXISTS student_competency_progress_authenticated_all ON public.student_competency_progress;

DROP POLICY IF EXISTS alumni_follow_ups_auth_all ON public.alumni_follow_ups;
DROP POLICY IF EXISTS job_offers_auth_all ON public.job_offers;
DROP POLICY IF EXISTS forum_threads_auth_all ON public.forum_threads;
DROP POLICY IF EXISTS forum_posts_auth_all ON public.forum_posts;
DROP POLICY IF EXISTS resources_auth_all ON public.resources;

DROP POLICY IF EXISTS badges_auth_all ON public.badges;
DROP POLICY IF EXISTS student_badges_auth_all ON public.student_badges;
DROP POLICY IF EXISTS i18n_translations_auth_all ON public.i18n_translations;
DROP POLICY IF EXISTS api_keys_auth_all ON public.api_keys;
DROP POLICY IF EXISTS webhook_endpoints_auth_all ON public.webhook_endpoints;
DROP POLICY IF EXISTS webhook_deliveries_auth_all ON public.webhook_deliveries;

-- ==============================================================================
-- 3. NOUVELLES POLITIQUES RLS STRICTES (TABLES 0065 : TUTEURS, ENQUÊTES, COMPÉTENCES)
-- ==============================================================================

-- 3.1 public.guardians
-- Le personnel administratif gère tout
CREATE POLICY guardians_staff_all ON public.guardians
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Le tuteur lit et modifie son propre profil
CREATE POLICY guardians_self_read ON public.guardians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY guardians_self_update ON public.guardians
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- L'apprenant peut lire les tuteurs qui lui sont activement liés
CREATE POLICY guardians_student_read ON public.guardians
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_guardians sg
      WHERE sg.guardian_id = guardians.id
        AND sg.student_id = public.current_student_id()
        AND sg.is_active = true
        AND sg.consent_revoked_at IS NULL
    )
  );

-- 3.2 public.student_guardians
-- Staff gère toutes les liaisons
CREATE POLICY student_guardians_staff_all ON public.student_guardians
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Le tuteur ne lit que les liaisons le concernant
CREATE POLICY student_guardians_guardian_read ON public.student_guardians
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = student_guardians.guardian_id
        AND g.user_id = auth.uid()
    )
  );

-- L'apprenant ne lit que ses propres liaisons
CREATE POLICY student_guardians_student_read ON public.student_guardians
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- 3.3 public.guardian_access_logs
-- Journal d'accès : écriture contrôlée, lecture staff uniquement, JAMAIS de suppression ni modification
CREATE POLICY guardian_access_logs_staff_read ON public.guardian_access_logs
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY guardian_access_logs_guardian_insert ON public.guardian_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff() OR
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_access_logs.guardian_id
        AND g.user_id = auth.uid()
    )
  );

REVOKE UPDATE, DELETE ON public.guardian_access_logs FROM authenticated, anon;

-- 3.4 public.surveys
-- Staff & formateur propriétaire gèrent l'enquête
CREATE POLICY surveys_staff_all ON public.surveys
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY surveys_teacher_manage ON public.surveys
  FOR ALL TO authenticated
  USING (teacher_id = public.current_teacher_id())
  WITH CHECK (teacher_id = public.current_teacher_id());

-- Les apprenants et autres enseignants ne peuvent lire que les enquêtes actives
CREATE POLICY surveys_read_active ON public.surveys
  FOR SELECT TO authenticated
  USING (status = 'active');

-- 3.5 public.survey_questions
CREATE POLICY survey_questions_staff_all ON public.survey_questions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY survey_questions_teacher_manage ON public.survey_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_questions.survey_id
        AND s.teacher_id = public.current_teacher_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_questions.survey_id
        AND s.teacher_id = public.current_teacher_id()
    )
  );

CREATE POLICY survey_questions_read_active ON public.survey_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_questions.survey_id
        AND (s.status = 'active' OR public.is_staff() OR s.teacher_id = public.current_teacher_id())
    )
  );

-- 3.6 public.survey_responses
-- AUCUNE lecture directe : les réponses individuelles brutes ne doivent jamais être exposées
-- L'accès aux résultats agrégés se fait exclusivement par la RPC get_survey_results()
CREATE POLICY survey_responses_no_direct_select ON public.survey_responses
  FOR SELECT TO authenticated
  USING (false);

REVOKE SELECT ON public.survey_responses FROM authenticated, anon;

-- 3.7 public.competencies
-- Référentiel lisible par tous les utilisateurs connectés, modifiable uniquement par le staff
CREATE POLICY competencies_read_all ON public.competencies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY competencies_staff_write ON public.competencies
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3.8 public.module_competencies
CREATE POLICY module_competencies_read_all ON public.module_competencies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY module_competencies_staff_teacher_write ON public.module_competencies
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher_of_module(module_id))
  WITH CHECK (public.is_staff() OR public.is_teacher_of_module(module_id));

-- 3.9 public.student_competency_progress
-- Lecture : l'apprenant lit ses compétences, formateurs et staff lisent tout
CREATE POLICY scp_read_own_or_pedagogy ON public.student_competency_progress
  FOR SELECT TO authenticated
  USING (
    student_id = public.current_student_id()
    OR public.is_staff()
    OR public.is_teacher()
  );

-- Écriture : strictement réservée au staff et aux enseignants. AUCUNE auto-attribution par un apprenant.
CREATE POLICY scp_write_pedagogy_only ON public.student_competency_progress
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());

-- ==============================================================================
-- 4. NOUVELLES POLITIQUES RLS STRICTES (TABLES 0066 : INSERTION, FORUM, RESSOURCES)
-- ==============================================================================

-- 4.1 public.alumni_follow_ups
CREATE POLICY alumni_staff_all ON public.alumni_follow_ups
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY alumni_student_read_own ON public.alumni_follow_ups
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

-- 4.2 public.job_offers
-- Offres actives lisibles par tous les connectés, modifiables par le staff
CREATE POLICY job_offers_read_active ON public.job_offers
  FOR SELECT TO authenticated
  USING (active = true OR public.is_staff());

CREATE POLICY job_offers_staff_write ON public.job_offers
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 4.3 public.forum_threads
CREATE POLICY forum_threads_read_all ON public.forum_threads
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY forum_threads_insert_author ON public.forum_threads
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY forum_threads_update_delete ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid()::text AND is_closed = false)
    OR public.is_staff()
    OR public.is_teacher_of_module(module_id)
  )
  WITH CHECK (
    (author_id = auth.uid()::text AND is_closed = false)
    OR public.is_staff()
    OR public.is_teacher_of_module(module_id)
  );

CREATE POLICY forum_threads_delete_mod ON public.forum_threads
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()::text
    OR public.is_staff()
    OR public.is_teacher_of_module(module_id)
  );

-- 4.4 public.forum_posts
CREATE POLICY forum_posts_read_all ON public.forum_posts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY forum_posts_insert_author ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()::text);

CREATE POLICY forum_posts_update_delete ON public.forum_posts
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()::text
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.forum_threads ft
      WHERE ft.id = forum_posts.thread_id
        AND public.is_teacher_of_module(ft.module_id)
    )
  )
  WITH CHECK (
    author_id = auth.uid()::text
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.forum_threads ft
      WHERE ft.id = forum_posts.thread_id
        AND public.is_teacher_of_module(ft.module_id)
    )
  );

CREATE POLICY forum_posts_delete_mod ON public.forum_posts
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()::text
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.forum_threads ft
      WHERE ft.id = forum_posts.thread_id
        AND public.is_teacher_of_module(ft.module_id)
    )
  );

-- 4.5 public.resources
CREATE POLICY resources_read_all ON public.resources
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY resources_staff_teacher_write ON public.resources
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());

-- ==============================================================================
-- 5. NOUVELLES POLITIQUES RLS STRICTES (TABLES 0067 : GAMIFICATION, I18N, API, WEBHOOKS)
-- ==============================================================================

-- 5.1 public.badges
CREATE POLICY badges_read_all ON public.badges
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY badges_staff_write ON public.badges
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5.2 public.student_badges
CREATE POLICY student_badges_read_all ON public.student_badges
  FOR SELECT TO authenticated
  USING (true);

-- Seul le personnel administratif peut décerner des badges (jamais d'auto-attribution)
CREATE POLICY student_badges_staff_write ON public.student_badges
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5.3 public.i18n_translations
CREATE POLICY i18n_read_all ON public.i18n_translations
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY i18n_staff_write ON public.i18n_translations
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5.4 public.api_keys (Réservée exclusivement aux administrateurs)
CREATE POLICY api_keys_staff_all ON public.api_keys
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5.5 public.webhook_endpoints & 5.6 public.webhook_deliveries
CREATE POLICY webhook_endpoints_staff_all ON public.webhook_endpoints
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY webhook_deliveries_staff_all ON public.webhook_deliveries
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Masquage obligatoire de la colonne de secret
REVOKE SELECT (secret) ON public.webhook_endpoints FROM authenticated, anon;

-- ==============================================================================
-- 6. PROTECTION DES EXAMENS (A.3 : QUESTIONS.BONNE_REPONSE MASQUÉE AUX APPRENANTS)
-- ==============================================================================

-- Révocation de la politique permissive introduite dans 0059
DROP POLICY IF EXISTS "questions_read_authenticated" ON public.questions;
DROP POLICY IF EXISTS "questions_read_staff_or_teacher" ON public.questions;

-- Lecture directe de public.questions : STRICTEMENT réservée au staff ou au formateur créateur
CREATE POLICY "questions_read_staff_or_teacher" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests t
      JOIN public.teachers te ON te.id = t.teacher_id
      WHERE t.id = questions.test_id AND te.user_id = auth.uid()
    )
  );

-- Vue sécurisée sans aucune information de correction (bonne_reponse / explication)
CREATE OR REPLACE VIEW public.questions_apprenant
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

-- Fonction RPC sécurisée retournant un examen et ses questions sans fuite de correction
CREATE OR REPLACE FUNCTION public.get_test_for_student(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_test record;
  v_questions jsonb;
BEGIN
  SELECT id, titre, description, module_id, teacher_id, consignes, duree, bareme, seuil_reussite, difficulte, tentatives, statut
  INTO v_test
  FROM public.tests
  WHERE id = p_test_id AND statut IN ('publie', 'en_cours', 'ouvert');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Évaluation introuvable ou fermée');
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'test_id', q.test_id,
      'question', q.question,
      'type', q.type,
      'points', q.points,
      'options', q.options_json,
      'ordre', q.ordre,
      'obligatoire', q.obligatoire
    ) ORDER BY q.ordre ASC
  ), '[]'::jsonb)
  INTO v_questions
  FROM public.questions q
  WHERE q.test_id = p_test_id;

  RETURN jsonb_build_object(
    'success', true,
    'test', to_jsonb(v_test),
    'questions', v_questions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_test_for_student(uuid) TO authenticated;

-- ==============================================================================
-- 7. FONCTIONS SÉCURISÉES D'ENQUÊTES (A.1 : ANONYMISATION SERVEUR & AGRÉGATION >= 5)
-- ==============================================================================

-- Soumission des réponses avec calcul côté serveur du hash anonymisant
CREATE OR REPLACE FUNCTION public.submit_survey_response(
  p_survey_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  v_survey_status text;
  v_item jsonb;
  v_count int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentification requise');
  END IF;

  -- Vérifier l'état de l'enquête
  SELECT status INTO v_survey_status FROM public.surveys WHERE id = p_survey_id;
  IF NOT FOUND OR v_survey_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquête non disponible ou clôturée');
  END IF;

  -- Calcul sécurisé de l'empreinte anonyme (auth.uid + survey_id + secret serveur)
  v_hash := encode(sha256(convert_to('SN_SURVEY_SECRET_SALT_2026_' || v_uid::text || '_' || p_survey_id::text, 'UTF8')), 'hex');

  -- Insertion sécurisée des réponses
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    INSERT INTO public.survey_responses (
      survey_id,
      question_id,
      respondent_hash,
      rating_value,
      text_value,
      submitted_at
    ) VALUES (
      p_survey_id,
      (v_item->>'question_id')::uuid,
      v_hash,
      CASE WHEN v_item ? 'rating_value' THEN (v_item->>'rating_value')::int ELSE NULL END,
      v_item->>'text_value',
      now()
    )
    ON CONFLICT (survey_id, question_id, respondent_hash)
    DO UPDATE SET
      rating_value = EXCLUDED.rating_value,
      text_value = EXCLUDED.text_value,
      submitted_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'recorded_answers', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_survey_response(uuid, jsonb) TO authenticated;

-- Consultation des résultats : restitution AGRÉGÉE uniquement si >= 5 répondants distincts
CREATE OR REPLACE FUNCTION public.get_survey_results(p_survey_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_survey record;
  v_total_respondents int;
  v_min_threshold int := 5;
  v_avg_score numeric;
  v_questions_summary jsonb;
BEGIN
  -- Seuls le staff ou le formateur assigné peuvent consulter les résultats
  IF NOT (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.surveys WHERE id = p_survey_id AND teacher_id = public.current_teacher_id()
  )) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès réservé au personnel pédagogique');
  END IF;

  SELECT * INTO v_survey FROM public.surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquête introuvable');
  END IF;

  v_min_threshold := coalesce(v_survey.min_responses_for_aggregation, 5);

  -- Dénombrement des répondants uniques
  SELECT count(DISTINCT respondent_hash)
  INTO v_total_respondents
  FROM public.survey_responses
  WHERE survey_id = p_survey_id;

  -- Protection de l'anonymat : bloquer si inférieur au seuil
  IF v_total_respondents < v_min_threshold THEN
    RETURN jsonb_build_object(
      'success', true,
      'survey_id', p_survey_id,
      'is_aggregated', false,
      'total_respondents', v_total_respondents,
      'min_required', v_min_threshold,
      'reason', 'Seuil minimal de protection d''anonymat non atteint (' || v_total_respondents || '/' || v_min_threshold || ' réponses)'
    );
  END IF;

  -- Moyenne globale
  SELECT round(avg(rating_value)::numeric, 2)
  INTO v_avg_score
  FROM public.survey_responses
  WHERE survey_id = p_survey_id AND rating_value IS NOT NULL;

  -- Résumé agrégé par question
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'question_id', sq.id,
      'question_text', sq.question_text,
      'average_rating', (
        SELECT round(avg(sr.rating_value)::numeric, 2)
        FROM public.survey_responses sr
        WHERE sr.question_id = sq.id AND sr.rating_value IS NOT NULL
      ),
      'responses_count', (
        SELECT count(*)
        FROM public.survey_responses sr
        WHERE sr.question_id = sq.id
      ),
      'text_answers', (
        SELECT coalesce(jsonb_agg(sr.text_value), '[]'::jsonb)
        FROM public.survey_responses sr
        WHERE sr.question_id = sq.id AND sr.text_value IS NOT NULL AND length(sr.text_value) > 0
      )
    ) ORDER BY sq.order_index ASC
  ), '[]'::jsonb)
  INTO v_questions_summary
  FROM public.survey_questions sq
  WHERE sq.survey_id = p_survey_id;

  RETURN jsonb_build_object(
    'success', true,
    'survey_id', p_survey_id,
    'is_aggregated', true,
    'total_respondents', v_total_respondents,
    'average_score', v_avg_score,
    'questions_summary', v_questions_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_survey_results(uuid) TO authenticated;

COMMIT;
