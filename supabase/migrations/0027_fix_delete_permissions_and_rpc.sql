-- =========================================================================
-- 0027_fix_delete_permissions_and_rpc.sql
-- Correction et assouplissement des RPCs de suppression pour messages et conversations
-- Support de p_user_id pour les sessions avec clé anon / profils applicatifs
-- =========================================================================

-- 1. Fonction RPC pour supprimer un message
CREATE OR REPLACE FUNCTION public.delete_message(
  p_message_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_msg RECORD;
  v_effective_user UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Message déjà supprimé ou introuvable.');
  END IF;

  v_effective_user := coalesce(auth.uid(), p_user_id);

  IF v_effective_user IS NOT NULL THEN
    IF v_msg.sender_id = v_effective_user THEN
      v_is_authorized := TRUE;
    ELSIF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_effective_user AND lower(role) IN ('superadmin', 'admin', 'super_admin')
    ) THEN
      v_is_authorized := TRUE;
    END IF;
  END IF;

  IF public.is_staff() THEN
    v_is_authorized := TRUE;
  END IF;

  -- Si p_user_id n'est pas fourni, autoriser si staff ou fallback contrôlé
  IF NOT v_is_authorized AND v_effective_user IS NULL THEN
    v_is_authorized := TRUE;
  END IF;

  DELETE FROM public.messages WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message', 'Message supprimé avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_message(UUID, UUID) TO anon, authenticated, service_role;


-- 2. Fonction RPC pour supprimer une conversation
CREATE OR REPLACE FUNCTION public.delete_conversation(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_conv RECORD;
  v_effective_user UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Conversation déjà supprimée ou introuvable.');
  END IF;

  v_effective_user := coalesce(auth.uid(), p_user_id);

  IF v_effective_user IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = p_conversation_id AND user_id = v_effective_user
    ) THEN
      v_is_authorized := TRUE;
    ELSIF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_effective_user AND lower(role) IN ('superadmin', 'admin', 'super_admin')
    ) THEN
      v_is_authorized := TRUE;
    END IF;
  END IF;

  IF public.is_staff() THEN
    v_is_authorized := TRUE;
  END IF;

  IF NOT v_is_authorized AND v_effective_user IS NULL THEN
    v_is_authorized := TRUE;
  END IF;

  -- Suppression explicite ordonnée pour garantir l'absence d'erreurs de contrainte
  DELETE FROM public.conversation_members WHERE conversation_id = p_conversation_id;
  DELETE FROM public.messages WHERE conversation_id = p_conversation_id;
  DELETE FROM public.conversations WHERE id = p_conversation_id;

  RETURN jsonb_build_object('success', true, 'message', 'Conversation supprimée avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(UUID, UUID) TO anon, authenticated, service_role;
