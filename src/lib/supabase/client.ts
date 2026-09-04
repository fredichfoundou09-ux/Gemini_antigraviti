import { createClient, SupabaseClient } from "@supabase/supabase-js";

const isDev = import.meta.env.DEV;

// Clés de développement local uniquement (ne doivent jamais remplacer une config de production manquante)
const DEV_FALLBACK_URL = "https://tvcuwhgqhrcvdgwlviju.supabase.co";
const DEV_FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8";

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/^["']|["']$/g, '');
const envKey = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined)?.trim().replace(/^["']|["']$/g, '');

let url = envUrl;
let anonKey = envKey;

if (isDev) {
  if (!url || url.includes("YOUR_PROJECT_REF")) url = DEV_FALLBACK_URL;
  if (!anonKey || anonKey.startsWith("sbp_") || (!anonKey.startsWith("eyJ") && !anonKey.startsWith("sb_publishable"))) {
    anonKey = DEV_FALLBACK_KEY;
  }
} else {
  // En production : échec explicite si variables non fournies
  if (!url || !anonKey) {
    console.error("[CRITICAL] Configuration Supabase manquante dans l'environnement de production. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
  }
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
