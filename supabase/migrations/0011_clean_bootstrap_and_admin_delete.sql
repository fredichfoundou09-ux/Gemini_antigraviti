-- Migration 0011: Sécurisation du bootstrap initial et suppression administrative complète d'utilisateur

-- 1. Fonction sécurisée de promotion du premier Super Admin (atomic avec verrou)
create or replace function public.promote_first_superadmin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verrou applicatif exclusif pour empêcher tout accès concurrent
  perform pg_advisory_xact_lock(733199);

  if public.has_any_superadmin() then
    return false;
  end if;

  update public.profiles
  set role = 'superadmin', active = true, updated_at = now()
  where id = auth.uid();

  insert into public.audit_logs(user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'ROLE_CHANGE', 'profiles', auth.uid()::text, 'Création et verrouillage du premier Administrateur Supérieur');

  return true;
end;
$$;

grant execute on function public.promote_first_superadmin() to authenticated;

-- 2. Fonction administrative de suppression complète d'un compte utilisateur
create or replace function public.admin_delete_user(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'superadmin' then
    raise exception 'Permissions insuffisantes : réservé au Super Admin.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Action interdite : vous ne pouvez pas supprimer votre propre compte Super Admin.';
  end if;

  -- Suppression des relations métier éventuelles
  delete from public.student_modules where student_id in (select id from public.students where user_id = target_user_id);
  delete from public.students where user_id = target_user_id;
  delete from public.teacher_modules where teacher_id in (select id from public.teachers where user_id = target_user_id);
  delete from public.teachers where user_id = target_user_id;
  delete from public.partner_members where user_id = target_user_id;

  -- Suppression du profil public
  delete from public.profiles where id = target_user_id;

  -- Suppression du compte d'authentification Supabase
  delete from auth.users where id = target_user_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'DELETE', 'profiles', target_user_id::text, 'Suppression définitive du compte utilisateur par le Super Admin');

  return true;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 3. Nettoyage complet des comptes de test et mocks pour un démarrage 100% propre (Clean Slate)
delete from public.students;
delete from public.teachers;
delete from public.student_modules;
delete from public.teacher_modules;
delete from public.partner_members;
delete from public.registrations;
delete from public.registration_modules;
delete from public.attendance;
delete from public.schedule;
delete from public.courses;
delete from public.tests;
delete from public.grades;
delete from public.invoices;
delete from public.payments;
delete from public.notifications;
delete from public.messages;
delete from public.certificates;
delete from public.scholarships;
delete from public.audit_logs;
delete from public.profiles;
delete from auth.users;
