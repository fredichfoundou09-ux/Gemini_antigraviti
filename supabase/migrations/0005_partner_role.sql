-- ============================================================
-- SENTINELLES NUMERIQUES - Role Partenaire / Admin partenaire
-- Organisations, perimetres, permissions, vues et RLS dediees
-- ============================================================

-- Etend la contrainte role de profiles si elle existe deja.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin','admin','partner_admin','teacher','student','partner'));

-- RBAC data-driven.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

insert into public.roles (code, name, description) values
  ('superadmin','Super Admin','Acces global'),
  ('admin','Administration','Gestion administrative'),
  ('partner_admin','Administration partenaire','Consultation institutionnelle etendue'),
  ('teacher','Formateur','Gestion pedagogique des modules attribues'),
  ('student','Apprenant','Acces personnel'),
  ('partner','Partenaire','Lecture seule institutionnelle')
on conflict (code) do update set name = excluded.name, description = excluded.description;

insert into public.permissions (code, description) values
  ('dashboard.read','Lire le tableau de bord'),
  ('students.read','Lire les apprenants autorises'),
  ('teachers.read','Lire les enseignants autorises'),
  ('formations.read','Lire les formations'),
  ('modules.read','Lire les modules'),
  ('schedule.read','Lire emploi du temps autorise'),
  ('attendance.read','Lire presences autorisees'),
  ('courses.read','Lire cours autorises'),
  ('materials.read','Lire supports autorises'),
  ('tests.read','Lire tests autorises'),
  ('grades.read','Lire notes autorisees'),
  ('certificates.read','Lire certificats autorises'),
  ('scholarships.read','Lire bourses autorisees'),
  ('reports.read','Lire rapports autorises'),
  ('enya.read','Lire Enya/ENIA')
on conflict (code) do update set description = excluded.description;

-- Donne au partenaire uniquement les permissions de lecture autorisees.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'dashboard.read','formations.read','modules.read','teachers.read','courses.read',
  'materials.read','certificates.read','scholarships.read','reports.read','enya.read'
)
where r.code = 'partner'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code like '%.read'
where r.code = 'partner_admin'
on conflict do nothing;

-- Organisations et perimetres partenaires.
create table if not exists public.partner_organizations (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  poste text,
  contact text,
  access_level text not null default 'viewer' check (access_level in ('viewer','academic','finance','institutional')),
  status text not null default 'active' check (status in ('active','inactive','expired')),
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.partner_access_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.partner_organizations(id) on delete cascade,
  scope text not null check (scope in ('viewer','academic','finance','institutional')),
  formation_id uuid references public.formations(id) on delete cascade,
  group_id uuid references public.student_groups(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.privacy_classifications (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  field_name text not null,
  level text not null check (level in ('public','internal','partner','private','restricted')),
  description text,
  unique (entity_type, field_name)
);

insert into public.privacy_classifications (entity_type, field_name, level, description) values
  ('students','nom','partner','Visible partenaire'),
  ('students','prenom','partner','Visible partenaire'),
  ('students','telephone','private','Coordonnee personnelle'),
  ('students','whatsapp','private','Coordonnee personnelle'),
  ('students','email','private','Coordonnee personnelle'),
  ('students','adresse','private','Adresse personnelle'),
  ('students','formation_id','partner','Parcours visible'),
  ('attendance','statut','partner','Statistiques institutionnelles'),
  ('grades','note','restricted','Visible uniquement selon politique'),
  ('payments','montant','restricted','Donnee financiere'),
  ('certificates','numero','partner','Certificat institutionnel')
on conflict (entity_type, field_name) do update set level = excluded.level, description = excluded.description;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('pedagogique','financier','administratif','institutionnel')),
  visibility text not null default 'internal' check (visibility in ('public','internal','partner','private','restricted')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Vues partenaires : colonnes limitees.
create or replace view public.partner_student_view as
select
  s.id,
  s.nom,
  s.prenom,
  s.formation_id,
  f.name as formation_name,
  s.group_id,
  s.statut,
  s.date_inscription
from public.students s
join public.formations f on f.id = s.formation_id;

create or replace view public.partner_teacher_view as
select
  t.id,
  t.nom,
  t.prenom,
  t.specialite,
  t.actif,
  array_agg(m.titre order by m.numero) filter (where m.id is not null) as modules
from public.teachers t
left join public.teacher_modules tm on tm.teacher_id = t.id
left join public.modules m on m.id = tm.module_id
group by t.id;

create or replace view public.partner_attendance_view as
select
  a.id,
  a.student_id,
  s.nom,
  s.prenom,
  a.module_id,
  m.titre as module_titre,
  a.date,
  a.statut
from public.attendance a
join public.students s on s.id = a.student_id
join public.modules m on m.id = a.module_id;

create or replace view public.partner_certificate_view as
select
  c.id,
  c.student_id,
  s.nom,
  s.prenom,
  c.numero,
  c.formation_id,
  c.periode,
  c.resultat,
  c.date
from public.certificates c
join public.students s on s.id = c.student_id;

create or replace view public.partner_report_view as
select id, title, category, payload, created_at
from public.reports
where visibility in ('public','partner');

-- Role helpers.
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = role_name and p.active = true);
$$;

create or replace function public.is_partner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role('partner'); $$;

create or replace function public.is_partner_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role('partner_admin'); $$;

create or replace function public.can_partner_read(scope_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_partner_admin()
    or exists (
      select 1
      from public.partner_members pm
      where pm.user_id = auth.uid()
        and pm.status = 'active'
        and (pm.end_date is null or pm.end_date >= current_date)
        and (
          pm.access_level = scope_name
          or pm.access_level = 'institutional'
          or (scope_name = 'viewer' and pm.access_level in ('viewer','academic','finance','institutional'))
          or (scope_name = 'academic' and pm.access_level in ('academic','institutional'))
          or (scope_name = 'finance' and pm.access_level in ('finance','institutional'))
        )
    );
$$;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.partner_organizations enable row level security;
alter table public.partner_members enable row level security;
alter table public.partner_access_scopes enable row level security;
alter table public.privacy_classifications enable row level security;
alter table public.reports enable row level security;

-- Staff manages RBAC/partners, partners read own org/membership.
drop policy if exists "rbac_staff_read" on public.roles;
create policy "rbac_staff_read" on public.roles for select to authenticated using (public.is_staff() or public.is_partner() or public.is_partner_admin());
drop policy if exists "permissions_staff_read" on public.permissions;
create policy "permissions_staff_read" on public.permissions for select to authenticated using (public.is_staff() or public.is_partner() or public.is_partner_admin());
drop policy if exists "role_permissions_staff_read" on public.role_permissions;
create policy "role_permissions_staff_read" on public.role_permissions for select to authenticated using (public.is_staff() or public.is_partner() or public.is_partner_admin());
drop policy if exists "user_permissions_staff_all" on public.user_permissions;
create policy "user_permissions_staff_all" on public.user_permissions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "partner_org_staff_all" on public.partner_organizations;
create policy "partner_org_staff_all" on public.partner_organizations for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "partner_org_member_read" on public.partner_organizations;
create policy "partner_org_member_read" on public.partner_organizations for select to authenticated using (
  exists(select 1 from public.partner_members pm where pm.organization_id = partner_organizations.id and pm.user_id = auth.uid() and pm.status = 'active')
);
drop policy if exists "partner_members_staff_all" on public.partner_members;
create policy "partner_members_staff_all" on public.partner_members for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "partner_members_own_read" on public.partner_members;
create policy "partner_members_own_read" on public.partner_members for select to authenticated using (user_id = auth.uid() or public.is_partner_admin());
drop policy if exists "partner_scopes_staff_all" on public.partner_access_scopes;
create policy "partner_scopes_staff_all" on public.partner_access_scopes for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "partner_scopes_member_read" on public.partner_access_scopes;
create policy "partner_scopes_member_read" on public.partner_access_scopes for select to authenticated using (
  exists(select 1 from public.partner_members pm where pm.organization_id = partner_access_scopes.organization_id and pm.user_id = auth.uid() and pm.status = 'active')
  or public.is_partner_admin()
);
drop policy if exists "privacy_staff_read" on public.privacy_classifications;
create policy "privacy_staff_read" on public.privacy_classifications for select to authenticated using (public.is_staff() or public.is_partner() or public.is_partner_admin());
drop policy if exists "privacy_staff_write" on public.privacy_classifications;
create policy "privacy_staff_write" on public.privacy_classifications for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "reports_staff_all" on public.reports;
create policy "reports_staff_all" on public.reports for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "reports_partner_read" on public.reports;
create policy "reports_partner_read" on public.reports for select to authenticated using (
  visibility in ('public','partner') and (public.is_partner() or public.is_partner_admin())
);

-- Policies explicites de lecture partenaire.
drop policy if exists "partner_students_read" on public.students;
create policy "partner_students_read" on public.students for select to authenticated using (
  (public.is_partner() and public.can_partner_read('academic')) or public.is_partner_admin()
);
drop policy if exists "partner_teachers_read" on public.teachers;
create policy "partner_teachers_read" on public.teachers for select to authenticated using (public.is_partner() or public.is_partner_admin());
drop policy if exists "partner_schedule_read" on public.schedule;
create policy "partner_schedule_read" on public.schedule for select to authenticated using (public.is_partner() or public.is_partner_admin());
drop policy if exists "partner_attendance_read" on public.attendance;
create policy "partner_attendance_read" on public.attendance for select to authenticated using (
  (public.is_partner() and public.can_partner_read('academic')) or public.is_partner_admin()
);
drop policy if exists "partner_courses_read" on public.courses;
create policy "partner_courses_read" on public.courses for select to authenticated using (
  publie = true and (public.is_partner() or public.is_partner_admin())
);
drop policy if exists "partner_course_files_read" on public.course_files;
create policy "partner_course_files_read" on public.course_files for select to authenticated using (
  public.is_partner() or public.is_partner_admin()
);
drop policy if exists "partner_tests_read" on public.tests;
create policy "partner_tests_read" on public.tests for select to authenticated using (public.is_partner() or public.is_partner_admin());
drop policy if exists "partner_grades_read" on public.grades;
create policy "partner_grades_read" on public.grades for select to authenticated using (
  (public.is_partner() and public.can_partner_read('institutional')) or public.is_partner_admin()
);
drop policy if exists "partner_certificates_read" on public.certificates;
create policy "partner_certificates_read" on public.certificates for select to authenticated using (public.is_partner() or public.is_partner_admin());
drop policy if exists "partner_scholarships_read" on public.scholarships;
create policy "partner_scholarships_read" on public.scholarships for select to authenticated using (public.is_partner() or public.is_partner_admin());

grant select on public.partner_student_view to authenticated;
grant select on public.partner_teacher_view to authenticated;
grant select on public.partner_attendance_view to authenticated;
grant select on public.partner_certificate_view to authenticated;
grant select on public.partner_report_view to authenticated;
