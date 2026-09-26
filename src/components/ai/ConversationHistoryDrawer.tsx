import React from "react";
import { MessageSquare, Plus, Trash2, X, Clock } from "lucide-react";
import { AiConversationMeta } from "@/lib/ai/types";

interface ConversationHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: AiConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ConversationHistoryDrawer({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationHistoryDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-cyan-400/30 bg-[#040810]/95 backdrop-blur-xl shadow-2xl transition-all duration-300"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header du Drawer */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-black/40">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Historique des échanges
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
          title="Fermer l'historique"
        >
          <X size={16} />
        </button>
      </div>

      {/* Bouton Nouvelle Conversation */}
      <div className="p-3 border-b border-white/5">
        <button
          onClick={() => {
            onNew();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 hover:scale-[1.02] active:scale-95 transition shadow-sm cursor-pointer"
        >
          <Plus size={14} />
          Nouvelle discussion
        </button>
      </div>

      {/* Liste des conversations */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            <Clock size={24} className="mx-auto mb-2 text-slate-600 opacity-60" />
            <p>Aucune discussion archivée.</p>
            <p className="mt-1 text-[11px] text-slate-600">Vos échanges apparaîtront ici.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const dateStr = new Date(conv.updated_at || conv.created_at).toLocaleDateString([], {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelect(conv.id);
                  onClose();
                }}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition cursor-pointer ${
                  isActive
                    ? "border border-cyan-400/40 bg-cyan-950/40 text-cyan-200 font-semibold shadow-inner"
                    : "border border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="flex-1 truncate mr-2">
                  <p className="truncate text-xs">{conv.title || "Discussion sans titre"}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{dateStr}</p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id, e);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Supprimer cette discussion"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-white/5 p-3 text-[10px] text-slate-500 text-center">
        Chiffrement & Isolation par utilisateur
      </div>
    </div>
  );
}
