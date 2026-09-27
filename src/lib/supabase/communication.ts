import { getSupabase } from "./client";

const LOCAL_STORAGE_DELETED_MSG_PREFIX = "sn_msg_deleted_v2_";
const LOCAL_STORAGE_DELETED_CONV_PREFIX = "sn_conv_deleted_v2_";
const FALLBACK_KEY = "global_session";

function safeUserKey(userId?: string): string {
  return userId && userId.trim() ? userId.trim() : FALLBACK_KEY;
}

export function getDeletedMessageIds(userId?: string): Set<string> {
  const set = new Set<string>();
  const keys = [safeUserKey(userId)];
  if (userId && userId !== FALLBACK_KEY) keys.push(FALLBACK_KEY);
  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_DELETED_MSG_PREFIX}${k}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach((id) => set.add(id));
      }
    } catch {
      // ignore
    }
  });
  return set;
}

export function markMessageAsDeleted(messageId: string, userId?: string) {
  const set = getDeletedMessageIds(userId);
  set.add(messageId);
  const arr = Array.from(set);
  try {
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_MSG_PREFIX}${safeUserKey(userId)}`, JSON.stringify(arr));
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_MSG_PREFIX}${FALLBACK_KEY}`, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function getDeletedConversationIds(userId?: string): Set<string> {
  const set = new Set<string>();
  const keys = [safeUserKey(userId)];
  if (userId && userId !== FALLBACK_KEY) keys.push(FALLBACK_KEY);
  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_DELETED_CONV_PREFIX}${k}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach((id) => set.add(id));
      }
    } catch {
      // ignore
    }
  });
  return set;
}

export function markConversationAsDeleted(conversationId: string, userId?: string) {
  const set = getDeletedConversationIds(userId);
  set.add(conversationId);
  const arr = Array.from(set);
  try {
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_CONV_PREFIX}${safeUserKey(userId)}`, JSON.stringify(arr));
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_CONV_PREFIX}${FALLBACK_KEY}`, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/* ---------- Conversations & messages ---------- */
export async function fetchMyConversations() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.id) return [];

  const deletedConvs = getDeletedConversationIds(user.id);
  const deletedMsgs = getDeletedMessageIds(user.id);

  let rawList: any[];
  const { data, error } = await sb
    .from("conversations")
    .select("*, members:conversation_members!inner(user_id, last_read_at), messages(*)")
    .eq("members.user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback sans join inner si besoin, tout en filtrant rigoureusement côté client
    const { data: fallbackData, error: fbErr } = await sb
      .from("conversations")
      .select("*, members:conversation_members(user_id, last_read_at), messages(*)")
      .order("created_at", { ascending: false });
    if (fbErr) throw fbErr;
    rawList = (fallbackData || []).filter((c: any) =>
      c.members?.some((m: any) => m.user_id === user.id) ||
      c.messages?.some((m: any) => m.sender_id === user.id)
    );
  } else {
    rawList = data || [];
  }

  return rawList
    .filter((c: any) => !deletedConvs.has(c.id))
    .map((c: any) => ({
      ...c,
      messages: (c.messages || []).filter((m: any) => !deletedMsgs.has(m.id)),
    }))
    .filter((c: any) => c.messages.length > 0);
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
  markConversationAsDeleted(conversationId, userId);
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("delete_conversation", {
      p_conversation_id: conversationId,
      p_user_id: userId || null,
    });
    if (!error && (data?.success || data?.ok)) return data;
  } catch { /* fallback */ }

  try {
    await sb.from("conversations").delete().eq("id", conversationId);
  } catch { /* silence */ }
  return { success: true };
}

export async function deleteMessage(messageId: string, userId?: string) {
  markMessageAsDeleted(messageId, userId);
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("delete_message", {
      p_message_id: messageId,
      p_user_id: userId || null,
    });
    if (!error && (data?.success || data?.ok)) return data;
  } catch { /* fallback */ }

  try {
    await sb.from("messages").delete().eq("id", messageId);
  } catch { /* silence */ }
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

export async function fetchMessagingRecipients() {
  const sb = getSupabase();
  try {
    const { data, error } = await sb.rpc("get_messaging_recipients");
    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    /* fallback to direct select */
  }
  try {
    const { data } = await sb.from("profiles").select("id, name, username, email, role, active").eq("active", true);
    return data || [];
  } catch {
    return [];
  }
}

