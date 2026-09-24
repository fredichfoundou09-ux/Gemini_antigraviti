import { UserContext } from "./auth.ts";

export interface MemoryRecord {
  id: string;
  scope: "user" | "course" | "organization" | "role";
  type: "fact" | "preference" | "instruction" | "summary" | "learning_context";
  content: string;
  confidence: number;
}

/**
 * Récupère les mémoires actives pertinentes pour cet utilisateur et son rôle.
 */
export async function getRelevantMemories(user: UserContext): Promise<MemoryRecord[]> {
  const sb = user.sbUser;
  const memories: MemoryRecord[] = [];

  try {
    const { data, error } = await sb
      .from("ai_memories")
      .select("id, scope, type, content, confidence")
      .or(`user_id.eq.${user.userId},scope.eq.organization,target_role.eq.${user.role}`)
      .order("updated_at", { ascending: false })
      .limit(6);

    if (!error && data) {
      memories.push(...data);
    }
  } catch (err) {
    console.warn("Échec récupération des mémoires :", err);
  }

  return memories;
}

/**
 * Détecte si le message de l'utilisateur contient une information mémorisable
 * (ex: "Je préfère les explications synthétiques", "Rappelle-toi que...", "Mon niveau est débutant")
 */
export async function captureCandidateMemory(user: UserContext, text: string): Promise<void> {
  const lower = text.toLowerCase();
  const sb = user.sbUser;

  let memoryType: MemoryRecord["type"] | null = null;
  let extractedContent: string | null = null;

  if (lower.includes("je préfère") || lower.includes("ma préférence")) {
    memoryType = "preference";
    extractedContent = text.trim();
  } else if (lower.includes("rappelle-toi que") || lower.includes("retiens que") || lower.includes("note que")) {
    memoryType = "fact";
    extractedContent = text.replace(/^(rappelle-toi que|retiens que|note que)\s*/i, "").trim();
  } else if (lower.includes("mon niveau est") || lower.includes("je suis débutant") || lower.includes("je suis avancé")) {
    memoryType = "learning_context";
    extractedContent = text.trim();
  }

  if (memoryType && extractedContent) {
    try {
      await sb.from("ai_memories").insert({
        user_id: user.userId,
        scope: "user",
        type: memoryType,
        content: extractedContent,
        source: "conversation_auto",
        confidence: 0.9,
      });
    } catch (e) {
      console.warn("Échec enregistrement mémoire candidate :", e);
    }
  }
}

/**
 * Formate les mémoires pertinentes sous forme de bloc de contexte clair.
 */
export function formatMemoryContext(memories: MemoryRecord[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => `- [${m.type}] ${m.content}`);
  return `\nMémoire contextuelle persistante de l'utilisateur et de l'organisation :\n${lines.join("\n")}\n`;
}
