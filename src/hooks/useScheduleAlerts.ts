import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { scheduleFor } from "@/lib/access";
import { sendNativeNotification } from "@/lib/pushNotifications";
import { toastMsg } from "@/lib/toast";

const STORAGE_ALERTS_KEY = "sn:schedule-alerts-sent";

/**
 * Récupère les alertes déjà émises aujourd'hui depuis le localStorage
 */
function getSentAlertsForToday(todayDateStr: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_ALERTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayDateStr || !Array.isArray(parsed.keys)) {
      return new Set();
    }
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

/**
 * Sauvegarde les alertes émises aujourd'hui dans le localStorage
 */
function saveSentAlertsForToday(todayDateStr: string, keys: Set<string>): void {
  try {
    localStorage.setItem(
      STORAGE_ALERTS_KEY,
      JSON.stringify({
        date: todayDateStr,
        keys: Array.from(keys),
      })
    );
  } catch {
    // silence
  }
}

/**
 * Convertit une chaîne heure (ex: "08:30", "08h30", "14:00") en minutes depuis minuit
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.toLowerCase().replace("h", ":").trim();
  const parts = clean.split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Hook d'alerte et de rappel automatique d'emploi du temps.
 * Boucle périodique qui vérifie chaque minute les cours du jour
 * et déclenche une notification système native sur smartphone et ordinateur.
 */
export function useScheduleAlerts() {
  const { db, user, update } = useStore();
  const sentAlertKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const checkSchedule = () => {
      const now = new Date();
      const todayDateStr = now.toISOString().slice(0, 10);
      const currentDayName = now
        .toLocaleDateString("fr-FR", { weekday: "long" })
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // "lundi", "mardi", "mercredi", etc.

      // Synchronisation de l'anti-doublon
      if (sentAlertKeysRef.current.size === 0) {
        sentAlertKeysRef.current = getSentAlertsForToday(todayDateStr);
      }

      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Récupération des cours concernant directement l'utilisateur
      const mySlots = scheduleFor(db, user);

      mySlots.forEach((slot) => {
        const slotDayName = (slot.jour || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        const isToday =
          slotDayName === currentDayName ||
          (slot.date && slot.date.slice(0, 10) === todayDateStr);

        if (!isToday) return;

        const startMinutes = parseTimeToMinutes(slot.heureDebut);
        if (startMinutes === null) return;

        const diff = startMinutes - nowMinutes; // minutes restantes avant le cours

        const mod = db.modules.find((m) => m.id === slot.moduleId);
        const moduleTitle = mod?.titre || "Cours & Formation";
        const salle = slot.salle ? `Salle ${slot.salle}` : "Salle assignée";

        const teacher = db.teachers.find(
          (t) => t.id === slot.teacherId || t.userId === slot.teacherId
        );
        const teacherName = teacher
          ? teacher.prenom
            ? `${teacher.prenom} ${teacher.nom}`
            : teacher.nom
          : "";

        // 1. Rappel 15 minutes avant le cours (entre 1 et 15 minutes)
        if (diff > 0 && diff <= 15) {
          const key15 = `${todayDateStr}-${slot.id}-15min`;
          if (!sentAlertKeysRef.current.has(key15)) {
            sentAlertKeysRef.current.add(key15);
            saveSentAlertsForToday(todayDateStr, sentAlertKeysRef.current);

            const title = `⏰ Cours dans ${diff} min : ${moduleTitle}`;
            const body = `Début à ${slot.heureDebut} en ${salle}${teacherName ? ` avec ${teacherName}` : ""}. Préparez vos supports !`;

            // Notification système native (haut de l'écran du téléphone / bureau)
            sendNativeNotification({
              title,
              body,
              url: "/app/emploi-du-temps",
              tag: `schedule-15m-${slot.id}`,
              playSound: true,
              vibrate: [200, 100, 200],
            });

            toastMsg.info(title);

            // Ajouter dans le centre de notifications de l'application
            update((prev) => ({
              ...prev,
              notifications: [
                {
                  id: `ntf-sch-15-${slot.id}-${Date.now()}`,
                  toId: user.id,
                  title,
                  body,
                  date: now.toLocaleDateString("fr-FR"),
                  lu: false,
                  type: "info",
                },
                ...(prev.notifications || []),
              ],
            }));
          }
        }

        // 2. Alerte début de cours pile à l'heure (entre 0 et 5 minutes de retard)
        if (diff <= 0 && diff >= -5) {
          const keyNow = `${todayDateStr}-${slot.id}-now`;
          if (!sentAlertKeysRef.current.has(keyNow)) {
            sentAlertKeysRef.current.add(keyNow);
            saveSentAlertsForToday(todayDateStr, sentAlertKeysRef.current);

            const title = `🔔 C'est l'heure : ${moduleTitle}`;
            const body = `Votre cours a débuté à ${slot.heureDebut} en ${salle}. Veuillez rejoindre la séance.`;

            // Notification système native
            sendNativeNotification({
              title,
              body,
              url: "/app/emploi-du-temps",
              tag: `schedule-now-${slot.id}`,
              playSound: true,
              vibrate: [300, 150, 300],
            });

            toastMsg.success(title);

            update((prev) => ({
              ...prev,
              notifications: [
                {
                  id: `ntf-sch-now-${slot.id}-${Date.now()}`,
                  toId: user.id,
                  title,
                  body,
                  date: now.toLocaleDateString("fr-FR"),
                  lu: false,
                  type: "urgent",
                },
                ...(prev.notifications || []),
              ],
            }));
          }
        }
      });
    };

    // Exécution immédiate au montage
    checkSchedule();

    // Boucle de vérification automatique toutes les 40 secondes
    const interval = setInterval(checkSchedule, 40000);
    return () => clearInterval(interval);
  }, [db, user, update]);
}
