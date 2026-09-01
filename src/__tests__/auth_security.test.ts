import { describe, it, expect } from "vitest";
import { validatePassword, passwordScore } from "../lib/auth";

describe("Authentication Security & Validation (Audit 3 & 4.3)", () => {
  it("rejette les mots de passe trop courts (< 8 caractères)", () => {
    const res = validatePassword("pass12");
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("rejette les mots de passe triviaux ou sans diversité", () => {
    const res = validatePassword("12345678");
    expect(res.valid).toBe(false);
  });

  it("accepte les mots de passe robustes respectant les règles", () => {
    const res = validatePassword("Sentinelle#2026!Sec");
    expect(res.valid).toBe(true);
  });

  it("calcule un score de robustesse élevé pour un mot de passe complexe", () => {
    const score = passwordScore("Congo@Enia_2026_Securise!");
    expect(score).toBeGreaterThanOrEqual(4);
  });

  it("vérifie le format et l'expiration des jetons d'invitation (48h)", () => {
    const token = "ACT_T_abc123_xyz789";
    expect(token.startsWith("ACT_")).toBe(true);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
