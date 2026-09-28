/**
 * Gestionnaire du thème d'affichage UI/UX (Réversible à tout moment).
 * 
 * Thèmes supportés :
 * - "classic" (Défaut) : L'interface d'origine sombre & néon Sentinelles.
 * - "spatial" : Centre de contrôle spatial professionnel (#04070D, #08162B, #00E5FF, HUD cyan).
 * - "crimson" : Thème Rouge Sentinelle & Chrome Métallique inspiré du blason officiel.
 * - "orange-slate" : Thème Orange Ardoise — Palette orange vif & bleu-noir structuré.
 * - "modern" : Variante épurée, contrastée avec reflets cyan/saphir et typographie aérée.
 * - "icrm-violet" : Dashboard SaaS Moderne — Cartes feutrées anti-éblouissement, lavande (#5B3FC4 / #E3DFF2), accents cyan (#12BFE0) et rose.
 * - "uba-archives" : Charte Institutionnelle UBA — Rouge officiel chaleureux (#D91B23) & Blanc perlé doux, en-têtes contrastés, tableaux à lignes alternées (#FBF0F2).
 * - "light" : Thème clair hérité (migré vers orange-slate si présent).
 */

export type UiTheme =
  | "classic"
  | "spatial"
  | "crimson"
  | "orange-slate"
  | "modern"
  | "icrm-violet"
  | "uba-archives"
  | "light";

export interface SpatialSettings {
  glowIntensity: "subtle" | "medium" | "high";
  transparency: boolean;
  reducedMotion: boolean;
  notificationSound: "sentinel" | "spatial_bip" | "radar" | "harmonic" | "subtle" | "none";
  soundVolume: number;
}

const STORAGE_KEY = "sn:ui-theme";
const SPATIAL_SETTINGS_KEY = "sn:spatial-settings";
const BRIGHTNESS_STORAGE_KEY = "sn:ui-brightness";

const DEFAULT_SPATIAL_SETTINGS: SpatialSettings = {
  glowIntensity: "medium",
  transparency: true,
  reducedMotion: false,
  notificationSound: "sentinel",
  soundVolume: 80,
};

// Valeur par défaut de luminosité : 92% (atténue l'éblouissement et protège la vue)
const DEFAULT_BRIGHTNESS = 92;

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
    if (
      saved === "spatial" ||
      saved === "crimson" ||
      saved === "modern" ||
      saved === "classic" ||
      saved === "orange-slate" ||
      saved === "icrm-violet" ||
      saved === "uba-archives"
    ) {
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

export function getUiBrightness(): number {
  try {
    const saved = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val >= 60 && val <= 100) {
        return val;
      }
    }
  } catch {}
  return DEFAULT_BRIGHTNESS;
}

export function setUiBrightness(percent: number): void {
  const clamped = Math.max(60, Math.min(100, Math.round(percent)));
  try {
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, clamped.toString());
  } catch {}
  applyBrightnessToDOM(clamped);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("sentinelles:brightness-changed", { detail: { brightness: clamped } })
    );
  }
}

export function applyBrightnessToDOM(brightness: number = getUiBrightness()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root) return;

  root.setAttribute("data-brightness", brightness.toString());
  if (root.style && typeof root.style.setProperty === "function") {
    root.style.setProperty("--app-brightness", (brightness / 100).toString());
    root.style.setProperty("--app-brightness-val", brightness.toString());
  }
  
  // Gestion d'un overlay de confort visuel transparent et non-bloquant
  if (document.body) {
    let overlay = document.getElementById("sentinelles-comfort-dim");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sentinelles-comfort-dim";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    
    // Plus la luminosité diminue sous 100, plus le voile tamisé anti-éblouissement s'applique en douceur
    const dimFactor = (100 - brightness) * 0.007; // 100% -> 0 opacity, 80% -> 0.14 opacity, 60% -> 0.28 opacity
    if (overlay.style) {
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "99998";
      overlay.style.backgroundColor = "#000000";
      overlay.style.opacity = dimFactor.toString();
      overlay.style.transition = "opacity 0.25s ease";
    }
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

  root.classList.remove(
    "theme-classic",
    "theme-spatial",
    "theme-crimson",
    "theme-modern",
    "theme-light",
    "theme-orange-slate",
    "theme-icrm-violet",
    "theme-uba-archives"
  );
  root.classList.add(`theme-${theme}`);

  applySpatialSettingsToDOM();
  applyBrightnessToDOM();
}

// Initialisation immédiate au chargement du script
if (typeof window !== "undefined") {
  applyThemeToDOM();
}
