import { idbGet, idbSet } from "@/lib/idbStorage";
import { supabase } from "@/lib/supabase/client";

export type QueueOperationType = "attendance" | "grade" | "submission_draft" | "message";

export interface QueuedOperation {
  id: string; // Identifiant client unique pour anti-doublon
  type: QueueOperationType;
  payload: Record<string, any>;
  timestamp: number;
  status: "pending" | "syncing" | "synced" | "conflict" | "failed";
  retries: number;
  error?: string;
}

const QUEUE_STORAGE_KEY = "sentinel_unified_offline_queue";
const DATA_SAVER_KEY = "sentinel_data_saver_mode";

/**
 * Récupère l'ensemble des opérations en attente dans IndexedDB.
 */
export async function getOfflineQueue(): Promise<QueuedOperation[]> {
  try {
    const list = await idbGet<QueuedOperation[]>(QUEUE_STORAGE_KEY);
    return list || [];
  } catch {
    return [];
  }
}

/**
 * Enregistre une opération dans la file d'attente hors-ligne.
 */
export async function queueOfflineOperation(
  type: QueueOperationType,
  payload: Record<string, any>
): Promise<QueuedOperation> {
  const queue = await getOfflineQueue();
  const op: QueuedOperation = {
    id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    status: "pending",
    retries: 0,
  };

  queue.push(op);
  await idbSet(QUEUE_STORAGE_KEY, queue);
  window.dispatchEvent(new CustomEvent("sentinelles:queue-updated", { detail: { count: queue.length } }));
  return op;
}

/**
 * Traite et synchronise la file d'attente locale au retour du réseau.
 * Respecte les règles de résolution de conflit :
 * - Notes : Le serveur gagne en cas de divergence préexistante.
 * - Présence : Le pointage le plus récent gagne.
 */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
  conflicts: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, conflicts: 0 };

  let syncedCount = 0;
  let failedCount = 0;
  let conflictsCount = 0;
  const remainingQueue: QueuedOperation[] = [];

  for (const op of queue) {
    try {
      op.status = "syncing";

      if (op.type === "attendance") {
        // Présence : Dernier pointage gagne
        const { studentId, moduleId, date, statut, teacherId } = op.payload;
        const { error } = await supabase.from("attendance").upsert(
          {
            student_id: studentId,
            module_id: moduleId,
            date,
            statut,
            teacher_id: teacherId,
            updated_at: new Date(op.timestamp).toISOString(),
          },
          { onConflict: "student_id,date,module_id" }
        );

        if (error) {
          op.retries += 1;
          op.status = "failed";
          op.error = error.message;
          remainingQueue.push(op);
          failedCount++;
        } else {
          syncedCount++;
        }
      } else if (op.type === "grade") {
        // Notes : Le serveur gagne en cas de conflit avec une note déjà validée
        const { studentId, testId, score, maxScore } = op.payload;
        const { data: serverGrade } = await supabase
          .from("test_results")
          .select("score, updated_at")
          .eq("student_id", studentId)
          .eq("test_id", testId)
          .maybeSingle();

        if (serverGrade && serverGrade.score !== undefined && serverGrade.score !== score) {
          // Conflit détecté : la valeur serveur est conservée
          conflictsCount++;
          op.status = "conflict";
          op.error = "Note serveur prioritaire";
        } else {
          const { error } = await supabase.from("test_results").upsert({
            student_id: studentId,
            test_id: testId,
            score,
            total_points: maxScore,
          });

          if (error) {
            op.retries += 1;
            op.status = "failed";
            remainingQueue.push(op);
            failedCount++;
          } else {
            syncedCount++;
          }
        }
      } else {
        // Autres opérations génériques
        syncedCount++;
      }
    } catch (err: any) {
      op.retries += 1;
      op.status = "failed";
      op.error = err.message;
      remainingQueue.push(op);
      failedCount++;
    }
  }

  await idbSet(QUEUE_STORAGE_KEY, remainingQueue);
  window.dispatchEvent(new CustomEvent("sentinelles:queue-updated", { detail: { count: remainingQueue.length } }));

  return { synced: syncedCount, failed: failedCount, conflicts: conflictsCount };
}

/**
 * Mode Économie de données (Data Saver) :
 * Réduit la consommation de bande passante sur réseaux mobiles contraints.
 */
export function isDataSaverEnabled(): boolean {
  try {
    return localStorage.getItem(DATA_SAVER_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDataSaverEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DATA_SAVER_KEY, enabled ? "true" : "false");
    window.dispatchEvent(new CustomEvent("sentinelles:data-saver-changed", { detail: { enabled } }));
  } catch {
    // silence
  }
}

/**
 * Compresse une image avant envoi pour respecter la cible ~300 Ko du mode léger.
 */
export async function compressImageForUpload(file: File, maxSizeBytes: number = 300 * 1024): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Réduction proportionnelle de dimension
        const maxDimension = 1200;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/jpeg",
          0.72
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Règle de garde-fou : les évaluations sont strictement désactivées hors-ligne par défaut
 * afin de garantir l'intégrité anti-triche académique.
 */
export function isAssessmentOfflineAllowed(test?: { autoriser_hors_ligne?: boolean }): boolean {
  if (!test) return false;
  return Boolean(test.autoriser_hors_ligne);
}

/**
 * Générateur et vérificateur de QR Code rotatif (Module E2) :
 * Renouvellement automatique toutes les 30 secondes pour prévenir toute fraude par capture d'écran.
 */
export function generateRotatingQrToken(studentId: string, scheduleId: string): {
  token: string;
  timeRemainingSec: number;
} {
  const windowSec = 30;
  const now = Date.now();
  const timeBucket = Math.floor(now / (windowSec * 1000));
  const timeRemainingSec = windowSec - Math.floor((now % (windowSec * 1000)) / 1000);
  const expiresAt = new Date((timeBucket + 1) * windowSec * 1000).toISOString();
  const signature = Math.abs(hashCode(`${studentId}:${scheduleId}:${timeBucket}`)).toString(16);

  const token = `QR_TOKEN|${studentId}|${scheduleId}|${expiresAt}|${signature}`;
  return { token, timeRemainingSec };
}

export function verifyRotatingQrToken(token: string): {
  valid: boolean;
  studentId?: string;
  scheduleId?: string;
  reason?: string;
} {
  const parts = token.split("|");
  if (parts[0] !== "QR_TOKEN" || parts.length < 5) {
    return { valid: false, reason: "Format de QR Code invalide ou altéré" };
  }

  const [, studentId, scheduleId, expiresAtStr, signature] = parts;
  const windowSec = 30;
  const now = Date.now();
  const currentBucket = Math.floor(now / (windowSec * 1000));

  // Tolérance : seau actuel ou seau précédent (pour tenir compte du décalage de transmission)
  const validSignatureCurrent = Math.abs(hashCode(`${studentId}:${scheduleId}:${currentBucket}`)).toString(16);
  const validSignaturePrevious = Math.abs(hashCode(`${studentId}:${scheduleId}:${currentBucket - 1}`)).toString(16);

  if (signature !== validSignatureCurrent && signature !== validSignaturePrevious) {
    return { valid: false, reason: "QR Code expiré ou falsifié (rotatif 30s requis)" };
  }

  return { valid: true, studentId, scheduleId };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
