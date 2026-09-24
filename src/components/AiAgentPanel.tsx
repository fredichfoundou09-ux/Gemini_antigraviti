import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Check, XCircle, Loader2, Sparkles, FileQuestion, BookOpen, Clock, Award } from "lucide-react";
import { useAiAgent } from "@/hooks/useAiAgent";
import { toolLabel, AiPendingAction } from "@/lib/ai/agent";

/** Rendu spécifique d'une carte de confirmation selon l'outil */
function ConfirmationCard({
  action,
  onConfirm,
  onDismiss,
}: {
  action: AiPendingAction;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { tool_name, arguments: args } = action;

  if (tool_name === "publier_evaluation") {
    const questions = Array.isArray(args.questions) ? args.questions : [];
    return (
      <div className="mr-8 rounded-xl border border-cyan-400/40 bg-cyan-950/30 p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            <FileQuestion size={13} /> Évaluation prête à publier
          </span>
          <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-400/30">
            {toolLabel(tool_name)}
          </span>
        </div>

        <p className="text-sm font-bold text-white mb-2">{args.titre || "Sans titre"}</p>

        <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 bg-black/40 rounded-lg p-2 border border-white/5">
            <Clock size={13} className="text-cyan-400" />
            <span>Durée : <strong className="text-white">{args.duree ?? 45} min</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 bg-black/40 rounded-lg p-2 border border-white/5">
            <Award size={13} className="text-amber-400" />
            <span>Barème : <strong className="text-white">{args.bareme ?? 20} pts</strong></span>
          </div>
        </div>

        <div className="mb-3 rounded-lg bg-black/40 p-2.5 border border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            {questions.length} Question{questions.length > 1 ? "s" : ""} incluse{questions.length > 1 ? "s" : ""} :
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {questions.map((q: any, i: number) => (
              <div key={i} className="text-[11px] text-slate-300 flex items-start justify-between gap-2 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                <span className="truncate">
                  <span className="font-mono text-cyan-400 mr-1">Q{i + 1}.</span>
                  {q.enonce || q.question}
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                  {q.points ?? 1} pt{Number(q.points) > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm"
          >
            <Check size={13} /> Confirmer & Publier
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <XCircle size={13} /> Ignorer
          </button>
        </div>
      </div>
    );
  }

  // Carte générique pour valider_presence, publier_devoir ou autres
  return (
    <div className="mr-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">Action à confirmer</p>
      <p className="mb-2 text-sm font-semibold text-white">{toolLabel(tool_name)}</p>
      <pre className="mb-3 max-h-32 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-slate-400">
        {JSON.stringify(args, null, 2)}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-400/20"
        >
          <Check size={13} /> Confirmer
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
        >
          <XCircle size={13} /> Ignorer
        </button>
      </div>
    </div>
  );
}

/** Panneau latéral de l'assistant IA agent — formateur/admin uniquement. */
export function AiAgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, pendingActions, loading, send, confirm, dismiss } = useAiAgent();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingActions]);

  if (!open) return null;

  const submit = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-cyan-400/20 bg-[#060b12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Bot size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Assistant IA Pédagogique</p>
              <p className="text-[10px] text-slate-500">Propose des actions, ne décide jamais seul</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
              <p className="mb-2 flex items-center gap-1.5 text-cyan-300"><Sparkles size={14} /> Exemples de demandes :</p>
              <ul className="space-y-1.5 text-xs">
                <li>• « Quels apprenants ne sont pas encore pointés aujourd'hui en Réseaux ? »</li>
                <li>• « Marque présents Jean Dupont et Awa Diallo en Cybersécurité »</li>
                <li>• « Publie un devoir sur les sous-réseaux IP pour le module Réseaux »</li>
                <li>• « Crée une évaluation QCM de 4 questions sur le chiffrement RSA »</li>
                <li>• « Y a-t-il des apprenants inactifs depuis longtemps ? »</li>
              </ul>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 px-3 py-2 text-sm text-cyan-100"
                  : "mr-8 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-slate-200"
              }
            >
              {m.content}
            </div>
          ))}

          {pendingActions.map((a) => (
            <ConfirmationCard
              key={a.action_id}
              action={a}
              onConfirm={() => confirm(a)}
              onDismiss={() => dismiss(a.action_id)}
            />
          ))}

          {loading && (
            <div className="mr-8 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
              <Loader2 size={13} className="animate-spin text-cyan-400" /> Réflexion en cours…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Demandez quelque chose à l'assistant..."
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              onClick={submit}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default AiAgentPanel;
