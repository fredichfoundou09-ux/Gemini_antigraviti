-- ==============================================================================
-- MIGRATION 0043: CLOISONNEMENT STRICT ENSEIGNANTS VS ADMIN SUR LES DEVOIRS & ÉVALUATIONS
-- SENTINEL'S PLATFORM
--
-- Règle impérative :
-- 1. Seul le profil Staff (superadmin, admin) a accès à TOUS les devoirs, évaluations, remises et résultats.
-- 2. Les enseignants ne peuvent voir et gérer QUE les devoirs et évaluations qu'ils ont composés/créés eux-mêmes.
-- 3. Les enseignants ne peuvent voir QUE les remises et copies d'étudiants correspondant à LEURS devoirs et évaluations.
-- ==============================================================================

-- 1. ASSIGNMENTS : Isolation stricte par créateur (teacher_id)
drop policy if exists "assignments_staff_teacher" on public.assignments;
create policy "assignments_staff_teacher" on public.assignments
for all to authenticated
using (
  public.is_staff() or exists (
    select 1 from public.teachers t
    where t.id = assignments.teacher_id and t.user_id = auth.uid()
  )
)
with check (
  public.is_staff() or exists (
    select 1 from public.teachers t
    where t.id = assignments.teacher_id and t.user_id = auth.uid()
  )
);

-- 2. ASSIGNMENT_SUBMISSIONS : Les enseignants ne voient QUE les copies de LEURS devoirs
drop policy if exists "assignment_submissions_teacher_manage" on public.assignment_submissions;
create policy "assignment_submissions_teacher_manage" on public.assignment_submissions
for all to authenticated
using (
  exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  )
);

-- 3. TESTS / ÉVALUATIONS : Les enseignants ne voient QUE leurs propres tests
drop policy if exists "tests_staff_teacher_all" on public.tests;
create policy "tests_staff_teacher_all" on public.tests
for all to authenticated
using (
  public.is_staff() or exists (
    select 1 from public.teachers t
    where t.id = tests.teacher_id and t.user_id = auth.uid()
  )
)
with check (
  public.is_staff() or exists (
    select 1 from public.teachers t
    where t.id = tests.teacher_id and t.user_id = auth.uid()
  )
);

-- 4. TEST_RESULTS : Les enseignants ne voient QUE les résultats de LEURS tests
drop policy if exists "test_results_staff_all" on public.test_results;
create policy "test_results_staff_all" on public.test_results
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "test_results_teacher_read" on public.test_results;
create policy "test_results_teacher_read" on public.test_results
for select to authenticated
using (
  exists (
    select 1 from public.tests te
    join public.teachers t on t.id = te.teacher_id
    where te.id = test_results.test_id and t.user_id = auth.uid()
  )
);

drop policy if exists "test_results_student_read" on public.test_results;
create policy "test_results_student_read" on public.test_results
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = test_results.student_id and s.user_id = auth.uid()
  )
);

-- Commentaires explicatifs sur le modèle de sécurité
comment on policy "assignments_staff_teacher" on public.assignments is 'Seul le staff ou l''enseignant créateur du devoir peut y accéder';
comment on policy "assignment_submissions_teacher_manage" on public.assignment_submissions is 'L''enseignant ne peut voir que les remises liées à ses propres devoirs';
