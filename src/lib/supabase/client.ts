import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Production defaults (fail-safe for Vercel/local builds)
const DEFAULT_URL = "https://tvcuwhgqhrcvdgwlviju.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL;
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON_KEY;

// Nettoyage des espaces et guillemets accidentels
let url = rawUrl.trim().replace(/^["']|["']$/g, '');
let anonKey = rawKey.trim().replace(/^["']|["']$/g, '');

// Si la clé est invalide (ex: token de compte sbp_ au lieu d'une clé API publique eyJ...), bascule automatique
if (!anonKey || anonKey.startsWith("sbp_") || (!anonKey.startsWith("eyJ") && !anonKey.startsWith("sb_publishable"))) {
  anonKey = DEFAULT_ANON_KEY;
}

if (!url || url.includes("YOUR_PROJECT_REF")) {
  url = DEFAULT_URL;
}

export const isSupabaseConfigured = Boolean(url && anonKey);

// Unique singleton instance
const clientInstance: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.sessionStorage,
      },
    })
  : null;

export const supabase = clientInstance as SupabaseClient;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured || !clientInstance) {
    throw new Error("Supabase n'est pas configuré.");
  }
  return clientInstance;
}
