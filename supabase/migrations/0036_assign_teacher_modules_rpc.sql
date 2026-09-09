-- Migration 0036: RPC sécurisée pour l'assignation staff-only des modules formateurs
-- Garantit la conformité stricte RLS : seuls les administrateurs et superadministrateurs
-- peuvent assigner ou révoquer des modules pour un formateur.

CREATE OR REPLACE FUNCTION public.assign_teacher_modules(
  p_teacher_id TEXT,
  p_module_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_mod_id TEXT;
  v_count INT := 0;
BEGIN
  -- 1. Contrôle d'accès strict : réservé au personnel administratif (admin / superadmin)
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Accès refusé : Seuls les administrateurs peuvent assigner des modules aux formateurs.';
  END IF;

  -- 2. Vérification existence du formateur
  IF NOT EXISTS (SELECT 1 FROM public.teachers WHERE id = p_teacher_id) THEN
    RAISE EXCEPTION 'Formateur introuvable : %', p_teacher_id;
  END IF;

  -- 3. Suppression des anciennes liaisons pour ce formateur
  DELETE FROM public.teacher_modules
  WHERE teacher_id = p_teacher_id;

  -- 4. Insertion des nouveaux modules
  IF p_module_ids IS NOT NULL AND array_length(p_module_ids, 1) > 0 THEN
    FOREACH v_mod_id IN ARRAY p_module_ids LOOP
      IF v_mod_id IS NOT NULL AND trim(v_mod_id) <> '' THEN
        INSERT INTO public.teacher_modules (teacher_id, module_id)
        VALUES (p_teacher_id, trim(v_mod_id))
        ON CONFLICT (teacher_id, module_id) DO NOTHING;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- 5. Audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
  VALUES (
    auth.uid(),
    'TEACHER_MODULES_ASSIGNED',
    'teachers',
    p_teacher_id,
    format('Assignation de %s module(s) au formateur %s par %s', v_count, p_teacher_id, v_caller_role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'teacher_id', p_teacher_id,
    'assigned_count', v_count
  );
END;
$$;

-- Permissions d'exécution
REVOKE ALL ON FUNCTION public.assign_teacher_modules(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_teacher_modules(TEXT, TEXT[]) TO authenticated;
