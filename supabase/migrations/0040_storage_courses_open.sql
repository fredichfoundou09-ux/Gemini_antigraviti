-- =========================================================================
-- 0040_storage_courses_open.sql
-- Ouverture complète du bucket course-files pour upload et lecture directe de tous types de documents pédagogiques
-- RLS permissif pour publication des cours par admin et formateurs
-- =========================================================================

-- 1. Storage bucket course-files : upload & téléchargement sans friction
drop policy if exists "course_files_anon_upload" on storage.objects;
create policy "course_files_anon_upload" on storage.objects
  for insert to anon
  with check (bucket_id = 'course-files');

drop policy if exists "course_files_anon_select" on storage.objects;
create policy "course_files_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'course-files');

drop policy if exists "course_files_auth_all" on storage.objects;
create policy "course_files_auth_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'course-files')
  with check (bucket_id = 'course-files');

-- 2. Permettre l'insertion, mise à jour et suppression de cours et fichiers pour les utilisateurs authentifiés (admin et formateurs)
drop policy if exists "courses_auth_insert" on public.courses;
create policy "courses_auth_insert" on public.courses
  for insert to authenticated
  with check (true);

drop policy if exists "courses_auth_update" on public.courses;
create policy "courses_auth_update" on public.courses
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "courses_auth_delete" on public.courses;
create policy "courses_auth_delete" on public.courses
  for delete to authenticated
  using (true);

drop policy if exists "course_files_auth_manage" on public.course_files;
create policy "course_files_auth_manage" on public.course_files
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "course_targets_auth_manage" on public.course_targets;
create policy "course_targets_auth_manage" on public.course_targets
  for all to authenticated
  using (true)
  with check (true);

-- 3. Recharger le schéma PostgREST
notify pgrst, 'reload schema';
