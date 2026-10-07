import { useState, useEffect } from "react";

export const CONGO_TIMEZONE = "Africa/Brazzaville";

/**
 * Décompose la date selon le fuseau horaire officiel du Congo-Brazzaville (WAT, UTC+1).
 */
export function getBrazzavilleDateTimeParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: CONGO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return {
    year: parseInt(map.year, 10),
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Retourne la date au format AAAA-MM-JJ selon le fuseau horaire de Brazzaville.
 */
export function getBrazzavilleDateISO(date: Date = new Date()): string {
  const p = getBrazzavilleDateTimeParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Retourne l'heure courante à Brazzaville (HH:mm:ss ou HH:mm).
 */
export function getBrazzavilleTime(date: Date = new Date(), withSeconds = true): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: CONGO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

/**
 * Retourne la date formatée en français pour Brazzaville.
 * - 'short': 07/10/2026
 * - 'medium': mer. 7 oct. 2026
 * - 'full': mercredi 7 octobre 2026
 */
export function getBrazzavilleDate(date: Date = new Date(), style: "short" | "medium" | "full" = "medium"): string {
  if (style === "short") {
    const p = getBrazzavilleDateTimeParts(date);
    return `${p.day}/${p.month}/${p.year}`;
  }
  if (style === "full") {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: CONGO_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: CONGO_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Retourne l'année en cours à Brazzaville (ex: 2026).
 */
export function getBrazzavilleYear(date: Date = new Date()): number {
  return getBrazzavilleDateTimeParts(date).year;
}

/**
 * Chaîne de contexte pour synchroniser l'assistant IA avec le temps réel.
 */
export function getBrazzavilleContextString(date: Date = new Date()): string {
  const time = getBrazzavilleTime(date, true);
  const fullDate = getBrazzavilleDate(date, "full");
  const year = getBrazzavilleYear(date);
  return `Temps réel officiel (Congo-Brazzaville, WAT UTC+1) : ${fullDate} à ${time} (Année en cours : ${year}).`;
}

/**
 * Hook React pour afficher l'heure et la date de Brazzaville en direct (rafraîchissement chaque seconde).
 */
export function useBrazzavilleClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    now,
    time: getBrazzavilleTime(now, true),
    timeShort: getBrazzavilleTime(now, false),
    dateMedium: getBrazzavilleDate(now, "medium"),
    dateFull: getBrazzavilleDate(now, "full"),
    dateShort: getBrazzavilleDate(now, "short"),
    isoDate: getBrazzavilleDateISO(now),
    year: getBrazzavilleYear(now),
    timezoneLabel: "Brazzaville (GMT+1)",
  };
}
