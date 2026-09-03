-- =========================================================================
-- 0026_delete_messages_and_conversations.sql
-- 1. Politiques RLS de suppression pour messages et conversations
-- 2. RPC sécurisées delete_message et delete_conversation
-- =========================================================================

-- 1. Politiques RLS DELETE
DROP POLICY IF EXISTS "messages_member_delete" ON public.messages;
CREATE POLICY "messages_member_delete" ON public.messages FOR DELETE TO authenticated
USING (
  sender_id = auth.uid() OR public.is_staff()
);

DROP POLICY IF EXISTS "conversations_member_delete" ON public.conversations;
CREATE POLICY "conversations_member_delete" ON public.conversations FOR DELETE TO authenticated
USING (
  public.is_staff() OR EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "conversation_members_delete" ON public.conversation_members;
CREATE POLICY "conversation_members_delete" ON public.conversation_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR public.is_staff()
);

-- 2. RPC Sécurisée pour supprimer un message
CREATE OR REPLACE FUNCTION public.delete_message(p_message_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_msg RECORD;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Message introuvable.');
  END IF;

  -- Vérifier droits (expéditeur du message ou staff/admin)
  IF v_msg.sender_id <> auth.uid() AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à supprimer ce message.';
  END IF;

  DELETE FROM public.messages WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message', 'Message supprimé avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_message(UUID) TO authenticated;


-- 3. RPC Sécurisée pour supprimer une conversation complète
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_conv RECORD;
  v_is_member BOOLEAN;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Conversation introuvable.');
  END IF;

  -- Vérifier si l'utilisateur est membre de la conversation ou staff
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Vous n''êtes pas autorisé à supprimer cette conversation.';
  END IF;

  -- Suppression en cascade (messages et members sont liés avec ON DELETE CASCADE)
  DELETE FROM public.conversations WHERE id = p_conversation_id;

  RETURN jsonb_build_object('success', true, 'message', 'Conversation supprimée avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(UUID) TO authenticated;
