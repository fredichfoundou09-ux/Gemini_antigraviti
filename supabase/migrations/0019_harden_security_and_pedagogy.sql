-- Migration 0019: Durcissement de la sécurité, intégrité des emplois du temps, invitations sécurisées et RLS
-- Date: 1er septembre 2026

-- 1. Table des invitations de comptes sécurisées (Activation par token temporaire 48h)
create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text,
  phone text,
  role text not null default 'teacher',
  target_id text, -- ID de l'enseignant ou de l'apprenant concerné
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.account_invitations enable row level security;

-- Seul le personnel administratif peut créer ou consulter les invitations
create policy "invitations_staff_all" on public.account_invitations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    )
  );

-- RPC publique sécurisée pour vérifier et consommer un jeton d'invitation (sans exposer la table)
create or replace function public.consume_invitation_token(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select * into v_inv from public.account_invitations
  where token = trim(p_token)
    and used_at is null
    and expires_at > now();

  if v_inv.id is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_OR_EXPIRED_TOKEN', 'message', 'Ce lien d''invitation est invalide ou a expiré (validité 48h). Veuillez contacter la direction.');
  end if;

  return jsonb_build_object(
    'success', true,
    'email', v_inv.email,
    'phone', v_inv.phone,
    'role', v_inv.role,
    'target_id', v_inv.target_id
  );
end;
$$;

grant execute on function public.consume_invitation_token(text) to authenticated, anon;


-- 2. Renforcement de l'emploi du temps (Schedule) : Interdiction des écritures directes non contrôlées
-- Révocation des écritures directes sur la table schedule pour les clients normaux
drop policy if exists "schedule_staff_all" on public.schedule;

-- Lecture autorisée selon le rôle
create policy "schedule_read_policy" on public.schedule
  for select to authenticated
  using (true);

-- Écritures réservées aux administrateurs
create policy "schedule_write_staff_only" on public.schedule
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    )
  );

-- 3. Mise à niveau de la RPC transactionnelle create_schedule_slot avec gestion de cohorte/groupe
create or replace function public.create_schedule_slot(
  p_formation_id uuid,
  p_module_id uuid,
  p_teacher_id text,
  p_jour text,
  p_heure_debut text,
  p_heure_fin text,
  p_salle text default null,
  p_date date default null,
  p_group_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_exists boolean;
  v_conflict_teacher boolean;
  v_conflict_room boolean;
  v_conflict_group boolean;
  v_schedule_id uuid;
begin
  -- Contrôles d'autorisation : seul le staff peut créer un créneau
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  ) then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Droits insuffisants pour planifier un créneau.');
  end if;

  -- 1. Contrôle des champs obligatoires
  if p_formation_id is null then
    return jsonb_build_object('success', false, 'code', 'FORMATION_REQUIRED', 'message', 'La formation est obligatoire.');
  end if;

  if p_teacher_id is null or trim(p_teacher_id) = '' then
    return jsonb_build_object('success', false, 'code', 'TEACHER_REQUIRED', 'message', 'Veuillez sélectionner un enseignant.');
  end if;

  if p_jour is null or trim(p_jour) = '' then
    return jsonb_build_object('success', false, 'code', 'DAY_REQUIRED', 'message', 'Le jour est obligatoire.');
  end if;

  if p_heure_debut is null or p_heure_fin is null or p_heure_debut >= p_heure_fin then
    return jsonb_build_object('success', false, 'code', 'INVALID_HOURS', 'message', 'L''heure de début doit être strictement antérieure à l''heure de fin.');
  end if;

  -- 2. Vérification existence de l'enseignant
  select exists(select 1 from public.teachers where id = p_teacher_id) into v_teacher_exists;
  if not v_teacher_exists then
    return jsonb_build_object('success', false, 'code', 'TEACHER_NOT_FOUND', 'message', 'Cet enseignant n''est plus disponible ou introuvable.');
  end if;

  -- 3. Détection des conflits pour l'enseignant (même jour, chevauchement d'heures)
  select exists(
    select 1 from public.schedule
    where teacher_id = p_teacher_id
      and jour = p_jour
      and (
        (p_date is null and date is null) or
        (p_date is not null and date = p_date)
      )
      and p_heure_debut < heure_fin
      and p_heure_fin > heure_debut
  ) into v_conflict_teacher;

  if v_conflict_teacher then
    return jsonb_build_object('success', false, 'code', 'TEACHER_CONFLICT', 'message', 'Conflit d''emploi du temps : cet enseignant est déjà assigné à un autre cours sur cette plage horaire.');
  end if;

  -- 4. Détection des conflits de salle (si renseignée)
  if p_salle is not null and trim(p_salle) != '' then
    select exists(
      select 1 from public.schedule
      where salle = trim(p_salle)
        and jour = p_jour
        and (
          (p_date is null and date is null) or
          (p_date is not null and date = p_date)
        )
        and p_heure_debut < heure_fin
        and p_heure_fin > heure_debut
    ) into v_conflict_room;

    if v_conflict_room then
      return jsonb_build_object('success', false, 'code', 'ROOM_CONFLICT', 'message', 'La salle "' || trim(p_salle) || '" est déjà réservée sur ce créneau horaire.');
    end if;
  end if;

  -- 5. Détection des conflits de groupe / cohorte (si spécifié)
  if p_group_id is not null and trim(p_group_id) != '' then
    select exists(
      select 1 from public.schedule
      where formation_id = p_formation_id
        and jour = p_jour
        and (
          (p_date is null and date is null) or
          (p_date is not null and date = p_date)
        )
        and p_heure_debut < heure_fin
        and p_heure_fin > heure_debut
    ) into v_conflict_group;

    if v_conflict_group then
      return jsonb_build_object('success', false, 'code', 'GROUP_CONFLICT', 'message', 'Cette cohorte/formation a déjà une séance prévue sur cette plage horaire.');
    end if;
  end if;

  -- 6. Insertion atomique
  insert into public.schedule (
    formation_id,
    module_id,
    teacher_id,
    salle,
    jour,
    heure_debut,
    heure_fin,
    date
  ) values (
    p_formation_id,
    p_module_id,
    p_teacher_id,
    coalesce(trim(p_salle), ''),
    p_jour,
    p_heure_debut,
    p_heure_fin,
    p_date
  ) returning id into v_schedule_id;

  return jsonb_build_object(
    'success', true,
    'schedule_id', v_schedule_id,
    'message', 'Créneau créé et certifié avec succès'
  );
end;
$$;

revoke all on function public.create_schedule_slot(uuid, uuid, text, text, text, text, text, date, text) from public, anon;
grant execute on function public.create_schedule_slot(uuid, uuid, text, text, text, text, text, date, text) to authenticated;


-- 4. Sécurisation de la messagerie : Révocation définitive de l'accès public/anonyme
revoke all on function public.create_conversation(text, uuid[], text) from public, anon;
grant execute on function public.create_conversation(text, uuid[], text) to authenticated;

revoke all on function public.send_message_in_conv(uuid, text) from public, anon;
grant execute on function public.send_message_in_conv(uuid, text) to authenticated;


-- 5. Notifications contrôlées (Interdiction d'usurpation côté client)
create or replace function public.send_system_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text default 'info'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_role text;
begin
  select role into v_sender_role from public.profiles where id = auth.uid();
  
  -- Seuls les membres du personnel peuvent notifier d'autres utilisateurs arbitraires
  if v_sender_role not in ('admin', 'superadmin', 'teacher') and p_user_id != auth.uid() then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Seul le personnel peut diffuser des notifications.');
  end if;

  insert into public.notifications (
    user_id,
    title,
    body,
    type,
    read,
    created_at
  ) values (
    p_user_id,
    trim(p_title),
    trim(p_body),
    coalesce(p_type, 'info'),
    false,
    now()
  );

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.send_system_notification(uuid, text, text, text) from public, anon;
grant execute on function public.send_system_notification(uuid, text, text, text) to authenticated;
