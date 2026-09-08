-- =========================================================================
-- 0035_strict_messaging_and_multi_login.sql
-- 1. Résolution multi-identifiants pour connexion (Username, Matricule ETU/ENS, Téléphone, Email)
-- 2. Confidentialité stricte des conversations & messages (Super Admin & tous utilisateurs)
-- =========================================================================

-- 1. Procédure enrichie de résolution d'email pour l'authentification
create or replace function public.get_email_by_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_cleaned text;
  v_clean_phone text;
  v_email text;
begin
  v_cleaned := lower(trim(coalesce(p_username, '')));
  if v_cleaned = '' then
    return null;
  end if;

  -- Nettoyage téléphone (suppression espaces, tirets, plus)
  v_clean_phone := regexp_replace(v_cleaned, '[^0-9]', '', 'g');

  -- A. Recherche directe dans les profils
  select email into v_email
  from public.profiles
  where active = true
    and (
      lower(username) = v_cleaned
      or lower(email) = v_cleaned
      or (v_clean_phone <> '' and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_clean_phone)
    )
  limit 1;

  if v_email is not null and v_email <> '' then
    return v_email;
  end if;

  -- B. Recherche par apprenant (Matricule ETU-xxx, Téléphone, Email)
  select coalesce(p.email, s.email) into v_email
  from public.students s
  left join public.profiles p on p.id = s.user_id
  where (p.active is null or p.active = true)
    and (
      lower(s.id) = v_cleaned
      or lower(coalesce(s.email, '')) = v_cleaned
      or (v_clean_phone <> '' and regexp_replace(coalesce(s.telephone, ''), '[^0-9]', '', 'g') = v_clean_phone)
      or (v_clean_phone <> '' and regexp_replace(coalesce(s.whatsapp, ''), '[^0-9]', '', 'g') = v_clean_phone)
    )
  order by s.created_at desc
  limit 1;

  if v_email is not null and v_email <> '' then
    return v_email;
  end if;

  -- C. Recherche par formateur (Matricule ENS-xxx, Téléphone, Email)
  select coalesce(p.email, t.email) into v_email
  from public.teachers t
  left join public.profiles p on p.id = t.user_id
  where (p.active is null or p.active = true)
    and (
      lower(t.id) = v_cleaned
      or lower(coalesce(t.email, '')) = v_cleaned
      or (v_clean_phone <> '' and regexp_replace(coalesce(t.phone, ''), '[^0-9]', '', 'g') = v_clean_phone)
    )
  order by t.created_at desc
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- =========================================================================
-- 2. CONFIDENTIALITÉ STRICTE DU SYSTÈME DE MESSAGERIE
-- Seuls les utilisateurs membres d'une conversation peuvent voir celle-ci et ses messages.
-- Aucun passe-droit pour Super Admin ou Admin afin de garantir le secret des échanges.
-- =========================================================================

-- Re-vérification / mise à jour de la fonction helper d'appartenance
create or replace function public.user_is_conversation_member(p_conv_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conv_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.user_is_conversation_member(uuid) to anon, authenticated;

-- RLS conversations
drop policy if exists "conversations_select" on public.conversations;
drop policy if exists "conversations_member_select" on public.conversations;
create policy "conversations_select" on public.conversations
for select to authenticated
using (
  public.user_is_conversation_member(id)
);

drop policy if exists "conversations_insert" on public.conversations;
create policy "conversations_insert" on public.conversations
for insert to authenticated
with check (true);

drop policy if exists "conversations_update" on public.conversations;
create policy "conversations_update" on public.conversations
for update to authenticated
using (
  public.user_is_conversation_member(id)
)
with check (
  public.user_is_conversation_member(id)
);

drop policy if exists "conversations_delete" on public.conversations;
drop policy if exists "conversations_member_delete" on public.conversations;
drop policy if exists "conversations_creator_or_staff_delete" on public.conversations;
create policy "conversations_delete" on public.conversations
for delete to authenticated
using (
  public.user_is_conversation_member(id)
);

-- RLS conversation_members
drop policy if exists "conversation_members_select" on public.conversation_members;
create policy "conversation_members_select" on public.conversation_members
for select to authenticated
using (
  user_id = auth.uid() or public.user_is_conversation_member(conversation_id)
);

drop policy if exists "conversation_members_insert" on public.conversation_members;
drop policy if exists "conversation_members_insert_authenticated" on public.conversation_members;
create policy "conversation_members_insert" on public.conversation_members
for insert to authenticated
with check (true);

drop policy if exists "conversation_members_delete" on public.conversation_members;
create policy "conversation_members_delete" on public.conversation_members
for delete to authenticated
using (
  user_id = auth.uid() or public.user_is_conversation_member(conversation_id)
);

-- RLS messages
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_member_select" on public.messages;
create policy "messages_select" on public.messages
for select to authenticated
using (
  public.user_is_conversation_member(conversation_id)
);

drop policy if exists "messages_insert" on public.messages;
drop policy if exists "messages_member_insert" on public.messages;
create policy "messages_insert" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid() and public.user_is_conversation_member(conversation_id)
);

drop policy if exists "messages_delete" on public.messages;
drop policy if exists "messages_member_delete" on public.messages;
create policy "messages_delete" on public.messages
for delete to authenticated
using (
  sender_id = auth.uid() and public.user_is_conversation_member(conversation_id)
);
