-- Migration 0012: Auto-confirmation immédiate des emails pour tout nouvel utilisateur auth.users
create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_auto_confirm on auth.users;
create trigger on_auth_user_created_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_new_user();

-- Assure également que tous les utilisateurs existants ont leur email confirmé
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
