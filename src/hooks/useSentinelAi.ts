import { useState, useCallback, useEffect } from "react";
import { AiChatMessage, AiPendingAction } from "@/lib/ai/types";
import {
  askSentinelAi,
  confirmSentinelAiAction,
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

      const userMsg: AiChatMessage = { role: "user", content: query, id: "msg-" + Date.now() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setLoading(true);
      setError(null);

      try {
        const res = await askSentinelAi(updatedMessages);
        if (res.reply) {
          const assistantMsg: AiChatMessage = {
            role: "assistant",
            content: res.reply,
            id: "msg-" + (Date.now() + 1),
          };
          setMessages([...updatedMessages, assistantMsg]);
        }

        if (Array.isArray(res.pending_actions) && res.pending_actions.length > 0) {
          setPendingActions((prev) => [...prev, ...res.pending_actions]);
        }
      } catch (err: any) {
        const errorMsg = err?.message || "Une erreur est survenue lors de la communication avec l'assistant.";
        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Désolé, je rencontre une difficulté : ${errorMsg}`,
            id: "err-" + Date.now(),
          },
        ]);
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
    clear,
    regenerate,
  };
}
