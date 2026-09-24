import { UserContext } from "./auth.ts";

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  similarityScore?: number;
}

/** Recherche dans la base de connaissances documentaire (RAG) */
export async function searchKnowledgeBase(
  user: UserContext,
  query: string,
  category?: string
): Promise<KnowledgeItem[]> {
  const sb = user.sbUser;
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëîïôöùûüç\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // 1. Recherche dans ai_knowledge_docs
  let dbQuery = sb
    .from("ai_knowledge_docs")
    .select("id, title, content, category")
    .limit(5);

  if (category) {
    dbQuery = dbQuery.eq("category", category);
  }

  const { data: docs, error } = await dbQuery;
  if (error) {
    console.warn("Erreur requête ai_knowledge_docs :", error);
  }

  const results: KnowledgeItem[] = [];

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
          similarityScore: matchCount,
        });
      }
    }
  }

  // 2. Recherche complémentaire dans les cours publiés accessibles
  try {
    let coursesQuery = sb
      .from("courses")
      .select("id, titre, description, content, type")
      .eq("publie", true)
      .limit(3);

    if (terms.length > 0) {
      coursesQuery = coursesQuery.ilike("titre", `%${terms[0]}%`);
    }

    const { data: courses } = await coursesQuery;
    if (courses && courses.length > 0) {
      for (const c of courses) {
        results.push({
          id: c.id,
          title: `[Cours / ${c.type}] ${c.titre}`,
          content: `${c.description || ""} ${c.content || ""}`.trim().slice(0, 600),
          category: "course",
          similarityScore: 1,
        });
      }
    }
  } catch {
    // Si table courses restreinte par RLS, on continue
  }

  return results.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0)).slice(0, 4);
}
