/**
 * Gestionnaire du thème d'affichage UI/UX (Réversible à tout moment).
 * 
 * Thèmes supportés :
 * - "classic" (Défaut) : L'interface d'origine sombre & néon Sentinelles.
 * - "modern" : Variante épurée, contrastée avec reflets cyan/saphir adoucis et typographie aérée.
 */

export type UiTheme = "classic" | "modern";

const STORAGE_KEY = "sn:ui-theme";

export function getUiTheme(): UiTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "modern" || saved === "classic") {
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
  window.dispatchEvent(new CustomEvent("sentinelles:theme-changed", { detail: { theme } }));
}

export function applyThemeToDOM(theme: UiTheme = getUiTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "modern") {
    root.setAttribute("data-theme", "modern");
    root.classList.add("theme-modern");
    root.classList.remove("theme-classic");
  } else {
    root.setAttribute("data-theme", "classic");
    root.classList.add("theme-classic");
    root.classList.remove("theme-modern");
  }
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyThemeToDOM();
}
