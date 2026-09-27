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
 * Décompresse un flux deflate brut via la standard DecompressionStream API.
 */
async function decompressDeflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    return bytes;
  }
  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const decompressedStream = stream.pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLength += value.length;
      }
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch {
    return bytes;
  }
}

/**
 * Extrait le texte d'un fichier Word (.docx) en inspectant son archive ZIP (word/document.xml).
 */
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Recherche des en-têtes de fichiers locaux ZIP (0x04034b50 = PK\x03\x04)
  let offset = 0;
  let xmlText = "";

  while (offset + 30 < bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }

    const compMethod = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const _uncompSize = view.getUint32(offset + 22, true);
    const fnLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const fnBytes = bytes.slice(offset + 30, offset + 30 + fnLen);
    const fileName = new TextDecoder().decode(fnBytes);
    const dataStart = offset + 30 + fnLen + extraLen;

    if (fileName === "word/document.xml" && dataStart + compSize <= bytes.length) {
      const entryBytes = bytes.slice(dataStart, dataStart + compSize);
      if (compMethod === 8) {
        const decompressed = await decompressDeflateRaw(entryBytes);
        xmlText = new TextDecoder("utf-8").decode(decompressed);
      } else if (compMethod === 0) {
        xmlText = new TextDecoder("utf-8").decode(entryBytes);
      }
      break;
    }

    offset = dataStart + (compSize > 0 ? compSize : 1);
  }

  if (xmlText) {
    // Remplacement des sauts de paragraphe Word par des retours à la ligne
    const withBreaks = xmlText.replace(/<\/w:p>/gi, "\n").replace(/<w:br[^>]*>/gi, "\n");
    // Extraction des textes dans les balises <w:t>
    const matches = withBreaks.match(/<w:t[^>]*>(.*?)<\/w:t>/gi);
    if (matches && matches.length > 0) {
      return matches
        .map((m) => m.replace(/<[^>]+>/g, ""))
        .join(" ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();
    }
    // Nettoyage générique de toutes les balises XML
    return withBreaks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

/**
 * Décode les chaînes textuelles d'un fichier PDF (flux décompressés ou bruts).
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const rawStr = new TextDecoder("latin1").decode(bytes);
  const textPieces: string[] = [];

  // 1. Recherche de blocs de flux /Filter /FlateDecode ... stream ... endstream
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawStr)) !== null) {
    const streamStart = match.index + match[0].indexOf("\n") + 1;
    const streamLen = match[1].length;
    const streamBytes = bytes.slice(streamStart, streamStart + streamLen);

    // Si zlib header présent (0x78 0x9c ou 0x78 0x01 ou 0x78 0xda), sauter les 2 octets pour deflate-raw
    const decodedBytes =
      streamBytes.length > 2 &&
      streamBytes[0] === 0x78 &&
      (streamBytes[1] === 0x9c || streamBytes[1] === 0x01 || streamBytes[1] === 0xda)
        ? await decompressDeflateRaw(streamBytes.slice(2))
        : await decompressDeflateRaw(streamBytes);

    const decodedStr = new TextDecoder("latin1").decode(decodedBytes);

    // Extraction des commandes de texte PDF : (texte) Tj ou [(t1) (t2)] TJ
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(decodedStr)) !== null) {
      if (tjMatch[1] && tjMatch[1].trim().length > 1) {
        textPieces.push(tjMatch[1]);
      }
    }

    const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = arrayTjRegex.exec(decodedStr)) !== null) {
      const innerTexts = arrayMatch[1].match(/\(([^)]+)\)/g);
      if (innerTexts) {
        const line = innerTexts.map((s) => s.slice(1, -1)).join("");
        if (line.trim().length > 1) textPieces.push(line);
      }
    }
  }

  // 2. Si du texte structuré a été extrait des flux PDF
  const combined = textPieces.join(" ").replace(/\\[nrtbf]/g, " ").trim();
  if (combined.length >= 40) {
    return combined;
  }

  // 3. Fallback : extraction robuste des chaînes lisibles UTF-8 / ASCII dans tout le document
  let asciiText = "";
  let cur = "";
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9 || (code >= 192 && code <= 255)) {
      cur += String.fromCharCode(code);
    } else {
      if (cur.length >= 4 && !cur.startsWith("/Font") && !cur.startsWith("/ProcSet") && !cur.includes("obj") && !cur.includes("endobj")) {
        asciiText += cur + " ";
      }
      cur = "";
    }
  }
  if (cur.length >= 4) asciiText += cur;

  return asciiText.trim();
}

/**
 * Extrait le texte d'un fichier (TXT, MD, CSV, JSON, DOCX, PDF ou image).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // 1. Fichiers texte direct
  if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    file.type.startsWith("text/")
  ) {
    const content = await file.text();
    if (content.trim()) return content;
  }

  const buffer = await file.arrayBuffer();

  // 2. Fichiers Word (.docx)
  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    try {
      const docxText = await extractTextFromDocx(buffer);
      if (docxText.length >= 20) return docxText;
    } catch (e) {
      console.warn("Échec parsing structuré DOCX, fallback:", e);
    }
  }

  // 3. Fichiers PDF
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      const pdfText = await extractTextFromPdf(buffer);
      if (pdfText.length >= 20) return pdfText;
    } catch (e) {
      console.warn("Échec parsing structuré PDF, fallback:", e);
    }
  }

  // 4. Images (PNG, JPG, WEBP, etc.)
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) {
    return `Document image indexé : ${file.name}. Taille : ${(file.size / 1024).toFixed(1)} Ko. Format : ${file.type || "image"}. Ce support visuel est enregistré dans la base de connaissances documentaire de Sentinelles Numériques.`;
  }

  // 5. Fallback universel lisible
  const bytes = new Uint8Array(buffer);
  let text = "";
  let currentString = "";

  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    if (
      (code >= 32 && code <= 126) ||
      code === 10 ||
      code === 13 ||
      code === 9 ||
      (code >= 192 && code <= 255)
    ) {
      currentString += String.fromCharCode(code);
    } else {
      if (currentString.length > 3) {
        text += currentString + "\n";
      }
      currentString = "";
    }
  }

  if (currentString.length > 3) {
    text += currentString;
  }

  const clean = text.trim();
  if (clean.length > 20) {
    return clean;
  }

  return `Document pédagogique : ${file.name}. Taille : ${(file.size / 1024).toFixed(1)} Ko. Type : ${file.type || "Document"}. Document indexé dans le corpus de connaissances de Sentinelles Numériques.`;
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
  const { cleanText, suspiciousPatterns: _suspiciousPatterns } = sanitizeExtractedText(rawText);
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
    if (!insErr) {
      // Enregistrement dans les documents officiels consultables
      try {
        await supabase.from("ai_knowledge_docs").insert({
          title: documentTitle,
          category: options?.category || "syllabus",
          content: cleanText.slice(0, 4000),
          is_official: true,
          hierarchy_level: 4,
          target_roles: ["superadmin", "admin", "teacher", "student", "partner", "partner_admin"],
        });
      } catch (docErr) {
        console.warn("Notice insertion ai_knowledge_docs:", docErr);
      }

      return {
        title: documentTitle,
        chunksCount: chunks.length,
        hash,
        version: nextVersion,
      };
    } else {
      console.warn("Supabase chunks insertion skipped (fallback local):", insErr.message);
    }
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

    db.ai_knowledge_docs = db.ai_knowledge_docs || [];
    db.ai_knowledge_docs.unshift({
      id: `doc-${Date.now()}`,
      title: documentTitle,
      category: options?.category || "syllabus",
      content: cleanText.slice(0, 4000),
      is_official: true,
      created_at: new Date().toISOString(),
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
