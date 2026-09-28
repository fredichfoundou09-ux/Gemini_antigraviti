import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { normalizePhoneForWhatsApp } from "../components/ContactButtons";
import {
  getUiTheme,
  setUiTheme,
  applyThemeToDOM,
  getUiBrightness,
  setUiBrightness,
  applyBrightnessToDOM,
} from "../lib/uiTheme";

describe("Normalisation Téléphonique WhatsApp (ContactButtons)", () => {
  it("gère les numéros locaux congolais à 9 chiffres avec 0 initial", () => {
    expect(normalizePhoneForWhatsApp("06 999 99 99")).toBe("24269999999");
    expect(normalizePhoneForWhatsApp("05-555-55-55")).toBe("24255555555");
  });

  it("gère les numéros locaux à 8 chiffres", () => {
    expect(normalizePhoneForWhatsApp("69999999")).toBe("24269999999");
  });

  it("gère les numéros internationaux avec préfixe + ou 00", () => {
    expect(normalizePhoneForWhatsApp("+242 06 999 99 99")).toBe("242069999999");
    expect(normalizePhoneForWhatsApp("00242069999999")).toBe("242069999999");
    expect(normalizePhoneForWhatsApp("+33 6 12 34 56 78")).toBe("33612345678");
  });

  it("retourne null pour les numéros absents ou invalides", () => {
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
    expect(normalizePhoneForWhatsApp(undefined)).toBeNull();
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp("123")).toBeNull();
  });
});

describe("Gestionnaire de Thème Réversible (uiTheme)", () => {
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
        style: {
          setProperty: vi.fn(),
          getPropertyValue: vi.fn(),
        },
      },
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({
        style: {},
        setAttribute: vi.fn(),
      })),
      body: {
        appendChild: vi.fn(),
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

  it("retourne 'classic' par défaut lorsque aucun thème n'est sélectionné", () => {
    expect(getUiTheme()).toBe("classic");
  });

  it("permet d'activer le thème 'modern' et l'applique au DOM et localStorage", () => {
    setUiTheme("modern");

    expect(mockStore["sn:ui-theme"]).toBe("modern");
    expect(getUiTheme()).toBe("modern");
    expect(rootAttributes["data-theme"]).toBe("modern");
    expect(rootClasses.has("theme-modern")).toBe(true);
    expect(rootClasses.has("theme-classic")).toBe(false);
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.theme).toBe("modern");
  });

  it("permet de revenir immédiatement à l'ancien thème 'classic' (réversibilité)", () => {
    setUiTheme("modern");
    expect(getUiTheme()).toBe("modern");

    // Revenir au classique
    setUiTheme("classic");
    expect(mockStore["sn:ui-theme"]).toBe("classic");
    expect(getUiTheme()).toBe("classic");
    expect(rootAttributes["data-theme"]).toBe("classic");
    expect(rootClasses.has("theme-classic")).toBe(true);
    expect(rootClasses.has("theme-modern")).toBe(false);
  });

  it("migre automatiquement l'ancien thème 'light' vers 'orange-slate'", () => {
    mockStore["sn:ui-theme"] = "light";

    // getUiTheme doit détecter "light" et migrer vers "orange-slate"
    expect(getUiTheme()).toBe("orange-slate");
    expect(mockStore["sn:ui-theme"]).toBe("orange-slate");
  });

  it("permet d'activer le thème 'crimson' (Rouge Sentinelle) et l'applique au DOM et localStorage", () => {
    setUiTheme("crimson");

    expect(mockStore["sn:ui-theme"]).toBe("crimson");
    expect(getUiTheme()).toBe("crimson");
    expect(rootAttributes["data-theme"]).toBe("crimson");
    expect(rootClasses.has("theme-crimson")).toBe(true);
    expect(rootClasses.has("theme-classic")).toBe(false);
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.theme).toBe("crimson");
  });

  it("permet d'activer le thème 'orange-slate' (Orange Ardoise) et l'applique au DOM et localStorage", () => {
    setUiTheme("orange-slate");

    expect(mockStore["sn:ui-theme"]).toBe("orange-slate");
    expect(getUiTheme()).toBe("orange-slate");
    expect(rootAttributes["data-theme"]).toBe("orange-slate");
    expect(rootClasses.has("theme-orange-slate")).toBe(true);
    expect(rootClasses.has("theme-classic")).toBe(false);
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.theme).toBe("orange-slate");
  });

  it("permet d'activer le thème 'icrm-violet' (I-CRM Violet) et l'applique au DOM et localStorage", () => {
    setUiTheme("icrm-violet");

    expect(mockStore["sn:ui-theme"]).toBe("icrm-violet");
    expect(getUiTheme()).toBe("icrm-violet");
    expect(rootAttributes["data-theme"]).toBe("icrm-violet");
    expect(rootClasses.has("theme-icrm-violet")).toBe(true);
    expect(rootClasses.has("theme-classic")).toBe(false);
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.theme).toBe("icrm-violet");
  });

  it("permet d'activer le thème 'uba-archives' (UBA Archives) et l'applique au DOM et localStorage", () => {
    setUiTheme("uba-archives");

    expect(mockStore["sn:ui-theme"]).toBe("uba-archives");
    expect(getUiTheme()).toBe("uba-archives");
    expect(rootAttributes["data-theme"]).toBe("uba-archives");
    expect(rootClasses.has("theme-uba-archives")).toBe(true);
    expect(rootClasses.has("theme-classic")).toBe(false);
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.theme).toBe("uba-archives");
  });

  it("applique le thème au DOM correctement avec applyThemeToDOM", () => {
    applyThemeToDOM("crimson");
    expect(rootAttributes["data-theme"]).toBe("crimson");

    applyThemeToDOM("modern");
    expect(rootAttributes["data-theme"]).toBe("modern");

    applyThemeToDOM("light");
    expect(rootAttributes["data-theme"]).toBe("light");

    applyThemeToDOM("orange-slate");
    expect(rootAttributes["data-theme"]).toBe("orange-slate");

    applyThemeToDOM("icrm-violet");
    expect(rootAttributes["data-theme"]).toBe("icrm-violet");

    applyThemeToDOM("uba-archives");
    expect(rootAttributes["data-theme"]).toBe("uba-archives");

    applyThemeToDOM("classic");
    expect(rootAttributes["data-theme"]).toBe("classic");
  });

  it("gère la luminosité par défaut (92% confort visuel) et permet de la modifier", () => {
    expect(getUiBrightness()).toBe(92);

    setUiBrightness(80);
    expect(mockStore["sn:ui-brightness"]).toBe("80");
    expect(getUiBrightness()).toBe(80);
    expect(rootAttributes["data-brightness"]).toBe("80");
    expect(dispatchedEvents.some((e) => e.type === "sentinelles:brightness-changed" || e.detail?.brightness === 80)).toBe(true);

    // Clamping entre 60% et 100%
    setUiBrightness(150);
    expect(getUiBrightness()).toBe(100);

    setUiBrightness(20);
    expect(getUiBrightness()).toBe(60);
  });
});
