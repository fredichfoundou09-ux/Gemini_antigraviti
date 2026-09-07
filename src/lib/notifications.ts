/**
 * Module centralisé et persistant de gestion des notifications par utilisateur.
 * Garantit que l'état "lu" et "supprimé" persiste en base de données (notification_reads)
 * et en miroir local (localStorage) afin que le badge rouge disparaisse instantanément
 * et ne réapparaisse JAMAIS après actualisation ou reconnexion.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Notification } from "@/lib/types";

const LOCAL_STORAGE_READ_PREFIX = "sn_notif_reads_v3_";
const LOCAL_STORAGE_DELETED_PREFIX = "sn_notif_deleted_v3_";
const FALLBACK_KEY = "global_session";

function safeKey(userId?: string): string {
  return userId && userId.trim() ? userId.trim() : FALLBACK_KEY;
}

/**
 * Récupère le Set d'identifiants de notifications supprimées pour un utilisateur
 */
export function getDeletedNotificationIds(userId?: string): Set<string> {
  const set = new Set<string>();
  const keys = [safeKey(userId)];
  if (userId && userId !== FALLBACK_KEY) keys.push(FALLBACK_KEY);

  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_DELETED_PREFIX}${k}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => set.add(id));
        }
      }
    } catch {
      // ignore
    }
  });

  return set;
}

/**
 * Sauvegarde le Set d'identifiants supprimés dans le localStorage
 */
function saveDeletedNotificationIds(userId: string, ids: Set<string>) {
  try {
    const arr = Array.from(ids);
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_PREFIX}${safeKey(userId)}`, JSON.stringify(arr));
    localStorage.setItem(`${LOCAL_STORAGE_DELETED_PREFIX}${FALLBACK_KEY}`, JSON.stringify(arr));
  } catch (err) {
    console.warn("Échec écriture localStorage notifications supprimées:", err);
  }
}

/**
 * Récupère le Set d'identifiants de notifications lues pour un utilisateur
 */
export function getReadNotificationIds(userId?: string): Set<string> {
  const set = new Set<string>();
  const keys = [safeKey(userId)];
  if (userId && userId !== FALLBACK_KEY) keys.push(FALLBACK_KEY);

  keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_READ_PREFIX}${k}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => set.add(id));
        }
      }
    } catch {
      // ignore
    }
  });

  return set;
}

/**
 * Sauvegarde le Set d'identifiants lus dans le localStorage de l'utilisateur
 */
function saveReadNotificationIds(userId: string, ids: Set<string>) {
  try {
    const arr = Array.from(ids);
    localStorage.setItem(`${LOCAL_STORAGE_READ_PREFIX}${safeKey(userId)}`, JSON.stringify(arr));
    localStorage.setItem(`${LOCAL_STORAGE_READ_PREFIX}${FALLBACK_KEY}`, JSON.stringify(arr));
  } catch (err) {
    console.warn("Échec écriture localStorage notifications lues:", err);
  }
}

/**
 * Détermine si une notification est considérée comme supprimée
 */
export function isNotificationDeleted(notificationId: string, userId?: string): boolean {
  if (!notificationId) return false;
  return getDeletedNotificationIds(userId).has(notificationId);
}

/**
 * Détermine si une notification est considérée comme lue pour un utilisateur donné
 */
export function isNotificationRead(notif: Notification, userId?: string): boolean {
  if (!notif) return true;
  if (isNotificationDeleted(notif.id, userId)) return true;
  if (!userId) return !!notif.lu;
  const readSet = getReadNotificationIds(userId);
  return notif.lu || readSet.has(notif.id);
}

/**
 * Calcule le nombre exact de notifications non lues pour l'utilisateur
 */
export function getUnreadNotificationCount(notifications: Notification[], userId?: string): number {
  if (!Array.isArray(notifications) || notifications.length === 0) return 0;
  const readSet = getReadNotificationIds(userId);
  const deletedSet = getDeletedNotificationIds(userId);

  return notifications.filter((n) => {
    if (!n || !n.id) return false;
    if (deletedSet.has(n.id)) return false;
    const isForMe = !userId || n.toId === userId || n.toId === "all";
    if (!isForMe) return false;
    if (n.lu) return false;
    return !readSet.has(n.id);
  }).length;
}

/**
 * Marque une notification spécifique comme lue
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  if (!notificationId) return;
  const uKey = safeKey(userId);

  // 1. Sauvegarde immédiate en miroir local synchrone
  const readSet = getReadNotificationIds(uKey);
  readSet.add(notificationId);
  saveReadNotificationIds(uKey, readSet);

  // Événement pour mise à jour synchrone de l'UI
  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId: uKey, notificationId } }));

  // 2. Persistance dans Supabase
  if (isSupabaseConfigured) {
    try {
      if (userId && userId.length > 20) {
        await supabase
          .from("notification_reads")
          .upsert({ user_id: userId, notification_id: notificationId, read_at: new Date().toISOString() }, { onConflict: "user_id,notification_id" });
      }
      // Mise à jour de la table notifications si attribuée directement
      await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
    } catch {
      // ignore
    }
  }
}

/**
 * Marque toutes les notifications destinées à l'utilisateur comme lues
 */
export async function markAllNotificationsAsRead(notifications: Notification[], userId: string): Promise<void> {
  if (!Array.isArray(notifications) || notifications.length === 0) return;
  const uKey = safeKey(userId);

  const userNotifs = notifications.filter((n) => !userId || n.toId === userId || n.toId === "all");
  const notifIds = userNotifs.map((n) => n.id);

  // 1. Mise à jour immédiate locale synchrone
  const readSet = getReadNotificationIds(uKey);
  notifIds.forEach((id) => readSet.add(id));
  saveReadNotificationIds(uKey, readSet);

  // Notifier l'UI immédiatement
  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId: uKey } }));

  // 2. Persistance groupée dans Supabase
  if (isSupabaseConfigured && notifIds.length > 0) {
    try {
      if (userId && userId.length > 20) {
        const records = notifIds.map((id) => ({
          user_id: userId,
          notification_id: id,
          read_at: new Date().toISOString(),
        }));
        await supabase
          .from("notification_reads")
          .upsert(records, { onConflict: "user_id,notification_id" });
      }
      // Mise à jour globale pour l'utilisateur
      if (userId) {
        await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Supprime une notification pour l'utilisateur
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<void> {
  if (!notificationId) return;
  const uKey = safeKey(userId);

  // 1. Marquer comme supprimée et comme lue en miroir local synchrone
  const deletedSet = getDeletedNotificationIds(uKey);
  deletedSet.add(notificationId);
  saveDeletedNotificationIds(uKey, deletedSet);

  const readSet = getReadNotificationIds(uKey);
  readSet.add(notificationId);
  saveReadNotificationIds(uKey, readSet);

  // Événement pour mise à jour synchrone de l'UI
  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId: uKey, notificationId, deleted: true } }));

  // 2. Tentative de suppression en base Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
    } catch {
      // ignore
    }
  }
}

/**
 * Supprime toutes les notifications actuelles de l'utilisateur
 */
export async function deleteAllNotifications(notifications: Notification[], userId: string): Promise<void> {
  if (!Array.isArray(notifications) || notifications.length === 0) return;
  const uKey = safeKey(userId);

  const deletedSet = getDeletedNotificationIds(uKey);
  const readSet = getReadNotificationIds(uKey);

  notifications.forEach((n) => {
    deletedSet.add(n.id);
    readSet.add(n.id);
  });

  saveDeletedNotificationIds(uKey, deletedSet);
  saveReadNotificationIds(uKey, readSet);

  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId: uKey, allDeleted: true } }));

  if (isSupabaseConfigured && userId) {
    try {
      await supabase.from("notifications").delete().eq("user_id", userId);
    } catch {
      // ignore
    }
  }
}

/**
 * Synchronise les notifications lues depuis Supabase vers le miroir local
 */
export async function syncNotificationReadsFromSupabase(userId: string): Promise<Set<string>> {
  const localSet = getReadNotificationIds(userId);
  if (!isSupabaseConfigured || !userId) return localSet;

  try {
    const { data, error } = await supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      data.forEach((row: { notification_id: string }) => {
        if (row.notification_id) localSet.add(row.notification_id);
      });
      saveReadNotificationIds(userId, localSet);
    }
  } catch {
    // ignore
  }
  return localSet;
}
