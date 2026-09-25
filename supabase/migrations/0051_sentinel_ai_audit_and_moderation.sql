-- ============================================================
-- 0051_sentinel_ai_audit_and_moderation.sql
-- Télémétrie d'audit des tokens IA, observabilité et connaissances officielles
-- ============================================================

-- 1. Table de journalisation et observabilité des tokens IA (ai_audit_logs)
create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  role text not null default 'student',
  intent text not null default 'GENERAL',
  tool_name text,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  latency_ms int not null default 0,
  sources text[] not null default '{}',
  status text not null default 'success' check (status in ('success', 'error', 'intercepted')),
  error text,
  created_at timestamptz not null default now()
);

alter table public.ai_audit_logs enable row level security;

-- Seul le personnel d'administration (staff / superadmin) ou le propriétaire peut lire ses logs
create policy "ai_audit_logs_select" on public.ai_audit_logs
  for select to authenticated
  using (
    public.is_staff() or user_id = auth.uid()
  );

-- Insertion autorisée pour tout utilisateur connecté émettant des requêtes IA
create policy "ai_audit_logs_insert" on public.ai_audit_logs
  for insert to authenticated
  with check (true);

create index if not exists idx_ai_audit_logs_created on public.ai_audit_logs (created_at desc);
create index if not exists idx_ai_audit_logs_role on public.ai_audit_logs (role);
create index if not exists idx_ai_audit_logs_intent on public.ai_audit_logs (intent);

-- 2. Enrichissement des connaissances officielles de Sentinelles Numériques (RAG)
insert into public.ai_knowledge_docs (category, title, content, target_roles, is_official, hierarchy_level)
values
(
  'rules',
  'Charte Officielle d''Assiduité et de Ponctualité ENIA 2.0',
  'Le contrôle des présences s''effectue à chaque séance via scan QR code ou émargement enseignant. Tout retard supérieur à 15 minutes est consigné. Au-delà de 3 absences non justifiées, l''accès à l''évaluation terminale du module est automatiquement bloqué jusqu''à régularisation auprès de la direction pédagogique.',
  '{superadmin,admin,teacher,student}',
  true,
  3
),
(
  'rules',
  'Conditions d''Attribution des Certificats et Bourses d''Excellence',
  'L''obtention du certificat officiel de fin de formation requiert : 1. Une moyenne générale supérieure ou égale à 12/20 aux évaluations continues et devoirs ; 2. Un taux d''assiduité effectif supérieur ou égal à 80% ; 3. La validation du projet pratique de fin de cycle. Les bourses d''excellence sont attribuées semestriellement sur critères de mérite académique et d''assiduité exemplaire.',
  '{superadmin,admin,teacher,student,partner,partner_admin}',
  true,
  3
),
(
  'course',
  'Syllabus Pédagogique Fondamental : Cybersécurité & Réseaux',
  'Le cursus couvre : 1. Architecture réseau, modèles OSI et TCP/IP, protocoles de routage dynamique (OSPF RFC 2328, BGP-4 RFC 4271) ; 2. Cryptographie appliquée (chiffrement symétrique AES, chiffrement asymétrique RSA RFC 8017, infrastructure PKI, TLS 1.3 RFC 8446) ; 3. Sécurité offensive & défensive (Top 10 OWASP, analyse de paquets Wireshark, sécurisation des pare-feu et segmentation réseau).',
  '{superadmin,admin,teacher,student}',
  true,
  3
)
on conflict do nothing;
