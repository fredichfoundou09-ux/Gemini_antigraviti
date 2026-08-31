-- Migration 0016: Sécurisation des créneaux d'emploi du temps et workflow enseignant
-- Vérification stricte de teacher_id, détection de conflits horaire et salle

-- 1. Fonction RPC sécurisée de création de créneau
create or replace function public.create_schedule_slot(
  p_formation_id uuid,
  p_module_id uuid,
  p_teacher_id text,
  p_jour text,
  p_heure_debut text,
  p_heure_fin text,
  p_salle text default null,
  p_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_exists boolean;
  v_conflict_teacher boolean;
  v_conflict_room boolean;
  v_schedule_id uuid;
begin
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
    return jsonb_build_object('success', false, 'code', 'TEACHER_CONFLICT', 'message', 'Conflit d''emploi du temps : cet enseignant a déjà un cours sur cette plage horaire.');
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
      return jsonb_build_object('success', false, 'code', 'ROOM_CONFLICT', 'message', 'La salle "' || trim(p_salle) || '" est déjà occupée sur ce créneau horaire.');
    end if;
  end if;

  -- 5. Insertion du créneau
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
    'message', 'Créneau créé avec succès'
  );
end;
$$;

grant execute on function public.create_schedule_slot(uuid, uuid, text, text, text, text, text, date) to authenticated;
