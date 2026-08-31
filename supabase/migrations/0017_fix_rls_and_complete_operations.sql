-- ============================================================
-- 0017_fix_rls_and_complete_operations.sql
-- Correction définitive des RLS (site_settings, conversations)
-- et fiabilisation des rôles, heures enseignants et audit logs
-- ============================================================

-- 1. Fonctions de rôles robustes (insensibles à la casse et aux espaces)
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce((select role from public.profiles where id = auth.uid()), 'anonymous')));
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('superadmin', 'admin', 'super_admin', 'super admin')
     or (auth.jwt() ->> 'role') in ('service_role', 'supabase_admin');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('superadmin', 'super_admin', 'super admin')
     or (auth.jwt() ->> 'role') in ('service_role', 'supabase_admin');
$$;

-- 2. Correction RLS sur site_settings (Résolution Capture 220931)
drop policy if exists "site_settings_read" on public.site_settings;
drop policy if exists "site_settings_write_staff" on public.site_settings;
drop policy if exists "site_settings_insert" on public.site_settings;
drop policy if exists "site_settings_update" on public.site_settings;
drop policy if exists "site_settings_all" on public.site_settings;

-- Lecture publique pour la vitrine
create policy "site_settings_read" on public.site_settings
for select to anon, authenticated
using (true);

-- Écriture autorisée pour le staff (insert et update pour supporter upsert)
create policy "site_settings_insert" on public.site_settings
for insert to authenticated
with check (
  public.is_staff()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and lower(trim(role)) in ('superadmin', 'admin', 'super_admin', 'super admin')
  )
);

create policy "site_settings_update" on public.site_settings
for update to authenticated
using (
  public.is_staff()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and lower(trim(role)) in ('superadmin', 'admin', 'super_admin', 'super admin')
  )
)
with check (true);

-- 3. Correction RLS sur conversations & messages (Résolution Capture 220822)
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_insert_authenticated" on public.conversations;
drop policy if exists "conversations_member_select" on public.conversations;

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

-- Conversation members RLS
drop policy if exists "conversation_members_select" on public.conversation_members;
drop policy if exists "conversation_members_insert" on public.conversation_members;
drop policy if exists "conversation_members_insert_authenticated" on public.conversation_members;

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

-- Messages RLS
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;
drop policy if exists "messages_member_select" on public.messages;
drop policy if exists "messages_member_insert" on public.messages;

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

-- 4. Fonction atomique create_conversation pour garantir le succès même en cas de restriction RLS
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

  insert into public.conversations (subject)
  values (coalesce(trim(p_subject), 'Discussion'))
  returning id into v_conv_id;

  -- Membre expéditeur
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv_id, v_sender_id)
  on conflict do nothing;

  -- Membres destinataires
  if p_member_ids is not null then
    foreach v_member_id in array p_member_ids loop
      if v_member_id is not null and v_member_id <> v_sender_id then
        insert into public.conversation_members (conversation_id, user_id)
        values (v_conv_id, v_member_id)
        on conflict do nothing;

        -- Notification interne
        insert into public.notifications (to_id, title, body, type)
        values (
          v_member_id,
          'Nouveau message : ' || coalesce(trim(p_subject), 'Discussion'),
          coalesce(p_initial_message, 'Vous avez reçu un nouveau message.'),
          'message'
        );
      end if;
    end loop;
  end if;

  -- Message initial si présent
  if p_initial_message is not null and trim(p_initial_message) <> '' then
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv_id, v_sender_id, trim(p_initial_message))
    returning id into v_msg_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'conversation_id', v_conv_id,
    'message_id', v_msg_id
  );
end;
$$;

grant execute on function public.create_conversation(text, uuid[], text) to authenticated;

-- 5. RLS sur notifications
drop policy if exists "notifications_read" on public.notifications;
drop policy if exists "notifications_write" on public.notifications;

create policy "notifications_read" on public.notifications
for select to authenticated
using (
  to_id = auth.uid() or public.is_staff()
);

create policy "notifications_write" on public.notifications
for insert to authenticated
with check (true);

create policy "notifications_update" on public.notifications
for update to authenticated
using (to_id = auth.uid() or public.is_staff())
with check (true);
