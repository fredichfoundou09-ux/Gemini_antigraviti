import { useState, useCallback, useEffect } from "react";
import { AiChatMessage, AiPendingAction, AiConversationMeta } from "@/lib/ai/types";
import {
  askSentinelAiStream,
  confirmSentinelAiAction,
  sendSentinelAiFeedback,
} from "@/lib/ai/sentinelAiService";
import { supabase } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

const STORAGE_KEY = "sentinel_ai_chat_session";
const CONVERSATIONS_STORAGE_KEY = "sn_ai_conversations_v1";

function getLocalConversations(): AiConversationMeta[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalConversations(list: AiConversationMeta[]) {
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function useSentinelAi() {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [conversations, setConversations] = useState<AiConversationMeta[]>(() => getLocalConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<AiPendingAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sauvegarde automatique de la conversation active dans la session courante
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Erreur sauvegarde session IA :", e);
    }
  }, [messages]);

  // Chargement des conversations sauvegardées (Supabase ou Local)
  const loadConversations = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data, error: dbErr } = await supabase
          .from("ai_conversations")
          .select("id, title, created_at, updated_at")
          .order("updated_at", { ascending: false });

        if (!dbErr && data) {
          setConversations(data);
          saveLocalConversations(data);
          return;
        }
      }
    } catch (err) {
      console.warn("Erreur chargement distant des conversations :", err);
    }
    // Fallback local
    setConversations(getLocalConversations());
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sélectionner et charger une discussion passée
  const selectConversation = useCallback(async (convId: string) => {
    setActiveConversationId(convId);
    setLoading(true);
    setError(null);
    try {
      const { data: dbMessages, error: mErr } = await supabase
        .from("ai_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (!mErr && dbMessages && dbMessages.length > 0) {
        const mapped: AiChatMessage[] = dbMessages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.created_at,
        }));
        setMessages(mapped);
        return;
      }
    } catch (err) {
      console.warn("Erreur chargement messages conversation :", err);
    }

    // Fallback local
    const savedLocal = localStorage.getItem(`sn_conv_msg_${convId}`);
    if (savedLocal) {
      try {
        setMessages(JSON.parse(savedLocal));
      } catch {}
    }
    setLoading(false);
  }, []);

  // Supprimer une conversation
  const deleteConversation = useCallback(async (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase.from("ai_conversations").delete().eq("id", convId);
    } catch {}

    const updated = conversations.filter((c) => c.id !== convId);
    setConversations(updated);
    saveLocalConversations(updated);
    localStorage.removeItem(`sn_conv_msg_${convId}`);

    if (activeConversationId === convId) {
      setActiveConversationId(null);
      setMessages([]);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    toastMsg.info("Discussion supprimée");
  }, [conversations, activeConversationId]);

  // Démarrer une nouvelle discussion vierge
  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setPendingActions([]);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  // Exporter la discussion en fichier Markdown (.md)
  const exportToMarkdown = useCallback(() => {
    if (messages.length === 0) {
      toastMsg.warning("Aucun message à exporter.");
      return;
    }

    const title = conversations.find((c) => c.id === activeConversationId)?.title || "Discussion Sentinel AI";
    const dateStr = new Date().toISOString().slice(0, 10);

    let md = `# ${title}\n\n`;
    md += `*Exporté le : ${new Date().toLocaleString("fr-FR")}*\n\n---\n\n`;

    messages.forEach((m) => {
      const sender = m.role === "user" ? "Human" : m.role === "system" ? "System" : "Sentinel AI";
      const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      md += `### ${sender} ${time ? `(${time})` : ""}\n\n${m.content}\n\n`;

      if (m.sources && m.sources.length > 0) {
        md += `> **Sources** : ${m.sources.join(" • ")}\n\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel_ai_${dateStr}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastMsg.success("Discussion exportée au format Markdown (.md)");
  }, [messages, conversations, activeConversationId]);

  const send = useCallback(
    async (text: string) => {
      const query = text.trim();
      if (!query || loading) return;

      const userMsg: AiChatMessage = {
        role: "user",
        content: query,
        id: "msg-" + Date.now(),
        createdAt: new Date().toISOString(),
      };

      const assistantId = "msg-" + (Date.now() + 1);
      const assistantPlaceholder: AiChatMessage = {
        role: "assistant",
        content: "",
        id: assistantId,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMsg];
      setMessages([...updatedMessages, assistantPlaceholder]);
      setLoading(true);
      setError(null);

      // Création automatique de la conversation si première question
      let convId = activeConversationId;
      if (!convId) {
        const generatedTitle = query.slice(0, 42).replace(/[\r\n]+/g, " ");
        convId = "conv-" + Date.now();
        setActiveConversationId(convId);

        const newConv: AiConversationMeta = {
          id: convId,
          title: generatedTitle,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setConversations((prev) => [newConv, ...prev]);
        saveLocalConversations([newConv, ...conversations]);

        // Sauvegarde Supabase en arrière-plan
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.id) {
            supabase
              .from("ai_conversations")
              .insert({ id: convId, user_id: session.user.id, title: generatedTitle })
              .then(({ error: cErr }) => {
                if (cErr) console.warn("Erreur sauvegarde ai_conversations:", cErr);
              });
          }
        });
      }

      try {
        await askSentinelAiStream(updatedMessages, {
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: (m.content || "") + token } : m
              )
            );
          },
          onActions: (acts) => {
            setPendingActions((prev) => {
              const existingIds = new Set(prev.map((p) => p.action_id));
              const filtered = acts.filter((a) => !existingIds.has(a.action_id));
              return [...prev, ...filtered];
            });
          },
          onSources: (srcs) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, sources: srcs } : m
              )
            );
          },
          onComplete: (res) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: res.reply || m.content,
                      sources: res.sources || m.sources,
                      intent: res.intent,
                    }
                  : m
              )
            );
            if (Array.isArray(res.pending_actions) && res.pending_actions.length > 0) {
              setPendingActions((prev) => {
                const existingIds = new Set(prev.map((p) => p.action_id));
                const filtered = res.pending_actions.filter((a) => !existingIds.has(a.action_id));
                return [...prev, ...filtered];
              });
            }

            // Persistance locale de la discussion
            if (convId) {
              localStorage.setItem(
                `sn_conv_msg_${convId}`,
                JSON.stringify([...updatedMessages, { ...assistantPlaceholder, content: res.reply }])
              );
            }
          },
          onError: (err) => {
            const errorMsg =
              err?.message || "Une erreur est survenue lors de la communication avec l'assistant.";
            setError(errorMsg);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content
                        ? `${m.content}\n\n*(Flux interrompu : ${errorMsg})*`
                        : `Désolé, je rencontre une difficulté : ${errorMsg}`,
                    }
                  : m
              )
            );
          },
        });
      } catch (err: any) {
        const errorMsg =
          err?.message || "Une erreur est survenue lors de la communication avec l'assistant.";
        setError(errorMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Désolé, je rencontre une difficulté : ${errorMsg}`,
                }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, activeConversationId, conversations]
  );

  const confirm = useCallback(async (action: AiPendingAction) => {
    try {
      const res = await confirmSentinelAiAction(action);
      if (res.ok) {
        toastMsg.success("Action confirmée et exécutée avec succès !");
        setPendingActions((prev) => prev.filter((a) => a.action_id !== action.action_id));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `L'action **${action.tool_name}** a été confirmée et exécutée en base de données.`,
            id: "conf-" + Date.now(),
          },
        ]);
      } else {
        toastMsg.error("Échec de l'action", res?.result?.error || "Erreur inconnue");
      }
    } catch (e: any) {
      toastMsg.error("Erreur de confirmation", String(e.message || e));
    }
  }, []);

  const dismiss = useCallback((actionId: string) => {
    setPendingActions((prev) => prev.filter((a) => a.action_id !== actionId));
    toastMsg.info("Action ignorée");
  }, []);

  const handleFeedback = useCallback(async (messageId: string, rating: "positive" | "negative") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m))
    );
    await sendSentinelAiFeedback({ message_id: messageId, rating });
    toastMsg.success("Merci pour votre retour !");
  }, []);

  const clear = useCallback(() => {
    startNewConversation();
  }, [startNewConversation]);

  const regenerate = useCallback(() => {
    if (messages.length === 0 || loading) return;
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIdx >= 0) {
      const lastUserContent = messages[lastUserIdx].content;
      const truncated = messages.slice(0, lastUserIdx);
      setMessages(truncated);
      send(lastUserContent);
    }
  }, [messages, loading, send]);

  return {
    messages,
    conversations,
    activeConversationId,
    pendingActions,
    loading,
    error,
    send,
    confirm,
    dismiss,
    feedback: handleFeedback,
    clear,
    regenerate,
    selectConversation,
    deleteConversation,
    startNewConversation,
    exportToMarkdown,
    loadConversations,
  };
}
