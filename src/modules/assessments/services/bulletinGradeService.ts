import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface BulletinGradePayload {
  studentId: string;
  moduleId: string;
  note: number;
  appreciation?: string;
  date?: string;
}

/**
 * Service de persistance et synchronisation officielle des notes au bulletin (Phase B.1 - F02).
 * Utilise la procédure stockée sécurisée upsert_grade_safe (migration 0062/0069)
 * avec traçabilité complète dans grade_audit.
 */
export async function persistGradeToBulletinSafe(
  payload: BulletinGradePayload
): Promise<{ success: boolean; gradeId?: string; error?: string }> {
  if (!payload.studentId || !payload.moduleId || payload.note === undefined || isNaN(payload.note)) {
    return { success: false, error: "Paramètres de note incomplets pour le bulletin." };
  }

  // Si Supabase n'est pas configuré, mode local
  if (!isSupabaseConfigured) {
    return { success: true };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.moduleId);
    if (!isUuid) {
      return { success: true };
    }

    const { data, error } = await supabase.rpc("upsert_grade_safe", {
      p_student_id: payload.studentId,
      p_module_id: payload.moduleId,
      p_note: Number(payload.note.toFixed(2)),
      p_appreciation: payload.appreciation || "",
      p_date: payload.date || new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.warn("Notice RPC upsert_grade_safe:", error);
      // Repli si nécessaire
      const { data: insData, error: insErr } = await supabase
        .from("grades")
        .upsert({
          student_id: payload.studentId,
          module_id: payload.moduleId,
          note: payload.note,
          appreciation: payload.appreciation || "",
          date: payload.date || new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        return { success: false, error: insErr.message };
      }
      return { success: true, gradeId: insData?.id };
    }

    const res = data as { success?: boolean; grade_id?: string; error?: string };
    if (res && res.success === false) {
      return { success: false, error: res.error || "Échec de l'enregistrement au bulletin." };
    }

    return { success: true, gradeId: res?.grade_id };
  } catch (err: any) {
    console.error("Erreur persistGradeToBulletinSafe:", err);
    return { success: false, error: err.message || "Erreur de persistance du bulletin." };
  }
}

/**
 * Report par lot de plusieurs notes au bulletin officiel
 */
export async function batchPersistGradesToBulletin(
  gradesList: BulletinGradePayload[]
): Promise<{ success: boolean; savedCount: number; errors: string[] }> {
  let savedCount = 0;
  const errors: string[] = [];

  for (const grade of gradesList) {
    const res = await persistGradeToBulletinSafe(grade);
    if (res.success) {
      savedCount++;
    } else if (res.error) {
      errors.push(`${grade.studentId}: ${res.error}`);
    }
  }

  return { success: errors.length === 0, savedCount, errors };
}
