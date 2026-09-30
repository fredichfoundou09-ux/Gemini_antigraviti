-- ============================================================
-- 0059_fix_questions_and_submissions_rls.sql
-- Durcissement RLS des questions et des remises de devoirs :
-- 1. Suppression des politiques trop permissives sur public.questions
-- 2. Création de la vue questions_apprenant masquant les réponses aux apprenants
-- 3. RLS stricte sur questions (écriture réservée au propriétaire / staff)
-- 4. RLS stricte sur assignment_submissions (l'apprenant ne peut soumettre que pour son compte)
-- ============================================================

-- 1. Vue sécurisée pour les apprenants (sans les réponses ni explications)
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

-- 2. Durcissement des politiques RLS sur public.questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_anon_read" ON public.questions;
DROP POLICY IF EXISTS "questions_staff_teacher_all" ON public.questions;
DROP POLICY IF EXISTS "questions_write_owner" ON public.questions;
DROP POLICY IF EXISTS "questions_read_authenticated" ON public.questions;

-- Écriture & suppression réservées au formateur propriétaire du test ou au staff
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

-- Lecture pour les formateurs, le staff et les apprenants pour les tests publiés
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

-- 3. Durcissement sur public.assignment_submissions
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
