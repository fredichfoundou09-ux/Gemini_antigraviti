import { useCallback, useEffect, useState } from "react";
import { listStudents, getStudentById } from "@/lib/supabase/students";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function useStudents() {
  const [students, setStudents] = useState<any[]>([]);
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
      const data = await listStudents();
      setStudents(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur de chargement des apprenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { students, loading, error, refresh, getStudentById };
}
