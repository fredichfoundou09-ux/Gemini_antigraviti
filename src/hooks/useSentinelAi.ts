import { useState, useCallback, useEffect } from "react";
import { AiChatMessage, AiPendingAction } from "@/lib/ai/types";
import {
  askSentinelAiStream,
  confirmSentinelAiAction,
  sendSentinelAiFeedback,
} from "@/lib/ai/sentinelAiService";
import { toastMsg } from "@/lib/toast";

const STORAGE_KEY = "sentinel_ai_chat_session";

export function useSentinelAi() {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pendingActions, setPendingActions] = useState<AiPendingAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sauvegarde automatique de la conversation active
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("Erreur sauvegarde session IA :", e);
    }
  }, [messages]);

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
    [messages, loading]
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
    setMessages([]);
    setPendingActions([]);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

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
    pendingActions,
    loading,
    error,
    send,
    confirm,
    dismiss,
    feedback: handleFeedback,
    clear,
    regenerate,
  };
}
