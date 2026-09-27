import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UiTheme, getUiTheme, setUiTheme,
  getSpatialSettings, setSpatialSettings, applySpatialSettingsToDOM
} from "@/lib/uiTheme";
import {
  getNotificationSoundPreferences,
  setNotificationSoundPreferences,
  playNotificationSound,
  NotificationSoundId
} from "@/lib/pushNotifications";

describe("Phase 3 — Mode Spatial & Sons de Notifications", () => {
  let mockStore: Record<string, string> = {};
  let rootAttributes: Record<string, string> = {};
  let rootClasses: Set<string> = new Set();
  let dispatchedEvents: CustomEvent[] = [];

  beforeEach(() => {
    mockStore = {};
    rootAttributes = {};
    rootClasses = new Set();
    dispatchedEvents = [];

    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { mockStore = {}; },
    };

    // Mock document
    (globalThis as any).document = {
      documentElement: {
        setAttribute: (k: string, v: string) => { rootAttributes[k] = v; },
        getAttribute: (k: string) => rootAttributes[k] || null,
        removeAttribute: (k: string) => { delete rootAttributes[k]; },
        classList: {
          add: (...classes: string[]) => classes.forEach((c) => rootClasses.add(c)),
          remove: (...classes: string[]) => classes.forEach((c) => rootClasses.delete(c)),
          contains: (c: string) => rootClasses.has(c),
        },
      },
    };

    // Mock window
    (globalThis as any).window = {
      dispatchEvent: (e: any) => {
        dispatchedEvents.push(e);
        return true;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  it("permet d'activer le Mode Spatial et applique l'attribut data-theme='spatial' et la classe 'theme-spatial'", () => {
    setUiTheme("spatial");
    expect(getUiTheme()).toBe("spatial");
    expect(document.documentElement.getAttribute("data-theme")).toBe("spatial");
    expect(document.documentElement.classList.contains("theme-spatial")).toBe(true);
  });

  it("permet de basculer de manière réversible entre le Mode Spatial et le Mode Classique", () => {
    setUiTheme("spatial");
    expect(getUiTheme()).toBe("spatial");

    setUiTheme("classic");
    expect(getUiTheme()).toBe("classic");
    expect(document.documentElement.getAttribute("data-theme")).toBe("classic");
    expect(document.documentElement.classList.contains("theme-classic")).toBe(true);
    expect(document.documentElement.classList.contains("theme-spatial")).toBe(false);
  });

  it("gère et persiste les réglages fins du Mode Spatial (halo, transparence, reduced-motion)", () => {
    // Valeurs par défaut
    const initial = getSpatialSettings();
    expect(initial.glowIntensity).toBe("medium");
    expect(initial.transparency).toBe(true);
    expect(initial.reducedMotion).toBe(false);

    // Mise à jour personnalisée
    setSpatialSettings({
      glowIntensity: "high",
      transparency: false,
      reducedMotion: true,
    });

    const updated = getSpatialSettings();
    expect(updated.glowIntensity).toBe("high");
    expect(updated.transparency).toBe(false);
    expect(updated.reducedMotion).toBe(true);

    applySpatialSettingsToDOM();
    expect(document.documentElement.getAttribute("data-spatial-glow")).toBe("high");
    expect(document.documentElement.getAttribute("data-spatial-transparency")).toBe("false");
    expect(document.documentElement.classList.contains("spatial-reduced-motion")).toBe(true);
  });

  it("gère les préférences de sons de notification (activation et choix du timbre)", () => {
    const prefs = getNotificationSoundPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.soundId).toBe("sentinel");

    setNotificationSoundPreferences({
      enabled: false,
      soundId: "spatial_bip"
    });

    const updated = getNotificationSoundPreferences();
    expect(updated.enabled).toBe(false);
    expect(updated.soundId).toBe("spatial_bip");
  });

  it("exécute playNotificationSound sans lever d'exception pour chaque timbre", () => {
    const soundList: NotificationSoundId[] = [
      "sentinel",
      "spatial_bip",
      "radar",
      "harmonic",
      "subtle",
      "none"
    ];

    soundList.forEach((soundId) => {
      expect(() => playNotificationSound(soundId)).not.toThrow();
    });
  });
});
