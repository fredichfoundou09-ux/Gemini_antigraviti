-- ==============================================================================
-- Migration 0049: Fix RLS Infinite Recursion between learner_modules & trainer_modules
-- ==============================================================================

-- 1. Fonctions de contrôle d'accès SECURITY DEFINER pour briser la récursion mutuelle
-- Ces fonctions s'exécutent avec les privilèges de l'administrateur et ne déclenchent
-- donc pas de politiques RLS en boucle infinie lors des jointures croisées.

create or replace function public.is_teacher_of_module(p_module_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers t
    join public.teacher_modules tm on tm.teacher_id = t.id
    where t.user_id = auth.uid() and tm.module_id::text = p_module_id
  )
  or exists (
    select 1 from public.teachers t
    join public.trainer_modules trm on (trm.trainer_id = t.id or trm.trainer_id = t.user_id::text)
    where t.user_id = auth.uid() and trm.module_id = p_module_id
  );
$$;

create or replace function public.is_student_of_module(p_module_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    join public.student_modules sm on sm.student_id = s.id
    where s.user_id = auth.uid() and sm.module_id::text = p_module_id
  )
  or exists (
    select 1 from public.students s
    join public.learner_modules lm on (lm.learner_id = s.id or lm.learner_id = s.user_id::text)
    where s.user_id = auth.uid() and lm.module_id = p_module_id
  );
$$;

grant execute on function public.is_teacher_of_module(text) to authenticated;
grant execute on function public.is_student_of_module(text) to authenticated;

-- 2. Recréation des politiques sur learner_modules avec SECURITY DEFINER
drop policy if exists "learner_modules_teacher_select" on public.learner_modules;
create policy "learner_modules_teacher_select" on public.learner_modules
  for select to authenticated
  using (public.is_teacher_of_module(module_id));

-- 3. Recréation des politiques sur trainer_modules avec SECURITY DEFINER
drop policy if exists "trainer_modules_student_select" on public.trainer_modules;
create policy "trainer_modules_student_select" on public.trainer_modules
  for select to authenticated
  using (public.is_student_of_module(module_id));

-- 4. Sécurisation et optimisation de la politique courses_student_select
drop policy if exists "courses_student_select" on public.courses;
create policy "courses_student_select" on public.courses
  for select to authenticated
  using (
    publie = true and (
      public.is_student_of_module(module_id::text)
      or exists (
        select 1 from public.course_targets ct
        join public.students s on s.id = ct.student_id
        where ct.course_id = courses.id and s.user_id = (select auth.uid())
      )
    )
  );

-- 5. Politique pour les documents chunks : accès élargi à authenticated pour lecture active
drop policy if exists "ai_document_chunks_select" on public.ai_document_chunks;
create policy "ai_document_chunks_select" on public.ai_document_chunks
  for select to authenticated
  using (active = true);
