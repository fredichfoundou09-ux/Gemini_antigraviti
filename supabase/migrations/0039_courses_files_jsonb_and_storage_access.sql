-- =========================================================================
-- 0039_courses_files_jsonb_and_storage_access.sql
-- 1. Ajout de la colonne 'files' JSONB sur public.courses pour préservation directe
-- 2. Assouplissement des contraintes NOT NULL sur courses (module_id, teacher_id)
-- 3. Configuration et ouverture publique du bucket storage 'course-files'
-- 4. Politiques RLS complètes pour lecture/téléchargement des cours et fichiers
-- =========================================================================

-- 1. Colonne JSONB sur courses pour conserver l'arborescence complète des fichiers originaux
alter table public.courses
  add column if not exists files jsonb not null default '[]'::jsonb;

-- 2. Assouplir module_id et teacher_id pour éviter tout échec de publication
alter table public.courses alter column module_id drop not null;
alter table public.courses alter column teacher_id drop not null;

-- 3. Bucket de stockage storage.objects pour les supports originaux (PDF, Word, Excel, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-files',
  'course-files',
  true,
  52428800, -- 50 Mo
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- 4. Politiques de lecture et écriture Storage pour 'course-files'
drop policy if exists "course_files_public_select" on storage.objects;
create policy "course_files_public_select" on storage.objects
  for select
  using (bucket_id = 'course-files');

drop policy if exists "course_files_upload_auth" on storage.objects;
create policy "course_files_upload_auth" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-files');

drop policy if exists "course_files_update_auth" on storage.objects;
create policy "course_files_update_auth" on storage.objects
  for update to authenticated
  using (bucket_id = 'course-files');

drop policy if exists "course_files_delete_auth" on storage.objects;
create policy "course_files_delete_auth" on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-files');

-- 5. Politiques RLS pour courses et course_files
drop policy if exists "courses_student_select" on public.courses;
create policy "courses_student_select" on public.courses
  for select to authenticated
  using (publie = true);

drop policy if exists "courses_anon_select" on public.courses;
create policy "courses_anon_select" on public.courses
  for select to anon
  using (publie = true);

drop policy if exists "course_files_student_select" on public.course_files;
create policy "course_files_student_select" on public.course_files
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_files.course_id and c.publie = true
    )
    or public.is_staff()
  );

drop policy if exists "course_files_anon_select" on public.course_files;
create policy "course_files_anon_select" on public.course_files
  for select to anon
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_files.course_id and c.publie = true
    )
  );

-- 6. Rechargement du cache de schéma
notify pgrst, 'reload schema';
