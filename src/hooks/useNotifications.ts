import { useCallback, useEffect, useState } from "react";
import { fetchNotifications, markNotificationRead } from "@/lib/supabase/communication";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase non configuré");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { notifications, loading, error, refresh, markRead };
}
