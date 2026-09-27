-- ============================================================
-- 0053_academic_years_and_restrictions.sql
-- Gestion des années académiques & Restrictions modulaires / IA
-- ============================================================

-- 1. Table des années académiques (academic_years)
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique, -- Ex: "2024-2025", "2025-2026", "2026-2027"
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'active' check (statut in ('active', 'cloturee', 'archivee')),
  is_default boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academic_years enable row level security;

-- Lecture authentifiée pour tous les membres
create policy "academic_years_read" on public.academic_years
  for select to authenticated
  using (true);

-- Écriture réservée au personnel d'administration (staff)
create policy "academic_years_write" on public.academic_years
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- 2. Table des restrictions de modules et contrôle d'accès IA (module_restrictions)
create table if not exists public.module_restrictions (
  id uuid primary key default gen_random_uuid(),
  module_key text not null, -- 'ia', 'finances', 'messages', 'evaluations', 'cours', 'presences'
  module_label text not null,
  bloque boolean not null default true,
  roles text[] not null default '{}',
  user_ids uuid[] not null default '{}',
  raison text not null default '',
  date_debut timestamptz,
  date_fin timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.module_restrictions enable row level security;

create policy "module_restrictions_read" on public.module_restrictions
  for select to authenticated
  using (true);

create policy "module_restrictions_write" on public.module_restrictions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- 3. Ajout des colonnes academic_year_id aux entités clés
do $$
begin
  if to_regclass('public.students') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='academic_year_id') then
    alter table public.students add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.grades') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='grades' and column_name='academic_year_id') then
    alter table public.grades add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.attendance') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='attendance' and column_name='academic_year_id') then
    alter table public.attendance add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.payments') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='academic_year_id') then
    alter table public.payments add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.invoices') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='academic_year_id') then
    alter table public.invoices add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.tests') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tests' and column_name='academic_year_id') then
    alter table public.tests add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.certificates') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='academic_year_id') then
    alter table public.certificates add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;

  if to_regclass('public.scholarships') is not null and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='scholarships' and column_name='academic_year_id') then
    alter table public.scholarships add column academic_year_id uuid references public.academic_years(id) on delete set null;
  end if;
end $$;

-- 4. Initialisation des années académiques de référence
insert into public.academic_years (label, date_debut, date_fin, statut, is_default, description)
values
  ('2024-2025', '2024-09-01', '2025-07-31', 'cloturee', false, 'Année académique précédente clôturée (archives consultables)'),
  ('2025-2026', '2025-09-01', '2026-07-31', 'active', true, 'Année académique courante en cours d''exécution'),
  ('2026-2027', '2026-09-01', '2027-07-31', 'active', false, 'Prochaine session académique et pré-inscriptions')
on conflict (label) do update
set updated_at = now();
