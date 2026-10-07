import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  credentialService,
  computeCertificateSignature,
  DigitalCertificate,
} from "@/modules/credentials/services/credentialService";
import { alumniService } from "@/modules/alumni/services/alumniService";
import { forumService } from "@/modules/forum/services/forumService";
import { resourceService } from "@/modules/resources/services/resourceService";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("Phase 5 — N8 Diplômes vérifiables + N9 Insertion + N10 Forum + N12 Ressources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("N8 — Diplômes Numériques Vérifiables & Open Badges", () => {
    it("génère une signature numérique SHA-256 déterministe pour un certificat", async () => {
      const data = {
        numero: "SN-CERT-2026-001",
        studentId: "STU-01",
        formation: "Cybersécurité",
        date: "2026-10-07",
      };

      const sig1 = await computeCertificateSignature(data);
      const sig2 = await computeCertificateSignature(data);

      expect(sig1).toBe(sig2);
      expect(sig1.length).toBeGreaterThan(10);
    });

    it("détecte toute altération d'un champ du certificat et invalide sa signature", async () => {
      const original = {
        numero: "SN-CERT-2026-001",
        studentId: "STU-01",
        formation: "Cybersécurité",
        date: "2026-10-07",
      };
      const signature = await computeCertificateSignature(original);

      // Certificat altéré (ex: formation modifiée frauduleusement)
      const tamperedCert: DigitalCertificate = {
        id: "c-1",
        numero: original.numero,
        studentId: original.studentId,
        studentName: "Jean Mpassi",
        formation: "Intelligence Artificielle", // Altéré !
        date: original.date,
        status: "valide",
        digital_signature: signature,
      };

      const verification = await credentialService.verifyCertificate(tamperedCert);
      expect(verification.valid).toBe(false);
      expect(verification.tampered).toBe(true);
      expect(verification.reason).toContain("Signature invalide : les données du certificat ont été altérées");
    });

    it("signale immédiatement un certificat révoqué par l'autorité académique", async () => {
      const cert: DigitalCertificate = {
        id: "c-revoked",
        numero: "SN-CERT-2026-REV",
        studentId: "STU-02",
        studentName: "Apprenant Fraudeur",
        formation: "Cybersécurité",
        date: "2026-10-07",
        status: "revoque",
        revocation_reason: "Plagiat avéré sur le projet final",
      };

      const verification = await credentialService.verifyCertificate(cert);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("Plagiat avéré");
    });

    it("génère un export Open Badges 2.0 conforme au standard", () => {
      const cert: DigitalCertificate = {
        id: "c-ob",
        numero: "SN-CERT-2026-99",
        studentId: "STU-99",
        studentName: "Marie Curie",
        formation: "Data Science",
        date: "2026-10-07",
        status: "valide",
      };

      const ob2 = credentialService.exportOpenBadgesV2(cert);
      expect(ob2.type).toBe("Assertion");
      expect(ob2.badge.name).toContain("Data Science");
      expect(ob2["@context"]).toContain("openbadges/v2");
    });

    it("génère un export Open Badges 3.0 (W3C Verifiable Credential)", () => {
      const cert: DigitalCertificate = {
        id: "c-ob3",
        numero: "SN-CERT-2026-99",
        studentId: "STU-99",
        studentName: "Marie Curie",
        formation: "Data Science",
        date: "2026-10-07",
        status: "valide",
        digital_signature: "sig123456",
      };

      const ob3 = credentialService.exportOpenBadgesV3(cert);
      expect(ob3.type).toContain("VerifiableCredential");
      expect(ob3.credentialSubject.achievement.name).toBe("Data Science");
      expect(ob3.proof.jws).toBe("sig123456");
    });
  });

  describe("N9 — Suivi d'insertion des diplômés", () => {
    it("calcule avec exactitude les métriques d'insertion professionnelle", async () => {
      const mockFollowUps = [
        { id: "1", status: "employed" },
        { id: "2", status: "employed" },
        { id: "3", status: "further_study" },
        { id: "4", status: "seeking" },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockFollowUps, error: null }),
      });

      const metrics = await alumniService.getInsertionMetrics();
      expect(metrics.totalFollowed).toBe(4);
      expect(metrics.employedCount).toBe(2);
      expect(metrics.furtherStudyCount).toBe(1);
      expect(metrics.seekingCount).toBe(1);
      // (2 + 1) / 4 = 75%
      expect(metrics.insertionRate).toBe(75);
    });
  });

  describe("N10 — Forum par module & N12 Ressources", () => {
    it("permet à l'enseignant de marquer une réponse comme solution validée", async () => {
      (supabase.from as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const res = await forumService.pinSolution("post-100", true);
      expect(res.success).toBe(true);
    });

    it("filtre les ressources documentaires par mot-clé et étiquette", async () => {
      const mockResources = [
        { id: "r1", title: "Guide Snort", tags: ["securite", "tp"] },
        { id: "r2", title: "React Hooks", tags: ["dev", "web"] },
      ];

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockResolvedValue({ data: [mockResources[0]], error: null }),
      });

      const res = await resourceService.getResources({ search: "Snort" });
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe("Guide Snort");
    });
  });
});
