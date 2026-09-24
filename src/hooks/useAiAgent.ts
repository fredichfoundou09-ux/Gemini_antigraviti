import { useCallback, useState } from "react";
import { askAgent, confirmAgentAction, AiChatMessage, AiPendingAction } from "@/lib/ai/agent";
import { toastMsg } from "@/lib/toast";

export function useAiAgent() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [pendingActions, setPendingActions] = useState<AiPendingAction[]>([]);
  const [loading, setLoading] = useState(false);

  const send = useCallback(async (text: string) => {
    const next: AiChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await askAgent(next);
      setMessages([...next, { role: "assistant", content: res.reply || "" }]);
      if (res.pending_actions?.length) setPendingActions((prev) => [...prev, ...res.pending_actions]);
    } catch (e: any) {
      toastMsg.error("Assistant indisponible", e.message);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const confirm = useCallback(async (action: AiPendingAction) => {
    try {
      await confirmAgentAction(action);
      setPendingActions((prev) => prev.filter((a) => a.action_id !== action.action_id));
      toastMsg.success("Action confirmée et exécutée ✓");
    } catch (e: any) {
      toastMsg.error("Échec de l'action", e.message);
    }
  }, []);

  const dismiss = useCallback((actionId: string) => {
    setPendingActions((prev) => prev.filter((a) => a.action_id !== actionId));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setPendingActions([]);
  }, []);

  return { messages, pendingActions, loading, send, confirm, dismiss, reset };
}
