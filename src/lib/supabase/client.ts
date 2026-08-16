import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes("YOUR_PROJECT_REF"));

// Unique singleton instance
const clientInstance: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
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
    throw new Error("Supabase n'est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.");
  }
  return clientInstance;
}
