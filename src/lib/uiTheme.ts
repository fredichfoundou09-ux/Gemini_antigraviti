/**
 * Gestionnaire du thème d'affichage UI/UX (Réversible à tout moment).
 * 
 * Thèmes supportés :
 * - "classic" (Défaut) : L'interface d'origine sombre & néon Sentinelles.
 * - "light" : Thème clair instantané avec inversion chromatique équilibrée et compensation des médias.
 * - "modern" : Variante épurée, contrastée avec reflets cyan/saphir adoucis et typographie aérée.
 */

export type UiTheme = "classic" | "light" | "modern";

const STORAGE_KEY = "sn:ui-theme";

export function getUiTheme(): UiTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "modern" || saved === "classic") {
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
  
  // Applique les deux attributs pour compatibilité totale (data-theme et data-ui-theme)
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-ui-theme", theme);

  if (theme === "light") {
    root.classList.add("theme-light");
    root.classList.remove("theme-classic", "theme-modern");
  } else if (theme === "modern") {
    root.classList.add("theme-modern");
    root.classList.remove("theme-classic", "theme-light");
  } else {
    root.classList.add("theme-classic");
    root.classList.remove("theme-modern", "theme-light");
  }
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyThemeToDOM();
}
