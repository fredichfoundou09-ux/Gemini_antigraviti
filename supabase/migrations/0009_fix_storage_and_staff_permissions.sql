-- ============================================================
-- 0009_fix_storage_and_staff_permissions.sql
-- Permissions complètes de stockage pour le staff (Admin Sup & Gestionnaires)
-- ============================================================

-- Politiques pour le bucket avatars (permet au staff d'uploader pour tout le monde)
drop policy if exists "avatars_auth_upload" on storage.objects;
drop policy if exists "avatars_auth_update" on storage.objects;
drop policy if exists "avatars_staff_all" on storage.objects;

create policy "avatars_staff_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars' 
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars' 
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- Politiques pour course-files (staff et formateurs)
drop policy if exists "course_files_staff_teacher_write" on storage.objects;
create policy "course_files_staff_teacher_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'course-files' 
    and (public.is_staff() or public.current_role() = 'teacher')
  )
  with check (
    bucket_id = 'course-files' 
    and (public.is_staff() or public.current_role() = 'teacher')
  );

-- Politiques pour public-media et enia-media (staff)
drop policy if exists "public_media_staff_write" on storage.objects;
create policy "public_media_staff_write" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('public-media', 'enia-media') 
    and public.is_staff()
  )
  with check (
    bucket_id in ('public-media', 'enia-media') 
    and public.is_staff()
  );

-- Politiques pour certificates (staff)
drop policy if exists "certificates_staff_write" on storage.objects;
create policy "certificates_staff_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certificates' 
    and public.is_staff()
  )
  with check (
    bucket_id = 'certificates' 
    and public.is_staff()
  );
