import { useCallback, useEffect, useState } from "react";
import { getEniaBundle, updateEniaContent } from "@/lib/supabase/enia";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useEnia() {
  const [data, setData] = useState<any>(null);
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
      const bundle = await getEniaBundle();
      setData(bundle);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement ENIA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, updateEniaContent };
}
