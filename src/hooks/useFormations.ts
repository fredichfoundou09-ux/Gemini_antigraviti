import { useCallback, useEffect, useState } from "react";
import { listFormations, listModules } from "@/lib/supabase/formations";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useFormations() {
  const [formations, setFormations] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (formationCode?: string) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError("Supabase non configuré");
      return;
    }
    setLoading(true);
    try {
      const [f, m] = await Promise.all([listFormations(), listModules(formationCode)]);
      setFormations(f);
      setModules(m);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement formations/modules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { formations, modules, loading, error, refresh };
}
