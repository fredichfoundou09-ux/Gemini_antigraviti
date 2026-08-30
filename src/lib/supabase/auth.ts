import { getSupabase, isSupabaseConfigured } from "./client";
import type { Role } from "@/lib/types";
export type AppRole = Role;

export interface Profile {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: AppRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string | null;
}

export async function hasAnySuperadmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const sb = getSupabase();
  const { data, error } = await sb.rpc("has_any_superadmin");
  if (error) throw error;
  return Boolean(data);
}

export async function signInWithPassword(emailOrUsername: string, password: string) {
  const sb = getSupabase();
  // Supabase Auth attend un email. Si username fourni, on résout via la fonction RPC sécurisée
  let email = emailOrUsername.trim();
  if (!email.includes("@")) {
    const { data: rpcEmail } = await sb.rpc("get_email_by_username", { p_username: email });
    if (rpcEmail) {
      email = rpcEmail;
    } else {
      const { data: profile } = await sb.from("profiles").select("email").eq("username", email.toLowerCase()).maybeSingle();
      if (!profile?.email) throw new Error("Identifiants incorrects.");
      email = profile.email;
    }
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message?.toLowerCase().includes("email not confirmed")) {
      throw new Error("Email en cours de confirmation. Réactualisez la page et réessayez.");
    }
    if (error.message?.toLowerCase().includes("invalid login credentials")) {
      throw new Error("Identifiant ou mot de passe incorrect.");
    }
    throw error;
  }
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function bootstrapFirstSuperadmin(payload: {
  email: string;
  password: string;
  name: string;
  username: string;
}) {
  const sb = getSupabase();
  // 1) Création compte Auth
  const { data: signUpData, error: signUpError } = await sb.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name,
        username: payload.username.toLowerCase(),
        role: "superadmin",
      },
    },
  });
  if (signUpError) throw signUpError;

  // 2) Session immédiate si possible
  if (!signUpData.session) {
    const { error: signInError } = await sb.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });
    if (signInError) throw signInError;
  }

  // 3) Promotion serveur (refuse un second superadmin)
  const { data: promoted, error: promoError } = await sb.rpc("promote_first_superadmin");
  if (promoError) throw promoError;
  if (!promoted) throw new Error("Un Administrateur Supérieur existe déjà.");

  // 4) Assure username/name
  const { data: userData } = await sb.auth.getUser();
  if (userData.user) {
    await sb.from("profiles").update({
      username: payload.username.toLowerCase(),
      name: payload.name,
      email: payload.email,
      role: "superadmin",
      active: true,
    }).eq("id", userData.user.id);
  }

  return getCurrentProfile();
}

export async function resetPasswordForEmail(email: string, redirectTo?: string) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${window.location.origin}/#/connexion`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
  // Lève le flag "changement obligatoire" après un changement volontaire réussi.
  try { await sb.rpc("clear_must_change_password"); } catch { /* fonction optionnelle */ }
}

export async function mustChangePassword(): Promise<boolean> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { data } = await sb.from("profiles").select("must_change_password").eq("id", auth.user.id).maybeSingle();
  return Boolean((data as any)?.must_change_password);
}

export function onAuthStateChange(callback: (event: string) => void) {
  const sb = getSupabase();
  return sb.auth.onAuthStateChange((event) => callback(event));
}

export async function invokeCreateUser(payload: {
  email: string;
  password: string;
  username: string;
  name: string;
  role: AppRole;
  student?: any;
  teacher?: any;
  partner?: any;
  module_ids?: string[];
}) {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke("create-user", {
    body: payload,
  });
  if (error) {
    let detail = error.message;
    try {
      if ((error as any).context && typeof (error as any).context.json === "function") {
        const body = await (error as any).context.json();
        if (body?.error) detail = body.error;
      }
    } catch { /* fallback */ }
    throw new Error(detail || "Erreur réseau avec l'Edge Function");
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}
