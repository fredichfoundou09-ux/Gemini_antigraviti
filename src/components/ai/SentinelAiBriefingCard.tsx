import React from "react";
import { Bot, Sparkles, Calendar, AlertCircle, ArrowRight, Zap, CheckCircle2 } from "lucide-react";

interface SentinelAiBriefingCardProps {
  userRole?: string;
  userName?: string;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export function SentinelAiBriefingCard({
  userRole = "student",
  userName = "Apprenant",
  onOpenChatWithPrompt,
}: SentinelAiBriefingCardProps) {
  const handleTrigger = (promptText: string) => {
    if (onOpenChatWithPrompt) {
      onOpenChatWithPrompt(promptText);
    }
    window.dispatchEvent(new CustomEvent("open-sentinel-ai", { detail: { prompt: promptText } }));
  };

  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const getBriefingItems = () => {
    if (userRole === "student") {
      return [
        {
          icon: <Calendar size={14} className="text-cyan-400" />,
          title: "Séances du jour",
          desc: "Consultez l'horaire de votre prochaine séance de cours et les salles attribuées.",
          prompt: "Quel est mon programme de cours aujourd'hui et dans quelle salle ?",
        },
        {
          icon: <CheckCircle2 size={14} className="text-emerald-400" />,
          title: "Évaluations & Devoirs",
          desc: "Vérifiez vos échéances de remise de travaux pratiques et tests planifiés.",
          prompt: "Quels devoirs ou évaluations ai-je à rendre cette semaine ?",
        },
        {
          icon: <Zap size={14} className="text-amber-400" />,
          title: "Objectif révision",
          desc: "Sollicitez Sentinel AI pour tester vos connaissances avec un quiz flash.",
          prompt: "Pose-moi 3 questions de révision sur le dernier module étudié.",
        },
      ];
    }

    if (userRole === "teacher") {
      return [
        {
          icon: <Calendar size={14} className="text-cyan-400" />,
          title: "Planning d'enseignement",
          desc: "Visualisez les cohortes et modules planifiés pour vos séances du jour.",
          prompt: "Quels sont mes cours planifiés aujourd'hui et les effectifs attendus ?",
        },
        {
          icon: <AlertCircle size={14} className="text-amber-400" />,
          title: "Émargement & Assiduité",
          desc: "Validez la feuille d'appel numérique pour votre dernière séance dispensée.",
          prompt: "Prépare l'appel des présences pour ma séance d'aujourd'hui.",
        },
        {
          icon: <Sparkles size={14} className="text-purple-400" />,
          title: "Génération de quiz",
          desc: "Concevez un devoir ou une évaluation QCM prête à l'emploi avec barème.",
          prompt: "Crée un projet d'évaluation QCM de 5 questions avec corrigé.",
        },
      ];
    }

    // Admin / Superadmin / Partner
    return [
      {
        icon: <Zap size={14} className="text-emerald-400" />,
        title: "Taux d'assiduité global",
        desc: "Analysez la présence générale et détectez les anomalies d'inactivité.",
        prompt: "Y a-t-il des anomalies d'assiduité ou d'absences répétées cette semaine ?",
      },
      {
        icon: <Calendar size={14} className="text-cyan-400" />,
        title: "Suivi de trésorerie",
        desc: "Consultez le solde des encaissements et les échéances de formation échues.",
        prompt: "Donne-moi le bilan financier des paiements et le total des impayés.",
      },
      {
        icon: <Sparkles size={14} className="text-purple-400" />,
        title: "Diffusion d'annonces",
        desc: "Rédigez et publiez une note d'information officielle aux cohortes.",
        prompt: "Rédige une annonce officielle de rappel des examens pour tous les étudiants.",
      },
    ];
  };

  const items = getBriefingItems();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#060d18] via-[#081324] to-[#040810] p-5 text-slate-100 shadow-[0_4px_25px_rgba(0,229,255,0.08)]">
      {/* Halo d'ambiance */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* En-tête du Briefing */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.25)]">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                Daily AI Briefing
              </span>
              <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 border border-emerald-400/30">
                ACTIF
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              Bonjour, {userName} • {todayStr}
            </h2>
          </div>
        </div>

        <button
          onClick={() => handleTrigger("Fais-moi le point complet pour ma journée.")}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 hover:scale-105 active:scale-95 transition shadow-sm cursor-pointer"
        >
          <Sparkles size={14} />
          Faire le point avec Sentinel AI
        </button>
      </div>

      {/* Cartes de synthèse proactives */}
      <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it, idx) => (
          <div
            key={idx}
            onClick={() => handleTrigger(it.prompt)}
            className="group flex flex-col justify-between rounded-xl border border-white/5 bg-black/30 p-3.5 transition hover:border-cyan-400/40 hover:bg-cyan-950/20 cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="rounded-lg bg-white/5 p-1.5 group-hover:bg-cyan-400/20 transition">
                  {it.icon}
                </div>
                <h3 className="text-xs font-bold text-white group-hover:text-cyan-200 transition">
                  {it.title}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{it.desc}</p>
            </div>

            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-cyan-400 opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition">
              <span>Demander</span>
              <ArrowRight size={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default SentinelAiBriefingCard;
