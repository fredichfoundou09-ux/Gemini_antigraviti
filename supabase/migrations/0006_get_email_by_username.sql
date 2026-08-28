-- ============================================================
-- Procédure pour résoudre un email par username de façon sécurisée (pour login par identifiant)
-- ============================================================
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(trim(p_username)) and active = true limit 1;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;
