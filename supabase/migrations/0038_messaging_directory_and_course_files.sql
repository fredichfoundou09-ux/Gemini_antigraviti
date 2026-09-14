-- =========================================================================
-- 0038_messaging_directory_and_course_files.sql
-- 1. Annuaire de messagerie pour tous les utilisateurs (RPC get_messaging_recipients)
-- 2. Compatibilité bidirectionnelle des colonnes de la table course_files
-- =========================================================================

-- 1. RPC : Annuaire des destinataires accessibles pour la messagerie
create or replace function public.get_messaging_recipients()
returns table (
  id uuid,
  name text,
  username text,
  email text,
  role text,
  active boolean
)
language sql
security definer
set search_path = public, auth, extensions
as $$
  select
    p.id,
    p.name,
    p.username,
    p.email,
    p.role,
    p.active
  from public.profiles p
  where p.active = true
    and p.id <> auth.uid()
  order by
    case
      when p.role in ('superadmin', 'admin', 'partner_admin') then 1
      when p.role = 'teacher' then 2
      when p.role = 'student' then 3
      else 4
    end,
    p.name asc;
$$;

grant execute on function public.get_messaging_recipients() to authenticated;
grant execute on function public.get_messaging_recipients() to anon;

-- 2. Compatibilité des colonnes pour public.course_files
alter table public.course_files
  add column if not exists nom text,
  add column if not exists taille int,
  add column if not exists type text,
  add column if not exists url text;

alter table public.course_files alter column original_name drop not null;
alter table public.course_files alter column stored_name drop not null;
alter table public.course_files alter column mime drop not null;
alter table public.course_files alter column size drop not null;
alter table public.course_files alter column storage_key drop not null;

create or replace function public.sync_course_files_columns()
returns trigger
language plpgsql
as $$
begin
  new.original_name := coalesce(new.original_name, new.nom, new.stored_name, 'document');
  new.nom := coalesce(new.nom, new.original_name, 'document');
  new.stored_name := coalesce(new.stored_name, new.original_name, new.nom, 'document');
  new.mime := coalesce(new.mime, new.type, 'application/octet-stream');
  new.type := coalesce(new.type, new.mime, 'application/octet-stream');
  new.size := coalesce(new.size, new.taille, 0);
  new.taille := coalesce(new.taille, new.size, 0);
  new.storage_key := coalesce(new.storage_key, new.url, '');
  new.url := coalesce(new.url, new.storage_key, '');
  return new;
end;
$$;

drop trigger if exists trg_sync_course_files on public.course_files;
create trigger trg_sync_course_files
  before insert or update on public.course_files
  for each row
  execute function public.sync_course_files_columns();
