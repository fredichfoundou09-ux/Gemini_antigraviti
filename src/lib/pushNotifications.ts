/**
 * ========================================================
 * SENTINEL'S — Gestionnaire de Notifications Natives Système
 * (Mobile Android/iOS PWA & Ordinateur de bureau)
 * ========================================================
 */

export interface NativeNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  playSound?: boolean;
  vibrate?: number[];
  renotify?: boolean;
}

/** Vérifie si les notifications sont supportées par l'environnement */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Retourne le statut de permission actuel */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return window.Notification.permission;
}

/** Demande l'autorisation à l'utilisateur pour afficher des notifications */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const permission = await window.Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("Erreur lors de la demande de permission de notification:", err);
    return window.Notification.permission;
  }
}

/** Carillon sonore doux généré dynamiquement via Web Audio API */
export function playNotificationChime(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Note 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // Silence si AudioContext non disponible ou bloqué
  }
}

/**
 * Déclenche une notification système native (Smartphone & Desktop)
 * Fonctionne même si l'application est en arrière-plan ou réduite.
 */
export async function sendNativeNotification(payload: NativeNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (window.Notification.permission !== "granted") return false;

  const title = payload.title || "SENTINEL'S";
  const icon = payload.icon || "/icon-192.png";
  const badge = payload.badge || "/icon-64.png";
  const url = payload.url || "/app/dashboard";
  const tag = payload.tag || `sentinels-${Date.now()}`;
  const vibratePattern = payload.vibrate || [150, 75, 150];

  // 1. Jouer le son si demandé
  if (payload.playSound !== false) {
    playNotificationChime();
  }

  // 2. Vibreur mobile si supporté
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(vibratePattern);
    } catch {
      // Ignorer
    }
  }

  // 3. Affichage via Service Worker en priorité (indispensable pour smartphone en arrière-plan)
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, {
          body: payload.body,
          icon,
          badge,
          tag,
          renotify: payload.renotify ?? true,
          data: { url },
          // vibrate n'est pas toujours dans les types TS standards de NotificationOptions
          ...(vibratePattern ? { vibrate: vibratePattern } : {}),
        } as any);
        return true;
      }
    } catch (swErr) {
      console.warn("Échec showNotification via Service Worker, repli sur Notification classique:", swErr);
    }
  }

  // 4. Repli sur l'API Notification standard
  try {
    const notif = new window.Notification(title, {
      body: payload.body,
      icon,
      badge,
      tag,
      data: { url },
    });

    notif.onclick = () => {
      try {
        window.focus();
        if (url) {
          window.location.href = url;
        }
        notif.close();
      } catch {
        // ignore
      }
    };
    return true;
  } catch (err) {
    console.warn("Erreur déclenchement Notification native:", err);
    return false;
  }
}

/** Envoi d'une notification de test pour permettre à l'utilisateur de vérifier sur son appareil */
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (perm !== "granted") return false;

  return sendNativeNotification({
    title: "🔔 Test de Notification — SENTINEL'S",
    body: "Le système d'alerte et de messages natifs est parfaitement opérationnel sur votre appareil !",
    url: "/app/dashboard",
    tag: "sentinels-test-alert",
    playSound: true,
  });
}
