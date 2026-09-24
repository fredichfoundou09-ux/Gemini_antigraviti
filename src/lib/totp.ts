import { supabase, isSupabaseConfigured } from "./supabase/client";

// ============================================================
// BASE32 & RFC 6238 TOTP IMPLEMENTATION (HMAC-SHA1)
// Conforme RFC 6238 et compatible Google/Microsoft Authenticator
// ============================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encode un buffer binaire en chaîne Base32 standard (RFC 4648 sans padding)
 */
export function toBase32(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Décode une chaîne Base32 en Uint8Array
 */
export function fromBase32(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Caractère Base32 invalide: ${clean[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Génère un secret aléatoire Base32 (20 octets / 160 bits = 32 caractères Base32)
 */
export function generateTotpSecret(): string {
  const randomBytes = new Uint8Array(20);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    // Fallback environnement Node / Tests
    for (let i = 0; i < 20; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toBase32(randomBytes);
}

/**
 * Calcule le code TOTP à 6 chiffres pour un secret et un timestamp donnés
 */
export async function generateTotpCode(secretBase32: string, timestampMs = Date.now(), stepSeconds = 30): Promise<string> {
  const keyBytes = fromBase32(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  // Buffer 8 octets big-endian pour le compteur
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  // Les 4 octets de poids fort sont 0 (jusqu'en 2038+)
  counterView.setUint32(0, 0);
  counterView.setUint32(4, counter);

  const cryptoSubtle = typeof window !== "undefined" && window.crypto?.subtle
    ? window.crypto.subtle
    : (globalThis as any).crypto?.subtle;

  if (!cryptoSubtle) {
    throw new Error("Web Crypto API (crypto.subtle) non disponible dans cet environnement.");
  }

  const cryptoKey = await cryptoSubtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: { name: "SHA-1" } },
    false,
    ["sign"]
  );

  const signature = await cryptoSubtle.sign("HMAC", cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  // Troncation dynamique (Dynamic Truncation RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Vérifie un code saisi par l'utilisateur avec une fenêtre de tolérance (fenêtre +/- 1 période de 30s)
 */
export async function verifyTotpCode(
  secretBase32: string,
  token: string,
  toleranceSteps = 1,
  timestampMs = Date.now(),
  stepSeconds = 30
): Promise<boolean> {
  const cleanToken = token.trim().replace(/\s+/g, "");
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  for (let i = -toleranceSteps; i <= toleranceSteps; i++) {
    const timeForStep = timestampMs + i * stepSeconds * 1000;
    const expected = await generateTotpCode(secretBase32, timeForStep, stepSeconds);
    if (expected === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Formate l'URL standard otpauth:// pour affichage QR Code
 */
export function generateTotpUri(issuer: string, accountName: string, secretBase32: string): string {
  const encIssuer = encodeURIComponent(issuer);
  const encAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// ============================================================
// SERVICE SUPABASE & STOCKAGE LOCAL (2FA ADMIN)
// ============================================================

export interface AdminTotpRecord {
  id?: string;
  user_id: string;
  secret: string;
  enabled: boolean;
  created_at?: string;
}

const LOCAL_2FA_STORAGE_KEY = "sentinelles:admin_2fa_config";

function getLocal2faMap(): Record<string, { secret: string; enabled: boolean }> {
  try {
    const raw = localStorage.getItem(LOCAL_2FA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal2faMap(map: Record<string, { secret: string; enabled: boolean }>) {
  try {
    localStorage.setItem(LOCAL_2FA_STORAGE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

/**
 * Vérifie si le 2FA est activé pour un utilisateur donné
 */
export async function isUser2faEnabled(userId: string): Promise<boolean> {
  if (!userId) return false;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("admin_totp_secrets")
        .select("enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        return Boolean(data.enabled);
      }
    } catch {
      // Fallback local
    }
  }

  const localMap = getLocal2faMap();
  return Boolean(localMap[userId]?.enabled);
}

/**
 * Récupère l'enregistrement TOTP pour l'utilisateur connecté (admin)
 */
export async function getAdminTotpConfig(userId: string): Promise<{ secret: string; enabled: boolean } | null> {
  if (!userId) return null;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("admin_totp_secrets")
        .select("secret, enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        return { secret: data.secret, enabled: data.enabled };
      }
    } catch {
      // Fallback local
    }
  }

  const localMap = getLocal2faMap();
  return localMap[userId] || null;
}

/**
 * Active ou désactive le 2FA pour l'utilisateur
 */
export async function saveAdminTotpConfig(userId: string, secret: string, enabled: boolean): Promise<boolean> {
  if (!userId) return false;

  // Mise à jour locale garantie
  const localMap = getLocal2faMap();
  localMap[userId] = { secret, enabled };
  saveLocal2faMap(localMap);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("admin_totp_secrets")
        .upsert(
          {
            user_id: userId,
            secret,
            enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.warn("Avertissement synchronisation TOTP Supabase:", error);
      }
    } catch (err) {
      console.warn("Erreur sauvegarde TOTP Supabase:", err);
    }
  }

  return true;
}

/**
 * Supprime la configuration 2FA
 */
export async function removeAdminTotpConfig(userId: string): Promise<boolean> {
  if (!userId) return false;

  const localMap = getLocal2faMap();
  delete localMap[userId];
  saveLocal2faMap(localMap);

  if (isSupabaseConfigured) {
    try {
      await supabase.from("admin_totp_secrets").delete().eq("user_id", userId);
    } catch {
      // ignore
    }
  }

  return true;
}
