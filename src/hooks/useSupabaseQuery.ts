/**
 * Hook générique Supabase — unifie loading/error/refresh.
 * Remplace les 8 hooks quasi-identiques (useStudents, useFormations, useAudit...).
 */
import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSupabaseQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  fallbackMessage = "Supabase non configuré"
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError(fallbackMessage);
      return;
    }
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
