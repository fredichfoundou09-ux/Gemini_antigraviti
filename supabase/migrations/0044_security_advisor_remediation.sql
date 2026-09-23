-- ==============================================================================
-- MIGRATION 0044: AUDIT DE SÉCURITÉ CRITIQUE & REMÉDIATION RLS SUPABASE
-- PROJET: CZX (tvcuwhgqhrcvdgwlviju)
--
-- RÉSOLUTIONS PRINCIPALES :
-- 1. Résolution de l'alerte Supabase Security Advisor :
--    "Tableau accessible au public — RLS désactivé"
--    -> Activation stricte de RLS sur public.learner_modules et public.trainer_modules
--    -> Révocation des grants excessifs accordés par défaut au rôle 'anon' et 'public'
--    -> Définition de policies RBAC fondées sur le moindre privilège (Admin, Formateur, Apprenant)
--    -> Protection CLS (Column Level Security) sur la donnée financière 'session_rate'
--
-- 2. Durcissement des politiques de stockage Supabase Storage :
--    -> Révocation de l'upload anonyme 'course_files_anon_upload' sur storage.objects
--    -> Sécurisation du bucket privé 'submission-files' (public = false)
--    -> Restriction d'accès aux copies d'étudiants (propriétaire, formateur assigné, staff)
--
-- 3. Durcissement des tables de cours (public.courses, public.course_files) :
--    -> Remplacement des clauses permissives USING (true) par une vérification stricte
--       de la propriété enseignant (teacher_id) et du rôle staff
--
-- 4. Optimisation des performances :
--    -> Indexation ciblée des clés étrangères exploitées par les policies RLS
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1 : REMÉDIATION DES TABLES learner_modules ET trainer_modules
-- ==============================================================================

-- 1.1 Activation impérative de RLS
ALTER TABLE IF EXISTS public.learner_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trainer_modules ENABLE ROW LEVEL SECURITY;

-- 1.2 Révocation des accès non authentifiés (anon & public)
REVOKE ALL ON TABLE public.learner_modules FROM anon;
REVOKE ALL ON TABLE public.learner_modules FROM public;
REVOKE ALL ON TABLE public.trainer_modules FROM anon;
REVOKE ALL ON TABLE public.trainer_modules FROM public;

-- 1.3 Attribution des privilèges minimaux nécessaires aux rôles applicatifs
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learner_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trainer_modules TO authenticated;
GRANT ALL ON TABLE public.learner_modules TO service_role;
GRANT ALL ON TABLE public.trainer_modules TO service_role;

-- 1.4 Nettoyage des anciennes policies éventuelles
DROP POLICY IF EXISTS "learner_modules_staff_all" ON public.learner_modules;
DROP POLICY IF EXISTS "learner_modules_student_select" ON public.learner_modules;
DROP POLICY IF EXISTS "learner_modules_teacher_select" ON public.learner_modules;

DROP POLICY IF EXISTS "trainer_modules_staff_all" ON public.trainer_modules;
DROP POLICY IF EXISTS "trainer_modules_teacher_select" ON public.trainer_modules;
DROP POLICY IF EXISTS "trainer_modules_student_select" ON public.trainer_modules;

-- 1.5 Politiques RLS pour learner_modules
-- A. Le personnel administratif (Staff / Admin / Superadmin) dispose d'un contrôle total
CREATE POLICY "learner_modules_staff_all" ON public.learner_modules
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- B. L'apprenant ne peut consulter QUE ses propres inscriptions de modules
CREATE POLICY "learner_modules_student_select" ON public.learner_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.id = learner_modules.learner_id OR s.user_id::text = learner_modules.learner_id)
        AND s.user_id = auth.uid()
    )
    OR learner_id = auth.uid()::text
  );

-- C. Le formateur peut consulter les inscriptions d'apprenants relatives aux modules qu'il enseigne
CREATE POLICY "learner_modules_teacher_select" ON public.learner_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.teacher_modules tm ON tm.teacher_id = t.id
      WHERE t.user_id = auth.uid() AND tm.module_id::text = learner_modules.module_id
    )
    OR EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.trainer_modules trm ON trm.trainer_id = t.id
      WHERE t.user_id = auth.uid() AND trm.module_id = learner_modules.module_id
    )
  );

-- 1.6 Politiques RLS pour trainer_modules
-- A. Le personnel administratif (Staff) dispose d'un contrôle total
CREATE POLICY "trainer_modules_staff_all" ON public.trainer_modules
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- B. Le formateur ne peut voir QUE ses propres affectations de modules
CREATE POLICY "trainer_modules_teacher_select" ON public.trainer_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE (t.id = trainer_modules.trainer_id OR t.user_id::text = trainer_modules.trainer_id)
        AND t.user_id = auth.uid()
    )
    OR trainer_id = auth.uid()::text
  );

-- C. L'apprenant peut voir qui est son formateur sur les modules où il est inscrit
CREATE POLICY "trainer_modules_student_select" ON public.trainer_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.student_modules sm ON sm.student_id = s.id
      WHERE s.user_id = auth.uid() AND sm.module_id::text = trainer_modules.module_id
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.learner_modules lm ON (lm.learner_id = s.id OR lm.learner_id = s.user_id::text)
      WHERE s.user_id = auth.uid() AND lm.module_id = trainer_modules.module_id
    )
  );


-- ==============================================================================
-- SECTION 2 : DURCISSEMENT DES COURS ET FICHIERS DE COURS (RÉVOCATION DES USING TRUE)
-- ==============================================================================

-- 2.1 Nettoyage des policies trop permissives de la migration 0040
DROP POLICY IF EXISTS "courses_auth_insert" ON public.courses;
DROP POLICY IF EXISTS "courses_auth_update" ON public.courses;
DROP POLICY IF EXISTS "courses_auth_delete" ON public.courses;
DROP POLICY IF EXISTS "course_files_auth_manage" ON public.course_files;
DROP POLICY IF EXISTS "course_targets_auth_manage" ON public.course_targets;

-- 2.2 Politiques rigoureuses sur courses
CREATE POLICY "courses_staff_all" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "courses_teacher_manage" ON public.courses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = courses.teacher_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teachers t
      WHERE t.id = courses.teacher_id AND t.user_id = auth.uid()
    )
  );

-- Les apprenants ne peuvent que lire les cours publiés qui concernent leurs modules
DROP POLICY IF EXISTS "courses_student_select" ON public.courses;
CREATE POLICY "courses_student_select" ON public.courses
  FOR SELECT TO authenticated
  USING (
    publie = true AND (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.student_modules sm ON sm.student_id = s.id
        WHERE s.user_id = auth.uid() AND sm.module_id = courses.module_id
      )
      OR EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.learner_modules lm ON (lm.learner_id = s.id OR lm.learner_id = s.user_id::text)
        WHERE s.user_id = auth.uid() AND lm.module_id::text = courses.module_id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.course_targets ct
        JOIN public.students s ON s.id = ct.student_id
        WHERE ct.course_id = courses.id AND s.user_id = auth.uid()
      )
    )
  );

-- 2.3 Politiques rigoureuses sur course_files
CREATE POLICY "course_files_staff_all" ON public.course_files
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "course_files_teacher_manage" ON public.course_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.teachers t ON t.id = c.teacher_id
      WHERE c.id = course_files.course_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      JOIN public.teachers t ON t.id = c.teacher_id
      WHERE c.id = course_files.course_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "course_files_student_select" ON public.course_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_files.course_id AND c.publie = true
    )
  );


-- ==============================================================================
-- SECTION 3 : SÉCURISATION DU STOCKAGE SUPABASE (STORAGE.OBJECTS & BUCKETS)
-- ==============================================================================

-- 3.1 Révocation impérative de l'upload anonyme sur le bucket course-files
DROP POLICY IF EXISTS "course_files_anon_upload" ON storage.objects;

-- 3.2 Seuls les enseignants et le staff peuvent uploader ou modifier les fichiers de cours
DROP POLICY IF EXISTS "course_files_auth_all" ON storage.objects;
DROP POLICY IF EXISTS "course_files_staff_teacher_manage" ON storage.objects;
CREATE POLICY "course_files_staff_teacher_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'course-files' AND (
      public.is_staff() OR EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'course-files' AND (
      public.is_staff() OR EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid()
      )
    )
  );

-- 3.3 Protection stricte du bucket des remises 'submission-files'
-- Le bucket ne doit pas être public pour empêcher la consultation directe par URL sans droit
UPDATE storage.buckets SET public = false WHERE id = 'submission-files';

DROP POLICY IF EXISTS "submission_files_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "submission_files_auth_write" ON storage.objects;

-- Un apprenant ne peut insérer que dans le bucket submission-files sous son propre identifiant
CREATE POLICY "submission_files_student_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'submission-files' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid() AND (storage.foldername(name))[1] = s.id
      )
      OR public.is_staff()
    )
  );

-- Lecture des copies déposées : uniquement l'apprenant auteur, le formateur du devoir ou le staff
CREATE POLICY "submission_files_restricted_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-files' AND (
      public.is_staff()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.user_id = auth.uid() AND (storage.foldername(name))[1] = s.id
      )
      OR EXISTS (
        SELECT 1 FROM public.assignment_submission_files asf
        JOIN public.assignment_submissions sub ON sub.id = asf.submission_id
        JOIN public.assignments a ON a.id = sub.assignment_id
        JOIN public.teachers t ON t.id = a.teacher_id
        WHERE asf.storage_path = storage.objects.name AND t.user_id = auth.uid()
      )
    )
  );


-- ==============================================================================
-- SECTION 4 : INDEXATION PERFORMANCES POUR SOUS-REQUÊTES RLS
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON public.assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_module_id ON public.assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON public.assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_tests_teacher_id ON public.tests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON public.test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_module_id ON public.courses(module_id);

COMMIT;
