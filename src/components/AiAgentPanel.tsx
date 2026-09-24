import React from "react";
import { SentinelAIChat } from "@/components/ai/SentinelAIChat";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";

export function AiAgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore();
  const { profile } = useAuth();
  const currentRole = user?.role || profile?.role || "visiteur";
  const currentName = user?.name || profile?.name || "Utilisateur";

  return (
    <SentinelAIChat
      open={open}
      onClose={onClose}
      userRole={currentRole}
      userName={currentName}
    />
  );
}

export default AiAgentPanel;
