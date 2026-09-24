import { describe, it, expect } from "vitest";
import {
  toBase32,
  fromBase32,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateTotpUri,
} from "../lib/totp";

describe("Authentification 2FA TOTP (RFC 6238)", () => {
  it("encode et décode correctement une chaîne Base32", () => {
    const originalBytes = new Uint8Array([72, 101, 108, 108, 111, 33]); // "Hello!"
    const b32 = toBase32(originalBytes);
    expect(b32).toBe("JBSWY3DPEE");

    const decoded = fromBase32(b32);
    expect(Array.from(decoded)).toEqual(Array.from(originalBytes));
  });

  it("génère un secret Base32 aléatoire de 32 caractères", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBe(32);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it("génère un code TOTP à 6 chiffres", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const code = await generateTotpCode(secret, 1700000000000);
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("vérifie avec succès le code correspondant au timestamp actuel", async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = await generateTotpCode(secret, now);

    const valid = await verifyTotpCode(secret, code, 1, now);
    expect(valid).toBe(true);
  });

  it("accepte un code émis dans la fenêtre de tolérance (+/- 30 secondes)", async () => {
    const secret = generateTotpSecret();
    const now = 1710000000000;
    // Code généré il y a 25 secondes (période précédente ou courante)
    const codePast = await generateTotpCode(secret, now - 25000);

    const valid = await verifyTotpCode(secret, codePast, 1, now);
    expect(valid).toBe(true);
  });

  it("rejette un code erroné ou expiré depuis trop longtemps", async () => {
    const secret = generateTotpSecret();
    const now = 1710000000000;
    // Code généré il y a 3 minutes (très en dehors de la tolérance de 30s)
    const codeOld = await generateTotpCode(secret, now - 180000);

    const valid = await verifyTotpCode(secret, codeOld, 1, now);
    expect(valid).toBe(false);

    // Code arbitraire invalide
    const validFake = await verifyTotpCode(secret, "000000", 1, now);
    expect(validFake).toBe(false);
  });

  it("génère un URI otpauth:// conforme et scannable", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const uri = generateTotpUri("Sentinelles Numériques", "admin@sentinelles.local", secret);

    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
