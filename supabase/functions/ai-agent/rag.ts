import { UserContext } from "./auth.ts";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  sourceType: "official_document" | "course_chunk" | "faq" | "rule";
  version?: number;
  similarityScore?: number;
  page?: number | string;
  section?: string;
}

/**
 * Moteur RAG hybride avancé :
 * 1. Recherche plein-texte multi-termes pondérée (PostgreSQL tsquery / RPC)
 * 2. Fallback robuste par mots-clés multiples (sans s'arrêter au 1er mot)
 * 3. Traçabilité des sources avec titre, section et page
 */
export async function searchKnowledgeBase(
  user: UserContext,
  query: string,
  category?: string
): Promise<KnowledgeItem[]> {
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

  // 1. Recherche par RPC multi-termes PostgreSQL si disponible
  let rpcSuccess = false;
  if (!targetDocName && terms.length > 0) {
    try {
      const { data: rpcChunks, error: rpcErr } = await sb.rpc("search_document_chunks_multiterm", {
        search_terms: terms,
        match_count: 10,
        filter_roles: [user.role],
      });

      if (!rpcErr && rpcChunks && rpcChunks.length > 0) {
        rpcSuccess = true;
        for (const ch of rpcChunks) {
          const meta = ch.metadata || {};
          results.push({
            id: ch.id,
            title: ch.document_title,
            content: ch.content,
            category: "course_chunk",
            sourceType: "course_chunk",
            similarityScore: Number(ch.rank || 1) * 2,
            page: meta.page || (meta.chunk_index !== undefined ? meta.chunk_index + 1 : undefined),
            section: meta.section,
          });
        }
      }
    } catch {
      rpcSuccess = false;
    }
  }

  // 2. Recherche standard / fallback dans les fragments documentaires (ai_document_chunks)
  if (!rpcSuccess) {
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
        // Multi-mots clés : combine les termes pertinents (jusqu'à 4)
        const orConditions = terms
          .slice(0, 4)
          .map((t) => `document_title.ilike.%${t}%,content.ilike.%${t}%`)
          .join(",");
        chunkQuery = chunkQuery.or(orConditions).limit(12);
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
            const meta = ch.metadata || {};
            results.push({
              id: ch.id,
              title: ch.document_title,
              content: ch.content,
              category: "course_chunk",
              sourceType: "course_chunk",
              version: ch.version,
              similarityScore: targetDocName ? 10 + matchCount * 2 : matchCount * 1.5,
              page: meta.page || (ch.chunk_index !== undefined ? ch.chunk_index + 1 : undefined),
              section: meta.section,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Recherche chunks documentaires :", err);
    }
  }

  // 3. Recherche dans les documents fondateurs (ai_knowledge_docs)
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

  // 4. Recherche dans les cours officiels publiés (courses)
  try {
    if (terms.length > 0) {
      const orFilter = terms.slice(0, 3).map((t) => `titre.ilike.%${t}%`).join(",");
      const { data: courses } = await sb
        .from("courses")
        .select("id, titre, description, content, type")
        .eq("publie", true)
        .or(orFilter)
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
    .slice(0, 5);
}
