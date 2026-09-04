import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

export interface SyncMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/**
 * Hook de synchronisation silencieuse d'arrière-plan (Background Auto-Refresh).
 * - Rafraîchit les données critiques (messages, présences, notifications) toutes les 4 secondes.
 * - Aucune coupure ni rechargement brutal de la page : synchronisation réactive transparente.
 * - Détecte l'arrivée de nouveaux messages, émet un signal sonore cyber et affiche une notification en haut
 *   avec le nom de l'expéditeur et son statut/rôle.
 * - Calcule et maintient en temps réel le badge compteur de messages non lus (1, 2, 3...).
 */
export function useBackgroundSync() {
  const { user, db, setDb } = useStore();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Mémorise les IDs de messages déjà traités pour éviter les doublons de notification
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const profilesMapRef = useRef<Map<string, { name: string; role: string }>>(new Map());

  // Met à jour la table de correspondance des profils pour afficher nom et statut
  useEffect(() => {
    if (db.users && db.users.length > 0) {
      db.users.forEach((u) => {
        profilesMapRef.current.set(u.id, { name: u.name || u.username, role: u.role });
      });
    }
  }, [db.users]);

  // Fonction de synchronisation silencieuse des messages et conversations
  const syncMessagesSilently = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) return;

    try {
      const sb = getSupabase();

      // 1. Récupérer les profils si non chargés
      if (profilesMapRef.current.size <= 1) {
        const { data: profs } = await sb.from("profiles").select("id, name, username, role");
        if (profs) {
          profs.forEach((p: any) => {
            profilesMapRef.current.set(p.id, { name: p.name || p.username, role: p.role });
          });
        }
      }

      // 2. Récupérer les conversations où l'utilisateur est membre avec leur date de dernière lecture
      const { data: memberships, error: mErr } = await sb
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (mErr || !memberships || memberships.length === 0) {
        setUnreadCount(0);
        return;
      }

      const convIds = memberships.map((m: any) => m.conversation_id);
      const lastReadMap = new Map<string, string>();
      memberships.forEach((m: any) => {
        lastReadMap.set(m.conversation_id, m.last_read_at || "1970-01-01T00:00:00Z");
      });

      // 3. Récupérer les messages récents de ces conversations
      const { data: messages, error: msgErr } = await sb
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (msgErr || !messages) return;

      let unread = 0;
      const incomingToNotify: SyncMessage[] = [];

      messages.forEach((msg: SyncMessage) => {
        const isFromMe = msg.sender_id === user.id;
        const lastRead = lastReadMap.get(msg.conversation_id) || "1970-01-01T00:00:00Z";
        const isUnread = !isFromMe && new Date(msg.created_at) > new Date(lastRead);

        if (isUnread) {
          unread++;
          // Détection d'un nouveau message qui n'a pas encore été notifié
          if (!isInitialLoadRef.current && !seenMessageIdsRef.current.has(msg.id)) {
            incomingToNotify.push(msg);
          }
        }

        seenMessageIdsRef.current.add(msg.id);
      });

      // Mettre à jour le compteur de messages non lus
      setUnreadCount(unread);

      // Déclencher les notifications Toast pour chaque nouveau message entrant
      if (incomingToNotify.length > 0) {
        incomingToNotify.forEach((newMsg) => {
          const senderInfo = profilesMapRef.current.get(newMsg.sender_id);
          const senderName = senderInfo?.name || "Un utilisateur";
          const senderRole = senderInfo?.role;

          toastMsg.incomingMessage({
            senderName,
            senderRole,
            body: newMsg.body,
          });
        });
      }

      // Synchroniser db.messages dans le store local pour cohérence globale
      setDb((prev) => {
        const mappedRemote = messages.map((m: SyncMessage) => {
          const senderInfo = profilesMapRef.current.get(m.sender_id);
          const lastRead = lastReadMap.get(m.conversation_id) || "1970-01-01T00:00:00Z";
          const isLu = m.sender_id === user.id || new Date(m.created_at) <= new Date(lastRead);
          return {
            id: m.id,
            fromId: m.sender_id,
            fromName: senderInfo?.name || "Utilisateur",
            toId: user.id,
            subject: "Discussion",
            body: m.body,
            date: m.created_at ? new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "",
            lu: isLu,
          };
        });

        // Fusionne sans doublon
        const existingIds = new Set(mappedRemote.map((r) => r.id));
        const filteredLocals = (prev.messages || []).filter((l) => !existingIds.has(l.id));

        return {
          ...prev,
          messages: [...mappedRemote, ...filteredLocals],
        };
      });

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.warn("Silent sync warning:", err);
    }
  }, [user?.id, setDb]);

  // Boucle de rafraîchissement d'arrière-plan toutes les 4 secondes (4000ms)
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;

    // Premier chargement immédiat
    syncMessagesSilently();

    // Timer périodique silencieux
    const interval = setInterval(() => {
      syncMessagesSilently();
      // Notifie les autres composants pour un rafraîchissement doux
      window.dispatchEvent(new CustomEvent("sentinelles:supabase-refresh"));
    }, 4000);

    // Écouteur Realtime Supabase pour réaction instantanée dès l'insertion d'un message
    const sb = getSupabase();
    const channelName = `bg-sync-${user.id}-${Date.now().toString(36)}`;
    let channel: any = null;

    try {
      channel = sb
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          () => {
            syncMessagesSilently();
          }
        )
        .subscribe();
    } catch { /* ignore realtime fallback to polling */ }

    return () => {
      clearInterval(interval);
      if (channel) {
        try { sb.removeChannel(channel); } catch { /* silence */ }
      }
    };
  }, [user?.id, syncMessagesSilently]);

  // Marquer une conversation comme lue
  const markConversationAsRead = useCallback(async (convId: string) => {
    if (!isSupabaseConfigured || !user?.id) return;
    try {
      const sb = getSupabase();
      await sb.rpc("mark_conversation_as_read", { p_conversation_id: convId });
      // Re-sync immédiat pour recalculer le badge
      await syncMessagesSilently();
    } catch (e) {
      console.warn("markConversationAsRead error:", e);
    }
  }, [user?.id, syncMessagesSilently]);

  return {
    unreadCount,
    syncMessagesSilently,
    markConversationAsRead,
  };
}
