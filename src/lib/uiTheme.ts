/**
 * Gestionnaire du thème d'affichage UI/UX (Réversible à tout moment).
 * 
 * Thèmes supportés :
 * - "classic" (Défaut) : L'interface d'origine sombre & néon Sentinelles.
 * - "crimson" : Thème Rouge Sentinelle & Chrome Métallique inspiré du blason officiel.
 * - "light" : Thème clair instantané avec inversion chromatique équilibrée et compensation des médias.
 * - "modern" : Variante épurée, contrastée avec reflets cyan/saphir adoucis et typographie aérée.
 * - "orange-slate" : Thème Orange Ardoise — Palette orange, bleu-noir et gris ardoise inspirée d'un design infographique moderne.
 */

export type UiTheme = "classic" | "crimson" | "orange-slate" | "modern" | "light";

const STORAGE_KEY = "sn:ui-theme";

export function getUiTheme(): UiTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Migration automatique de l'ancien thème clair vers Orange Ardoise
    if (saved === "light") {
      try {
        localStorage.setItem(STORAGE_KEY, "orange-slate");
      } catch {}
      return "orange-slate";
    }
    if (saved === "crimson" || saved === "modern" || saved === "classic" || saved === "orange-slate") {
      return saved;
    }
  } catch {
    // Fallback safe en cas de restrictions storage
  }
  return "classic"; // Par défaut, strict respect de l'UI/UX actuelle
}

export function setUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Fallback safe
  }
  applyThemeToDOM(theme);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sentinelles:theme-changed", { detail: { theme } }));
  }
}

export function applyThemeToDOM(theme: UiTheme = getUiTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  
  // Applique l'attribut standard unique
  root.setAttribute("data-theme", theme);

  root.classList.remove("theme-classic", "theme-crimson", "theme-modern", "theme-light", "theme-orange-slate");
  root.classList.add(`theme-${theme}`);
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyThemeToDOM();
}
