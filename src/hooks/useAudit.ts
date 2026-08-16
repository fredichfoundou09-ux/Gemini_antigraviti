import { useCallback, useEffect, useState } from "react";
import { listAuditLogs } from "@/lib/supabase/audit";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useAudit(limit = 100) {
  const [logs, setLogs] = useState<any[]>([]);
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
      const data = await listAuditLogs(limit);
      setLogs(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement du journal d'audit");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, error, refresh };
}
