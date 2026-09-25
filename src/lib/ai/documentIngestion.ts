import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export interface IngestedDocumentResult {
  title: string;
  chunksCount: number;
  hash: string;
  version: number;
}

/**
 * Calcule l'empreinte SHA-256 d'un texte ou ArrayBuffer pour dédupliquer les documents.
 */
export async function computeSha256(input: ArrayBuffer | string): Promise<string> {
  const buffer = typeof input === "string" ? new TextEncoder().encode(input).buffer : input;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /ignore toutes les instructions précédentes/i,
  /disregard system (prompt|rules)/i,
  /bypass (all )?(security|permissions)/i,
  /you are now (an admin|unrestricted|DAN)/i,
  /tu es maintenant (un administrateur|sans limites)/i,
  /oublie tes règles/i,
  /system:\s*role/i,
];

/**
 * Analyse et neutralise les tentatives de prompt injection présentes dans un document.
 * Conserve la donnée brute en neutralisant le pouvoir impératif de l'instruction.
 */
export function sanitizeExtractedText(raw: string): { cleanText: string; suspiciousPatterns: string[] } {
  const suspicious: string[] = [];
  let sanitized = raw;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      suspicious.push(pattern.source);
      sanitized = sanitized.replace(pattern, (match) => `[TENTATIVE D'INJECTION NEUTRALISÉE DANS DOCUMENT: "${match}"]`);
    }
  }

  return { cleanText: sanitized, suspiciousPatterns: suspicious };
}

/**
 * Découpe un texte en fragments (chunks) cohérents avec un léger chevauchement (overlap).
 */
export function chunkText(text: string, chunkSize = 750, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= chunkSize) {
    return [clean];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = start + chunkSize;

    if (end < clean.length) {
      // Éviter de couper au milieu d'un mot ou d'une phrase
      const nextBreak = clean.lastIndexOf("\n", end);
      const nextPeriod = clean.lastIndexOf(". ", end);
      const splitPoint = Math.max(nextBreak, nextPeriod);

      if (splitPoint > start + chunkSize * 0.5) {
        end = splitPoint + 1;
      }
    } else {
      end = clean.length;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    if (end >= clean.length) {
      break;
    }

    // Assurer une progression stricte pour éliminer tout risque de boucle infinie
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}


/**
 * Extrait le texte d'un fichier (TXT, MD, CSV, JSON ou binaire textuel).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // Fichiers texte direct
  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    file.type.startsWith("text/")
  ) {
    return await file.text();
  }

  // Pour d'autres formats (ex: PDF ou Word sans parser lourd côté client) :
  // extraction des chaînes textuelles ASCII/UTF-8 lisibles
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = "";
  let currentString = "";

  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    // Caractères imprimables et espaces/sauts de ligne
    if (
      (code >= 32 && code <= 126) ||
      code === 10 ||
      code === 13 ||
      code === 9 ||
      (code >= 192 && code <= 255)
    ) {
      currentString += String.fromCharCode(code);
    } else {
      if (currentString.length > 5) {
        text += currentString + "\n";
      }
      currentString = "";
    }
  }

  if (currentString.length > 5) {
    text += currentString;
  }

  if (text.trim().length < 50) {
    throw new Error(
      `Impossible d'extraire suffisamment de texte du document ${file.name}. Privilégiez les formats .txt, .md, .csv ou documents structurés.`
    );
  }

  return text;
}

/**
 * Ingestion complète d'un document dans le système RAG de SENTINEL'S AI.
 */
export async function ingestDocumentForRag(
  file: File,
  options?: { title?: string; category?: string }
): Promise<IngestedDocumentResult> {
  const buffer = await file.arrayBuffer();
  const hash = await computeSha256(buffer);
  const rawText = await extractTextFromFile(file);
  const { cleanText, suspiciousPatterns } = sanitizeExtractedText(rawText);
  const chunks = chunkText(cleanText);

  const documentTitle = options?.title || file.name;

  if (isSupabaseConfigured) {
    // Vérifier si ce hash existe déjà
    const { data: existing } = await supabase
      .from("ai_document_chunks")
      .select("id, version")
      .eq("hash", hash)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        title: documentTitle,
        chunksCount: 0,
        hash,
        version: existing[0].version || 1,
      };
    }

    // Récupérer la version max pour ce titre
    const { data: prevDocs } = await supabase
      .from("ai_document_chunks")
      .select("version")
      .eq("document_title", documentTitle)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = prevDocs && prevDocs.length > 0 ? (prevDocs[0].version || 1) + 1 : 1;

    // Archiver les anciennes versions
    if (nextVersion > 1) {
      await supabase
        .from("ai_document_chunks")
        .update({ active: false })
        .eq("document_title", documentTitle);
    }

    // Insérer les nouveaux fragments
    const rows = chunks.map((content, idx) => ({
      document_title: documentTitle,
      chunk_index: idx,
      content,
      hash,
      version: nextVersion,
      active: true,
      metadata: {
        fileSize: file.size,
        mimeType: file.type,
        ingestedAt: new Date().toISOString(),
      },
    }));

    const { error: insErr } = await supabase.from("ai_document_chunks").insert(rows);
    if (insErr) throw insErr;

    return {
      title: documentTitle,
      chunksCount: chunks.length,
      hash,
      version: nextVersion,
    };
  }

  // Stockage local de secours
  try {
    const raw = localStorage.getItem("sn_db_v2");
    const db = raw ? JSON.parse(raw) : {};
    db.ai_document_chunks = db.ai_document_chunks || [];
    chunks.forEach((content, idx) => {
      db.ai_document_chunks.push({
        id: `chunk-${Date.now()}-${idx}`,
        document_title: documentTitle,
        content,
        hash,
        version: 1,
        active: true,
      });
    });
    localStorage.setItem("sn_db_v2", JSON.stringify(db));
  } catch (e) {
    console.warn("Échec stockage local du chunk :", e);
  }

  return {
    title: documentTitle,
    chunksCount: chunks.length,
    hash,
    version: 1,
  };
}
