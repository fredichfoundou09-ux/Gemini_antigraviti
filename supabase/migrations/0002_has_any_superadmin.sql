-- Vérifie s'il existe déjà un superadmin actif (utilisé par l'écran de bootstrap)
create or replace function public.has_any_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where role = 'superadmin'
      and active = true
  );
$$;

grant execute on function public.has_any_superadmin() to anon, authenticated;
