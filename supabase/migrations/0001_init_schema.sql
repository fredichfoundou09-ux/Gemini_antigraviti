-- ============================================================
-- SENTINELLES NUMÉRIQUES — Migration initiale Supabase
-- PostgreSQL + Auth + RLS + Storage
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anonymous');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('superadmin', 'admin');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'superadmin';
$$;

-- ============================================================
-- A. PROFILES / AUTH LINK
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  email text,
  phone text,
  role text not null check (role in ('superadmin','admin','teacher','student','partner','partner_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create index if not exists idx_profiles_role on public.profiles(role);

-- Auto-create profile on auth.users insert (role default student; bootstrap can promote)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- B. FORMATIONS / MODULES / CHAPTERS
-- ============================================================
create table if not exists public.formations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  numero int not null,
  titre text not null,
  icon text,
  description text,
  duree text,
  supports text,
  infos_supp text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (formation_id, numero)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  titre text not null,
  contenu text,
  ordre int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_modules_formation on public.modules(formation_id);
create index if not exists idx_chapters_module on public.chapters(module_id);

-- ============================================================
-- C. GROUPS / STUDENTS / REGISTRATIONS
-- ============================================================
create table if not exists public.student_groups (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  nom text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id text primary key, -- SN-YYYY-XXXXX
  user_id uuid unique references public.profiles(id) on delete set null,
  formation_id uuid not null references public.formations(id) on delete restrict,
  group_id uuid references public.student_groups(id) on delete set null,
  nom text not null,
  prenom text not null,
  date_naissance date,
  sexe text check (sexe in ('M','F') or sexe is null),
  telephone text,
  whatsapp text,
  email text,
  adresse text,
  niveau text,
  photo_url text,
  date_inscription date not null default current_date,
  statut text not null default 'actif' check (statut in ('actif','inactif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_modules (
  student_id text not null references public.students(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  date_inscription date not null default current_date,
  active boolean not null default true,
  primary key (student_id, module_id)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations(id) on delete cascade,
  nom text not null,
  prenom text not null,
  telephone text not null,
  whatsapp text not null,
  email text,
  niveau text,
  date date not null default current_date,
  statut text not null default 'en_attente' check (statut in ('en_attente','confirmee','refusee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_modules (
  registration_id uuid not null references public.registrations(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  primary key (registration_id, module_id)
);

create index if not exists idx_students_user on public.students(user_id);
create index if not exists idx_students_formation on public.students(formation_id);
create index if not exists idx_student_modules_student on public.student_modules(student_id);
create index if not exists idx_student_modules_module on public.student_modules(module_id);

-- ============================================================
-- D. TEACHERS
-- ============================================================
create table if not exists public.teachers (
  id text primary key, -- ENS-XXX
  user_id uuid unique references public.profiles(id) on delete set null,
  nom text not null,
  prenom text not null,
  specialite text not null,
  email text not null,
  phone text not null,
  photo_url text,
  infos_pro text,
  diplomes text,
  type_contrat text,
  tarif_horaire numeric(12,2) not null default 0,
  heures_prevues numeric(8,2) not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_modules (
  teacher_id text not null references public.teachers(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  primary key (teacher_id, module_id)
);

create table if not exists public.teacher_module_rates (
  teacher_id text not null references public.teachers(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  tarif_horaire numeric(12,2) not null,
  primary key (teacher_id, module_id)
);

create index if not exists idx_teacher_modules_teacher on public.teacher_modules(teacher_id);
create index if not exists idx_teacher_modules_module on public.teacher_modules(module_id);

-- ============================================================
-- E. PEDAGOGY
-- ============================================================
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  module_id uuid not null references public.modules(id) on delete cascade,
  teacher_id text not null references public.teachers(id) on delete cascade,
  type text not null check (type in ('cours','document','devoir')),
  content text,
  group_id uuid references public.student_groups(id) on delete set null,
  audience text not null default 'module' check (audience in ('module','groupe','apprenants')),
  publie boolean not null default true,
  date_publication timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  original_name text not null,
  stored_name text not null,
  mime text not null,
  size int not null,
  storage_key text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.course_targets (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  primary key (course_id, student_id)
);

create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  jour text not null,
  heure_debut text not null,
  heure_fin text not null,
  date date,
  module_id uuid not null references public.modules(id) on delete cascade,
  teacher_id text not null references public.teachers(id) on delete cascade,
  salle text not null default '',
  formation_id uuid not null references public.formations(id) on delete cascade,
  group_id uuid references public.student_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_targets (
  schedule_id uuid not null references public.schedule(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  primary key (schedule_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  schedule_id uuid references public.schedule(id) on delete set null,
  module_id uuid not null references public.modules(id) on delete cascade,
  teacher_id text not null references public.teachers(id) on delete cascade,
  date date not null,
  heure text not null,
  salle text not null default '',
  statut text not null check (statut in ('present','absent','retard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, schedule_id, date)
);

create table if not exists public.file_activities (
  id uuid primary key default gen_random_uuid(),
  course_file_id uuid not null references public.course_files(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('ouvert','telecharge')),
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  teacher_id text not null references public.teachers(id) on delete cascade,
  texte text,
  date timestamptz not null default now(),
  note numeric(5,2),
  appreciation text,
  valide boolean not null default false,
  date_correction timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  mime text not null,
  size int not null
);

create index if not exists idx_courses_module on public.courses(module_id);
create index if not exists idx_courses_teacher on public.courses(teacher_id);
create index if not exists idx_schedule_date on public.schedule(date);
create index if not exists idx_schedule_teacher on public.schedule(teacher_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_submissions_student on public.submissions(student_id);
create index if not exists idx_submissions_course on public.submissions(course_id);

-- ============================================================
-- F. TESTS / GRADES
-- ============================================================
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  module_id uuid not null references public.modules(id) on delete cascade,
  chapitre_id uuid references public.chapters(id) on delete set null,
  teacher_id text not null references public.teachers(id) on delete cascade,
  date timestamptz not null default now(),
  duree int not null default 45,
  bareme numeric(5,2) not null default 20,
  date_debut timestamptz,
  date_fin timestamptz,
  difficulte text not null default 'moyen',
  tentatives int not null default 1,
  afficher_corrections boolean not null default true,
  validation_requise boolean not null default false
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question text not null,
  type text not null check (type in ('qcm','vf','courte')),
  bonne_reponse text not null,
  points numeric(5,2) not null default 1,
  explication text,
  ordre int not null default 1
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  ordre int not null default 1
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  note numeric(5,2) not null,
  pourcentage numeric(5,2) not null,
  date timestamptz not null default now(),
  heure text,
  valide boolean not null default true,
  statut text not null check (statut in ('reussi','echoue'))
);

create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.test_results(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  reponse text not null,
  correct boolean not null default false,
  points_obtenus numeric(5,2) not null default 0
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  note numeric(5,2) not null,
  appreciation text not null default '',
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_tests_module on public.tests(module_id);
create index if not exists idx_test_results_student on public.test_results(student_id);
create index if not exists idx_grades_student on public.grades(student_id);

-- ============================================================
-- G. FINANCE
-- ============================================================
create table if not exists public.fee_settings (
  id text primary key default 'default',
  inscription_amount numeric(12,2) not null default 5000,
  default_formation_amount numeric(12,2) not null default 15000,
  updated_at timestamptz not null default now()
);

insert into public.fee_settings (id) values ('default') on conflict do nothing;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  type text not null check (type in ('inscription','formation')),
  libelle text not null,
  montant numeric(12,2) not null check (montant >= 0),
  date date not null default current_date,
  due_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  type text not null check (type in ('inscription','formation')),
  libelle text not null,
  montant numeric(12,2) not null check (montant > 0),
  date date not null default current_date,
  heure text,
  mode text not null,
  reference text unique,
  observation text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_hours (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.schedule(id) on delete set null,
  teacher_id text not null references public.teachers(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  date date not null,
  heure_debut text not null,
  heure_fin text not null,
  heures numeric(6,2) not null,
  tarif_applique numeric(12,2) not null,
  montant numeric(12,2) not null,
  valide boolean not null default false,
  valide_par uuid references public.profiles(id) on delete set null,
  date_validation timestamptz
);

create table if not exists public.teacher_payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null references public.teachers(id) on delete cascade,
  montant numeric(12,2) not null check (montant > 0),
  date date not null default current_date,
  heure text,
  mode text not null,
  reference text,
  observation text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_student on public.invoices(student_id);
create index if not exists idx_payments_student on public.payments(student_id);

-- ============================================================
-- H. COMMUNICATION
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  subject text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_created on public.messages(created_at);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- ============================================================
-- I. CERTIFICATES / SCHOLARSHIPS
-- ============================================================
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  numero text unique not null,
  formation_id uuid not null references public.formations(id) on delete restrict,
  periode text not null,
  resultat text not null,
  note numeric(5,2) not null default 0,
  date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificate_modules (
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  primary key (certificate_id, module_id)
);

create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  student_id text unique not null references public.students(id) on delete cascade,
  statut text not null check (statut in ('en_attente','test_programme','test_effectue','admis','non_admis','bourse_attribuee')),
  date date not null default current_date,
  date_attribution date,
  date_debut date,
  date_fin date,
  conditions text,
  description text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- J. ENIA 2.0
-- ============================================================
create table if not exists public.enia_content (
  id text primary key default 'singleton',
  visible boolean not null default true,
  titre text not null default 'ENIA 2.0',
  sous_titre text not null default 'École du Numérique et de l''Intelligence Artificielle',
  presentation text not null default '',
  bourse_titre text not null default 'Bourse ENIA 2.0',
  bourse_intro text not null default '',
  bourse_concretement text not null default '',
  bourse_highlights text[] not null default '{}',
  note_inscription text not null default 'Les frais d''inscription ne sont pas remboursables.',
  affiche_url text,
  allow_download_affiche boolean not null default true,
  lien_nom text not null default 'Site officiel ENIA 2.0',
  lien_url text not null default 'https://enia.cg',
  lien_description text not null default '',
  lien_actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enia_advantages (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text not null default '',
  ordre int not null default 1
);

create table if not exists public.enia_fee_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  ordre int not null default 1
);

create table if not exists public.enia_piece_groups (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  pieces text not null default '',
  frais_depot text,
  ordre int not null default 1
);

create table if not exists public.enia_partners (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text,
  logo_url text,
  url text,
  telephone text,
  email text,
  actif boolean not null default true,
  ordre int not null default 1
);

insert into public.enia_content (id) values ('singleton') on conflict do nothing;

-- ============================================================
-- K. SITE CONTENT / AUDIT
-- ============================================================
create table if not exists public.site_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values ('default') on conflict do nothing;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_user on public.audit_logs(user_id);
create index if not exists idx_audit_created on public.audit_logs(created_at);

-- ============================================================
-- L. BUSINESS FUNCTIONS
-- ============================================================
create or replace function public.generate_student_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  cnt int;
begin
  select count(*) + 1 into cnt from public.students where id like 'SN-' || y || '-%';
  return 'SN-' || y || '-' || lpad(cnt::text, 5, '0');
end;
$$;

create or replace function public.student_financial_summary(p_student_id text)
returns table(total_du numeric, total_paye numeric, solde numeric, statut text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_du numeric := 0;
  v_paye numeric := 0;
  v_solde numeric := 0;
  v_statut text := 'impaye';
begin
  select coalesce(sum(montant),0) into v_du from public.invoices where student_id = p_student_id;
  select coalesce(sum(montant),0) into v_paye from public.payments where student_id = p_student_id;
  v_solde := greatest(0, v_du - v_paye);
  if v_du = 0 and v_paye = 0 then v_statut := 'impaye';
  elsif v_paye <= 0 then v_statut := 'impaye';
  elsif v_paye >= v_du then v_statut := 'paye';
  else v_statut := 'partiel';
  end if;
  if v_statut <> 'paye' and exists (
    select 1 from public.invoices i where i.student_id = p_student_id and i.due_date is not null and i.due_date < current_date
  ) then
    v_statut := 'retard';
  end if;
  return query select v_du, v_paye, v_solde, v_statut;
end;
$$;

create or replace function public.has_any_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where role = 'superadmin' and active = true);
$$;

grant execute on function public.has_any_superadmin() to anon, authenticated;

create or replace function public.promote_first_superadmin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.has_any_superadmin() then
    return false;
  end if;
  update public.profiles
  set role = 'superadmin', active = true, updated_at = now()
  where id = auth.uid();
  insert into public.audit_logs(user_id, action, entity_type, entity_id, description)
  values (auth.uid(), 'ROLE_CHANGE', 'profiles', auth.uid()::text, 'Bootstrap du premier Administrateur Supérieur');
  return true;
end;
$$;

grant execute on function public.promote_first_superadmin() to authenticated;

-- ============================================================
-- M. RLS ENABLE
-- ============================================================
alter table public.profiles enable row level security;
alter table public.formations enable row level security;
alter table public.modules enable row level security;
alter table public.chapters enable row level security;
alter table public.student_groups enable row level security;
alter table public.students enable row level security;
alter table public.student_modules enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_modules enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_modules enable row level security;
alter table public.teacher_module_rates enable row level security;
alter table public.courses enable row level security;
alter table public.course_files enable row level security;
alter table public.course_targets enable row level security;
alter table public.schedule enable row level security;
alter table public.schedule_targets enable row level security;
alter table public.attendance enable row level security;
alter table public.file_activities enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.test_results enable row level security;
alter table public.test_answers enable row level security;
alter table public.grades enable row level security;
alter table public.fee_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.teacher_hours enable row level security;
alter table public.teacher_payments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_modules enable row level security;
alter table public.scholarships enable row level security;
alter table public.enia_content enable row level security;
alter table public.enia_advantages enable row level security;
alter table public.enia_fee_items enable row level security;
alter table public.enia_piece_groups enable row level security;
alter table public.enia_partners enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- N. RLS POLICIES (essentielles)
-- ============================================================

-- Profiles
create policy "profiles_select_own_or_staff" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_staff());

create policy "profiles_update_own_or_staff" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_staff())
with check (id = auth.uid() or public.is_staff());

create policy "profiles_insert_staff" on public.profiles
for insert to authenticated
with check (public.is_staff() or id = auth.uid());

-- Formations / modules / chapters : lecture large, écriture staff
create policy "formations_read_all_auth" on public.formations for select to authenticated using (true);
create policy "formations_write_staff" on public.formations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "modules_read_all_auth" on public.modules for select to authenticated using (true);
create policy "modules_write_staff" on public.modules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "chapters_read_all_auth" on public.chapters for select to authenticated using (true);
create policy "chapters_write_staff" on public.chapters for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Students
create policy "students_staff_all" on public.students for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "students_self_select" on public.students for select to authenticated using (user_id = auth.uid());
create policy "students_teacher_select" on public.students for select to authenticated using (
  exists (
    select 1
    from public.teachers t
    join public.teacher_modules tm on tm.teacher_id = t.id
    join public.student_modules sm on sm.module_id = tm.module_id and sm.student_id = students.id
    where t.user_id = auth.uid()
  )
);

create policy "student_modules_staff_all" on public.student_modules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "student_modules_self_select" on public.student_modules for select to authenticated using (
  exists (select 1 from public.students s where s.id = student_modules.student_id and s.user_id = auth.uid())
);

-- Teachers
create policy "teachers_staff_all" on public.teachers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "teachers_self_select" on public.teachers for select to authenticated using (user_id = auth.uid());
create policy "teachers_read_authenticated" on public.teachers for select to authenticated using (true);

create policy "teacher_modules_staff_all" on public.teacher_modules for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "teacher_modules_self_select" on public.teacher_modules for select to authenticated using (
  exists (select 1 from public.teachers t where t.id = teacher_modules.teacher_id and t.user_id = auth.uid())
);

-- Registrations (public insert via anon + staff manage)
create policy "registrations_public_insert" on public.registrations for insert to anon, authenticated with check (true);
create policy "registrations_staff_all" on public.registrations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "registration_modules_public_insert" on public.registration_modules for insert to anon, authenticated with check (true);
create policy "registration_modules_staff_all" on public.registration_modules for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Courses
create policy "courses_staff_all" on public.courses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "courses_teacher_manage" on public.courses for all to authenticated
using (exists (select 1 from public.teachers t where t.id = courses.teacher_id and t.user_id = auth.uid()))
with check (exists (select 1 from public.teachers t where t.id = courses.teacher_id and t.user_id = auth.uid()));
create policy "courses_student_select" on public.courses for select to authenticated using (
  publie = true and (
    exists (
      select 1 from public.students s
      join public.student_modules sm on sm.student_id = s.id
      where s.user_id = auth.uid() and sm.module_id = courses.module_id
    )
    or exists (
      select 1 from public.course_targets ct
      join public.students s on s.id = ct.student_id
      where ct.course_id = courses.id and s.user_id = auth.uid()
    )
  )
);

create policy "course_files_staff_teacher" on public.course_files for all to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.courses c
    join public.teachers t on t.id = c.teacher_id
    where c.id = course_files.course_id and t.user_id = auth.uid()
  )
)
with check (
  public.is_staff()
  or exists (
    select 1 from public.courses c
    join public.teachers t on t.id = c.teacher_id
    where c.id = course_files.course_id and t.user_id = auth.uid()
  )
);
create policy "course_files_student_select" on public.course_files for select to authenticated using (
  exists (
    select 1 from public.courses c
    where c.id = course_files.course_id and c.publie = true
  )
);

-- Schedule / attendance
create policy "schedule_staff_all" on public.schedule for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "schedule_read_auth" on public.schedule for select to authenticated using (true);
create policy "attendance_staff_all" on public.attendance for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "attendance_teacher_manage" on public.attendance for all to authenticated
using (exists (select 1 from public.teachers t where t.id = attendance.teacher_id and t.user_id = auth.uid()))
with check (exists (select 1 from public.teachers t where t.id = attendance.teacher_id and t.user_id = auth.uid()));
create policy "attendance_student_select" on public.attendance for select to authenticated using (
  exists (select 1 from public.students s where s.id = attendance.student_id and s.user_id = auth.uid())
);

-- Submissions
create policy "submissions_staff_all" on public.submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "submissions_teacher_manage" on public.submissions for all to authenticated
using (exists (select 1 from public.teachers t where t.id = submissions.teacher_id and t.user_id = auth.uid()))
with check (exists (select 1 from public.teachers t where t.id = submissions.teacher_id and t.user_id = auth.uid()));
create policy "submissions_student_own" on public.submissions for all to authenticated
using (exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()))
with check (exists (select 1 from public.students s where s.id = submissions.student_id and s.user_id = auth.uid()));

-- Tests / grades
create policy "tests_staff_teacher_all" on public.tests for all to authenticated
using (public.is_staff() or exists (select 1 from public.teachers t where t.id = tests.teacher_id and t.user_id = auth.uid()))
with check (public.is_staff() or exists (select 1 from public.teachers t where t.id = tests.teacher_id and t.user_id = auth.uid()));
create policy "tests_student_select" on public.tests for select to authenticated using (true);
create policy "questions_read_auth" on public.questions for select to authenticated using (true);
create policy "questions_write_staff_teacher" on public.questions for all to authenticated
using (public.is_staff() or exists (
  select 1 from public.tests te join public.teachers t on t.id = te.teacher_id
  where te.id = questions.test_id and t.user_id = auth.uid()
))
with check (public.is_staff() or exists (
  select 1 from public.tests te join public.teachers t on t.id = te.teacher_id
  where te.id = questions.test_id and t.user_id = auth.uid()
));
create policy "grades_staff_teacher_all" on public.grades for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "grades_student_select" on public.grades for select to authenticated using (
  exists (select 1 from public.students s where s.id = grades.student_id and s.user_id = auth.uid())
);

-- Finance
create policy "fee_settings_staff" on public.fee_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "fee_settings_read_auth" on public.fee_settings for select to authenticated using (true);
create policy "invoices_staff_all" on public.invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "invoices_student_select" on public.invoices for select to authenticated using (
  exists (select 1 from public.students s where s.id = invoices.student_id and s.user_id = auth.uid())
);
create policy "payments_staff_all" on public.payments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "payments_student_select" on public.payments for select to authenticated using (
  exists (select 1 from public.students s where s.id = payments.student_id and s.user_id = auth.uid())
);

-- Communication
create policy "conversation_members_own" on public.conversation_members for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "conversations_member_select" on public.conversations for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.conversation_members cm where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
  )
);
create policy "messages_member_select" on public.messages for select to authenticated using (
  public.is_staff() or exists (
    select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);
create policy "messages_member_insert" on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);
create policy "notifications_own" on public.notifications for select to authenticated using (user_id = auth.uid() or user_id is null or public.is_staff());
create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy "notifications_insert_staff" on public.notifications for insert to authenticated with check (public.is_staff() or user_id = auth.uid());

-- Certificates / scholarships
create policy "certificates_staff_all" on public.certificates for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "certificates_student_select" on public.certificates for select to authenticated using (
  exists (select 1 from public.students s where s.id = certificates.student_id and s.user_id = auth.uid())
);
create policy "scholarships_staff_all" on public.scholarships for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "scholarships_student_select" on public.scholarships for select to authenticated using (
  exists (select 1 from public.students s where s.id = scholarships.student_id and s.user_id = auth.uid())
);

-- ENIA
create policy "enia_content_read" on public.enia_content for select to anon, authenticated using (visible = true or public.is_staff());
create policy "enia_content_write_staff" on public.enia_content for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "enia_advantages_read" on public.enia_advantages for select to anon, authenticated using (true);
create policy "enia_advantages_write_staff" on public.enia_advantages for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "enia_fees_read" on public.enia_fee_items for select to anon, authenticated using (true);
create policy "enia_fees_write_staff" on public.enia_fee_items for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "enia_pieces_read" on public.enia_piece_groups for select to anon, authenticated using (true);
create policy "enia_pieces_write_staff" on public.enia_piece_groups for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "enia_partners_read" on public.enia_partners for select to anon, authenticated using (actif = true or public.is_staff());
create policy "enia_partners_write_staff" on public.enia_partners for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Site settings / audit
create policy "site_settings_read" on public.site_settings for select to anon, authenticated using (true);
create policy "site_settings_write_staff" on public.site_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "audit_staff_select" on public.audit_logs for select to authenticated using (public.is_staff());
create policy "audit_insert_auth" on public.audit_logs for insert to authenticated with check (true);

-- ============================================================
-- O. STORAGE BUCKETS + POLICIES
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('course-files', 'course-files', false),
  ('submission-files', 'submission-files', false),
  ('certificates', 'certificates', false),
  ('enia-media', 'enia-media', true),
  ('public-media', 'public-media', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select to public using (bucket_id = 'avatars');
create policy "avatars_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_auth_update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public_media_read" on storage.objects for select to public using (bucket_id in ('public-media','enia-media'));
create policy "public_media_staff_write" on storage.objects for all to authenticated using (bucket_id in ('public-media','enia-media') and public.is_staff()) with check (bucket_id in ('public-media','enia-media') and public.is_staff());

create policy "course_files_auth_read" on storage.objects for select to authenticated using (bucket_id = 'course-files');
create policy "course_files_staff_teacher_write" on storage.objects for all to authenticated
using (bucket_id = 'course-files' and (public.is_staff() or public.current_role() = 'teacher'))
with check (bucket_id = 'course-files' and (public.is_staff() or public.current_role() = 'teacher'));

create policy "submission_files_auth_read" on storage.objects for select to authenticated using (bucket_id = 'submission-files');
create policy "submission_files_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'submission-files');

create policy "certificates_auth_read" on storage.objects for select to authenticated using (bucket_id = 'certificates');
create policy "certificates_staff_write" on storage.objects for all to authenticated using (bucket_id = 'certificates' and public.is_staff()) with check (bucket_id = 'certificates' and public.is_staff());
