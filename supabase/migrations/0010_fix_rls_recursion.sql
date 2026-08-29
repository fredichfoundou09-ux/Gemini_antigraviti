-- Migration 0010: Fix RLS recursion between students and student_modules

-- 1. Helper functions with SECURITY DEFINER to break recursion
create or replace function public.is_teacher_of_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teachers t
    join public.teacher_modules tm on tm.teacher_id = t.id
    join public.student_modules sm on sm.module_id = tm.module_id
    where t.user_id = auth.uid() and sm.student_id = p_student_id
  );
$$;

create or replace function public.is_student_owner(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_teacher_of_student(text) to authenticated;
grant execute on function public.is_student_owner(text) to authenticated;

-- 2. Drop and recreate the mutually recursive policies
drop policy if exists "students_teacher_select" on public.students;
create policy "students_teacher_select" on public.students
for select to authenticated
using (public.is_teacher_of_student(id));

drop policy if exists "student_modules_self_select" on public.student_modules;
create policy "student_modules_self_select" on public.student_modules
for select to authenticated
using (public.is_student_owner(student_id));

-- 3. Also update student policies on child tables to use is_student_owner
drop policy if exists "invoices_student_select" on public.invoices;
create policy "invoices_student_select" on public.invoices
for select to authenticated
using (public.is_student_owner(student_id));

drop policy if exists "payments_student_select" on public.payments;
create policy "payments_student_select" on public.payments
for select to authenticated
using (public.is_student_owner(student_id));

drop policy if exists "attendance_student_select" on public.attendance;
create policy "attendance_student_select" on public.attendance
for select to authenticated
using (public.is_student_owner(student_id));

drop policy if exists "grades_student_select" on public.grades;
create policy "grades_student_select" on public.grades
for select to authenticated
using (public.is_student_owner(student_id));

drop policy if exists "submissions_student_own" on public.submissions;
create policy "submissions_student_own" on public.submissions
for all to authenticated
using (public.is_student_owner(student_id))
with check (public.is_student_owner(student_id));
