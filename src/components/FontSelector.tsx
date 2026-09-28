import React, { useState, useEffect } from "react";
import {
  Type,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  ZoomIn,
  CheckCircle2,
} from "lucide-react";
import {
  FONT_OPTIONS,
  FONT_SCALE_LABELS,
  FontFamilyId,
  FontScaleId,
  getFontFamily,
  setFontFamily,
  getFontScale,
  setFontScale,
  resetFontSettings,
  getFontCSSValue,
} from "@/lib/uiFont";
import { cn } from "@/utils/cn";
import { toastMsg } from "@/lib/toast";

interface FontSelectorProps {
  className?: string;
  compact?: boolean;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ className, compact = false }) => {
  const [currentFont, setCurrentFont] = useState<FontFamilyId>(getFontFamily());
  const [currentScale, setCurrentScale] = useState<FontScaleId>(getFontScale());

  useEffect(() => {
    const handleFontChange = (e: any) => {
      if (e.detail?.fontFamily) setCurrentFont(e.detail.fontFamily);
      if (e.detail?.fontScale) setCurrentScale(e.detail.fontScale);
    };

    window.addEventListener("sentinelles:font-changed", handleFontChange);
    return () => window.removeEventListener("sentinelles:font-changed", handleFontChange);
  }, []);

  const handleSelectFont = (id: FontFamilyId) => {
    setFontFamily(id);
    setCurrentFont(id);
    const selected = FONT_OPTIONS.find((f) => f.id === id);
    toastMsg.success(
      "Police mise à jour ✓",
      `Police active : ${selected?.label || id}`
    );
  };

  const handleSelectScale = (scale: FontScaleId) => {
    setFontScale(scale);
    setCurrentScale(scale);
    const label = FONT_SCALE_LABELS[scale]?.label || scale;
    toastMsg.success(
      "Taille de police modifiée ✓",
      `Taille appliquée : ${label} (${scale === "small" ? "0.90x" : scale === "normal" ? "1.00x" : "1.15x"})`
    );
  };

  const handleReset = () => {
    resetFontSettings();
    setCurrentFont("system");
    setCurrentScale("normal");
    toastMsg.success(
      "Police réinitialisée ✓",
      "La typographie par défaut du système a été restaurée."
    );
  };

  const activeFontOption = FONT_OPTIONS.find((f) => f.id === currentFont) || FONT_OPTIONS[0];

  return (
    <div className={cn("space-y-5", className)}>
      {/* En-tête du sélecteur */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
            <Type size={18} />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              Typographie & Sélecteur de Police
            </h3>
            <p className="text-xs text-slate-400">
              Personnalisez la police d'écriture et la taille du texte sur toute l'interface. Immédiat et persistant.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
          title="Restaurer la typographie par défaut du système"
        >
          <RotateCcw size={13} className="text-cyan-400" />
          <span>Réinitialiser la police</span>
        </button>
      </div>

      {/* ZONE D'APERÇU EN DIRECT (Exigé par le prompt : "Rapport journalier — 1 234,56") */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-black/40 to-slate-900/40 p-4 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-2 text-xs font-semibold text-cyan-300">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
            <Sparkles size={13} className="text-cyan-400" />
            Aperçu en direct de la police
          </span>
          <span className="rounded-full bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 text-[11px] font-mono text-cyan-200">
            {activeFontOption.label} • {FONT_SCALE_LABELS[currentScale]?.label}
          </span>
        </div>

        <div
          className="rounded-xl border border-white/10 bg-black/40 p-4 transition-all"
          style={{
            fontFamily: getFontCSSValue(currentFont),
          }}
        >
          <p className="text-xl sm:text-2xl font-bold text-white tracking-normal mb-1">
            Rapport journalier — 1 234,56
          </p>
          <p className="text-xs sm:text-sm text-slate-300">
            SENTINEL'S • Génie Informatique & Télécoms — Évaluation continue et gestion académique
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-normal">
            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">0123456789</span>
            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Aa Bb Cc Dd Ee Ff Gg Hh</span>
            <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Éèêë àâ ç îï ô ùû</span>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR DE TAILLE DE POLICE (Petite / Normale / Grande) */}
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
          <span className="flex items-center gap-1.5">
            <ZoomIn size={14} className="text-cyan-400" />
            Taille de police d'affichage
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Multiplicateur : {currentScale === "small" ? "0.90x" : currentScale === "normal" ? "1.00x" : "1.15x"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {(["small", "normal", "large"] as const).map((scale) => {
            const isSelected = currentScale === scale;
            const info = FONT_SCALE_LABELS[scale];
            return (
              <button
                key={scale}
                type="button"
                onClick={() => handleSelectScale(scale)}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between group",
                  isSelected
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/5"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">{info.label}</span>
                  {isSelected && <CheckCircle2 size={13} className="text-cyan-400" />}
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                  {scale === "small" ? "0.90x" : scale === "normal" ? "1.00x (Recommandé)" : "1.15x"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRILLE DE POLICES AVEC CHAQUE NOM PRÉVISUALISÉ DANS SA PROPRE POLICE */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-200 block">
          Choisir une famille de police ({FONT_OPTIONS.length} options disponibles)
        </label>
        
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FONT_OPTIONS.map((font) => {
            const isSelected = currentFont === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => handleSelectFont(font.id)}
                className={cn(
                  "p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                  isSelected
                    ? "border-cyan-400 bg-cyan-950/40 text-white shadow-[0_0_15px_rgba(0,229,255,0.25)] ring-1 ring-cyan-400/40"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25 hover:bg-white/[0.04]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    {/* Nom affiché DANS SA PROPRE POLICE */}
                    <span
                      className="text-sm font-bold tracking-tight text-white group-hover:text-cyan-200 transition"
                      style={{ fontFamily: font.fontFamilyCSS }}
                    >
                      {font.label}
                    </span>
                    {isSelected && (
                      <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-400/40 shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {font.description}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="capitalize">{font.category}</span>
                  <span
                    className="font-semibold text-slate-300"
                    style={{ fontFamily: font.fontFamilyCSS }}
                  >
                    1234 • Abc
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
