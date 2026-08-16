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

export async function createConversation(subject: string, memberIds: string[]) {
  const sb = getSupabase();
  const { data: conv, error } = await sb.from("conversations").insert({ subject }).select("*").single();
  if (error) throw error;
  if (memberIds.length) {
    await sb.from("conversation_members").insert(memberIds.map((user_id) => ({ conversation_id: conv.id, user_id })));
  }
  return conv;
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
  return sb
    .channel(`messages-${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => onInsert(payload.new))
    .subscribe();
}

export function subscribeToNotifications(userId: string, onInsert: (n: any) => void) {
  const sb = getSupabase();
  return sb
    .channel(`notifications-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => onInsert(payload.new))
    .subscribe();
}
