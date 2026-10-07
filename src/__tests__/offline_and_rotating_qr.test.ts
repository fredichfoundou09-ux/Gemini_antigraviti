import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage and window in node test runner
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStore[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete localStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStore).forEach((k) => delete localStore[k]);
  }),
};
(global as any).localStorage = mockLocalStorage;

if (typeof (global as any).window === "undefined") {
  (global as any).window = {
    dispatchEvent: vi.fn(),
  };
}

let mockIdbData: Record<string, any> = {};
vi.mock("@/lib/idbStorage", () => ({
  idbGet: vi.fn((key: string) => Promise.resolve(mockIdbData[key] || null)),
  idbSet: vi.fn((key: string, val: any) => {
    mockIdbData[key] = val;
    return Promise.resolve();
  }),
}));

import {
  generateRotatingQrToken,
  verifyRotatingQrToken,
  isDataSaverEnabled,
  setDataSaverEnabled,
  isAssessmentOfflineAllowed,
  queueOfflineOperation,
  getOfflineQueue,
  compressImageForUpload,
} from "@/lib/offlineQueue";

describe("Phase 3 — Offline Queue & Rotating QR (E2 & N4)", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockIdbData = {};
    vi.restoreAllMocks();
  });

  describe("E2 — Rotating QR Code (30s window)", () => {
    it("génère un token rotatif avec format normalisé et compte à rebours valide", () => {
      const studentId = "STU_1001";
      const scheduleId = "SCH_2002";
      const result = generateRotatingQrToken(studentId, scheduleId);

      expect(result.token).toMatch(/^QR_TOKEN\|STU_1001\|SCH_2002\|\d{4}-\d{2}-\d{2}T.*\|[a-f0-9]+$/);
      expect(result.timeRemainingSec).toBeGreaterThanOrEqual(0);
      expect(result.timeRemainingSec).toBeLessThanOrEqual(30);
    });

    it("valide avec succès un token rotatif légitime émis dans la fenêtre actuelle", () => {
      const studentId = "STU_99";
      const scheduleId = "SCH_42";
      const { token } = generateRotatingQrToken(studentId, scheduleId);

      const verification = verifyRotatingQrToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.studentId).toBe(studentId);
      expect(verification.scheduleId).toBe(scheduleId);
    });

    it("rejette un token avec une signature falsifiée ou altérée", () => {
      const studentId = "STU_99";
      const scheduleId = "SCH_42";
      const { token } = generateRotatingQrToken(studentId, scheduleId);

      const tampered = token.replace(/\|[a-f0-9]+$/, "|deadbeef");
      const verification = verifyRotatingQrToken(tampered);

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("QR Code expiré ou falsifié");
    });

    it("rejette un token au format corrompu", () => {
      const verification = verifyRotatingQrToken("RANDOM_INVALID_DATA");
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("Format de QR Code invalide");
    });

    it("accepte la fenêtre précédente immédiate (tolérance de latence réseau)", () => {
      const studentId = "STU_TOLERANCE";
      const scheduleId = "SCH_TOLERANCE";
      const now = Date.now();

      // Token créé dans le passé immédiat
      const pastNow = now - 25000;
      vi.spyOn(Date, "now").mockReturnValue(pastNow);
      const { token } = generateRotatingQrToken(studentId, scheduleId);

      // Vérifié maintenant
      vi.spyOn(Date, "now").mockReturnValue(now);
      const verification = verifyRotatingQrToken(token);
      expect(verification.valid).toBe(true);
    });
  });

  describe("N4 — Offline Queue & Data Saver Mode", () => {
    it("active et désactive le mode économie de données avec persistance", () => {
      expect(isDataSaverEnabled()).toBe(false);

      setDataSaverEnabled(true);
      expect(isDataSaverEnabled()).toBe(true);

      setDataSaverEnabled(false);
      expect(isDataSaverEnabled()).toBe(false);
    });

    it("bloque strictement les évaluations hors-ligne par défaut (intégrité anti-triche)", () => {
      expect(isAssessmentOfflineAllowed(undefined)).toBe(false);
      expect(isAssessmentOfflineAllowed({})).toBe(false);
      expect(isAssessmentOfflineAllowed({ autoriser_hors_ligne: false })).toBe(false);
      expect(isAssessmentOfflineAllowed({ autoriser_hors_ligne: true })).toBe(true);
    });

    it("enregistre une opération dans la file hors-ligne avec identifiant client unique", async () => {
      const op = await queueOfflineOperation("attendance", {
        studentId: "STU_1",
        moduleId: "MOD_1",
        date: "2026-10-07",
        statut: "present",
      });

      expect(op.id).toMatch(/^op_\d+_[a-z0-9]+$/);
      expect(op.status).toBe("pending");
      expect(op.type).toBe("attendance");

      const queue = await getOfflineQueue();
      expect(queue.some((item) => item.id === op.id)).toBe(true);
    });

    it("conserve les fichiers non-images sans tentative de compression erronée", async () => {
      const pdfBlob = new File(["test pdf content"], "doc.pdf", { type: "application/pdf" });
      const result = await compressImageForUpload(pdfBlob);
      expect(result).toBe(pdfBlob);
    });
  });
});
