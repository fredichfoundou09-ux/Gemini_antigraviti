-- ============================================================
-- 0021_fix_messaging_recursion.sql
-- Élimination de la récursion infinie (42P17) dans les politiques RLS
-- ============================================================

-- Fonction Helper SECURITY DEFINER pour tester l'appartenance à une conversation sans récursion RLS
create or replace function public.user_is_conversation_member(p_conv_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conv_id and user_id = auth.uid()
  );
$$;

grant execute on function public.user_is_conversation_member(uuid) to authenticated;
grant execute on function public.user_is_conversation_member(uuid) to anon;

-- Politiques RLS conversations
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_insert" on public.conversations;
drop policy if exists "conversations_update" on public.conversations;
drop policy if exists "conversations_delete" on public.conversations;

create policy "conversations_select" on public.conversations
for select to authenticated
using (
  public.is_staff() or public.user_is_conversation_member(id)
);

create policy "conversations_insert" on public.conversations
for insert to authenticated
with check (true);

create policy "conversations_update" on public.conversations
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

-- Politiques RLS conversation_members
drop policy if exists "conversation_members_select" on public.conversation_members;
drop policy if exists "conversation_members_insert" on public.conversation_members;
drop policy if exists "conversation_members_insert_authenticated" on public.conversation_members;

create policy "conversation_members_select" on public.conversation_members
for select to authenticated
using (
  public.is_staff() or user_id = auth.uid() or public.user_is_conversation_member(conversation_id)
);

create policy "conversation_members_insert" on public.conversation_members
for insert to authenticated
with check (true);

-- Politiques RLS messages
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_insert" on public.messages;

create policy "messages_select" on public.messages
for select to authenticated
using (
  public.is_staff() or public.user_is_conversation_member(conversation_id)
);

create policy "messages_insert" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid() or public.is_staff()
);
