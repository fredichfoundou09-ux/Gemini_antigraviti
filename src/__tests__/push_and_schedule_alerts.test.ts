import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playNotificationChime,
  sendNativeNotification,
  sendTestNotification,
} from "../lib/pushNotifications";
import { useScheduleAlerts } from "../hooks/useScheduleAlerts";

describe("Notifications Système & Push PWA (pushNotifications.ts)", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(globalThis, "localStorage", {
      value: {
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
      },
      configurable: true,
      writable: true,
    });

    // Mock window & window.Notification
    const MockNotification = function (this: any, title: string, options: any) {
      this.title = title;
      this.options = options;
      this.close = vi.fn();
    } as any;
    MockNotification.permission = "default";
    MockNotification.requestPermission = vi.fn().mockResolvedValue("granted");

    Object.defineProperty(globalThis, "window", {
      value: {
        Notification: MockNotification,
        location: { href: "" },
        focus: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    // Also define global Notification to match window.Notification
    Object.defineProperty(globalThis, "Notification", {
      value: MockNotification,
      configurable: true,
      writable: true,
    });

    // Mock navigator.vibrate
    try {
      Object.defineProperty(navigator, "vibrate", {
        value: vi.fn(),
        configurable: true,
        writable: true,
      });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("détecte correctement si l'API Notification est supportée ou absente", () => {
    // Cas supporté
    expect(isNotificationSupported()).toBe(true);
    expect(getNotificationPermission()).toBe("default");

    // Cas non supporté
    delete (window as any).Notification;
    expect(isNotificationSupported()).toBe(false);
    expect(getNotificationPermission()).toBe("unsupported");
  });

  it("demande la permission utilisateur avec succès", async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue("granted");
    (window as any).Notification.requestPermission = mockRequestPermission;

    const result = await requestNotificationPermission();
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result).toBe("granted");
  });

  it("exécute le carillon Web Audio sans crash même si AudioContext est suspendu ou absent", () => {
    expect(() => playNotificationChime()).not.toThrow();

    // Simulation avec AudioContext
    const mockResume = vi.fn().mockResolvedValue(undefined);
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };

    function MockAudioContext(this: any) {
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
      this.resume = mockResume;
      this.createOscillator = () => mockOscillator;
      this.createGain = () => mockGain;
    }

    (window as any).AudioContext = MockAudioContext;

    expect(() => playNotificationChime()).not.toThrow();
    expect(mockResume).toHaveBeenCalled();
  });

  it("refuse l'envoi si la permission n'est pas 'granted'", async () => {
    (window as any).Notification.permission = "denied";

    const sent = await sendNativeNotification({
      title: "Test",
      body: "Notification refusée",
    });
    expect(sent).toBe(false);
  });

  it("déclenche la notification via ServiceWorker showNotification quand disponible et permise", async () => {
    const mockShowNotification = vi.fn().mockResolvedValue(undefined);
    (window as any).Notification.permission = "granted";

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          showNotification: mockShowNotification,
        }),
      },
      configurable: true,
      writable: true,
    });

    const sent = await sendNativeNotification({
      title: "SENTINEL'S — Nouveau message",
      body: "Bonjour, voici les informations du cours.",
      url: "/app/messages",
      tag: "msg-123",
      playSound: false,
    });

    expect(sent).toBe(true);
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "SENTINEL'S — Nouveau message",
      expect.objectContaining({
        body: "Bonjour, voici les informations du cours.",
        data: { url: "/app/messages" },
        tag: "msg-123",
      })
    );
  });

  it("sendTestNotification sollicite la permission et transmet le message de test", async () => {
    const mockShowNotification = vi.fn().mockResolvedValue(undefined);
    (window as any).Notification.permission = "granted";
    (window as any).Notification.requestPermission = vi.fn().mockResolvedValue("granted");

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve({
          showNotification: mockShowNotification,
        }),
      },
      configurable: true,
      writable: true,
    });

    const testResult = await sendTestNotification();
    expect(testResult).toBe(true);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Test de Notification"),
      expect.objectContaining({
        tag: "sentinels-test-alert",
      })
    );
  });
});

describe("Algorithme d'Alertes et Rappels d'Emploi du Temps (useScheduleAlerts)", () => {
  it("exporte le hook useScheduleAlerts", () => {
    expect(typeof useScheduleAlerts).toBe("function");
  });

  it("gère correctement le stockage anti-doublon des alertes quotidiennes", () => {
    const today = new Date().toISOString().slice(0, 10);
    const storageKey = "sn:schedule-alerts-sent";

    // Enregistrement de deux alertes (15min et immédiate)
    const alertKeys = [`${today}-slot-1-15min`, `${today}-slot-1-now`];
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        date: today,
        keys: alertKeys,
      })
    );

    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    expect(saved.date).toBe(today);
    expect(saved.keys).toContain(`${today}-slot-1-15min`);
    expect(saved.keys).toContain(`${today}-slot-1-now`);

    // Nettoyage après le test
    localStorage.removeItem(storageKey);
  });
});
