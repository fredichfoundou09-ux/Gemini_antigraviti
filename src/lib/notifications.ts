/**
 * Module centralisé et persistant de gestion des notifications par utilisateur.
 * Garantit que l'état "lu" persiste en base de données (notification_reads)
 * et en miroir local (localStorage) afin que le badge rouge ne réapparaisse
 * JAMAIS après actualisation ou reconnexion (Points 49-53 du plan v2.1).
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Notification } from "@/lib/types";

const LOCAL_STORAGE_PREFIX = "sn_notif_reads_v2_";

/**
 * Récupère le Set d'identifiants de notifications lues pour un utilisateur
 */
export function getReadNotificationIds(userId?: string): Set<string> {
  if (!userId) return new Set<string>();
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

/**
 * Sauvegarde le Set d'identifiants dans le localStorage de l'utilisateur
 */
function saveReadNotificationIds(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(Array.from(ids)));
  } catch (err) {
    console.warn("Échec écriture localStorage notifications lues:", err);
  }
}

/**
 * Détermine si une notification est considérée comme lue pour un utilisateur donné
 */
export function isNotificationRead(notif: Notification, userId?: string): boolean {
  if (!userId) return !!notif.lu;
  const readSet = getReadNotificationIds(userId);
  return notif.lu || readSet.has(notif.id);
}

/**
 * Calcule le nombre exact de notifications non lues pour l'utilisateur
 */
export function getUnreadNotificationCount(notifications: Notification[], userId?: string): number {
  if (!userId || !Array.isArray(notifications)) return 0;
  const readSet = getReadNotificationIds(userId);
  return notifications.filter((n) => {
    const isForMe = n.toId === userId || n.toId === "all";
    if (!isForMe) return false;
    if (n.lu) return false;
    return !readSet.has(n.id);
  }).length;
}

/**
 * Marque une notification spécifique comme lue
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
  if (!userId || !notificationId) return;

  // 1. Sauvegarde immédiate en miroir local
  const readSet = getReadNotificationIds(userId);
  readSet.add(notificationId);
  saveReadNotificationIds(userId, readSet);

  // Événement pour mise à jour synchrone de l'UI
  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId, notificationId } }));

  // 2. Persistance dans Supabase (table notification_reads)
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from("notification_reads")
        .upsert({ user_id: userId, notification_id: notificationId, read_at: new Date().toISOString() }, { onConflict: "user_id,notification_id" });
    } catch (err) {
      console.warn("Échec persistance Supabase notification_reads:", err);
    }
  }
}

/**
 * Marque toutes les notifications destinées à l'utilisateur comme lues
 */
export async function markAllNotificationsAsRead(notifications: Notification[], userId: string): Promise<void> {
  if (!userId || !Array.isArray(notifications)) return;

  const userNotifs = notifications.filter((n) => n.toId === userId || n.toId === "all");
  const notifIds = userNotifs.map((n) => n.id);

  // 1. Mise à jour immédiate locale
  const readSet = getReadNotificationIds(userId);
  notifIds.forEach((id) => readSet.add(id));
  saveReadNotificationIds(userId, readSet);

  // Notifier l'UI
  window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId } }));

  // 2. Persistance groupée dans Supabase
  if (isSupabaseConfigured && notifIds.length > 0) {
    try {
      const records = notifIds.map((id) => ({
        user_id: userId,
        notification_id: id,
        read_at: new Date().toISOString(),
      }));
      await supabase
        .from("notification_reads")
        .upsert(records, { onConflict: "user_id,notification_id" });
    } catch (err) {
      console.warn("Échec persistance groupée Supabase notification_reads:", err);
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
  } catch (err) {
    console.warn("Erreur synchronisation notification_reads distants:", err);
  }
  return localSet;
}
