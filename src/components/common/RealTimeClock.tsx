import React from "react";
import { Clock } from "lucide-react";
import { useBrazzavilleClock } from "@/lib/timeUtils";

interface RealTimeClockProps {
  compact?: boolean;
  className?: string;
}

export const RealTimeClock: React.FC<RealTimeClockProps> = ({ compact = false, className = "" }) => {
  const { time, dateMedium, timezoneLabel } = useBrazzavilleClock();

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-[#0B111A] px-2.5 py-1.5 sm:px-3 text-[#B8F3FF] shadow-sm transition hover:border-cyan-400/60 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] ${className}`}
      title="Horloge officielle en temps réel — République du Congo (Brazzaville, WAT UTC+1)"
      aria-label={`Heure en direct à Brazzaville : ${time}`}
    >
      {/* Icône avec point vert d'activité temps réel */}
      <div className="relative flex items-center justify-center shrink-0">
        <Clock size={16} className="text-cyan-400 group-hover:scale-105 transition-transform" />
        <span className="absolute -top-1 -right-1 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#10B981]"></span>
        </span>
      </div>

      {/* Affichage de l'heure et de la date (compact sans texte Brazzaville GMT+1) */}
      <div className="flex flex-col text-left leading-none">
        <span className="font-mono text-xs font-black tracking-wider text-cyan-200">
          {time}
        </span>
        {!compact && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-300 font-medium whitespace-nowrap">
            <span className="capitalize">{dateMedium}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeClock;
