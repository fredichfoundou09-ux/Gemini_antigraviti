-- ============================================================
-- 0020_user_presence_and_audit_fixes.sql
-- Module Présence en ligne / hors ligne des utilisateurs
-- Consolidation finale de la messagerie interne et RLS
-- Table announcements et archivage des préinscriptions
-- ============================================================

-- 1. Table user_presence pour le suivi d'activité des utilisateurs
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null,
  name text,
  email text,
  last_seen_at timestamptz not null default now(),
  is_online boolean not null default true,
  user_agent text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_last_seen on public.user_presence(last_seen_at);
create index if not exists idx_user_presence_is_online on public.user_presence(is_online);

alter table public.user_presence enable row level security;

drop policy if exists "user_presence_select" on public.user_presence;
drop policy if exists "user_presence_insert" on public.user_presence;
drop policy if exists "user_presence_update" on public.user_presence;

create policy "user_presence_select" on public.user_presence
for select to authenticated
using (
  public.is_staff() or auth.uid() = user_id
);

create policy "user_presence_insert" on public.user_presence
for insert to authenticated
with check (
  auth.uid() = user_id or public.is_staff()
);

create policy "user_presence_update" on public.user_presence
for update to authenticated
using (
  auth.uid() = user_id or public.is_staff()
)
with check (
  auth.uid() = user_id or public.is_staff()
);

-- RPC update_user_heartbeat
create or replace function public.update_user_heartbeat(
  p_is_online boolean default true,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role, name, email into v_profile
  from public.profiles
  where id = v_user_id;

  insert into public.user_presence (user_id, role, name, email, last_seen_at, is_online, user_agent, updated_at)
  values (
    v_user_id,
    coalesce(v_profile.role, 'authenticated'),
    coalesce(v_profile.name, 'Utilisateur'),
    v_profile.email,
    now(),
    p_is_online,
    p_user_agent,
    now()
  )
  on conflict (user_id) do update set
    last_seen_at = now(),
    is_online = p_is_online,
    user_agent = coalesce(p_user_agent, user_presence.user_agent),
    role = coalesce(v_profile.role, user_presence.role),
    name = coalesce(v_profile.name, user_presence.name),
    email = coalesce(v_profile.email, user_presence.email),
    updated_at = now();

  return jsonb_build_object('success', true, 'is_online', p_is_online, 'last_seen_at', now());
end;
$$;

grant execute on function public.update_user_heartbeat(boolean, text) to authenticated;
grant execute on function public.update_user_heartbeat(boolean, text) to anon;

-- 2. Table announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text not null,
  priorite text default 'normale',
  cible text default 'tous',
  actif boolean default true,
  date_publication timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;
drop policy if exists "announcements_select" on public.announcements;
drop policy if exists "announcements_all" on public.announcements;

create policy "announcements_select" on public.announcements for select to authenticated, anon using (true);
create policy "announcements_all" on public.announcements for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 3. Sécurisation définitive de la Messagerie Interne
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_update" on public.conversations;
drop policy if exists "conversations_delete" on public.conversations;

create policy "conversations_select" on public.conversations
for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
  )
);

create policy "conversations_insert" on public.conversations
for insert to authenticated
with check (true);

create policy "conversations_update" on public.conversations
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "conversation_members_select" on public.conversation_members;
drop policy if exists "conversation_members_insert" on public.conversation_members;

create policy "conversation_members_select" on public.conversation_members
for select to authenticated
using (
  public.is_staff()
  or user_id = auth.uid()
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "conversation_members_insert" on public.conversation_members
for insert to authenticated
with check (true);

drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;

create policy "messages_select" on public.messages
for select to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

create policy "messages_insert" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid() or public.is_staff()
);

-- 4. Table d'archivage des préinscriptions
create table if not exists public.archived_registrations (
  id uuid primary key default gen_random_uuid(),
  original_id text,
  nom text not null,
  prenom text not null,
  email text,
  telephone text,
  formation text,
  statut text,
  archive_reason text,
  created_at timestamptz,
  archived_at timestamptz default now(),
  details jsonb default '{}'::jsonb
);

alter table public.archived_registrations enable row level security;
drop policy if exists "archived_registrations_staff" on public.archived_registrations;
create policy "archived_registrations_staff" on public.archived_registrations for all to authenticated using (public.is_staff()) with check (public.is_staff());
