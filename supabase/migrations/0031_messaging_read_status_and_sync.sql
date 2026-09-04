-- =========================================================================
-- 0031_messaging_read_status_and_sync.sql
-- Optimisation temps réel & marquage des messages comme lus
-- 1. Politique RLS UPDATE sur conversation_members pour last_read_at
-- 2. RPC mark_conversation_as_read
-- 3. Vue / fonction de comptage des messages non lus
-- =========================================================================

BEGIN;

-- 1. Politique UPDATE sur conversation_members
DROP POLICY IF EXISTS "conversation_members_update" ON public.conversation_members;
CREATE POLICY "conversation_members_update" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- 2. RPC sécurisée pour marquer une conversation comme lue pour l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'read_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_as_read(UUID) TO authenticated;

-- 3. RPC pour récupérer le nombre de messages non lus pour l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(m.id) INTO v_count
  FROM public.messages m
  JOIN public.conversation_members cm
    ON cm.conversation_id = m.conversation_id
    AND cm.user_id = v_uid
  WHERE m.sender_id <> v_uid
    AND m.created_at > cm.last_read_at;

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_messages_count() TO authenticated;

COMMIT;
