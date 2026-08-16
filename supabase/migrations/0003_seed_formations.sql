-- Formations fixes de SENTINELLES NUMÉRIQUES
insert into public.formations (code, name, description, active)
values
  ('informatique', 'Génie Informatique', 'Programmation, réseaux, hacking éthique et cybersécurité.', true),
  ('industriel', 'Génie Industriel', 'Mécanique, électricité, électronique, automatismes et maintenance.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    active = true,
    updated_at = now();
