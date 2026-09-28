import React, { useState, useEffect } from "react";
import { Sun, SunDim, SunMedium, Eye, Check } from "lucide-react";
import { getUiBrightness, setUiBrightness } from "@/lib/uiTheme";
import { cn } from "@/utils/cn";
import { toastMsg } from "@/lib/toast";

interface BrightnessControlProps {
  className?: string;
  compact?: boolean;
}

export const BRIGHTNESS_PRESETS = [
  { value: 70, label: "Nocturne", desc: "Atténuation forte, repose la vue", icon: SunDim },
  { value: 80, label: "Tamisé", desc: "Idéal le soir et en basse lumière", icon: SunMedium },
  { value: 92, label: "Confort", desc: "Recommandé — Anti-éblouissement", icon: Eye },
  { value: 100, label: "Éclatant", desc: "Luminosité maximale 100%", icon: Sun },
];

export const BrightnessControl: React.FC<BrightnessControlProps> = ({ className, compact = false }) => {
  const [brightness, setBrightnessState] = useState<number>(getUiBrightness());

  useEffect(() => {
    const handleBrightnessChange = (e: any) => {
      if (typeof e.detail?.brightness === "number") {
        setBrightnessState(e.detail.brightness);
      }
    };
    window.addEventListener("sentinelles:brightness-changed", handleBrightnessChange);
    return () => window.removeEventListener("sentinelles:brightness-changed", handleBrightnessChange);
  }, []);

  const handleUpdate = (val: number, showToast = true) => {
    setUiBrightness(val);
    setBrightnessState(val);
    if (showToast) {
      toastMsg.success(
        "Luminosité ajustée ✓",
        `Luminosité réglée à ${val}% pour le confort de vos yeux.`
      );
    }
  };

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Eye size={13} className="text-cyan-400" />
            Luminosité & Confort Visuel
          </span>
          <span className="font-mono text-cyan-300 text-[11px] font-bold">{brightness}%</span>
        </div>

        <input
          type="range"
          min="65"
          max="100"
          step="1"
          value={brightness}
          onChange={(e) => handleUpdate(Number(e.target.value), false)}
          className="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
        />

        <div className="flex items-center justify-between gap-1 pt-1">
          {BRIGHTNESS_PRESETS.map((p) => {
            const isSelected = Math.abs(brightness - p.value) <= 3;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => handleUpdate(p.value)}
                className={cn(
                  "flex-1 py-1 px-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer text-center",
                  isSelected
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : "border-white/10 bg-black/20 text-slate-400 hover:text-white"
                )}
                title={p.desc}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
            <Eye size={18} />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              Contrôle de Luminosité & Confort Visuel
            </h3>
            <p className="text-xs text-slate-400">
              Diminuez l'éclat des fonds clairs pour protéger vos yeux de la fatigue visuelle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-400/40 px-3 py-1 rounded-xl">
            {brightness}%
          </span>
        </div>
      </div>

      {/* Curseur de précision */}
      <div className="space-y-2 p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5 font-bold">
            <SunDim size={14} className="text-slate-400" />
            Atténué (65%)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {brightness < 80 ? "Mode repos nocturne" : brightness <= 94 ? "Confort équilibré recommandé" : "Luminosité standard"}
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            Éclatant (100%)
            <Sun size={14} className="text-amber-400" />
          </span>
        </div>

        <input
          type="range"
          min="65"
          max="100"
          step="1"
          value={brightness}
          onChange={(e) => handleUpdate(Number(e.target.value), false)}
          className="w-full accent-cyan-400 h-2 bg-white/10 rounded-lg cursor-pointer"
        />
      </div>

      {/* 4 Boutons de préréglages rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {BRIGHTNESS_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = Math.abs(brightness - preset.value) <= 3;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleUpdate(preset.value)}
              className={cn(
                "p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between group",
                isSelected
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                  : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/5"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={isSelected ? "text-cyan-400" : "text-slate-400"} />
                  <span className="font-bold text-xs text-white">{preset.label}</span>
                </div>
                {isSelected && <Check size={13} className="text-cyan-400" />}
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">{preset.desc}</p>
              <span className="mt-2 text-[10px] font-mono text-cyan-300/80 font-bold">{preset.value}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
