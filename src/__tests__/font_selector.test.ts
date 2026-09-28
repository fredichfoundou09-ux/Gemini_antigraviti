import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  FONT_OPTIONS,
  FONT_SCALE_FACTORS,
  FONT_SCALE_LABELS,
  FontFamilyId,
  FontScaleId,
  getFontFamily,
  setFontFamily,
  getFontScale,
  setFontScale,
  resetFontSettings,
  applyFontToDOM,
  getFontCSSValue,
} from "../lib/uiFont";

describe("Gestionnaire de Typographie & Sélecteur de Police (uiFont)", () => {
  let mockStore: Record<string, string> = {};
  let rootAttributes: Record<string, string> = {};
  let rootStyles: Record<string, string> = {};
  let bodyStyles: Record<string, string> = {};
  let dispatchedEvents: CustomEvent[] = [];

  beforeEach(() => {
    mockStore = {};
    rootAttributes = {};
    rootStyles = {};
    bodyStyles = {};
    dispatchedEvents = [];

    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };

    // Mock document
    (globalThis as any).document = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          rootAttributes[k] = v;
        },
        getAttribute: (k: string) => rootAttributes[k] || null,
        removeAttribute: (k: string) => {
          delete rootAttributes[k];
        },
        style: {
          setProperty: (prop: string, val: string) => {
            rootStyles[prop] = val;
          },
          getPropertyValue: (prop: string) => rootStyles[prop] || "",
        },
      },
      body: {
        style: {
          set fontFamily(v: string) {
            bodyStyles["font-family"] = v;
          },
          get fontFamily() {
            return bodyStyles["font-family"] || "";
          },
          set fontSize(v: string) {
            bodyStyles["font-size"] = v;
          },
          get fontSize() {
            return bodyStyles["font-size"] || "";
          },
          removeProperty: (prop: string) => {
            delete bodyStyles[prop];
          },
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

  it("retourne 'system' et échelle 'normal' par défaut", () => {
    expect(getFontFamily()).toBe("system");
    expect(getFontScale()).toBe("normal");
  });

  it("définit et persiste une nouvelle police (ex: Arial)", () => {
    setFontFamily("arial");

    expect(mockStore["sn:font-family"]).toBe("arial");
    expect(getFontFamily()).toBe("arial");
    expect(rootAttributes["data-font-family"]).toBe("arial");
    expect(rootStyles["--app-font-family"]).toContain("Arial");
    expect(bodyStyles["font-family"]).toContain("Arial");
    expect(dispatchedEvents.length).toBeGreaterThan(0);
    expect(dispatchedEvents[0].detail.fontFamily).toBe("arial");
  });

  it("supporte toutes les polices requises dans FONT_OPTIONS", () => {
    const expectedFonts: FontFamilyId[] = [
      "system",
      "arial",
      "aptos",
      "segoe-ui",
      "calibri",
      "tahoma",
      "verdana",
      "roboto",
      "open-sans",
      "poppins",
      "times",
      "consolas",
    ];

    expectedFonts.forEach((fontId) => {
      setFontFamily(fontId);
      expect(getFontFamily()).toBe(fontId);
      expect(rootAttributes["data-font-family"]).toBe(fontId);
      const css = getFontCSSValue(fontId);
      expect(css).toBeDefined();
      expect(css.length).toBeGreaterThan(0);
    });
  });

  it("modifie l'échelle de taille de police (small, normal, large)", () => {
    setFontScale("small");
    expect(mockStore["sn:font-scale"]).toBe("small");
    expect(getFontScale()).toBe("small");
    expect(rootAttributes["data-font-scale"]).toBe("small");
    expect(rootStyles["--app-font-scale"]).toBe("0.9");
    expect(bodyStyles["font-size"]).toBe("0.9rem");

    setFontScale("large");
    expect(mockStore["sn:font-scale"]).toBe("large");
    expect(getFontScale()).toBe("large");
    expect(rootAttributes["data-font-scale"]).toBe("large");
    expect(rootStyles["--app-font-scale"]).toBe("1.15");
    expect(bodyStyles["font-size"]).toBe("1.15rem");
  });

  it("réinitialise les réglages de police avec resetFontSettings", () => {
    setFontFamily("poppins");
    setFontScale("large");
    expect(getFontFamily()).toBe("poppins");
    expect(getFontScale()).toBe("large");

    resetFontSettings();
    expect(getFontFamily()).toBe("system");
    expect(getFontScale()).toBe("normal");
    expect(mockStore["sn:font-family"]).toBeUndefined();
    expect(mockStore["sn:font-scale"]).toBeUndefined();
    expect(rootAttributes["data-font-family"]).toBe("system");
    expect(rootAttributes["data-font-scale"]).toBe("normal");
  });

  it("fournit les bons coefficients et libellés d'échelle", () => {
    expect(FONT_SCALE_FACTORS.small).toBe(0.9);
    expect(FONT_SCALE_FACTORS.normal).toBe(1.0);
    expect(FONT_SCALE_FACTORS.large).toBe(1.15);

    expect(FONT_SCALE_LABELS.small.label).toBe("Petite");
    expect(FONT_SCALE_LABELS.normal.label).toBe("Normale");
    expect(FONT_SCALE_LABELS.large.label).toBe("Grande");
  });
});
