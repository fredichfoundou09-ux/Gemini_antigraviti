import { createClient, SupabaseClient } from "@supabase/supabase-js";

const isDev = import.meta.env.DEV;

// Récupération stricte depuis les variables d'environnement (.env.local ou configuration Vercel)
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/^["']|["']$/g, '');
const envKey = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined)?.trim().replace(/^["']|["']$/g, '');

const url = envUrl && !envUrl.includes("YOUR_PROJECT_REF") ? envUrl : undefined;
const anonKey = envKey && !envKey.startsWith("sbp_") ? envKey : undefined;

if (!url || !anonKey) {
  if (isDev) {
    console.info("[SECURITY] Supabase non configuré via variables d'environnement (.env.local). Mode local actif.");
  } else {
    console.error("[CRITICAL] Configuration Supabase manquante dans l'environnement de production. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey);

// Unique singleton instance
const clientInstance: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
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
