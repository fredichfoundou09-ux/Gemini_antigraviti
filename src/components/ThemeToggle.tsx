import React, { useState, useEffect, useRef } from "react";
import { Palette, Check, RotateCcw, Sparkles } from "lucide-react";
import { getUiTheme, setUiTheme, UiTheme } from "@/lib/uiTheme";
import { cn } from "@/utils/cn";

export function ThemeToggle() {
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

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative rounded-lg border p-2 sm:p-2.5 transition shrink-0",
          currentTheme === "modern"
            ? "border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            : "border-[#006DFF]/30 bg-[#0B111A] text-[#4C91B5] hover:border-[#00C8FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.25)]"
        )}
        title="Personnaliser l'apparence de l'interface (Thème réversible)"
        aria-label="Changer le thème d'affichage"
      >
        <Palette size={18} />
        {currentTheme === "modern" && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-white/15 bg-[#091528]/95 p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Apparence de l'interface</span>
            </div>
            <span className="font-mono text-[9px] text-cyan-300/70 uppercase tracking-widest font-semibold">
              Réversible
            </span>
          </div>

          <div className="space-y-1.5">
            {/* Option 1: Thème Classique (Par défaut) */}
            <button
              type="button"
              onClick={() => selectTheme("classic")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border",
                currentTheme === "classic"
                  ? "border-cyan-400/40 bg-cyan-500/10 text-white"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold">Thème Classique (Défaut)</p>
                  {currentTheme === "classic" && (
                    <span className="rounded bg-cyan-400/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300">
                      Actif
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  L'interface d'origine sombre et contrastée certifiée Sentinelles.
                </p>
              </div>
              {currentTheme === "classic" && <Check size={16} className="text-cyan-400 shrink-0 mt-0.5" />}
            </button>

            {/* Option 2: Thème Modernisé */}
            <button
              type="button"
              onClick={() => selectTheme("modern")}
              className={cn(
                "w-full text-left rounded-xl p-2.5 transition flex items-start justify-between gap-2 border",
                currentTheme === "modern"
                  ? "border-cyan-400/50 bg-cyan-500/15 text-white"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
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
              </div>
              {currentTheme === "modern" && <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
            </button>
          </div>

          {/* Bouton de retour rapide si en mode modernisé */}
          {currentTheme === "modern" && (
            <div className="mt-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => selectTheme("classic")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                <RotateCcw size={12} className="text-amber-400" />
                <span>Revenir à l'ancienne présentation</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
