/**
 * Gestionnaire de Police et d'Échelle Typographique (uiFont).
 * Permet de personnaliser la police et la taille d'affichage de toute l'application.
 * 100% réversible, persistant et universel (avec fallbacks automatiques).
 */

export type FontFamilyId =
  | "system"
  | "arial"
  | "aptos"
  | "segoe-ui"
  | "calibri"
  | "tahoma"
  | "verdana"
  | "roboto"
  | "open-sans"
  | "poppins"
  | "times"
  | "consolas";

export type FontScaleId = "small" | "normal" | "large";

export interface FontOption {
  id: FontFamilyId;
  label: string;
  category: "sans-serif" | "serif" | "monospace";
  fontFamilyCSS: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "system",
    label: "Par défaut (Système)",
    category: "sans-serif",
    fontFamilyCSS: "var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
    description: "Typographie officielle de la plateforme",
  },
  {
    id: "arial",
    label: "Arial",
    category: "sans-serif",
    fontFamilyCSS: "Arial, 'Helvetica Neue', Helvetica, 'Liberation Sans', sans-serif",
    description: "Universelle, lisibilité garantie sur tous les systèmes",
  },
  {
    id: "aptos",
    label: "Aptos",
    category: "sans-serif",
    fontFamilyCSS: "Aptos, 'Segoe UI', Calibri, Arial, sans-serif",
    description: "Moderne, nouvelle référence Microsoft 365",
  },
  {
    id: "segoe-ui",
    label: "Segoe UI",
    category: "sans-serif",
    fontFamilyCSS: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
    description: "Standard Windows, interface épurée et très lisible",
  },
  {
    id: "calibri",
    label: "Calibri",
    category: "sans-serif",
    fontFamilyCSS: "Calibri, Candara, 'Segoe UI', Arial, sans-serif",
    description: "Standard bureautique, doux et compact",
  },
  {
    id: "tahoma",
    label: "Tahoma",
    category: "sans-serif",
    fontFamilyCSS: "Tahoma, Verdana, 'Segoe UI', Arial, sans-serif",
    description: "Compacte, excellente netteté pour les tableaux denses",
  },
  {
    id: "verdana",
    label: "Verdana",
    category: "sans-serif",
    fontFamilyCSS: "Verdana, Geneva, 'Segoe UI', Arial, sans-serif",
    description: "Grande lisibilité avec espacement généreux",
  },
  {
    id: "roboto",
    label: "Roboto",
    category: "sans-serif",
    fontFamilyCSS: "Roboto, 'Segoe UI', Arial, sans-serif",
    description: "Moderne et neutre, parfait pour les tableaux de bord",
  },
  {
    id: "open-sans",
    label: "Open Sans",
    category: "sans-serif",
    fontFamilyCSS: "'Open Sans', 'Segoe UI', Roboto, Arial, sans-serif",
    description: "Humaniste et équilibrée, grand confort de lecture",
  },
  {
    id: "poppins",
    label: "Poppins",
    category: "sans-serif",
    fontFamilyCSS: "Poppins, 'Segoe UI', Roboto, Arial, sans-serif",
    description: "Géométrique et élégante, style SaaS moderne I-CRM",
  },
  {
    id: "times",
    label: "Times New Roman",
    category: "serif",
    fontFamilyCSS: "'Times New Roman', Times, 'Liberation Serif', serif",
    description: "Classique à empattements, style officiel et académique",
  },
  {
    id: "consolas",
    label: "Consolas",
    category: "monospace",
    fontFamilyCSS: "Consolas, 'Cascadia Code', 'Courier New', monospace",
    description: "Chasse fixe (monospace), idéale pour données et codes",
  },
];

export const FONT_SCALE_FACTORS: Record<FontScaleId, number> = {
  small: 0.9,
  normal: 1.0,
  large: 1.15,
};

export const FONT_SCALE_LABELS: Record<FontScaleId, { label: string; desc: string }> = {
  small: { label: "Petite", desc: "Échelle 0.90x — Plus compact" },
  normal: { label: "Normale", desc: "Échelle 1.00x — Standard recommandé" },
  large: { label: "Grande", desc: "Échelle 1.15x — Confort visuel renforcé" },
};

const FONT_FAMILY_STORAGE_KEY = "sn:font-family";
const FONT_SCALE_STORAGE_KEY = "sn:font-scale";

export function getFontFamily(): FontFamilyId {
  try {
    const saved = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
    if (saved && FONT_OPTIONS.some((f) => f.id === saved)) {
      return saved as FontFamilyId;
    }
  } catch {
    // Fallback safe
  }
  return "system";
}

export function setFontFamily(family: FontFamilyId): void {
  try {
    localStorage.setItem(FONT_FAMILY_STORAGE_KEY, family);
  } catch {}
  applyFontToDOM();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sentinelles:font-changed", {
        detail: { fontFamily: family, fontScale: getFontScale() },
      })
    );
  }
}

export function getFontScale(): FontScaleId {
  try {
    const saved = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (saved === "small" || saved === "normal" || saved === "large") {
      return saved;
    }
  } catch {}
  return "normal";
}

export function setFontScale(scale: FontScaleId): void {
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, scale);
  } catch {}
  applyFontToDOM();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sentinelles:font-changed", {
        detail: { fontFamily: getFontFamily(), fontScale: scale },
      })
    );
  }
}

export function resetFontSettings(): void {
  try {
    localStorage.removeItem(FONT_FAMILY_STORAGE_KEY);
    localStorage.removeItem(FONT_SCALE_STORAGE_KEY);
  } catch {}
  applyFontToDOM();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sentinelles:font-changed", {
        detail: { fontFamily: "system", fontScale: "normal" },
      })
    );
  }
}

export function getFontCSSValue(familyId: FontFamilyId = getFontFamily()): string {
  const match = FONT_OPTIONS.find((f) => f.id === familyId);
  return match ? match.fontFamilyCSS : FONT_OPTIONS[0].fontFamilyCSS;
}

export function applyFontToDOM(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const family = getFontFamily();
  const scale = getFontScale();
  const cssFont = getFontCSSValue(family);
  const factor = FONT_SCALE_FACTORS[scale] || 1.0;

  root.setAttribute("data-font-family", family);
  root.setAttribute("data-font-scale", scale);

  root.style.setProperty("--app-font-family", cssFont);
  root.style.setProperty("--app-font-scale", factor.toString());

  // Mise à jour directe de la police sur le body si ce n'est pas le système
  if (family === "system") {
    document.body.style.removeProperty("font-family");
  } else {
    document.body.style.fontFamily = cssFont;
  }

  // Applique l'échelle de taille
  document.body.style.fontSize = `${factor}rem`;
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyFontToDOM();
}
