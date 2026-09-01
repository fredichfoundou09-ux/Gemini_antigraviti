// Utilitaires d'authentification sécurisée pour SENTINELLES NUMÉRIQUES.
// Les mots de passe ne sont JAMAIS stockés en clair : ils sont hashés
// avec PBKDF2-SHA256 (100 000 itérations) + sel aléatoire par utilisateur.
// Note : en environnement front-only, ce hachage empêche la lecture directe
// du mot de passe et rend impossible la connexion sans le mot de passe original.

const ITERATIONS = 100_000;
const KEYLEN = 32; // 256 bits

const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomSalt(len = 16): Uint8Array {
  const s = new Uint8Array(len);
  crypto.getRandomValues(s);
  return s;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEYLEN * 8
  );
  return new Uint8Array(bits);
}

/** Hash un mot de passe. Format : `pbkdf2$iterations$saltB64$hashB64`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomSalt(16);
  const hash = await pbkdf2(password, salt);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Vérifie qu'un mot de passe correspond à un hash stocké. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith("pbkdf2$")) {
    // rétro-compatibilité impossible : refus par principe (pas de clair).
    return false;
  }
  const [, , saltB64, hashB64] = stored.split("$");
  const salt = b64ToBytes(saltB64);
  const expected = b64ToBytes(hashB64);
  const actual = await pbkdf2(password, salt);
  if (actual.length !== expected.length) return false;
  // comparaison à temps constant
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/* ---------------- Politique de mot de passe ---------------- */

// Liste de mots de passe très courants explicitement refusés.
const COMMON = new Set([
  "password", "motdepasse", "azerty", "azerty123", "qwerty", "qwerty123",
  "123456", "12345678", "123456789", "admin", "admin123", "administrateur",
  "root", "toor", "welcome", "sentinelles", "sentinelles123", "test", "test123",
  "sentinellesnumeriques", "changeme", "letmein", "0000", "1111",
]);

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  notCommon: boolean;
}

export function checkPassword(pwd: string): PasswordChecks {
  const p = pwd || "";
  return {
    length: p.length >= 12,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
    notCommon: p.length > 0 && !COMMON.has(p.toLowerCase()),
  };
}

export function validatePassword(pwd: string): { valid: boolean; error?: string } {
  const p = pwd || "";
  if (p.length < 8) return { valid: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
  const c = checkPassword(p);
  if (!c.notCommon) return { valid: false, error: "Ce mot de passe est trop simple ou courant." };
  if (!c.upper && !c.digit && !c.special) return { valid: false, error: "Ajoutez au moins une majuscule, un chiffre ou un caractère spécial." };
  return { valid: true };
}

export function passwordStrong(pwd: string): boolean {
  const c = checkPassword(pwd);
  return c.length && c.upper && c.lower && c.digit && c.special && c.notCommon;
}

export function passwordScore(pwd: string): number {
  const c = checkPassword(pwd);
  let n = 0;
  Object.values(c).forEach((v) => v && n++);
  // Bonus longueur
  if (pwd.length >= 16) n++;
  if (pwd.length >= 20) n++;
  return Math.min(8, n);
}

/* ---------------- Anti brute-force (côté client) ---------------- */
// Compteur d'échecs par identifiant. Verrou progressif :
// 3 échecs → 30 s ; 5 → 2 min ; 7 → 10 min ; 9+ → 30 min.

const LOCK_KEY = "sn_login_locks_v1";

interface LockEntry {
  count: number;
  lockedUntil: number; // timestamp ms
  lastAttempt: number;
}

type LockMap = Record<string, LockEntry>;

function readLocks(): LockMap {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function writeLocks(m: LockMap) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(m)); } catch {}
}

function delayFor(count: number): number {
  if (count < 3) return 0;
  if (count < 5) return 30_000;
  if (count < 7) return 2 * 60_000;
  if (count < 9) return 10 * 60_000;
  return 30 * 60_000;
}

export function getLockState(username: string): { locked: boolean; remainingMs: number; attempts: number } {
  const key = (username || "").trim().toLowerCase();
  if (!key) return { locked: false, remainingMs: 0, attempts: 0 };
  const map = readLocks();
  const e = map[key];
  if (!e) return { locked: false, remainingMs: 0, attempts: 0 };
  const now = Date.now();
  const remaining = Math.max(0, e.lockedUntil - now);
  return { locked: remaining > 0, remainingMs: remaining, attempts: e.count };
}

export function registerFailure(username: string): { locked: boolean; remainingMs: number; attempts: number } {
  const key = (username || "").trim().toLowerCase();
  if (!key) return { locked: false, remainingMs: 0, attempts: 0 };
  const map = readLocks();
  const now = Date.now();
  const prev = map[key] ?? { count: 0, lockedUntil: 0, lastAttempt: 0 };
  const count = prev.count + 1;
  const wait = delayFor(count);
  const entry: LockEntry = { count, lockedUntil: now + wait, lastAttempt: now };
  map[key] = entry;
  writeLocks(map);
  return { locked: wait > 0, remainingMs: wait, attempts: count };
}

export function clearFailures(username: string) {
  const key = (username || "").trim().toLowerCase();
  const map = readLocks();
  if (map[key]) { delete map[key]; writeLocks(map); }
}

/** Génère un mot de passe temporaire fort (respecte la politique). */
export function generateTempPassword(): string {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sans I/O
  const L = "abcdefghijkmnpqrstuvwxyz"; // sans l/o
  const D = "23456789";
  const S = "@#$%&*+=?";
  const all = U + L + D + S;
  const rand = (str: string) => str[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * str.length)];
  const arr = [rand(U), rand(U), rand(L), rand(L), rand(L), rand(D), rand(D), rand(S), rand(S)];
  while (arr.length < 14) arr.push(rand(all));
  // mélange
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0 s";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m} min ${rs} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
}
