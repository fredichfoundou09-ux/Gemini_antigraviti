import React, { useState, useRef, useEffect, useCallback } from "react";
import { useDensity, DENSITY_OPTIONS, DensityLevel } from "@/contexts/DensityContext";
import { Monitor, Minimize2, Zap, Microscope, SlidersHorizontal, Check } from "lucide-react";
import { cn } from "@/utils/cn";

export const DensitySwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { density, setDensity, currentOption } = useDensity();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic ou tap à l'extérieur (Compatible Desktop, Android & iOS Safari)
  const handlePointerOutside = useCallback((e: Event) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerOutside);
      document.addEventListener("touchstart", handlePointerOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside);
      document.removeEventListener("touchstart", handlePointerOutside);
    };
  }, [isOpen, handlePointerOutside]);

  // Fermeture par la touche Échap pour conformité accessibilité WCAG
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const getIcon = (id: DensityLevel) => {
    switch (id) {
      case "normal":
        return Monitor;
      case "compact":
        return Minimize2;
      case "ultra-compact":
        return Zap;
      case "micro":
        return Microscope;
    }
  };

  const CurrentIcon = getIcon(density);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bouton de déclenchement (optimisé pour écran tactile et iOS HIG minimum 40-44px) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Densité d'affichage actuelle : ${currentOption.label} (${currentOption.percentage}). Cliquer pour modifier.`}
        className={cn(
          "relative flex items-center justify-center gap-1.5 rounded-lg border border-[#006DFF]/30 bg-[#0B111A] text-[#B8F3FF] transition hover:border-[#00C8FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.25)] select-none shrink-0 cursor-pointer active:scale-95",
          compact
            ? "h-9 w-9 p-0 sm:h-8 sm:w-auto sm:px-2.5 sm:py-1.5 text-xs"
            : "h-9 px-2 sm:px-2.5 py-1.5 text-xs font-semibold"
        )}
        title={`Densité d'affichage: ${currentOption.label} (${currentOption.percentage})`}
      >
        <CurrentIcon size={16} className="text-[#00E5FF] shrink-0" />
        <span className="hidden sm:inline font-mono text-[11px] font-bold text-[#00E5FF]">
          {currentOption.percentage}
        </span>
        <SlidersHorizontal size={12} className="opacity-60 hidden md:inline shrink-0" />
      </button>

      {/* Menu Déroulant (Adaptatif Mobile / iOS / Desktop, anti-débordement horizontal) */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Options de densité d'affichage"
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[#006DFF]/40 bg-[#071320] p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1.5 border-b border-[#003B55]/60 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4C91B5]">
              Densité d'affichage
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-semibold">
              Matrice 4 Niveaux
            </span>
          </div>

          <div className="space-y-1">
            {DENSITY_OPTIONS.map((opt) => {
              const Icon = getIcon(opt.id);
              const isSelected = density === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDensity(opt.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer active:scale-[0.98]",
                    isSelected
                      ? "bg-[#003B55]/80 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]"
                      : "text-[#B8F3FF] hover:bg-[#0B1A2C] hover:text-white border border-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 p-1.5 rounded-md shrink-0",
                      isSelected ? "bg-[#00E5FF]/20 text-[#00E5FF]" : "bg-slate-800/80 text-slate-400"
                    )}
                  >
                    <Icon size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold font-mono truncate">{opt.label}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0",
                          isSelected ? "bg-[#00E5FF] text-slate-950" : "bg-slate-800 text-slate-300"
                        )}
                      >
                        {opt.badge}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {opt.description}
                    </div>

                    {/* Métriques réelles de la matrice */}
                    <div className="mt-1 flex items-center gap-2 text-[9.5px] font-mono text-[#4C91B5] flex-wrap">
                      <span>Btn: {opt.btnHeight}</span>
                      <span>•</span>
                      <span>Tab: {opt.tablePadding}</span>
                      <span>•</span>
                      <span>Txt: {opt.font}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-[#00E5FF] shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-1.5 border-t border-[#003B55]/40 px-2 text-[9px] text-slate-400 font-mono text-center">
            Adaptation dynamique instantanée de l'interface
          </div>
        </div>
      )}
    </div>
  );
};
