import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { createNotification } from "@/lib/supabase/communication";
import { sendNativeNotification, playNotificationChime } from "@/lib/pushNotifications";

export const SUBMISSIONS_UPDATED_EVENT = "sn:submissions-updated";

/** Déclenche une synchronisation instantanée inter-composants et multi-onglets */
export function broadcastSubmissionsChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT));
  }
}

/**
 * Souscrit aux changements en direct (Temps Réel Supabase + Événements locaux)
 * pour les devoirs, évaluations, remises et résultats.
 */
export function subscribeToAssessmentsSync(onSync: () => void): { unsubscribe: () => void } {
  let timer: any = null;

  const debouncedSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onSync();
    }, 300);
  };

  // 1. Écouteur local rapide
  if (typeof window !== "undefined") {
    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, debouncedSync);
  }

  // 2. Écouteur Supabase Realtime
  let channel: any = null;
  if (isSupabaseConfigured) {
    const channelName = `realtime-assessments-${Math.random().toString(36).slice(2, 8)}`;
    channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "assignment_submissions" }, () => debouncedSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "test_results" }, () => debouncedSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "assignments" }, () => debouncedSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "tests" }, () => debouncedSync())
      .subscribe();
  }

  return {
    unsubscribe: () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, debouncedSync);
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
      if (timer) clearTimeout(timer);
    },
  };
}

export interface NotifyAssessmentParams {
  targetUserId: string;
  title: string;
  body: string;
  type?: string;
  url?: string;
  storeNotify?: (toId: string, title: string, body: string, type?: string) => void;
}

/** Envoie une notification multi-canaux (Store, Supabase DB, Push native & Carillon) */
export async function notifyAssessmentEvent({
  targetUserId,
  title,
  body,
  type = "info",
  url = "/app/evaluations-devoirs",
  storeNotify,
}: NotifyAssessmentParams): Promise<void> {
  // 1. Mise à jour du store local
  if (storeNotify) {
    try {
      storeNotify(targetUserId, title, body, type);
    } catch (e) {
      console.warn("Erreur storeNotify:", e);
    }
  }

  // 2. Persistance dans la base Supabase
  if (isSupabaseConfigured) {
    try {
      await createNotification({
        user_id: targetUserId === "all" ? null : targetUserId,
        title,
        body,
        type,
      });
    } catch (e) {
      console.warn("Erreur persistance createNotification:", e);
    }
  }

  // 3. Notification système native & carillon
  try {
    playNotificationChime();
    await sendNativeNotification({
      title,
      body,
      url,
      tag: `assessment-${Date.now()}`,
    });
  } catch {
    // ignore
  }

  // 4. Événement UI
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sn:notifications-changed", { detail: { userId: targetUserId } }));
  }
}
