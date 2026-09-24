import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  X,
  Check,
  XCircle,
  Loader2,
  Sparkles,
  FileQuestion,
  BookOpen,
  Clock,
  Award,
  Copy,
  RotateCcw,
  Trash2,
  CheckCheck,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Zap,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Download,
  FileCode,
} from "lucide-react";
import { useSentinelAi } from "@/hooks/useSentinelAi";
import { toolLabel, AiPendingAction } from "@/lib/ai/types";
import { toastMsg } from "@/lib/toast";
import { ingestDocumentForRag } from "@/lib/ai/documentIngestion";
import {
  startVoiceRecognition,
  isVoiceRecognitionSupported,
  speakText,
  stopSpeaking,
  isSpeechSynthesisSupported,
} from "@/lib/ai/voice";
import { exportEvaluationToDocx, exportEvaluationToPdf } from "@/lib/ai/exportAiContent";


interface SentinelAIChatProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
}

/** Carte de confirmation interactive pour les actions de niveau 3 */
function ActionConfirmationCard({
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
      <div className="mr-6 rounded-xl border border-cyan-400/40 bg-cyan-950/40 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            <FileQuestion size={14} /> Évaluation prête pour publication
          </span>
          <span className="rounded bg-cyan-400/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-400/30">
            Niveau 3 — Sensible
          </span>
        </div>

        <p className="text-sm font-bold text-white mb-2">{args.titre || "Évaluation sans titre"}</p>

        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300 bg-black/50 rounded-lg p-2 border border-white/5">
            <Clock size={14} className="text-cyan-400" />
            <span>Durée : <strong className="text-white">{args.duree ?? 45} min</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 bg-black/50 rounded-lg p-2 border border-white/5">
            <Award size={14} className="text-amber-400" />
            <span>Barème : <strong className="text-white">{args.bareme ?? 20} pts</strong></span>
          </div>
        </div>

        <div className="mb-3 rounded-lg bg-black/50 p-2.5 border border-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            {questions.length} Question{questions.length > 1 ? "s" : ""} incluse{questions.length > 1 ? "s" : ""} :
          </p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {questions.map((q: any, i: number) => (
              <div
                key={i}
                className="text-xs text-slate-300 flex items-start justify-between gap-2 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
              >
                <span className="truncate">
                  <span className="font-mono text-cyan-400 mr-1.5 font-bold">Q{i + 1}.</span>
                  {q.enonce || q.question}
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {q.points ?? 1} pt{Number(q.points) > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={async () => {
              try {
                await exportEvaluationToDocx(args, { includeSolutions: false });
                toastMsg.success("DOCX Épreuve téléchargé avec succès !");
              } catch (err: any) {
                toastMsg.error("Erreur export DOCX : " + (err.message || "inconnue"));
              }
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-blue-400/30 bg-blue-500/10 px-2 py-1.5 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 transition cursor-pointer"
            title="Télécharger l'épreuve au format Word DOCX"
          >
            <Download size={12} /> DOCX Épreuve
          </button>
          <button
            onClick={async () => {
              try {
                await exportEvaluationToDocx(args, { includeSolutions: true });
                toastMsg.success("DOCX Corrigé enseignant téléchargé !");
              } catch (err: any) {
                toastMsg.error("Erreur export DOCX : " + (err.message || "inconnue"));
              }
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
            title="Télécharger le corrigé professeur au format Word DOCX"
          >
            <Download size={12} /> DOCX Corrigé
          </button>
          <button
            onClick={async () => {
              try {
                await exportEvaluationToPdf(args, { includeSolutions: false });
                toastMsg.success("PDF Épreuve généré avec succès !");
              } catch (err: any) {
                toastMsg.error("Erreur export PDF : " + (err.message || "inconnue"));
              }
            }}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
            title="Télécharger l'épreuve officielle au format PDF"
          >
            <Download size={12} /> PDF Officiel
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm cursor-pointer"
          >
            <Check size={14} /> Confirmer & Publier
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
          >
            <XCircle size={14} /> Ignorer
          </button>
        </div>
      </div>
    );
  }

  if (tool_name === "valider_presence") {
    const count = Array.isArray(args.student_ids) ? args.student_ids.length : 0;
    return (
      <div className="mr-6 rounded-xl border border-emerald-400/40 bg-emerald-950/30 p-4 shadow-xl backdrop-blur-md">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
          <CheckCheck size={14} /> Validation des présences
        </p>
        <p className="text-sm font-semibold text-white mb-2">
          Enregistrement de <span className="text-emerald-400 font-bold">{count} apprenant(s)</span> avec le statut{" "}
          <strong className="uppercase text-cyan-300">{args.statut || "Présent"}</strong>.
        </p>
        <p className="text-xs text-slate-400 mb-3">Date : {args.date || new Date().toISOString().slice(0, 10)}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/25 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/35 transition cursor-pointer"
          >
            <Check size={14} /> Valider l'appel
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
          >
            <XCircle size={14} /> Annuler
          </button>
        </div>
      </div>
    );
  }

  // Carte générique pour actions sensibles
  return (
    <div className="mr-6 rounded-xl border border-amber-400/40 bg-amber-950/30 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
          <ShieldAlert size={14} /> Action nécessitant validation
        </p>
        <span className="text-[10px] rounded bg-amber-400/10 text-amber-300 px-2 py-0.5 border border-amber-400/20">
          Niveau 3
        </span>
      </div>
      <p className="mb-2 text-sm font-bold text-white">{toolLabel(tool_name)}</p>
      <pre className="mb-3 max-h-32 overflow-auto rounded-lg bg-black/60 p-2.5 text-[11px] font-mono text-slate-300 border border-white/5">
        {JSON.stringify(args, null, 2)}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
        >
          <Check size={14} /> Confirmer l'action
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
        >
          <XCircle size={14} /> Ignorer
        </button>
      </div>
    </div>
  );
}

export function SentinelAIChat({ open, onClose, userRole, userName }: SentinelAIChatProps) {
  const {
    messages,
    pendingActions,
    loading,
    error,
    send,
    confirm,
    dismiss,
    feedback,
    clear,
    regenerate,
  } = useSentinelAi();

  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingActions, loading]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, []);

  const handleToggleVoice = () => {
    if (isListening) {
      stopListeningRef.current?.();
      setIsListening(false);
      return;
    }
    if (!isVoiceRecognitionSupported()) {
      toastMsg.warning("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
      return;
    }
    setIsListening(true);
    const stopFn = startVoiceRecognition({
      lang: "fr-FR",
      continuous: true,
      onResult: (transcript) => {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      },
      onError: (err) => {
        console.warn("Erreur vocale :", err);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
    stopListeningRef.current = stopFn;
  };

  const handleToggleSpeak = (text: string, idx: number) => {
    if (speakingIdx === idx) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    stopSpeaking();
    setSpeakingIdx(idx);
    speakText(text, {
      lang: "fr-FR",
      onEnd: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null),
    });
  };

  const handleProcessFile = async (file: File) => {
    setUploadingDoc(true);
    toastMsg.info(`Indexation du fichier "${file.name}"...`);
    try {
      const result = await ingestDocumentForRag(file, {
        title: file.name,
        category: "cours",
      });
      toastMsg.success(`Document ingéré avec succès (${result.chunksCount} fragments indexés).`);
      send(
        `J'ai indexé le document "${file.name}" (${result.chunksCount} fragments dans la base). Analyse son contenu et résume-moi les points clés.`
      );
    } catch (err: any) {
      console.error("Erreur ingestion document:", err);
      toastMsg.error(err.message || "Échec de l'indexation du document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleProcessFile(files[0]);
    }
  };


  if (!open) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toastMsg.success("Texte copié dans le presse-papier");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Suggestions rapides contextualisées selon le rôle de l'utilisateur
  const getSuggestions = () => {
    if (userRole === "student") {
      return [
        "À quelle heure est mon prochain cours aujourd'hui ?",
        "Explique-moi le chiffrement asymétrique simplement.",
        "Fais-moi réviser avec un quiz de 3 questions.",
        "Quelles sont les conditions pour obtenir mon certificat ?",
      ];
    }
    if (userRole === "teacher") {
      return [
        "Quels apprenants sont inscrits à mon module ?",
        "Fais l'appel des présences pour la séance d'aujourd'hui.",
        "Crée une évaluation QCM de 3 questions sur la cybersécurité.",
        "Rédige un devoir pratique à faire pour vendredi.",
      ];
    }
    // Admin / superadmin / partner
    return [
      "Donne-moi le résumé financier et le total des impayés.",
      "Affiche les statistiques globales de l'école (élèves, profs).",
      "Prépare une annonce pour les apprenants.",
      "Y a-t-il des anomalies d'assiduité récentes ?",
    ];
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-lg flex-col border-l border-cyan-400/30 bg-[#060b12] text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Overlay Drag & Drop */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-cyan-950/90 backdrop-blur-md border-2 border-dashed border-cyan-400 p-6 text-center pointer-events-none">
            <Paperclip size={48} className="text-cyan-300 mb-3 animate-bounce" />
            <p className="text-lg font-bold text-white mb-1">Déposez votre document ici</p>
            <p className="text-xs text-cyan-200">
              PDF, DOCX, TXT ou CSV seront découpés et indexés dans la base de connaissances
            </p>
          </div>
        )}

        {/* Header HUD */}
        <div className="flex items-center justify-between border-b border-cyan-400/20 bg-[#04070c]/90 px-4 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
              <Bot size={20} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-sm font-black tracking-wider uppercase text-white">SENTINEL'S AI</p>
                <span className="rounded bg-cyan-400/10 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-400/30">
                  NVIDIA NEMOTRON
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Zap size={10} className="text-emerald-400" />
                Intelligence contextuelle • {userRole?.toUpperCase() || "CONNECTÉ"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clear}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
              title="Nouvelle conversation"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition cursor-pointer"
              title="Fermer le panneau"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps des messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-b from-cyan-950/20 to-transparent p-5 text-sm text-slate-300">
              <div className="flex items-center gap-2 text-cyan-300 font-bold mb-3">
                <Sparkles size={16} /> Suggestions contextuelles pour vous :
              </div>
              <div className="space-y-2 text-xs">
                {getSuggestions().map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => send(sug)}
                    className="w-full text-left rounded-xl border border-white/5 bg-black/40 p-2.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200 transition cursor-pointer"
                  >
                    • « {sug} »
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => (
            <div key={idx} className="group relative">
              <div
                className={
                  m.role === "user"
                    ? "ml-10 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-400/30 p-3.5 text-sm text-cyan-100 shadow-md"
                    : "mr-10 rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 text-sm text-slate-200 shadow-md leading-relaxed whitespace-pre-line"
                }
              >
                {m.content}

                {/* Sources utilisées (RAG) */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] text-cyan-300/80">
                    <p className="font-semibold flex items-center gap-1 mb-1 text-slate-400">
                      <FileText size={12} className="text-cyan-400" /> Sources consultées :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="rounded bg-cyan-950/60 px-2 py-0.5 border border-cyan-400/20 text-cyan-200"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {m.role === "assistant" && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCopy(m.content, idx)}
                      className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                    >
                      {copiedIdx === idx ? (
                        <CheckCheck size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copiedIdx === idx ? "Copié" : "Copier"}
                    </button>

                    {isSpeechSynthesisSupported() && (
                      <button
                        onClick={() => handleToggleSpeak(m.content, idx)}
                        className={`flex items-center gap-1 transition cursor-pointer ${
                          speakingIdx === idx
                            ? "text-cyan-400 font-bold"
                            : "hover:text-cyan-300"
                        }`}
                        title={speakingIdx === idx ? "Arrêter la lecture" : "Écouter la réponse"}
                      >
                        {speakingIdx === idx ? (
                          <VolumeX size={12} className="animate-pulse text-cyan-400" />
                        ) : (
                          <Volume2 size={12} />
                        )}
                        {speakingIdx === idx ? "Arrêter" : "Écouter"}
                      </button>
                    )}

                    {idx === messages.length - 1 && (
                      <button
                        onClick={regenerate}
                        className="flex items-center gap-1 hover:text-cyan-300 transition cursor-pointer"
                      >
                        <RotateCcw size={12} /> Régénérer
                      </button>
                    )}
                  </div>

                  {/* Feedback 👍 / 👎 */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => m.id && feedback(m.id, "positive")}
                      className={`p-1 rounded hover:text-emerald-400 transition cursor-pointer ${
                        m.feedback === "positive" ? "text-emerald-400 font-bold" : ""
                      }`}
                      title="Réponse utile"
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      onClick={() => m.id && feedback(m.id, "negative")}
                      className={`p-1 rounded hover:text-red-400 transition cursor-pointer ${
                        m.feedback === "negative" ? "text-red-400 font-bold" : ""
                      }`}
                      title="Réponse inexacte ou incomplète"
                    >
                      <ThumbsDown size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Cartes de confirmation d'action */}
          {pendingActions.map((a) => (
            <ActionConfirmationCard
              key={a.action_id}
              action={a}
              onConfirm={() => confirm(a)}
              onDismiss={() => dismiss(a.action_id)}
            />
          ))}

          {loading && (
            <div className="mr-10 flex items-center gap-2.5 rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-3.5 text-xs text-cyan-300 shadow-lg">
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span>SENTINEL'S AI analyse vos connaissances et élabore la réponse...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-300 flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Zone de saisie avec support vocal et ingestion documentaire */}
        <div className="border-t border-cyan-400/20 bg-[#04070c]/90 p-3.5 backdrop-blur-md">
          {/* Input fichier caché pour téléversement de documents */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.txt,.csv,.json,.md"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await handleProcessFile(file);
                e.target.value = "";
              }
            }}
          />

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* Bouton Ingestion Document */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploadingDoc}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:border-cyan-400/40 hover:bg-cyan-950/30 hover:text-cyan-300 transition cursor-pointer disabled:opacity-40"
              title="Ajouter un document à la base RAG (PDF, DOCX, TXT, CSV)"
            >
              {uploadingDoc ? (
                <Loader2 size={16} className="animate-spin text-cyan-400" />
              ) : (
                <Paperclip size={16} />
              )}
            </button>

            {/* Champ de saisie */}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question, dictez ou glissez un fichier..."
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:bg-white/[0.06] focus:outline-none transition shadow-inner"
            />

            {/* Bouton Dictée vocale */}
            {isVoiceRecognitionSupported() && (
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition cursor-pointer ${
                  isListening
                    ? "border-red-400/60 bg-red-500/20 text-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-cyan-400/40 hover:bg-cyan-950/30 hover:text-cyan-300"
                }`}
                title={isListening ? "Arrêter la dictée" : "Dicter vocalement en français"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

            {/* Bouton Envoyer */}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-400/20 px-4 text-cyan-300 hover:bg-cyan-400/30 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition shadow-[0_0_15px_rgba(0,229,255,0.2)] cursor-pointer"
            >
              <Send size={16} />
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-cyan-400" />
              RAG & Mémoire active • Glissez-déposez vos cours
            </span>
            <span>{isListening ? "Écoute en cours..." : "Entrée pour envoyer"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SentinelAIChat;
