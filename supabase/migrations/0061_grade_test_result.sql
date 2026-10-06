-- Migration 0061: Procédure stockée de notation manuelle et validation d'épreuves
-- Permet au formateur propriétaire du test ou au staff d'enregistrer les notes manuelles par question,
-- d'ajuster les commentaires, de recalculer le total et de valider définitivement le résultat.

create or replace function public.grade_test_result(
  p_result_id uuid,
  p_grades jsonb default '{}'::jsonb,
  p_comments jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_test_id uuid;
  v_teacher_id uuid;
  v_test_owner_uid uuid;
  v_bareme numeric;
  v_seuil numeric;
  v_total_points numeric := 0;
  v_total_max numeric := 0;
  v_pourcentage numeric := 0;
  v_statut text;
  v_q_id text;
  v_q_val text;
  v_comm text;
  v_num_note numeric;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into v_role from public.users where id = v_user_id;

  -- Récupérer le résultat et les paramètres de l'évaluation
  select tr.test_id into v_test_id
  from public.test_results tr
  where tr.id = p_result_id;

  if v_test_id is null then
    return jsonb_build_object('success', false, 'error', 'Résultat introuvable');
  end if;

  select t.teacher_id, t.bareme, t.seuil_reussite
  into v_teacher_id, v_bareme, v_seuil
  from public.tests t
  where t.id = v_test_id;

  if v_teacher_id is not null then
    select te.user_id into v_test_owner_uid
    from public.teachers te
    where te.id = v_teacher_id;
  end if;

  -- Vérifier l'autorisation : formateur titulaire ou staff
  if v_role not in ('admin', 'superadmin') and (v_test_owner_uid is null or v_test_owner_uid <> v_user_id) then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé : vous devez être le formateur titulaire de cette épreuve.');
  end if;

  -- Mise à jour des réponses avec les notes manuelles
  for v_q_id in select jsonb_object_keys(p_grades)
  loop
    v_q_val := p_grades->>v_q_id;
    v_comm := p_comments->>v_q_id;
    begin
      v_num_note := v_q_val::numeric;
    exception when others then
      v_num_note := 0;
    end;

    update public.test_answers
    set note_manuelle = v_num_note,
        commentaire_formateur = v_comm,
        statut_correction = 'corrige'
    where result_id = p_result_id
      and question_id = v_q_id::uuid;
  end loop;

  -- Calcul de la note totale finale
  select coalesce(sum(coalesce(ta.note_manuelle, ta.points_obtenus, 0)), 0),
         coalesce(sum(coalesce(q.points, 1)), 20)
  into v_total_points, v_total_max
  from public.test_answers ta
  left join public.questions q on q.id = ta.question_id
  where ta.result_id = p_result_id;

  if v_bareme is null or v_bareme <= 0 then
    v_bareme := 20;
  end if;

  if v_total_max > 0 then
    v_total_points := round(((v_total_points / v_total_max) * v_bareme)::numeric, 2);
    v_pourcentage := round(((v_total_points / v_bareme) * 100)::numeric, 0);
  else
    v_pourcentage := 0;
  end if;

  if v_seuil is null then
    v_seuil := v_bareme / 2;
  end if;

  if v_total_points >= v_seuil then
    v_statut := 'reussi';
  else
    v_statut := 'echoue';
  end if;

  -- Mettre à jour le résultat avec validation définitive
  update public.test_results
  set note = v_total_points,
      pourcentage = v_pourcentage,
      statut = v_statut,
      valide = true
  where id = p_result_id;

  return jsonb_build_object(
    'success', true,
    'result_id', p_result_id,
    'note', v_total_points,
    'pourcentage', v_pourcentage,
    'statut', v_statut,
    'valide', true
  );
end;
$$;

grant execute on function public.grade_test_result(uuid, jsonb, jsonb) to authenticated;
