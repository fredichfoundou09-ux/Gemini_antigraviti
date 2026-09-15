import React, { useState, useEffect, useRef } from "react";
import { Palette, Check, RotateCcw, Sparkles, Moon, Shield, Flame } from "lucide-react";
import { getUiTheme, setUiTheme, UiTheme } from "@/lib/uiTheme";
import { cn } from "@/utils/cn";

interface ThemeToggleProps {
  className?: string;
  align?: "left" | "right";
  showLabel?: boolean;
}

export function ThemeToggle({ className, align = "right", showLabel = false }: ThemeToggleProps) {
  const [currentTheme, setCurrentTheme] = useState<UiTheme>("classic");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(getUiTheme());
    const onThemeChange = (e: any) => {
      if (e.detail?.theme) {
        setCurrentTheme(e.detail.theme);
      }
    };
    window.addEventListener("sentinelles:theme-changed", onThemeChange);
    return () => window.removeEventListener("sentinelles:theme-changed", onThemeChange);
  }, []);

  // Fermer le menu lors d'un clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectTheme = (theme: UiTheme) => {
    setUiTheme(theme);
    setCurrentTheme(theme);
    setOpen(false);
  };

  const isNonDefault = currentTheme !== "classic";

  const getThemeLabel = (t: UiTheme) => {
    switch (t) {
      case "orange-slate":
        return "Orange Ardoise";
      case "crimson":
        return "Rouge Sentinelle";
      case "modern":
        return "Modernisé";
      default:
        return "Classique";
    }
  };

  return (
    <div className={cn("relative shrink-0 no-theme-invert", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative rounded-lg border p-2 sm:p-2.5 transition shrink-0 inline-flex items-center gap-2",
          currentTheme === "orange-slate"
            ? "border-[#F03E00] bg-[#263136] text-[#F03E00] shadow-[0_0_14px_rgba(240,62,0,0.45)]"
            : currentTheme === "crimson"
            ? "border-red-500 bg-red-950/50 text-red-400 shadow-[0_0_14px_rgba(255,23,79,0.4)]"
            : currentTheme === "modern"
            ? "border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            : "border-[#006DFF]/30 bg-[#0B111A] text-[#4C91B5] hover:border-[#00C8FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.25)]"
        )}
        title="Personnaliser l'apparence de l'interface (Changer de thème)"
        aria-label="Changer le thème d'affichage"
      >
        <Palette size={18} className="shrink-0" />
        {showLabel && (
          <span className="text-xs font-bold truncate max-w-[120px]">
            {getThemeLabel(currentTheme)}
          </span>
        )}
        {isNonDefault && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                currentTheme === "orange-slate"
                  ? "bg-[#F03E00]"
                  : currentTheme === "crimson"
                  ? "bg-red-500"
                  : "bg-cyan-400"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                currentTheme === "orange-slate"
                  ? "bg-[#F03E00]"
                  : currentTheme === "crimson"
                  ? "bg-red-600"
                  : "bg-cyan-500"
              )}
            />
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-2 z-50 w-80 rounded-2xl border border-white/15 bg-[#091528]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in text-white",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Apparence de l'interface</span>
            </div>
            <span className="font-mono text-[9px] text-cyan-300/70 uppercase tracking-widest font-semibold">
              100% Réversible
            </span>
          </div>

          <div className="space-y-2">
            {/* Option 1: Thème Classique (Par défaut) */}
            <button
              type="button"
              onClick={() => selectTheme("classic")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border group",
                currentTheme === "classic"
                  ? "border-cyan-400/50 bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Moon size={14} className="text-cyan-400" />
                  <p className="text-xs font-bold text-white">Thème Classique (Défaut)</p>
                  {currentTheme === "classic" && (
                    <span className="rounded bg-cyan-400/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300">
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  L'interface d'origine sombre et contrastée certifiée Sentinelles.
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#080A0F] border border-white/20" title="#080A0F" />
                  <span className="h-2 w-2 rounded-full bg-[#00E5FF]" title="#00E5FF" />
                  <span className="h-2 w-2 rounded-full bg-[#006DFF]" title="#006DFF" />
                  <span className="h-2 w-2 rounded-full bg-[#FF174F]" title="#FF174F" />
                </div>
              </div>
              {currentTheme === "classic" && <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />}
            </button>

            {/* Option 2: Thème Rouge Sentinelle (Blason 3D) */}
            <button
              type="button"
              onClick={() => selectTheme("crimson")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border group",
                currentTheme === "crimson"
                  ? "border-red-500/60 bg-red-500/20 text-white shadow-[0_0_15px_rgba(255,23,79,0.25)]"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-red-500" />
                  <p className="text-xs font-bold text-red-300">Rouge Sentinelle & Chrome</p>
                  {currentTheme === "crimson" && (
                    <span className="rounded bg-red-500/30 px-1.5 py-0.2 text-[9px] font-bold text-red-200">
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  Ambiance rubis écarlate et chrome métallique du blason 3D.
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#FF174F]" title="#FF174F" />
                  <span className="h-2 w-2 rounded-full bg-[#9E002B]" title="#9E002B" />
                  <span className="h-2 w-2 rounded-full bg-[#0E0E14] border border-white/20" title="#0E0E14" />
                </div>
              </div>
              {currentTheme === "crimson" && <Check size={16} className="text-red-400 shrink-0 mt-0.5" />}
            </button>

            {/* Option 3: Thème Orange Ardoise (Style Infographique - Remplacement de Clair) */}
            <button
              type="button"
              onClick={() => selectTheme("orange-slate")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border group",
                currentTheme === "orange-slate"
                  ? "border-[#F03E00] bg-[#F03E00]/25 text-white shadow-[0_0_16px_rgba(240,62,0,0.35)]"
                  : "border-orange-500/20 bg-orange-950/10 text-slate-200 hover:bg-white/5 hover:border-orange-500/40"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Flame size={15} className="text-[#F03E00]" />
                  <p className="text-xs font-bold text-orange-300 group-hover:text-orange-200">
                    Orange Ardoise (Style Infographique)
                  </p>
                  {currentTheme === "orange-slate" && (
                    <span className="rounded bg-[#F03E00] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-[0_0_6px_#F03E00]">
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                  Palette orange vif, bleu-noir, gris ardoise et blanc cassé de référence.
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F03E00] ring-1 ring-white/30" title="Orange vif #F03E00" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#B33107]" title="Orange profond #B33107" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#263136] ring-1 ring-white/20" title="Bleu-noir #263136" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#394E53]" title="Slate foncé #394E53" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#78868A]" title="Gris ardoise #78868A" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E6E5E1]" title="Blanc cassé #E6E5E1" />
                </div>
              </div>
              {currentTheme === "orange-slate" && <Check size={16} className="text-[#F03E00] shrink-0 mt-0.5" />}
            </button>

            {/* Option 4: Thème Modernisé */}
            <button
              type="button"
              onClick={() => selectTheme("modern")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border group",
                currentTheme === "modern"
                  ? "border-cyan-400/50 bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-cyan-300" />
                  <p className="text-xs font-bold text-cyan-200">Thème Modernisé</p>
                  {currentTheme === "modern" && (
                    <span className="rounded bg-emerald-400/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300">
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  Dégradés saphir doux, flou d'arrière-plan et bordures aériennes.
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#00E5FF]" title="#00E5FF" />
                  <span className="h-2 w-2 rounded-full bg-[#091528] border border-white/20" title="#091528" />
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" title="#10B981" />
                </div>
              </div>
              {currentTheme === "modern" && <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
            </button>
          </div>

          {/* Bouton de retour rapide si un thème non-défaut est actif */}
          {isNonDefault && (
            <div className="mt-3 pt-2.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => selectTheme("classic")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                <RotateCcw size={12} className="text-cyan-400" />
                <span>Revenir à l'apparence Classique</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Alias de rétro-compatibilité
export const UiThemeToggle = ThemeToggle;
