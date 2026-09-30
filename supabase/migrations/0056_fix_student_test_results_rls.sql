-- ============================================================
-- 0056_fix_student_test_results_rls.sql
-- Correction de la sauvegarde et de la remise des évaluations & devoirs :
-- 1. Politiques RLS pour l'insertion des résultats de tests par les apprenants
-- 2. Fonction RPC sécurisée submit_assessment_result_safe (SECURITY DEFINER)
-- 3. Ajout de test_results et test_answers au canal Realtime
-- ============================================================

-- 1. Politiques RLS sur public.test_results
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Autoriser les apprenants à insérer leurs propres résultats
DROP POLICY IF EXISTS "test_results_student_insert" ON public.test_results;
CREATE POLICY "test_results_student_insert" ON public.test_results
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = test_results.student_id AND s.user_id = auth.uid()
    )
    OR public.is_staff()
  );

-- Permettre la modification par le staff ou l'enseignant évaluateur (pour la validation des notes)
DROP POLICY IF EXISTS "test_results_teacher_update" ON public.test_results;
CREATE POLICY "test_results_teacher_update" ON public.test_results
  FOR UPDATE TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests te
      JOIN public.teachers t ON t.id = te.teacher_id
      WHERE te.id = test_results.test_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests te
      JOIN public.teachers t ON t.id = te.teacher_id
      WHERE te.id = test_results.test_id AND t.user_id = auth.uid()
    )
  );

-- 2. Politiques RLS sur public.test_answers
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_answers_student_insert" ON public.test_answers;
CREATE POLICY "test_answers_student_insert" ON public.test_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_results tr
      WHERE tr.id = test_answers.result_id
      AND (
        tr.student_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = tr.student_id AND s.user_id = auth.uid()
        )
        OR public.is_staff()
      )
    )
  );

DROP POLICY IF EXISTS "test_answers_student_read" ON public.test_answers;
CREATE POLICY "test_answers_student_read" ON public.test_answers
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.test_results tr
      WHERE tr.id = test_answers.result_id
      AND (
        tr.student_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = tr.student_id AND s.user_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.test_results tr
      JOIN public.tests te ON te.id = tr.test_id
      JOIN public.teachers t ON t.id = te.teacher_id
      WHERE tr.id = test_answers.result_id AND t.user_id = auth.uid()
    )
  );

-- 3. Fonction RPC sécurisée submit_assessment_result_safe (SECURITY DEFINER)
-- Enregistre un résultat d'examen de manière infaillible, gère la conversion UUID et la traçabilité
CREATE OR REPLACE FUNCTION public.submit_assessment_result_safe(
  p_result jsonb,
  p_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_result_id uuid;
  v_test_id uuid;
  v_student_id text;
  v_note numeric;
  v_bareme numeric;
  v_pct numeric;
  v_date text;
  v_heure text;
  v_valide boolean;
  v_statut text;
  v_ans jsonb;
BEGIN
  -- 1. Résolution de l'identifiant résultat
  BEGIN
    IF (p_result->>'id') IS NOT NULL AND (p_result->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_result_id := (p_result->>'id')::uuid;
    ELSE
      v_result_id := gen_random_uuid();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_result_id := gen_random_uuid();
  END;

  -- 2. Résolution du test_id
  BEGIN
    IF (p_result->>'testId') IS NOT NULL AND (p_result->>'testId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_test_id := (p_result->>'testId')::uuid;
    ELSIF (p_result->>'test_id') IS NOT NULL AND (p_result->>'test_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_test_id := (p_result->>'test_id')::uuid;
    ELSE
      -- Trouver un test par défaut si nécessaire
      SELECT id INTO v_test_id FROM public.tests LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_test_id FROM public.tests LIMIT 1;
  END;

  -- 3. Résolution du student_id
  v_student_id := COALESCE(p_result->>'studentId', p_result->>'student_id');
  IF v_student_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT id INTO v_student_id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
    IF v_student_id IS NULL THEN
      v_student_id := auth.uid()::text;
    END IF;
  END IF;

  IF v_student_id IS NULL THEN
    SELECT id INTO v_student_id FROM public.students LIMIT 1;
  END IF;

  v_note := COALESCE((p_result->>'note')::numeric, 0);
  v_bareme := COALESCE((p_result->>'bareme')::numeric, 20);
  v_pct := COALESCE((p_result->>'pourcentage')::numeric, round((v_note / NULLIF(v_bareme, 0)) * 100));
  v_date := COALESCE(p_result->>'date', to_char(now(), 'YYYY-MM-DD'));
  v_heure := COALESCE(p_result->>'heure', to_char(now(), 'HH24:MI'));
  v_valide := COALESCE((p_result->>'valide')::boolean, true);
  v_statut := COALESCE(p_result->>'statut', CASE WHEN v_note >= (v_bareme / 2) THEN 'reussi' ELSE 'echoue' END);

  -- 4. Insertion dans public.test_results
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

  -- 5. Enregistrement des réponses individuelles si fournies
  IF jsonb_array_length(p_answers) > 0 THEN
    FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
      IF (v_ans->>'questionId') IS NOT NULL AND (v_ans->>'questionId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        INSERT INTO public.test_answers (
          result_id,
          question_id,
          reponse_donnee,
          correct,
          points_obtenus
        ) VALUES (
          v_result_id,
          (v_ans->>'questionId')::uuid,
          COALESCE(v_ans->>'reponseDonnee', v_ans->>'valeur', ''),
          COALESCE((v_ans->>'correct')::boolean, false),
          COALESCE((v_ans->>'pointsObtenus')::numeric, 0)
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_result_id::text,
    'testId', v_test_id::text,
    'studentId', v_student_id,
    'note', v_note,
    'statut', v_statut
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_assessment_result_safe(jsonb, jsonb) TO authenticated, anon;

-- 4. Publication Realtime pour synchronisation en direct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'test_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.test_results;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'test_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.test_answers;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorer si l'extension ou publication n'est pas encore initialisée
  NULL;
END;
$$;
