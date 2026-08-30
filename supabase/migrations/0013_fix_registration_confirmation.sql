-- Migration 0013: Sécurisation du trigger utilisateur et réinitialisation de la pré-inscription

-- 1. Harmonisation du trigger pour éviter toute race condition lors de la création d'utilisateur
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  candidate_username text;
  final_username text;
  counter int := 1;
begin
  candidate_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))));
  final_username := candidate_username;

  -- Vérification d'unicité en cas de collision concurrente
  while exists (select 1 from public.profiles where username = final_username and id <> new.id) loop
    final_username := candidate_username || counter;
    counter := counter + 1;
  end loop;

  insert into public.profiles (id, username, name, email, role, active)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    true
  )
  on conflict (id) do update set
    username = excluded.username,
    name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    active = true,
    updated_at = now();

  return new;
end;
$$;

-- 2. Remettre la pré-inscription de test de FOUNDOU Lorich à 'en_attente' pour validation
update public.registrations
set statut = 'en_attente', updated_at = now()
where nom = 'FOUNDOU' and prenom = 'Lorich';
