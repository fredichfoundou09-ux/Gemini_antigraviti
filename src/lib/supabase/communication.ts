import { getSupabase } from "./client";

/* ---------- Conversations & messages ---------- */
export async function fetchMyConversations() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("conversations")
    .select("*, members:conversation_members(user_id), messages(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchMessages(conversationId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const sb = getSupabase();
  const { data, error } = await sb.from("messages").insert({ conversation_id: conversationId, sender_id: senderId, body }).select("*").single();
  if (error) throw error;
  return data;
}

const isUuid = (id?: string | null): id is string =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function createConversation(subject: string, memberIds: string[]) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const { data: conv, error } = await sb.from("conversations").insert({ subject: subject.trim() }).select("*").single();
  if (error) throw error;

  const validMembers = new Set<string>();
  if (user?.id && isUuid(user.id)) validMembers.add(user.id);
  memberIds.filter(isUuid).forEach((m) => validMembers.add(m));

  if (validMembers.size > 0) {
    try {
      await sb
        .from("conversation_members")
        .insert(Array.from(validMembers).map((user_id) => ({ conversation_id: conv.id, user_id })));
    } catch { /* silence */ }
  }
  return conv;
}

export async function startConversation(subject: string, memberIds: string[], initialMessage?: string) {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  const validMemberIds = memberIds.filter(isUuid);

  // 1. Essai via la fonction RPC create_conversation (atomique)
  try {
    const { data, error } = await sb.rpc("create_conversation", {
      p_subject: subject.trim(),
      p_member_ids: validMemberIds,
      p_initial_message: initialMessage?.trim() || null,
    });
    if (!error && (data?.success || data?.ok)) {
      return { id: data.conversation_id, messageId: data.message_id };
    }
  } catch { /* fallback */ }

  // 1b. Essai via start_conversation
  try {
    const { data, error } = await sb.rpc("start_conversation", {
      p_subject: subject.trim(),
      p_member_ids: validMemberIds,
      p_initial_message: initialMessage?.trim() || null,
    });
    if (!error && (data?.ok || data?.success)) {
      return { id: data.conversation_id, messageId: data.message_id };
    }
  } catch { /* fallback direct */ }

  // 2. Fallback tables directes
  const { data: conv, error } = await sb.from("conversations").insert({ subject: subject.trim() }).select("*").single();
  if (error) throw error;

  // L'expéditeur et les destinataires DOIVENT être inscrits comme membres
  const allMembers = new Set<string>();
  if (user?.id && isUuid(user.id)) allMembers.add(user.id);
  validMemberIds.forEach((m) => allMembers.add(m));

  if (allMembers.size > 0) {
    try {
      await sb
        .from("conversation_members")
        .insert(Array.from(allMembers).map((user_id) => ({ conversation_id: conv.id, user_id })));
    } catch { /* silence */ }
  }

  let messageId;
  if (initialMessage && user?.id) {
    const { data: msg, error: msgErr } = await sb
      .from("messages")
      .insert({ conversation_id: conv.id, sender_id: user.id, body: initialMessage.trim() })
      .select("id")
      .single();
    if (!msgErr) messageId = msg?.id;

    // Notifier les destinataires
    for (const recipientId of validMemberIds) {
      if (recipientId !== user.id) {
        try {
          await sb.from("notifications").insert({
            user_id: recipientId,
            title: `Nouveau message : ${subject.trim()}`,
            body: initialMessage.trim(),
            type: "message",
            read: false,
          });
        } catch { /* silence */ }
      }
    }
  }
  return { id: conv.id, messageId };
}

export async function replyToConversation(conversationId: string, senderId: string, body: string) {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("send_message_in_conv", {
      p_conv_id: conversationId,
      p_body: body.trim(),
    });
    if (!error && data?.ok) {
      return { id: data.message_id };
    }
  } catch { /* fallback */ }

  // S'assurer que l'expéditeur est membre avant d'insérer
  if (isUuid(senderId)) {
    try {
      await sb
        .from("conversation_members")
        .insert({ conversation_id: conversationId, user_id: senderId });
    } catch { /* silence */ }
  }

  return sendMessage(conversationId, senderId, body.trim());
}

export async function deleteConversation(conversationId: string, userId?: string) {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("delete_conversation", {
      p_conversation_id: conversationId,
      p_user_id: userId || null,
    });
    if (!error && (data?.success || data?.ok)) return data;
  } catch { /* fallback */ }

  const { error } = await sb.from("conversations").delete().eq("id", conversationId);
  if (error) throw error;
  return { success: true };
}

export async function deleteMessage(messageId: string, userId?: string) {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("delete_message", {
      p_message_id: messageId,
      p_user_id: userId || null,
    });
    if (!error && (data?.success || data?.ok)) return data;
  } catch { /* fallback */ }

  const { error } = await sb.from("messages").delete().eq("id", messageId);
  if (error) throw error;
  return { success: true };
}

/* ---------- Notifications ---------- */
export async function fetchNotifications() {
  const sb = getSupabase();
  const { data, error } = await sb.from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id: string) {
  const sb = getSupabase();
  const { error } = await sb.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function createNotification(payload: { user_id?: string | null; title: string; body: string; type?: string }) {
  const sb = getSupabase();
  const { data, error } = await sb.from("notifications").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/* ---------- Realtime ---------- */
export function subscribeToMessages(conversationId: string, onInsert: (msg: any) => void) {
  const sb = getSupabase();
  const channelName = `messages-${conversationId}-${Math.random().toString(36).slice(2, 7)}`;
  const channel = sb
    .channel(channelName)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => onInsert(payload.new))
    .subscribe();
  return {
    unsubscribe: () => {
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

export function subscribeToAllMessages(onInsert: (msg: any) => void) {
  const sb = getSupabase();
  const channelName = `all-msgs-${Math.random().toString(36).slice(2, 7)}`;
  const channel = sb
    .channel(channelName)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => onInsert(payload.new))
    .subscribe();
  return {
    unsubscribe: () => {
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}

export function subscribeToNotifications(userId: string, onInsert: (n: any) => void) {
  const sb = getSupabase();
  const channelName = `notifs-${userId}-${Math.random().toString(36).slice(2, 7)}`;
  const channel = sb
    .channel(channelName)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => onInsert(payload.new))
    .subscribe();
  return {
    unsubscribe: () => {
      try { sb.removeChannel(channel); } catch { /* ignore */ }
    },
  };
}
