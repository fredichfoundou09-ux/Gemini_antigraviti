-- ============================================================
-- 0007_public_registration_rpc.sql
-- 1. Permettre la lecture publique (anon) du catalogue formations et modules
-- 2. Procédure atomique sécurisée pour soumettre une pré-inscription
-- ============================================================

drop policy if exists "formations_read_all_auth" on public.formations;
drop policy if exists "formations_read_public" on public.formations;
create policy "formations_read_public" on public.formations for select to anon, authenticated using (true);

drop policy if exists "modules_read_all_auth" on public.modules;
drop policy if exists "modules_read_public" on public.modules;
create policy "modules_read_public" on public.modules for select to anon, authenticated using (true);

drop policy if exists "chapters_read_all_auth" on public.chapters;
drop policy if exists "chapters_read_public" on public.chapters;
create policy "chapters_read_public" on public.chapters for select to anon, authenticated using (true);

-- Procédure stockée atomique
create or replace function public.submit_registration(
  p_nom text,
  p_prenom text,
  p_telephone text,
  p_whatsapp text,
  p_email text default '',
  p_niveau text default '',
  p_formation_code text default 'informatique',
  p_module_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_formation_id uuid;
  v_reg_id uuid;
  v_mod_id uuid;
  v_code text;
begin
  -- Résolution formation_id
  v_code := lower(trim(coalesce(p_formation_code, 'informatique')));
  select id into v_formation_id from public.formations where lower(code) = v_code limit 1;
  
  if v_formation_id is null then
    select id into v_formation_id from public.formations limit 1;
  end if;

  if v_formation_id is null then
    return jsonb_build_object('ok', false, 'error', 'Aucune formation configurée.');
  end if;

  -- Insertion pré-inscription
  insert into public.registrations (
    formation_id, nom, prenom, telephone, whatsapp, email, niveau, statut, date
  ) values (
    v_formation_id,
    trim(p_nom),
    trim(p_prenom),
    trim(p_telephone),
    trim(p_whatsapp),
    nullif(trim(p_email), ''),
    nullif(trim(p_niveau), ''),
    'en_attente',
    current_date
  )
  returning id into v_reg_id;

  -- Insertion modules choisis (si présents)
  if p_module_ids is not null and array_length(p_module_ids, 1) > 0 then
    foreach v_mod_id in array p_module_ids loop
      if v_mod_id is not null then
        insert into public.registration_modules (registration_id, module_id)
        values (v_reg_id, v_mod_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Notification automatique pour l'administration (user_id = null = visible par staff)
  insert into public.notifications (
    user_id, title, body, type, read
  ) values (
    null,
    'Nouvelle pré-inscription',
    trim(p_nom) || ' ' || trim(p_prenom) || ' a envoyé une demande de pré-inscription (' || upper(v_code) || ').',
    'inscription',
    false
  );

  return jsonb_build_object('ok', true, 'id', v_reg_id::text);
end;
$$;

grant execute on function public.submit_registration(text, text, text, text, text, text, text, uuid[]) to anon, authenticated;
