import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Assignment, AssignmentSubmission, AssignmentValidationDiagnostic } from "../types";
import { safeFileName } from "@/lib/files";

const ASSIGNMENTS_STORAGE_KEY = "sentinels_assignments_cache_v1";
const SUBMISSIONS_STORAGE_KEY = "sentinels_assignment_submissions_cache_v1";

// 1. Validation rigoureuse avant publication (Exigence #6)
export function validateAssignmentForPublication(assignment: Assignment): AssignmentValidationDiagnostic {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!assignment.titre?.trim()) {
    errors.push("Le titre du devoir est obligatoire.");
  }

  if (!assignment.moduleId?.trim()) {
    errors.push("Le module associé est obligatoire.");
  }

  if (!assignment.teacherId?.trim()) {
    errors.push("Le formateur responsable est obligatoire.");
  }

  if (!assignment.consignes?.trim()) {
    errors.push("Les consignes détaillées sont obligatoires avant publication.");
  }

  if (!assignment.dateLimite) {
    errors.push("La date limite de remise est obligatoire.");
  } else {
    const deadlineStr = `${assignment.dateLimite}T${assignment.heureLimite || "23:59"}:00`;
    const deadlineTime = new Date(deadlineStr).getTime();
    if (isNaN(deadlineTime)) {
      errors.push("La date ou l'heure limite renseignée est invalide.");
    } else if (deadlineTime < Date.now()) {
      warnings.push("Attention : La date limite est déjà dans le passé.");
    }
  }

  if (assignment.dateOuverture && assignment.dateLimite) {
    const startStr = `${assignment.dateOuverture}T00:00:00`;
    const endStr = `${assignment.dateLimite}T${assignment.heureLimite || "23:59"}:00`;
    if (new Date(startStr).getTime() > new Date(endStr).getTime()) {
      errors.push("La date d'ouverture doit être antérieure à la date limite.");
    }
  }

  if (assignment.bareme <= 0) {
    errors.push("Le barème de notation doit être strictement supérieur à 0 point.");
  }

  if (assignment.seuilReussite < 0 || assignment.seuilReussite > assignment.bareme) {
    errors.push(`Le seuil de réussite doit être compris entre 0 et le barème (${assignment.bareme} pts).`);
  }

  if (assignment.nbFichiersMax <= 0) {
    errors.push("Le nombre maximal de fichiers autorisés doit être d'au moins 1.");
  }

  if (assignment.tailleMaxMo <= 0) {
    errors.push("La taille maximale autorisée par fichier doit être d'au moins 1 Mo.");
  }

  if (!assignment.formatsAutorises || assignment.formatsAutorises.length === 0) {
    errors.push("Au moins un format de fichier doit être sélectionné.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// 2. Calcul du statut d'échéance et temps restant
export interface DeadlineInfo {
  isOverdue: boolean;
  minutesRemaining: number;
  formattedRemaining: string;
  badgeColor: "green" | "gold" | "red" | "cyan";
  deadlineIso: string;
}

export function getDeadlineInfo(assignment: Assignment, refDate = new Date()): DeadlineInfo {
  const timeStr = assignment.heureLimite || "23:59";
  const deadlineDate = new Date(`${assignment.dateLimite}T${timeStr}:00`);
  const diffMs = deadlineDate.getTime() - refDate.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  const isOverdue = diffMinutes < 0;

  let formattedRemaining = "";
  let badgeColor: "green" | "gold" | "red" | "cyan" = "green";

  if (isOverdue) {
    const absMin = Math.abs(diffMinutes);
    const absHours = Math.floor(absMin / 60);
    const absDays = Math.floor(absHours / 24);
    if (absDays > 0) {
      formattedRemaining = `Échu depuis ${absDays} j`;
    } else if (absHours > 0) {
      formattedRemaining = `Échu depuis ${absHours} h`;
    } else {
      formattedRemaining = `Échu depuis ${absMin} min`;
    }
    badgeColor = "red";
  } else {
    const hours = Math.floor(diffMinutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 2) {
      formattedRemaining = `${days} jours restants`;
      badgeColor = "green";
    } else if (days > 0) {
      formattedRemaining = `${days}j ${hours % 24}h restantes`;
      badgeColor = "cyan";
    } else if (hours > 0) {
      formattedRemaining = `${hours}h ${diffMinutes % 60}m restantes`;
      badgeColor = "gold";
    } else {
      formattedRemaining = `${diffMinutes} minutes restantes`;
      badgeColor = "red";
    }
  }

  return {
    isOverdue,
    minutesRemaining: diffMinutes,
    formattedRemaining,
    badgeColor,
    deadlineIso: deadlineDate.toISOString(),
  };
}

// 3. Sauvegarde locale de secours (Offline resilience)
export function getLocalAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAssignments(assignments: Assignment[]) {
  try {
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  } catch (e) {
    console.warn("Erreur sauvegarde locale devoirs:", e);
  }
}

export function getLocalSubmissions(): AssignmentSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSubmissions(submissions: AssignmentSubmission[]) {
  try {
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.warn("Erreur sauvegarde locale remises:", e);
  }
}

// 4. Téléversement de fichier vers Supabase Storage
export async function uploadSubmissionFileToStorage(
  file: File,
  assignmentId: string,
  studentId: string
): Promise<{ fileUrl: string; storagePath: string }> {
  if (!isSupabaseConfigured) {
    // Mode dégradé : DataURL Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ fileUrl: String(reader.result), storagePath: "local/fallback" });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const safe = safeFileName(file.name);
  const ext = safe.split(".").pop() || "bin";
  const storagePath = `assignments/${assignmentId}/${studentId}/${Date.now()}-${safe}`;

  const { data, error } = await supabase.storage.from("submission-files").upload(storagePath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    console.error("Erreur upload Storage Supabase:", error);
    // Fallback dataURL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ fileUrl: String(reader.result), storagePath });
      reader.readAsDataURL(file);
    });
  }

  const { data: pubData } = supabase.storage.from("submission-files").getPublicUrl(storagePath);
  return {
    fileUrl: pubData.publicUrl || storagePath,
    storagePath: data?.path || storagePath,
  };
}

// 5. Téléversement des pièces jointes du formateur
export async function uploadAssignmentAttachmentToStorage(
  file: File,
  assignmentId: string
): Promise<{ fileUrl: string; storagePath: string }> {
  if (!isSupabaseConfigured) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ fileUrl: String(reader.result), storagePath: "local/attachment" });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const safe = safeFileName(file.name);
  const storagePath = `assignments/attachments/${assignmentId}/${Date.now()}-${safe}`;

  const { data, error } = await supabase.storage.from("course-files").upload(storagePath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ fileUrl: String(reader.result), storagePath });
      reader.readAsDataURL(file);
    });
  }

  const { data: pubData } = supabase.storage.from("course-files").getPublicUrl(storagePath);
  return {
    fileUrl: pubData.publicUrl || storagePath,
    storagePath: data?.path || storagePath,
  };
}

// 6. Persistance d'un devoir sur Supabase
export async function persistAssignmentToSupabase(assignment: Assignment): Promise<{ success: boolean; id: string; error?: string }> {
  if (!isSupabaseConfigured) {
    const list = getLocalAssignments();
    const idx = list.findIndex((a) => a.id === assignment.id);
    if (idx >= 0) list[idx] = assignment;
    else list.unshift(assignment);
    saveLocalAssignments(list);
    return { success: true, id: assignment.id };
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignment.id);

    const timeStr = assignment.heureLimite || "23:59";
    const deadlineIso = `${assignment.dateLimite}T${timeStr}:00Z`;

    const payload: Record<string, any> = {
      titre: assignment.titre,
      description: assignment.description || null,
      consignes: assignment.consignes,
      formation: assignment.formation || null,
      module_id: assignment.moduleId,
      chapitre_id: assignment.chapitreId || null,
      teacher_id: assignment.teacherId,
      date_limite: deadlineIso,
      heure_limite: assignment.heureLimite || "23:59",
      duree_estimee_minutes: assignment.dureeEstimeeMinutes || null,
      nb_fichiers_max: assignment.nbFichiersMax,
      taille_max_mo: assignment.tailleMaxMo,
      formats_autorises: assignment.formatsAutorises,
      bareme: assignment.bareme,
      seuil_reussite: assignment.seuilReussite,
      statut: assignment.statut,
      audience: assignment.audience,
      target_groupe: assignment.targetGroupe || null,
      target_student_ids: assignment.targetStudentIds || null,
      autoriser_remise_tardive: assignment.autoriserRemiseTardive,
      tentatives_max: assignment.tentativesMax,
      correction_visible_immediatement: assignment.correctionVisibleImmediatement,
    };

    if (assignment.statut === "publie" && !assignment.datePublication) {
      payload.date_publication = new Date().toISOString();
    }

    let savedId = assignment.id;

    if (isUuid) {
      payload.id = assignment.id;
      const { data, error } = await supabase.from("assignments").upsert(payload).select("id").single();
      if (error) throw error;
      if (data?.id) savedId = data.id;
    } else {
      const { data, error } = await supabase.from("assignments").insert(payload).select("id").single();
      if (error) throw error;
      if (data?.id) savedId = data.id;
    }

    // Pièces jointes
    if (assignment.attachments && assignment.attachments.length > 0) {
      const attachRows = assignment.attachments.map((att) => ({
        assignment_id: savedId,
        file_name: att.fileName,
        original_name: att.originalName,
        file_url: att.fileUrl,
        mime: att.mime,
        size: att.size,
        storage_path: att.storagePath || null,
      }));
      await supabase.from("assignment_attachments").delete().eq("assignment_id", savedId);
      await supabase.from("assignment_attachments").insert(attachRows);
    }

    return { success: true, id: savedId };
  } catch (err: any) {
    console.error("Erreur persistance devoir Supabase:", err);
    return { success: false, id: assignment.id, error: err.message || "Erreur base de données" };
  }
}

// 7. Envoi d'une remise d'apprenant (submitAssignmentWork)
export async function submitAssignmentWork(
  assignmentId: string,
  texte: string | undefined,
  filesPayload: Array<{
    fileName: string;
    originalName: string;
    fileUrl: string;
    mime: string;
    size: number;
    storagePath?: string;
  }>,
  studentId: string,
  isOverdue = false
): Promise<{ success: boolean; submissionId?: string; version?: number; error?: string }> {
  if (!isSupabaseConfigured) {
    // Mode dégradé local
    const localSubs = getLocalSubmissions();
    const existing = localSubs.filter((s) => s.assignmentId === assignmentId && s.studentId === studentId);
    const newVersion = existing.length + 1;
    const newSub: AssignmentSubmission = {
      id: `SUB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      assignmentId,
      studentId,
      version: newVersion,
      texte,
      statut: isOverdue ? "en_retard" : "remis",
      dateRemise: new Date().toISOString(),
      publie: true,
      files: filesPayload.map((f, idx) => ({
        id: `FILE-${idx + 1}-${Date.now().toString(36)}`,
        fileName: f.fileName,
        originalName: f.originalName,
        fileUrl: f.fileUrl,
        mime: f.mime,
        size: f.size,
        storagePath: f.storagePath,
      })),
    };
    localSubs.unshift(newSub);
    saveLocalSubmissions(localSubs);
    return { success: true, submissionId: newSub.id, version: newVersion };
  }

  try {
    // Appel de la RPC sécurisée
    const { data, error } = await supabase.rpc("submit_assignment_work", {
      p_assignment_id: assignmentId,
      p_texte: texte || null,
      p_files: filesPayload,
    });

    if (error) {
      console.warn("Échec RPC submit_assignment_work, tentative insert direct:", error);
      // Fallback insert direct si RPC non dispo
      const { data: subData, error: subError } = await supabase.from("assignment_submissions").insert({
        assignment_id: assignmentId,
        student_id: studentId,
        texte,
        statut: isOverdue ? "en_retard" : "remis",
        date_remise: new Date().toISOString(),
      }).select("id, version").single();

      if (subError) throw subError;

      if (filesPayload.length > 0 && subData?.id) {
        const fileRows = filesPayload.map((f) => ({
          submission_id: subData.id,
          file_name: f.fileName,
          original_name: f.originalName,
          file_url: f.fileUrl,
          mime: f.mime,
          size: f.size,
          storage_path: f.storagePath || null,
        }));
        await supabase.from("assignment_submission_files").insert(fileRows);
      }

      return { success: true, submissionId: subData?.id, version: subData?.version || 1 };
    }

    if (data && !data.success) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      submissionId: data?.submissionId,
      version: data?.version,
    };
  } catch (err: any) {
    console.error("Erreur soumission devoir:", err);
    return { success: false, error: err.message || "Erreur de connexion au serveur" };
  }
}

// 8. Notation et correction d'une remise
export async function gradeAssignmentSubmission(
  submissionId: string,
  note: number,
  bareme: number,
  appreciation?: string,
  pointsForts?: string,
  pointsAmelioration?: string,
  publier = true
): Promise<{ success: boolean; error?: string }> {
  if (note < 0 || note > bareme) {
    return { success: false, error: `La note doit être comprise entre 0 et ${bareme} pts.` };
  }

  if (!isSupabaseConfigured) {
    const list = getLocalSubmissions();
    const idx = list.findIndex((s) => s.id === submissionId);
    if (idx >= 0) {
      list[idx].note = note;
      list[idx].appreciation = appreciation;
      list[idx].pointsForts = pointsForts;
      list[idx].pointsAmelioration = pointsAmelioration;
      list[idx].statut = "corrige";
      list[idx].dateCorrection = new Date().toISOString();
      list[idx].publie = publier;
      saveLocalSubmissions(list);
    }
    return { success: true };
  }

  try {
    const { data, error } = await supabase.rpc("grade_assignment_submission", {
      p_submission_id: submissionId,
      p_note: note,
      p_appreciation: appreciation || null,
      p_points_forts: pointsForts || null,
      p_points_amelioration: pointsAmelioration || null,
      p_publier: publier,
    });

    if (error) {
      console.warn("Échec RPC grade_assignment_submission, update direct:", error);
      const { error: updErr } = await supabase.from("assignment_submissions").update({
        note,
        appreciation: appreciation || null,
        points_forts: pointsForts || null,
        points_amelioration: pointsAmelioration || null,
        statut: "corrige",
        date_correction: new Date().toISOString(),
        publie: publier,
      }).eq("id", submissionId);

      if (updErr) throw updErr;
      return { success: true };
    }

    if (data && !data.success) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Erreur notation devoir:", err);
    return { success: false, error: err.message || "Erreur de notation" };
  }
}
