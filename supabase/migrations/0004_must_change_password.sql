-- Force le changement de mot de passe à la première connexion pour tout compte
-- créé par un administrateur via l'Edge Function create-user.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Marque un compte comme devant changer son mot de passe (appelé par create-user)
create or replace function public.flag_must_change_password(p_user_id uuid, p_value boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = p_value, updated_at = now() where id = p_user_id;
$$;

-- Un utilisateur peut lever son propre flag après avoir changé son mot de passe
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false, updated_at = now() where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;
