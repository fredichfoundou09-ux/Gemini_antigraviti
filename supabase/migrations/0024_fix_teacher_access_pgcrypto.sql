-- =========================================================================
-- 0024_fix_teacher_access_pgcrypto.sql
-- Correction de la fonction complete_teacher_first_access :
-- Ajout de 'extensions' dans search_path et appel explicite extensions.crypt/gen_salt
-- Audit log résilient
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.complete_teacher_first_access(
  p_teacher_id TEXT,
  p_user_id UUID,
  p_email TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
BEGIN
  -- Validation minimale du mot de passe
  IF length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le mot de passe doit contenir au moins 6 caractères.');
  END IF;

  -- 1. Mise à jour de auth.users si p_user_id existe
  IF p_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
        email = COALESCE(NULLIF(trim(p_email), ''), email),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = p_user_id;

    -- Mise à jour du profil public
    UPDATE public.profiles
    SET email = COALESCE(NULLIF(trim(p_email), ''), email),
        must_change_password = false,
        active = true,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- 2. Mise à jour de la table teachers
  IF p_teacher_id IS NOT NULL THEN
    UPDATE public.teachers
    SET email = COALESCE(NULLIF(trim(p_email), ''), email),
        updated_at = now()
    WHERE id = p_teacher_id;
  END IF;

  -- 3. Audit log (inséré seulement si le profil existe)
  IF p_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, description)
    VALUES (
      p_user_id,
      'TEACHER_INITIAL_SETUP',
      'teachers',
      p_teacher_id,
      'Activation réussie et mot de passe initial personnalisé par l''enseignant'
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Profil et mot de passe enregistrés avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_teacher_first_access(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
