import { CourseFile } from "./types";
import { supabase, isSupabaseConfigured } from "./supabase/client";

// Types MIME autorisés pour les supports pédagogiques.
export const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
]);

export const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|gif|txt|csv)$/i;

export const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo — protège le quota localStorage

export function safeFileName(name: string): string {
  const base = (name || "fichier")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80);
  return base || "fichier";
}

export function humanSize(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

export interface FileValidation {
  ok: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidation {
  if (!file) return { ok: false, error: "Aucun fichier." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: `Fichier trop volumineux (max ${humanSize(MAX_FILE_SIZE)}).` };
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (!ALLOWED_EXT.test(file.name)) return { ok: false, error: "Extension non autorisée." };
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: `Type MIME non autorisé (${file.type}).` };
  }
  return { ok: true };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function ingestFile(file: File): Promise<CourseFile> {
  const check = validateFile(file);
  if (!check.ok) throw new Error(check.error);

  const safeName = safeFileName(file.name);
  const fileId = `F-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let finalUrl = "";

  if (isSupabaseConfigured) {
    try {
      const ext = (file.name || "bin").split(".").pop() || "bin";
      const storagePath = `courses/${Date.now()}-${fileId}.${ext}`;
      const { data, error } = await supabase.storage.from("course-files").upload(storagePath, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (!error && data?.path) {
        const { data: pubData } = supabase.storage.from("course-files").getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          finalUrl = pubData.publicUrl;
        } else {
          const { data: signed } = await supabase.storage.from("course-files").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) {
            finalUrl = signed.signedUrl;
          }
        }
      }
    } catch (e) {
      console.warn("Storage upload fallback:", e);
    }
  }

  // Si pas d'URL distante ou si stockage hors-ligne, lire en dataUrl Base64 complet
  // Ainsi le fichier original et son contenu binaire exact sont 100% préservés
  if (!finalUrl) {
    finalUrl = await readFileAsDataUrl(file);
  }

  return {
    id: fileId,
    name: safeName,
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: finalUrl,
    uploadedAt: new Date().toISOString(),
  };
}

export function fileKind(mime: string, name?: string): string {
  const n = (name || "").toLowerCase();
  if (mime === "application/pdf" || n.endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || /\.docx?$/.test(n)) return "Word";
  if (mime.includes("excel") || mime.includes("spreadsheet") || /\.xlsx?$/.test(n)) return "Excel";
  if (mime.includes("presentation") || /\.pptx?$/.test(n)) return "PowerPoint";
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("text/")) return "Texte";
  return "Fichier";
}

/** Déclenche le téléchargement d'un fichier (CourseFile ou équivalent) dans son format et contenu d'origine (PDF, Word, Excel, etc.). */
export async function downloadFile(f: CourseFile | { name?: string; originalName?: string; nom?: string; mime?: string; type?: string; size?: number; taille?: number; dataUrl?: string; url?: string; storage_key?: string }) {
  if (!f) return;
  const fileName = f.originalName || f.name || (f as any).nom || "document";
  const fileUrl = f.dataUrl || (f as any).url || (f as any).storage_key || (f as any).storageKey || "";

  if (!fileUrl) {
    console.warn("downloadFile: aucune URL ou donnée pour le fichier", f);
    return;
  }

  // 1. Data URL (Base64) : reconstruction d'un Blob binaire natif pour garantir le format et le contenu exacts
  if (fileUrl.startsWith("data:")) {
    try {
      const parts = fileUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : (f.mime || (f as any).type || "application/octet-stream");
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    } catch (e) {
      console.warn("downloadFile data-url parse error, fallback href direct:", e);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }

  // 2. Blob URL direct
  if (fileUrl.startsWith("blob:")) {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 3. Clé de stockage relative Supabase (ex: 'courses/123.pdf' ou 'course-files/courses/...')
  if (isSupabaseConfigured && !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
    try {
      const cleanPath = fileUrl.replace(/^course-files\//, "");
      const { data, error } = await supabase.storage.from("course-files").download(cleanPath);
      if (!error && data) {
        const blobUrl = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }
    } catch (e) {
      console.warn("downloadFile: fallback direct Supabase Storage", e);
    }
  }

  // 4. URL HTTP/HTTPS (Supabase Storage public/signed URL ou URL distante)
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    try {
      const res = await fetch(fileUrl, { mode: "cors" });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }
    } catch {
      // Si CORS bloque le fetch, téléchargement direct via ancre
    }

    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 5. Fallback par défaut
  const a = document.createElement("a");
  a.href = fileUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

