-- Migration 0042: Module Devoirs / Remises enrichi et sécurisé
-- Aligné sur le module Tests / Évaluations (0041)

-- 1. Table des devoirs (Assignments)
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  consignes text not null,
  formation text,
  module_id uuid not null references public.modules(id) on delete cascade,
  chapitre_id uuid references public.chapters(id) on delete set null,
  teacher_id text not null references public.teachers(id) on delete cascade,
  date_creation timestamptz not null default now(),
  date_publication timestamptz,
  date_ouverture timestamptz,
  date_limite timestamptz not null,
  heure_limite text,
  duree_estimee_minutes int,
  nb_fichiers_max int not null default 3,
  taille_max_mo int not null default 10,
  formats_autorises text[] not null default array['pdf', 'docx', 'xlsx', 'pptx', 'md', 'txt', 'zip', 'png', 'jpg'],
  bareme numeric(5,2) not null default 20.00,
  seuil_reussite numeric(5,2) not null default 10.00,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'enregistre', 'publie', 'ouvert', 'ferme', 'archive')),
  audience text not null default 'all' check (audience in ('all', 'formation', 'module', 'groupe', 'apprenants')),
  target_groupe text,
  target_student_ids text[],
  autoriser_remise_tardive boolean not null default false,
  tentatives_max int not null default 1,
  correction_visible_immediatement boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour les recherches rapides
create index if not exists idx_assignments_module on public.assignments(module_id);
create index if not exists idx_assignments_teacher on public.assignments(teacher_id);
create index if not exists idx_assignments_statut on public.assignments(statut);
create index if not exists idx_assignments_date_limite on public.assignments(date_limite);

-- 2. Table des pièces jointes du sujet (fournies par le formateur)
create table if not exists public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  file_name text not null,
  original_name text not null,
  file_url text not null,
  mime text not null,
  size int not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_attachments_assignment on public.assignment_attachments(assignment_id);

-- 3. Table des remises des apprenants (Submissions)
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  version int not null default 1,
  texte text,
  statut text not null default 'remis' check (statut in ('brouillon', 'remis', 'en_retard', 'en_correction', 'corrige', 'retourne')),
  date_remise timestamptz not null default now(),
  note numeric(5,2),
  appreciation text,
  commentaires_prives text,
  points_forts text,
  points_amelioration text,
  corrige_par text references public.teachers(id) on delete set null,
  date_correction timestamptz,
  publie boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignment_submissions_assignment on public.assignment_submissions(assignment_id);
create index if not exists idx_assignment_submissions_student on public.assignment_submissions(student_id);
create index if not exists idx_assignment_submissions_statut on public.assignment_submissions(statut);

-- 4. Table des fichiers remis par l'apprenant
create table if not exists public.assignment_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  file_name text not null,
  original_name text not null,
  file_url text not null,
  mime text not null,
  size int not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_submission_files_submission on public.assignment_submission_files(submission_id);

-- 5. Table des documents indépendants de devoirs (supports de devoirs)
create table if not exists public.assignment_documents (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  module_id uuid references public.modules(id) on delete cascade,
  teacher_id text references public.teachers(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size int not null,
  created_at timestamptz not null default now()
);

-- 6. Trigger updated_at automatique
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_assignments on public.assignments;
create trigger set_timestamp_assignments
before update on public.assignments
for each row execute procedure public.trigger_set_timestamp();

drop trigger if exists set_timestamp_assignment_submissions on public.assignment_submissions;
create trigger set_timestamp_assignment_submissions
before update on public.assignment_submissions
for each row execute procedure public.trigger_set_timestamp();

-- 7. RLS : Activer sur toutes les tables
alter table public.assignments enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_submission_files enable row level security;
alter table public.assignment_documents enable row level security;

-- Politiques RLS pour assignments
drop policy if exists "assignments_staff_all" on public.assignments;
create policy "assignments_staff_all" on public.assignments
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "assignments_teacher_manage" on public.assignments;
create policy "assignments_teacher_manage" on public.assignments
for all to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = assignments.teacher_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.teacher_modules tm
    join public.teachers t on t.id = tm.teacher_id
    where tm.module_id = assignments.module_id and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.id = assignments.teacher_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.teacher_modules tm
    join public.teachers t on t.id = tm.teacher_id
    where tm.module_id = assignments.module_id and t.user_id = auth.uid()
  )
);

drop policy if exists "assignments_student_read" on public.assignments;
create policy "assignments_student_read" on public.assignments
for select to authenticated
using (
  statut in ('publie', 'ouvert') and (
    audience = 'all' or
    exists (
      select 1 from public.students s
      left join public.formations f on f.id = s.formation_id
      where s.user_id = auth.uid() and (
        (assignments.audience = 'formation' and (f.code = assignments.formation or f.name = assignments.formation)) or
        (assignments.audience = 'groupe' and assignments.target_groupe is not null and (s.group_id::text = assignments.target_groupe)) or
        (assignments.audience = 'apprenants' and s.id = any(assignments.target_student_ids)) or
        (assignments.audience = 'module' and exists (
          select 1 from public.student_modules sm
          where sm.student_id = s.id and sm.module_id = assignments.module_id
        ))
      )
    )
  )
);

-- Politiques RLS pour assignment_attachments
drop policy if exists "assignment_attachments_staff_teacher" on public.assignment_attachments;
create policy "assignment_attachments_staff_teacher" on public.assignment_attachments
for all to authenticated
using (
  public.is_staff() or exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_attachments.assignment_id and t.user_id = auth.uid()
  )
)
with check (
  public.is_staff() or exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_attachments.assignment_id and t.user_id = auth.uid()
  )
);

drop policy if exists "assignment_attachments_student_read" on public.assignment_attachments;
create policy "assignment_attachments_student_read" on public.assignment_attachments
for select to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = assignment_attachments.assignment_id and a.statut in ('publie', 'ouvert')
  )
);

-- Politiques RLS pour assignment_submissions
drop policy if exists "assignment_submissions_staff_all" on public.assignment_submissions;
create policy "assignment_submissions_staff_all" on public.assignment_submissions
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "assignment_submissions_teacher_manage" on public.assignment_submissions;
create policy "assignment_submissions_teacher_manage" on public.assignment_submissions
for all to authenticated
using (
  exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.assignments a
    join public.teacher_modules tm on tm.module_id = a.module_id
    join public.teachers t on t.id = tm.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assignments a
    join public.teachers t on t.id = a.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.assignments a
    join public.teacher_modules tm on tm.module_id = a.module_id
    join public.teachers t on t.id = tm.teacher_id
    where a.id = assignment_submissions.assignment_id and t.user_id = auth.uid()
  )
);

drop policy if exists "assignment_submissions_student_own" on public.assignment_submissions;
create policy "assignment_submissions_student_own" on public.assignment_submissions
for all to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = assignment_submissions.student_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = assignment_submissions.student_id and s.user_id = auth.uid()
  )
);

-- Politiques RLS pour assignment_submission_files
drop policy if exists "assignment_submission_files_staff_teacher" on public.assignment_submission_files;
create policy "assignment_submission_files_staff_teacher" on public.assignment_submission_files
for all to authenticated
using (
  public.is_staff() or exists (
    select 1 from public.assignment_submissions sub
    join public.assignments a on a.id = sub.assignment_id
    join public.teachers t on t.id = a.teacher_id
    where sub.id = assignment_submission_files.submission_id and t.user_id = auth.uid()
  )
)
with check (
  public.is_staff() or exists (
    select 1 from public.assignment_submissions sub
    join public.assignments a on a.id = sub.assignment_id
    join public.teachers t on t.id = a.teacher_id
    where sub.id = assignment_submission_files.submission_id and t.user_id = auth.uid()
  )
);

drop policy if exists "assignment_submission_files_student_own" on public.assignment_submission_files;
create policy "assignment_submission_files_student_own" on public.assignment_submission_files
for all to authenticated
using (
  exists (
    select 1 from public.assignment_submissions sub
    join public.students s on s.id = sub.student_id
    where sub.id = assignment_submission_files.submission_id and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assignment_submissions sub
    join public.students s on s.id = sub.student_id
    where sub.id = assignment_submission_files.submission_id and s.user_id = auth.uid()
  )
);

-- Politiques RLS pour assignment_documents
drop policy if exists "assignment_documents_staff_all" on public.assignment_documents;
create policy "assignment_documents_staff_all" on public.assignment_documents
for all to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "assignment_documents_teacher_manage" on public.assignment_documents;
create policy "assignment_documents_teacher_manage" on public.assignment_documents
for all to authenticated
using (
  exists (
    select 1 from public.teachers t
    where t.id = assignment_documents.teacher_id and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.teachers t
    where t.id = assignment_documents.teacher_id and t.user_id = auth.uid()
  )
);

drop policy if exists "assignment_documents_read" on public.assignment_documents;
create policy "assignment_documents_read" on public.assignment_documents
for select to authenticated
using (true);

-- 8. Fonctions RPC Sécurisées

-- RPC 1 : Soumission d'un devoir par un apprenant avec contrôle strict de deadline
create or replace function public.submit_assignment_work(
  p_assignment_id uuid,
  p_texte text default null,
  p_files jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id text;
  v_assignment record;
  v_now timestamptz := now();
  v_statut text;
  v_current_count int;
  v_new_version int;
  v_submission_id uuid;
  v_file record;
begin
  -- 1. Identifier l'étudiant appelant
  select s.id into v_student_id
  from public.students s
  where s.user_id = auth.uid();

  if v_student_id is null and not public.is_staff() then
    return jsonb_build_object('success', false, 'error', 'Profil apprenant introuvable pour ce compte utilisateur.');
  end if;

  -- 2. Charger le devoir
  select * into v_assignment
  from public.assignments
  where id = p_assignment_id;

  if v_assignment.id is null then
    return jsonb_build_object('success', false, 'error', 'Le devoir spécifié n''existe pas.');
  end if;

  if v_assignment.statut not in ('publie', 'ouvert') then
    return jsonb_build_object('success', false, 'error', 'Ce devoir n''est pas actuellement ouvert aux remises.');
  end if;

  -- 3. Vérification de la deadline serveur
  if v_now > v_assignment.date_limite then
    if not v_assignment.autoriser_remise_tardive then
      return jsonb_build_object(
        'success', false,
        'error', 'La date limite de remise est dépassée (' || to_char(v_assignment.date_limite, 'DD/MM/YYYY HH24:MI') || ') et les remises tardives ne sont pas autorisées pour ce devoir.'
      );
    else
      v_statut := 'en_retard';
    end if;
  else
    v_statut := 'remis';
  end if;

  -- 4. Vérification des tentatives autorisées
  select count(*) into v_current_count
  from public.assignment_submissions
  where assignment_id = p_assignment_id and student_id = v_student_id;

  if v_assignment.tentatives_max > 0 and v_current_count >= v_assignment.tentatives_max then
    return jsonb_build_object(
      'success', false,
      'error', 'Vous avez déjà atteint le nombre maximal de remises autorisées (' || v_assignment.tentatives_max || ').'
    );
  end if;

  v_new_version := v_current_count + 1;

  -- 5. Création de la soumission
  insert into public.assignment_submissions (
    assignment_id,
    student_id,
    version,
    texte,
    statut,
    date_remise
  ) values (
    p_assignment_id,
    v_student_id,
    v_new_version,
    p_texte,
    v_statut,
    v_now
  ) returning id into v_submission_id;

  -- 6. Enregistrement des fichiers joints
  if jsonb_array_length(p_files) > 0 then
    for v_file in select * from jsonb_to_recordset(p_files) as x(
      file_name text,
      original_name text,
      file_url text,
      mime text,
      size int,
      storage_path text
    )
    loop
      insert into public.assignment_submission_files (
        submission_id,
        file_name,
        original_name,
        file_url,
        mime,
        size,
        storage_path
      ) values (
        v_submission_id,
        coalesce(v_file.file_name, 'fichier'),
        coalesce(v_file.original_name, 'fichier'),
        coalesce(v_file.file_url, ''),
        coalesce(v_file.mime, 'application/octet-stream'),
        coalesce(v_file.size, 0),
        v_file.storage_path
      );
    end loop;
  end if;

  -- 7. Notifier le formateur
  insert into public.notifications (
    to_id,
    title,
    body,
    date,
    lu,
    type
  )
  select
    t.user_id,
    'Devoir remis' || (case when v_statut = 'en_retard' then ' (en retard)' else '' end),
    'Un travail a été remis pour le devoir « ' || v_assignment.titre || ' » (version ' || v_new_version || ').',
    to_char(v_now, 'YYYY-MM-DD'),
    false,
    'info'
  from public.teachers t
  where t.id = v_assignment.teacher_id and t.user_id is not null;

  return jsonb_build_object(
    'success', true,
    'submissionId', v_submission_id,
    'version', v_new_version,
    'statut', v_statut,
    'dateRemise', v_now
  );
end;
$$;

-- RPC 2 : Notation et retour d'un devoir par le formateur
create or replace function public.grade_assignment_submission(
  p_submission_id uuid,
  p_note numeric,
  p_appreciation text default null,
  p_points_forts text default null,
  p_points_amelioration text default null,
  p_publier boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id text;
  v_sub record;
  v_assignment record;
  v_student record;
  v_now timestamptz := now();
begin
  -- 1. Identifier l'enseignant appelant
  select t.id into v_teacher_id
  from public.teachers t
  where t.user_id = auth.uid();

  if v_teacher_id is null and not public.is_staff() then
    return jsonb_build_object('success', false, 'error', 'Seul un formateur ou un administrateur peut corriger une remise.');
  end if;

  -- 2. Charger la soumission
  select * into v_sub
  from public.assignment_submissions
  where id = p_submission_id;

  if v_sub.id is null then
    return jsonb_build_object('success', false, 'error', 'Remise introuvable.');
  end if;

  -- 3. Charger le devoir
  select * into v_assignment
  from public.assignments
  where id = v_sub.assignment_id;

  -- 4. Valider la note
  if p_note < 0 or p_note > v_assignment.bareme then
    return jsonb_build_object(
      'success', false,
      'error', 'La note doit être comprise entre 0 et le barème maximal du devoir (' || v_assignment.bareme || ' pts).'
    );
  end if;

  -- 5. Mettre à jour la soumission
  update public.assignment_submissions
  set
    note = p_note,
    appreciation = p_appreciation,
    points_forts = p_points_forts,
    points_amelioration = p_points_amelioration,
    statut = 'corrige',
    corrige_par = coalesce(v_teacher_id, v_assignment.teacher_id),
    date_correction = v_now,
    publie = p_publier,
    updated_at = v_now
  where id = p_submission_id;

  -- 6. Enregistrer dans le carnet de notes officiel (grades)
  insert into public.grades (
    student_id,
    module_id,
    note,
    appreciation,
    date
  ) values (
    v_sub.student_id,
    v_assignment.module_id,
    p_note,
    coalesce(p_appreciation, 'Devoir : ' || v_assignment.titre),
    to_char(v_now, 'YYYY-MM-DD')
  );

  -- 7. Notifier l'apprenant
  select * into v_student from public.students where id = v_sub.student_id;
  if v_student.user_id is not null and p_publier then
    insert into public.notifications (
      to_id,
      title,
      body,
      date,
      lu,
      type
    ) values (
      v_student.user_id,
      'Devoir corrigé',
      'Votre devoir « ' || v_assignment.titre || ' » a été corrigé. Note : ' || p_note || '/' || v_assignment.bareme || '.',
      to_char(v_now, 'YYYY-MM-DD'),
      false,
      'info'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'submissionId', p_submission_id,
    'note', p_note,
    'bareme', v_assignment.bareme,
    'dateCorrection', v_now
  );
end;
$$;

-- 9. Assurer l'existence du bucket Storage pour les remises
insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', true)
on conflict (id) do update set public = true;

-- Politiques de stockage durcies pour submission-files
drop policy if exists "submission_files_auth_read" on storage.objects;
create policy "submission_files_auth_read" on storage.objects
for select to authenticated
using (bucket_id = 'submission-files');

drop policy if exists "submission_files_auth_write" on storage.objects;
create policy "submission_files_auth_write" on storage.objects
for insert to authenticated
with check (bucket_id = 'submission-files');
