-- ============================================================
-- 0050_sentinel_ai_full_agent_engine.sql
-- Moteur Agentique : Hiérarchie des connaissances, Web Sources et Validation
-- ============================================================

-- 1. Ajout de colonnes de statut et priorité sur ai_memories
alter table public.ai_memories
  add column if not exists status text not null default 'candidate' check (status in ('candidate', 'validated', 'unverified', 'archived')),
  add column if not exists hierarchy_level int not null default 6; -- Niveau 6 = Mémoire validée, Niveau 10 = Non vérifiée

-- 2. Ajout de colonnes sur ai_knowledge_docs pour l'autorité officielle
alter table public.ai_knowledge_docs
  add column if not exists is_official boolean not null default true,
  add column if not exists hierarchy_level int not null default 4, -- Niveau 4 = Documents officiels actifs, Niveau 5 = Knowledge Base
  add column if not exists version int not null default 1;

-- 3. Table de cache des sources externes (Wikipédia, RFC, MDN, Documentation)
create table if not exists public.ai_external_sources (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  provider text not null check (provider in ('wikipedia', 'rfc', 'owasp', 'mdn', 'web_search', 'custom')),
  title text not null,
  url text,
  snippet text not null,
  full_content text,
  reliability_score numeric(3,2) not null default 0.90,
  created_at timestamptz not null default now()
);

alter table public.ai_external_sources enable row level security;

-- Accessible en lecture à tous les utilisateurs connectés
create policy "ai_external_sources_select" on public.ai_external_sources
  for select to authenticated using (true);

-- Insertion autorisée pour les utilisateurs connectés via les outils
create policy "ai_external_sources_insert" on public.ai_external_sources
  for insert to authenticated with check (true);

create index if not exists idx_ai_ext_sources_query on public.ai_external_sources (query);
create index if not exists idx_ai_ext_sources_provider on public.ai_external_sources (provider);
