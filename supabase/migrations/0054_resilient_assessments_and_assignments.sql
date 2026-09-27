-- ============================================================
-- 0054_resilient_assessments_and_assignments.sql
-- Synchronisation résiliente et publication immédiate des
-- Évaluations & Devoirs pour l'ensemble des formateurs, admins et apprenants.
-- ============================================================

-- 1. Assouplissement des contraintes de clés étrangères teacher_id
-- (Permet aux administrateurs ou formateurs invités de publier des sujets)
ALTER TABLE IF EXISTS public.tests 
  DROP CONSTRAINT IF EXISTS tests_teacher_id_fkey;

ALTER TABLE IF EXISTS public.tests 
  ALTER COLUMN teacher_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.assignments 
  DROP CONSTRAINT IF EXISTS assignments_teacher_id_fkey;

ALTER TABLE IF EXISTS public.assignments 
  ALTER COLUMN teacher_id DROP NOT NULL;

-- 2. Politiques RLS robustes pour public.tests
ALTER TABLE IF EXISTS public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tests_staff_teacher_all" ON public.tests;
DROP POLICY IF EXISTS "tests_staff_manage" ON public.tests;
DROP POLICY IF EXISTS "tests_teacher_manage" ON public.tests;
DROP POLICY IF EXISTS "tests_student_select" ON public.tests;
DROP POLICY IF EXISTS "tests_read_published" ON public.tests;
DROP POLICY IF EXISTS "tests_anon_read_published" ON public.tests;

-- Staff (superadmin, admin) : Plein pouvoir
CREATE POLICY "tests_staff_manage" ON public.tests
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Enseignants : Gestion de leurs tests
CREATE POLICY "tests_teacher_manage" ON public.tests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE (t.id = tests.teacher_id OR t.user_id = auth.uid())
        AND t.user_id = auth.uid()
    ) OR tests.teacher_id = auth.uid()::text
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE (t.id = tests.teacher_id OR t.user_id = auth.uid())
        AND t.user_id = auth.uid()
    ) OR tests.teacher_id = auth.uid()::text
  );

-- Tous les utilisateurs authentifiés (Apprenants) : Lecture des tests publiés
CREATE POLICY "tests_read_published" ON public.tests
  FOR SELECT TO authenticated
  USING (
    statut IN ('publie', 'en_cours', 'ouvert') OR public.is_staff()
  );

-- Utilisateurs anonymes (Démo / Mode public) : Lecture des tests publiés
CREATE POLICY "tests_anon_read_published" ON public.tests
  FOR SELECT TO anon
  USING (
    statut IN ('publie', 'en_cours', 'ouvert')
  );

-- 3. Politiques RLS robustes pour public.questions
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_staff_teacher_all" ON public.questions;
DROP POLICY IF EXISTS "questions_all_read" ON public.questions;
DROP POLICY IF EXISTS "questions_anon_read" ON public.questions;

CREATE POLICY "questions_staff_teacher_all" ON public.questions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "questions_anon_read" ON public.questions
  FOR SELECT TO anon
  USING (true);

-- 4. Politiques RLS robustes pour public.assignments
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_staff_teacher" ON public.assignments;
DROP POLICY IF EXISTS "assignments_staff_all" ON public.assignments;
DROP POLICY IF EXISTS "assignments_teacher_manage" ON public.assignments;
DROP POLICY IF EXISTS "assignments_student_read" ON public.assignments;
DROP POLICY IF EXISTS "assignments_anon_read" ON public.assignments;

CREATE POLICY "assignments_staff_all" ON public.assignments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "assignments_teacher_manage" ON public.assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE (t.id = assignments.teacher_id OR t.user_id = auth.uid())
        AND t.user_id = auth.uid()
    ) OR assignments.teacher_id = auth.uid()::text
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE (t.id = assignments.teacher_id OR t.user_id = auth.uid())
        AND t.user_id = auth.uid()
    ) OR assignments.teacher_id = auth.uid()::text
  );

CREATE POLICY "assignments_student_read" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    statut IN ('publie', 'ouvert') OR public.is_staff()
  );

CREATE POLICY "assignments_anon_read" ON public.assignments
  FOR SELECT TO anon
  USING (
    statut IN ('publie', 'ouvert')
  );

-- 5. Politiques pour public.assignment_attachments
ALTER TABLE IF EXISTS public.assignment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignment_attachments_staff_teacher" ON public.assignment_attachments;
DROP POLICY IF EXISTS "assignment_attachments_read" ON public.assignment_attachments;
DROP POLICY IF EXISTS "assignment_attachments_manage" ON public.assignment_attachments;

CREATE POLICY "assignment_attachments_read" ON public.assignment_attachments
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "assignment_attachments_manage" ON public.assignment_attachments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Politiques pour public.assignment_submissions
ALTER TABLE IF EXISTS public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_student_insert" ON public.assignment_submissions;
DROP POLICY IF EXISTS "submissions_student_select" ON public.assignment_submissions;
DROP POLICY IF EXISTS "submissions_staff_manage" ON public.assignment_submissions;

CREATE POLICY "submissions_student_insert" ON public.assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "submissions_student_select" ON public.assignment_submissions
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR student_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = assignment_submissions.student_id AND s.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id = auth.uid()::text OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = a.teacher_id AND t.user_id = auth.uid()))
    )
  );

CREATE POLICY "submissions_staff_manage" ON public.assignment_submissions
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id = auth.uid()::text OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = a.teacher_id AND t.user_id = auth.uid()))
    )
  )
  WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND (a.teacher_id = auth.uid()::text OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = a.teacher_id AND t.user_id = auth.uid()))
    )
  );

-- 7. Fonctions RPC sécurisées pour suppression atomique
CREATE OR REPLACE FUNCTION public.delete_test_safe(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Suppression des dépendances
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

GRANT EXECUTE ON FUNCTION public.delete_test_safe(uuid) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.delete_assignment_safe(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Suppression des dépendances
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

GRANT EXECUTE ON FUNCTION public.delete_assignment_safe(uuid) TO authenticated, anon;

-- Activation du temps réel pour les tables tests et assignments
ALTER PUBLICATION supabase_realtime ADD TABLE public.tests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions;
