-- ============================================================
-- 0018_fix_notifications_and_messaging_system.sql
-- Consolidation définitive du module Messagerie Interne
-- Harmonisation du schéma notifications (user_id) et des RLS
-- ============================================================

-- 1. Table notifications : s'assurer de la présence de user_id
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'user_id'
  ) then
    alter table public.notifications add column user_id uuid references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Créer un index sur notifications(user_id) s'il n'existe pas
create index if not exists idx_notifications_user_id on public.notifications(user_id);

-- 2. Politiques RLS robustes sur notifications
alter table public.notifications enable row level security;

drop policy if exists "notifications_read" on public.notifications;
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_write" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;

create policy "notifications_select" on public.notifications
for select to authenticated
using (
  user_id = auth.uid() or public.is_staff()
);

create policy "notifications_insert" on public.notifications
for insert to authenticated
with check (true);

create policy "notifications_update" on public.notifications
for update to authenticated
using (user_id = auth.uid() or public.is_staff())
with check (true);

create policy "notifications_delete" on public.notifications
for delete to authenticated
using (user_id = auth.uid() or public.is_staff());

-- 3. Politiques RLS conversations, membres et messages
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;

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

-- 4. Fonction atomique sécurisée create_conversation
create or replace function public.create_conversation(
  p_subject text,
  p_member_ids uuid[],
  p_initial_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_member_id uuid;
  v_sender_id uuid := auth.uid();
  v_msg_id uuid;
begin
  if v_sender_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  -- 1. Créer la conversation
  insert into public.conversations (subject)
  values (coalesce(trim(p_subject), 'Discussion'))
  returning id into v_conv_id;

  -- 2. Ajouter l'expéditeur comme membre
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv_id, v_sender_id)
  on conflict do nothing;

  -- 3. Ajouter les destinataires et notifier
  if p_member_ids is not null then
    foreach v_member_id in array p_member_ids loop
      if v_member_id is not null and v_member_id <> v_sender_id then
        insert into public.conversation_members (conversation_id, user_id)
        values (v_conv_id, v_member_id)
        on conflict do nothing;

        -- Notification avec colonne user_id garantie
        insert into public.notifications (user_id, title, body, type, read)
        values (
          v_member_id,
          'Nouveau message : ' || coalesce(trim(p_subject), 'Discussion'),
          coalesce(p_initial_message, 'Vous avez reçu un nouveau message.'),
          'message',
          false
        );
      end if;
    end loop;
  end if;

  -- 4. Insérer le message initial si fourni
  if p_initial_message is not null and trim(p_initial_message) <> '' then
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv_id, v_sender_id, trim(p_initial_message))
    returning id into v_msg_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'ok', true,
    'conversation_id', v_conv_id::text,
    'message_id', v_msg_id::text
  );
end;
$$;

grant execute on function public.create_conversation(text, uuid[], text) to authenticated;
grant execute on function public.create_conversation(text, uuid[], text) to anon;
