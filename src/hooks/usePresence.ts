import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";

export interface UserPresenceRecord {
  user_id: string;
  role: string;
  name: string;
  email: string | null;
  last_seen_at: string;
  is_online: boolean;
  user_agent?: string | null;
}

/**
 * Hook de suivi de présence en temps réel des utilisateurs.
 * - Heartbeat toutes les 45 secondes pour l'utilisateur connecté.
 * - Détection immédiate lors de la fermeture d'onglet/navigateur (beforeunload).
 * - Règle de validité : en ligne si is_online=true ET dernière activité < 90 secondes.
 * - Synchronisation en temps réel de la liste des présences pour les Superadmins et Admins.
 */
export function usePresence() {
  const { user } = useStore();
  const [presences, setPresences] = useState<UserPresenceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Envoi du heartbeat de présence
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;

    const sb = getSupabase();

    const sendHeartbeat = async (isOnline = true) => {
      try {
        await sb.rpc("update_user_heartbeat", {
          p_is_online: isOnline,
          p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
        });
      } catch {
        // Fallback upsert direct si la RPC est indisponible
        try {
          await sb.from("user_presence").upsert({
            user_id: user.id,
            role: user.role,
            name: user.name,
            email: user.email || null,
            last_seen_at: new Date().toISOString(),
            is_online: isOnline,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
            updated_at: new Date().toISOString(),
          });
        } catch { /* silence */ }
      }
    };

    // Heartbeat initial immédiat
    sendHeartbeat(true);

    // Heartbeat périodique (45 secondes)
    const interval = setInterval(() => {
      sendHeartbeat(true);
    }, 45000);

    // Détection de déconnexion / fermeture de la fenêtre
    const handleUnload = () => {
      sendHeartbeat(false);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      sendHeartbeat(false);
    };
  }, [user?.id, user?.role, user?.name, user?.email]);

  // 2. Chargement de la liste des présences pour l'administration
  const fetchPresences = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    if (user.role !== "superadmin" && user.role !== "admin") return;

    setLoading(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("user_presence")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (!error && data) {
        setPresences(data);
      }
    } catch { /* silence */ }
    finally {
      setLoading(false);
    }
  }, [user]);

  // Abonnement Realtime aux changements de présence
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    if (user.role !== "superadmin" && user.role !== "admin") return;

    fetchPresences();

    let channel: any = null;
    const sb = getSupabase();
    const channelName = `presence-monitor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      channel = sb
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_presence" },
          () => {
            fetchPresences();
          }
        );
      channel.subscribe();
    } catch (err) {
      console.warn("Realtime presence subscription warning:", err);
    }

    const polling = setInterval(fetchPresences, 30000);

    return () => {
      if (channel) {
        try {
          sb.removeChannel(channel);
        } catch { /* silence */ }
      }
      clearInterval(polling);
    };
  }, [user, fetchPresences]);

  return { presences, loading, refresh: fetchPresences };
}

/**
 * Évalue si un utilisateur est actuellement actif et en ligne (< 90 secondes).
 */
export function isUserActiveOnline(presence: UserPresenceRecord): boolean {
  if (!presence.is_online) return false;
  if (!presence.last_seen_at) return false;
  const lastSeen = new Date(presence.last_seen_at).getTime();
  const now = Date.now();
  const diffSeconds = (now - lastSeen) / 1000;
  return diffSeconds < 90;
}
