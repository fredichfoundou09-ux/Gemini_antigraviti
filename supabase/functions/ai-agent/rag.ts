import { UserContext } from "./auth.ts";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  sourceType: "official_document" | "course_chunk" | "faq" | "rule";
  version?: number;
  similarityScore?: number;
}

/**
 * Moteur RAG étendu : interroge la base de connaissances organisationnelle,
 * les fragments de cours (chunks dédupliqués) et les documents de référence.
 */
export async function searchKnowledgeBase(
  user: UserContext,
  query: string,
  category?: string
): Promise<KnowledgeItem[]> {
  // Préférer sbAdmin pour accéder aux fragments et aux documents sans restriction RLS ou récursion
  const sb = user.sbAdmin || user.sbUser;

  // Détection d'un nom de fichier spécifique cité dans la requête (ex: OpenSSL_Cours_TP.pdf)
  const fileMatch = query.match(/[\w.-]+\.(pdf|docx|txt|csv|json|md)/i);
  const targetDocName = fileMatch ? fileMatch[0] : null;

  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëîïôöùûüç\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const results: KnowledgeItem[] = [];

  // 1. Recherche dans les fragments de documents & cours (ai_document_chunks)
  try {
    let chunkQuery = sb
      .from("ai_document_chunks")
      .select("id, document_title, content, version, chunk_index, metadata")
      .eq("active", true);

    if (targetDocName) {
      chunkQuery = chunkQuery
        .ilike("document_title", `%${targetDocName}%`)
        .order("chunk_index", { ascending: true })
        .limit(14);
    } else if (terms.length > 0) {
      chunkQuery = chunkQuery
        .or(`document_title.ilike.%${terms[0]}%,content.ilike.%${terms[0]}%`)
        .limit(10);
    } else {
      chunkQuery = chunkQuery.limit(8);
    }

    const { data: chunks, error: chunkErr } = await chunkQuery;
    if (chunkErr) {
      console.warn("Erreur query ai_document_chunks :", chunkErr);
    }

    if (chunks && chunks.length > 0) {
      for (const ch of chunks) {
        const text = `${ch.document_title} ${ch.content}`.toLowerCase();
        let matchCount = 0;
        for (const t of terms) {
          if (text.includes(t)) matchCount++;
        }
        if (targetDocName || terms.length === 0 || matchCount > 0) {
          results.push({
            id: ch.id,
            title: ch.document_title,
            content: ch.content,
            category: "course_chunk",
            sourceType: "course_chunk",
            version: ch.version,
            similarityScore: targetDocName ? 10 + matchCount * 2 : matchCount * 1.5,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Recherche chunks documentaires :", err);
  }

  // 2. Recherche dans les documents fondateurs (ai_knowledge_docs)
  try {
    let dbQuery = sb
      .from("ai_knowledge_docs")
      .select("id, title, content, category")
      .limit(6);

    if (category) {
      dbQuery = dbQuery.eq("category", category);
    }

    const { data: docs } = await dbQuery;
    if (docs && docs.length > 0) {
      for (const doc of docs) {
        const text = `${doc.title} ${doc.content}`.toLowerCase();
        let matchCount = 0;
        for (const t of terms) {
          if (text.includes(t)) matchCount++;
        }
        if (terms.length === 0 || matchCount > 0) {
          results.push({
            id: doc.id,
            title: doc.title,
            content: doc.content.slice(0, 800),
            category: doc.category,
            sourceType: doc.category === "rules" ? "rule" : "faq",
            version: 1,
            similarityScore: matchCount,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Recherche knowledge docs :", err);
  }

  // 3. Recherche dans la table courses si besoin
  try {
    if (terms.length > 0) {
      const { data: courses } = await sb
        .from("courses")
        .select("id, titre, description, content, type")
        .eq("publie", true)
        .ilike("titre", `%${terms[0]}%`)
        .limit(3);

      if (courses) {
        for (const c of courses) {
          results.push({
            id: c.id,
            title: `[Support / ${c.type}] ${c.titre}`,
            content: `${c.description || ""} - ${c.content || ""}`.trim().slice(0, 500),
            category: "course",
            sourceType: "official_document",
            version: 1,
            similarityScore: 1,
          });
        }
      }
    }
  } catch {
    // ignore RLS restriction on courses
  }

  return results
    .sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0))
    .slice(0, 4);
}
