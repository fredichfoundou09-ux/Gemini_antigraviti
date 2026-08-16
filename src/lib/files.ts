import { CourseFile } from "./types";

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
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: `F-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: safeFileName(file.name),
    originalName: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    dataUrl,
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

/** Déclenche le téléchargement d'un CourseFile depuis un dataURL. */
export function downloadFile(f: CourseFile) {
  const a = document.createElement("a");
  a.href = f.dataUrl;
  a.download = f.originalName || f.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
