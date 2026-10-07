import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
const mockStorage = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    store[k] = String(v);
  }),
  removeItem: vi.fn((k: string) => {
    delete store[k];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};
(global as any).localStorage = mockStorage;

if (typeof (global as any).window === "undefined") {
  (global as any).window = {
    dispatchEvent: vi.fn(),
  };
}

import { gamificationService } from "@/modules/gamification/services/gamificationService";
import { i18nService } from "@/modules/i18n/services/i18nService";
import { webhookService, computeHmacSignature } from "@/modules/api/services/webhookService";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("Phase 6 — N13 Gamification + N14 Multilingue + N15 API & Webhooks", () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe("N13 — Gamification & Badges", () => {
    it("active et désactive le système de gamification avec persistance", () => {
      expect(gamificationService.isEnabled()).toBe(true); // Actif par défaut

      gamificationService.setEnabled(false);
      expect(gamificationService.isEnabled()).toBe(false);

      gamificationService.setEnabled(true);
      expect(gamificationService.isEnabled()).toBe(true);
    });

    it("attribue un badge à un apprenant via upsert idempotent", async () => {
      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await gamificationService.awardBadge(
        "STU-01",
        "BADGE_ASSIDUITE_OR",
        "100% de présence"
      );
      expect(res.success).toBe(true);
    });

    it("bloque l'attribution si la gamification est désactivée", async () => {
      gamificationService.setEnabled(false);
      const res = await gamificationService.awardBadge("STU-01", "B-1", "Test");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Gamification désactivée");
    });
  });

  describe("N14 — Multilingue (i18n)", () => {
    it("gère le changement de langue vers Lingála et Anglais avec persistance", () => {
      expect(i18nService.getLocale()).toBe("fr");

      i18nService.setLocale("ln");
      expect(i18nService.getLocale()).toBe("ln");

      i18nService.setLocale("en");
      expect(i18nService.getLocale()).toBe("en");
    });

    it("traduit les termes clés selon la langue choisie", () => {
      i18nService.setLocale("fr");
      expect(i18nService.t("dashboard")).toBe("Tableau de bord");

      i18nService.setLocale("ln");
      expect(i18nService.t("dashboard")).toBe("Etanda ya misala");
      expect(i18nService.t("students")).toBe("Bana-kelasi");

      i18nService.setLocale("en");
      expect(i18nService.t("dashboard")).toBe("Dashboard");
      expect(i18nService.t("students")).toBe("Students");
    });

    it("se replie sur le français en cas de clé non traduite", () => {
      i18nService.setLocale("ln");
      const res = i18nService.t("unknown_key_xyz", "Valeur par défaut");
      expect(res).toBe("Valeur par défaut");
    });
  });

  describe("N15 — API Publique & Webhooks", () => {
    it("génère une clé d'API avec préfixe masqué et hash sécurisé", async () => {
      const mockInsertedKey = {
        id: "key-1",
        name: "Système RH",
        key_prefix: "sn_live_abc1...",
        scopes: ["read"],
        revoked: false,
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockInsertedKey, error: null }),
      });

      const res = await webhookService.createApiKey("Système RH", ["read"]);
      expect(res.fullKey).toMatch(/^sn_live_[a-z0-9]+$/);
      expect(res.apiKeyItem.name).toBe("Système RH");
      expect(res.apiKeyItem.revoked).toBe(false);
    });

    it("révoque une clé d'API existante", async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await webhookService.revokeApiKey("key-1");
      expect(res.success).toBe(true);
    });

    it("calcule une signature HMAC déterministe pour les webhooks", async () => {
      const payload = JSON.stringify({ event: "grade.published", studentId: "STU-01" });
      const secret = "whsec_test_secret_123";

      const sig1 = await computeHmacSignature(payload, secret);
      const sig2 = await computeHmacSignature(payload, secret);

      expect(sig1).toBe(sig2);
      expect(sig1.length).toBeGreaterThan(10);
    });
  });
});
