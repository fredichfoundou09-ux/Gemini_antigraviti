import { describe, it, expect } from "vitest";
import {
  CONGO_TIMEZONE,
  getBrazzavilleDateTimeParts,
  getBrazzavilleTime,
  getBrazzavilleDate,
  getBrazzavilleYear,
  getBrazzavilleDateISO,
  getBrazzavilleContextString,
} from "../lib/timeUtils";
import { localAgentProcess } from "../lib/ai/sentinelAiService";

describe("SYSTÈME TEMPS RÉEL CONGO-BRAZZAVILLE (WAT UTC+1)", () => {
  it("utilise le fuseau horaire officiel Africa/Brazzaville", () => {
    expect(CONGO_TIMEZONE).toBe("Africa/Brazzaville");
  });

  it("décompose correctement les parties de date et d'heure pour Brazzaville", () => {
    const parts = getBrazzavilleDateTimeParts();
    expect(parts.year).toBeGreaterThanOrEqual(2026);
    expect(parts.month).toMatch(/^\d{2}$/);
    expect(parts.day).toMatch(/^\d{2}$/);
    expect(parts.hour).toMatch(/^\d{2}$/);
    expect(parts.minute).toMatch(/^\d{2}$/);
    expect(parts.second).toMatch(/^\d{2}$/);
  });

  it("génère une date ISO au format AAAA-MM-JJ conforme à Brazzaville", () => {
    const iso = getBrazzavilleDateISO();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("génère une heure valide avec ou sans secondes", () => {
    const timeWithSec = getBrazzavilleTime(new Date(), true);
    expect(timeWithSec).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    const timeShort = getBrazzavilleTime(new Date(), false);
    expect(timeShort).toMatch(/^\d{2}:\d{2}$/);
  });

  it("formate la date en français selon plusieurs styles", () => {
    const short = getBrazzavilleDate(new Date(), "short");
    expect(short).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const medium = getBrazzavilleDate(new Date(), "medium");
    expect(medium.length).toBeGreaterThan(5);

    const full = getBrazzavilleDate(new Date(), "full");
    expect(full.length).toBeGreaterThan(10);
  });

  it("retourne l'année en cours numérique", () => {
    const year = getBrazzavilleYear();
    expect(typeof year).toBe("number");
    expect(year).toBeGreaterThanOrEqual(2026);
  });

  it("fournit une chaîne de contexte riche pour l'assistant IA", () => {
    const ctx = getBrazzavilleContextString();
    expect(ctx).toContain("Congo-Brazzaville");
    expect(ctx).toContain("WAT UTC+1");
    expect(ctx).toContain(String(getBrazzavilleYear()));
  });
});

describe("SYNCHRONISATION DE L'ASSISTANT IA AVEC LE TEMPS RÉEL", () => {
  it("répond précisément avec l'heure et la date de Brazzaville à la question 'quelle heure est-il ?'", async () => {
    const res = await localAgentProcess([
      { role: "user", content: "Quelle heure est-il ?" },
    ]);

    expect(res.intent).toBe("TIME_SYNC");
    expect(res.reply).toContain("Brazzaville");
    expect(res.reply).toContain("WAT UTC+1");
    expect(res.reply).toContain(String(getBrazzavilleYear()));
    expect(res.sources).toContain("Horloge Système Temps Réel — Brazzaville (WAT UTC+1)");
  });

  it("répond avec la date du jour et l'année courante à la question 'quelle est la date d'aujourd'hui ?'", async () => {
    const res = await localAgentProcess([
      { role: "user", content: "Quelle est la date d'aujourd'hui ?" },
    ]);

    expect(res.intent).toBe("DATE_SYNC");
    expect(res.reply).toContain(String(getBrazzavilleYear()));
    expect(res.sources).toContain("Horloge Système Temps Réel — Brazzaville (WAT UTC+1)");
  });

  it("génère un rapport officiel complet daté en temps réel à la demande 'donne-moi le rapport'", async () => {
    const res = await localAgentProcess([
      { role: "user", content: "Donne-moi le rapport d'activité" },
    ]);

    expect(res.intent).toBe("OFFICIAL_REPORT");
    expect(res.reply).toContain("RAPPORT OFFICIEL EN TEMPS RÉEL");
    expect(res.reply).toContain("Brazzaville (Congo)");
    expect(res.reply).toContain(String(getBrazzavilleYear()));
    expect(res.reply).toContain("Effectifs & Pédagogie");
    expect(res.reply).toContain("Trésorerie & Scolarité");
    expect(res.sources).toContain("Rapport Administratif & Pédagogique Officiel (Temps Réel)");
  });

  it("ne confond pas les questions d'heure système avec les requêtes d'emploi du temps", async () => {
    const resTime = await localAgentProcess([
      { role: "user", content: "Il est quelle heure actuellement ?" },
    ]);
    expect(resTime.intent).toBe("TIME_SYNC");

    const resSchedule = await localAgentProcess([
      { role: "user", content: "Quel est mon prochain cours aujourd'hui ?" },
    ]);
    expect(resSchedule.intent).toBe("SCHEDULE");
  });
});
