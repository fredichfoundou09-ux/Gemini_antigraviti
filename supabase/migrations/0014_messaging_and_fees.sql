-- ============================================================
-- 0014_messaging_and_fees.sql
-- Correction de la messagerie (conversations/messages) et tarification
-- ============================================================

-- 1. RLS sur conversations & conversation_members
drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated" on public.conversations
for insert to authenticated with check (true);

drop policy if exists "conversation_members_insert_authenticated" on public.conversation_members;
create policy "conversation_members_insert_authenticated" on public.conversation_members
for insert to authenticated with check (
  public.is_staff() or user_id = auth.uid() or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id and cm.user_id = auth.uid()
  )
);

-- 2. Fonction sécurisée pour créer une conversation avec ses membres et message initial
create or replace function public.start_conversation(
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
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;

  insert into public.conversations (subject)
  values (coalesce(trim(p_subject), 'Discussion'))
  returning id into v_conv_id;

  -- Ajouter l'expéditeur
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv_id, v_sender_id)
  on conflict do nothing;

  -- Ajouter les destinataires
  if p_member_ids is not null then
    foreach v_member_id in array p_member_ids loop
      if v_member_id is not null and v_member_id <> v_sender_id then
        insert into public.conversation_members (conversation_id, user_id)
        values (v_conv_id, v_member_id)
        on conflict do nothing;

        -- Notification
        insert into public.notifications (user_id, title, body, type, read)
        values (
          v_member_id,
          'Nouveau message : ' || coalesce(trim(p_subject), 'Discussion'),
          coalesce(p_initial_message, 'Vous avez reçu un nouveau message.'),
          'info',
          false
        );
      end if;
    end loop;
  end if;

  -- Message initial
  if p_initial_message is not null and trim(p_initial_message) <> '' then
    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv_id, v_sender_id, trim(p_initial_message))
    returning id into v_msg_id;
  end if;

  return jsonb_build_object('ok', true, 'conversation_id', v_conv_id::text, 'message_id', v_msg_id::text);
end;
$$;

grant execute on function public.start_conversation(text, uuid[], text) to authenticated;

-- 3. Fonction sécurisée pour répondre dans une conversation
create or replace function public.send_message_in_conv(
  p_conv_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_msg_id uuid;
  v_member record;
  v_subject text;
begin
  if v_sender_id is null then
    return jsonb_build_object('ok', false, 'error', 'Non authentifié');
  end if;

  if not public.is_staff() and not exists (
    select 1 from public.conversation_members where conversation_id = p_conv_id and user_id = v_sender_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Non autorisé à participer à cette conversation');
  end if;

  select subject into v_subject from public.conversations where id = p_conv_id;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conv_id, v_sender_id, trim(p_body))
  returning id into v_msg_id;

  -- Notification aux autres membres
  for v_member in select user_id from public.conversation_members where conversation_id = p_conv_id and user_id <> v_sender_id loop
    insert into public.notifications (user_id, title, body, type, read)
    values (
      v_member.user_id,
      'Nouveau message : ' || coalesce(v_subject, 'Discussion'),
      trim(p_body),
      'info',
      false
    );
  end loop;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id::text);
end;
$$;

grant execute on function public.send_message_in_conv(uuid, text) to authenticated;

-- 4. Structure de tarification dynamique par formation
create table if not exists public.formation_pricing (
  formation_id uuid primary key references public.formations(id) on delete cascade,
  prix_module numeric(12,2) not null default 3500,
  frais_inscription numeric(12,2) not null default 5000,
  updated_at timestamptz not null default now()
);

alter table public.formation_pricing enable row level security;

drop policy if exists "formation_pricing_select" on public.formation_pricing;
create policy "formation_pricing_select" on public.formation_pricing for select to authenticated, anon using (true);

drop policy if exists "formation_pricing_staff" on public.formation_pricing;
create policy "formation_pricing_staff" on public.formation_pricing for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.formation_pricing (formation_id, prix_module, frais_inscription)
select id, 3500, 5000 from public.formations
on conflict (formation_id) do nothing;
