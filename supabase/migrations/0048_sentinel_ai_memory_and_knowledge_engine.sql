-- ============================================================
-- 0048_sentinel_ai_memory_and_knowledge_engine.sql
-- Couche avancée : Mémoire long terme, Ingestion documentaire par Chunks et Feedback
-- ============================================================

-- 1. Table de mémoire long terme (utilisateur, cours, organisation)
create table if not exists public.ai_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('user', 'course', 'organization', 'role')),
  type text not null check (type in ('fact', 'preference', 'instruction', 'summary', 'learning_context')),
  content text not null,
  source text default 'conversation',
  confidence numeric(3,2) not null default 0.85,
  target_role text check (target_role in ('superadmin','admin','partner_admin','partner','teacher','student') or target_role is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_memories enable row level security;

-- Chacun accède à ses propres mémoires ou aux mémoires organisationnelles autorisées
create policy "ai_memories_select" on public.ai_memories
  for select to authenticated
  using (
    user_id = auth.uid()
    or scope = 'organization'
    or (scope = 'role' and target_role = public.current_role())
    or public.is_staff()
  );

create policy "ai_memories_insert" on public.ai_memories
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_staff()
  );

create policy "ai_memories_update" on public.ai_memories
  for update to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

create policy "ai_memories_delete" on public.ai_memories
  for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

create index if not exists idx_ai_memories_user_scope on public.ai_memories (user_id, scope, type);

-- 2. Table des fragments documentaires RAG avec versionnement et hachage dédupliqué
create table if not exists public.ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_title text not null,
  course_id uuid references public.courses(id) on delete cascade,
  course_file_id uuid references public.course_files(id) on delete set null,
  chunk_index int not null default 0,
  content text not null,
  hash text not null, -- Empreinte SHA-256 pour déduplication
  version int not null default 1,
  active boolean not null default true,
  target_roles text[] not null default '{superadmin,admin,teacher,student,partner,partner_admin}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_document_chunks enable row level security;

create policy "ai_document_chunks_select" on public.ai_document_chunks
  for select to authenticated
  using (
    (public.current_role() = any(target_roles) and active = true)
    or public.is_staff()
  );

create policy "ai_document_chunks_staff_manage" on public.ai_document_chunks
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create index if not exists idx_ai_chunks_hash on public.ai_document_chunks (hash);
create index if not exists idx_ai_chunks_course on public.ai_document_chunks (course_id, version, active);
create index if not exists idx_ai_chunks_fts on public.ai_document_chunks using gin (to_tsvector('french', document_title || ' ' || content));

-- 3. Table des feedbacks utilisateurs (👍 / 👎 pour l'apprentissage continu)
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null,
  rating text not null check (rating in ('positive', 'negative')),
  comment text,
  context jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_feedback enable row level security;

create policy "ai_feedback_user_insert" on public.ai_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "ai_feedback_user_select" on public.ai_feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create index if not exists idx_ai_feedback_user on public.ai_feedback (user_id, created_at desc);
create index if not exists idx_ai_feedback_rating on public.ai_feedback (rating);
