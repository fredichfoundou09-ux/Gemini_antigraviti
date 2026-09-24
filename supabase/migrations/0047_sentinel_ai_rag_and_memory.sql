-- ============================================================
-- 0047_sentinel_ai_rag_and_memory.sql
-- Extension pour Sentinel AI : Mémoire conversationnelle, RAG et Audit
-- ============================================================

-- 1. Table des conversations de l'agent IA
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

create policy "ai_conversations_user_all" on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_ai_conversations_user_updated
  on public.ai_conversations (user_id, updated_at desc);

-- 2. Table des messages échangés
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  tool_calls jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_messages enable row level security;

create policy "ai_messages_user_all" on public.ai_messages
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_ai_messages_conv_created
  on public.ai_messages (conversation_id, created_at asc);

-- 3. Base de connaissances documentaire (RAG)
create table if not exists public.ai_knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('general', 'rules', 'faq', 'course', 'system')),
  title text not null,
  content text not null,
  target_roles text[] not null default '{superadmin,admin,teacher,student,partner,partner_admin}',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_knowledge_docs enable row level security;

-- Tout utilisateur connecté peut lire les documents autorisés pour son rôle
create policy "ai_knowledge_read_role" on public.ai_knowledge_docs
  for select to authenticated
  using (
    public.current_role() = any(target_roles)
    or public.is_staff()
  );

-- Seul le personnel d'administration peut modifier ou ajouter des documents
create policy "ai_knowledge_staff_manage" on public.ai_knowledge_docs
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create index if not exists idx_ai_knowledge_category on public.ai_knowledge_docs (category);
create index if not exists idx_ai_knowledge_fts on public.ai_knowledge_docs using gin (to_tsvector('french', title || ' ' || content));

-- Index complémentaires pour ai_agent_actions
create index if not exists idx_ai_agent_actions_status on public.ai_agent_actions (status);
create index if not exists idx_ai_agent_actions_tool on public.ai_agent_actions (tool_name);

-- 4. Initialisation des documents RAG fondamentaux de l'école
insert into public.ai_knowledge_docs (category, title, content, target_roles)
values
(
  'general',
  'Présentation de Sentinelles Numériques & ENIA 2.0',
  'Sentinelles Numériques / ENIA 2.0 est un centre d''excellence en formation technologique, cybersécurité, intelligence artificielle et ingénierie logicielle. La plateforme gère les inscriptions, les modules de cours, les devoirs, les examens QCM/courts, les présences par QR code et les attestations officielles.',
  '{superadmin,admin,teacher,student,partner,partner_admin}'
),
(
  'rules',
  'Règlement intérieur et politique d''assiduité',
  'La présence aux séances de cours est obligatoire. Tout retard supérieur à 15 minutes est comptabilisé comme retard. Au-delà de 3 absences non justifiées par module, l''étudiant ne peut pas se présenter à l''évaluation finale du module sans autorisation expresse de la direction des études.',
  '{superadmin,admin,teacher,student}'
),
(
  'faq',
  'Obtention des certificats et attestations de réussite',
  'Les certificats sont délivrés après validation de l''ensemble des modules avec une moyenne minimale de 12/20 et un taux d''assiduité supérieur à 80%. Chaque certificat est doté d''un identifiant unique vérifiable sur la page publique /verifier-certificat.',
  '{superadmin,admin,teacher,student,partner}'
),
(
  'rules',
  'Directives pédagogiques pour les formateurs',
  'Les formateurs doivent pointer les présences à chaque début de séance ou valider les scans QR des étudiants. Les devoirs et évaluations doivent être publiés avec un barème clair et une date limite de soumission. Les corrections doivent être saisies sous 7 jours ouvrés.',
  '{superadmin,admin,teacher}'
)
on conflict do nothing;
