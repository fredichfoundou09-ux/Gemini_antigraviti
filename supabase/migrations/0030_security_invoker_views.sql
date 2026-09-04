-- =========================================================================
-- 0030_security_invoker_views.sql
-- Correction Lint Supabase : Passage des 7 vues en security_invoker = true
-- 1. Configuration security_invoker = true sur les 7 vues
-- 2. Policy RLS public sur teachers pour alimenter public_teachers
-- 3. Sécurisation de questions au niveau colonne (Column-Level Security)
-- =========================================================================

BEGIN;

-- 1. Configuration security_invoker = true sur les 7 vues
ALTER VIEW public.partner_teacher_view      SET (security_invoker = true);
ALTER VIEW public.partner_attendance_view   SET (security_invoker = true);
ALTER VIEW public.partner_certificate_view  SET (security_invoker = true);
ALTER VIEW public.partner_report_view       SET (security_invoker = true);
ALTER VIEW public.partner_student_view      SET (security_invoker = true);
ALTER VIEW public.public_teachers           SET (security_invoker = true);
ALTER VIEW public.student_questions         SET (security_invoker = true);

-- 2. Garantir la lecture de la table teachers pour public_teachers (uniquement profs actifs pour anon/auth)
DROP POLICY IF EXISTS "teachers_read_public" ON public.teachers;
CREATE POLICY "teachers_read_public" ON public.teachers
  FOR SELECT TO authenticated, anon
  USING (actif = true OR public.is_staff());

-- 3. Garantir la lecture des questions pour student_questions (security_invoker = true)
DROP POLICY IF EXISTS "questions_read_auth" ON public.questions;
CREATE POLICY "questions_read_auth" ON public.questions
  FOR SELECT TO authenticated
  USING (true);

-- 4. Protection Column-Level Security : restreindre la lecture directe de bonne_reponse et explication
-- Seuls postgres, le service_role et les fonctions SECURITY DEFINER peuvent lire la solution
REVOKE SELECT (bonne_reponse, explication) ON public.questions FROM authenticated, anon;
GRANT SELECT (id, test_id, question, type, points, ordre) ON public.questions TO authenticated, anon;

COMMIT;
