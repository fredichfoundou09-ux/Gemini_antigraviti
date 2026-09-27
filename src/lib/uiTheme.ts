/**
 * Gestionnaire du thème d'affichage UI/UX (Réversible à tout moment).
 * 
 * Thèmes supportés :
 * - "classic" (Défaut) : L'interface d'origine sombre & néon Sentinelles.
 * - "spatial" (Nouveau) : Centre de contrôle spatial professionnel (#04070D, #08162B, #00E5FF, HUD cyan).
 * - "crimson" : Thème Rouge Sentinelle & Chrome Métallique inspiré du blason officiel.
 * - "light" : Thème clair instantané avec inversion chromatique équilibrée et compensation des médias.
 * - "modern" : Variante épurée, contrastée avec reflets cyan/saphir adoucis et typographie aérée.
 * - "orange-slate" : Thème Orange Ardoise — Palette orange, bleu-noir et gris ardoise inspirée d'un design infographique moderne.
 */

export type UiTheme = "classic" | "spatial" | "crimson" | "orange-slate" | "modern" | "light";

export interface SpatialSettings {
  glowIntensity: "subtle" | "medium" | "high";
  transparency: boolean;
  reducedMotion: boolean;
  notificationSound: "sentinel" | "spatial_bip" | "radar" | "harmonic" | "subtle" | "none";
  soundVolume: number;
}

const STORAGE_KEY = "sn:ui-theme";
const SPATIAL_SETTINGS_KEY = "sn:spatial-settings";

const DEFAULT_SPATIAL_SETTINGS: SpatialSettings = {
  glowIntensity: "medium",
  transparency: true,
  reducedMotion: false,
  notificationSound: "sentinel",
  soundVolume: 80,
};

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
    if (saved === "spatial" || saved === "crimson" || saved === "modern" || saved === "classic" || saved === "orange-slate") {
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

export function getSpatialSettings(): SpatialSettings {
  try {
    const raw = localStorage.getItem(SPATIAL_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SPATIAL_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SPATIAL_SETTINGS;
}

export function setSpatialSettings(settings: Partial<SpatialSettings>): void {
  const current = getSpatialSettings();
  const next = { ...current, ...settings };
  try {
    localStorage.setItem(SPATIAL_SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  applySpatialSettingsToDOM(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sentinelles:spatial-settings-changed", { detail: { settings: next } }));
  }
}

export function applySpatialSettingsToDOM(settings: SpatialSettings = getSpatialSettings()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Glow intensity
  root.setAttribute("data-spatial-glow", settings.glowIntensity);

  // 2. Transparence
  root.setAttribute("data-spatial-transparency", settings.transparency ? "true" : "false");

  // 3. Réduction des animations
  if (settings.reducedMotion) {
    root.classList.add("spatial-reduced-motion");
  } else {
    root.classList.remove("spatial-reduced-motion");
  }
}

export function applyThemeToDOM(theme: UiTheme = getUiTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  
  // Applique l'attribut standard unique
  root.setAttribute("data-theme", theme);

  root.classList.remove("theme-classic", "theme-spatial", "theme-crimson", "theme-modern", "theme-light", "theme-orange-slate");
  root.classList.add(`theme-${theme}`);

  applySpatialSettingsToDOM();
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyThemeToDOM();
}
