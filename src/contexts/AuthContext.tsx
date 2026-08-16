import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  AppRole,
  Profile,
  bootstrapFirstSuperadmin,
  getCurrentProfile,
  hasAnySuperadmin,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { writeAudit } from "@/lib/supabase/audit";

interface AuthContextValue {
  ready: boolean;
  loading: boolean;
  profile: Profile | null;
  role: AppRole | null;
  hasSuperAdmin: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string, group?: "admin" | "teacher" | "student" | "partner") => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  bootstrap: (payload: { email: string; password: string; name: string; username: string }) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasSuperAdmin, setHasSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    try {
      const [p, anyAdmin] = await Promise.all([getCurrentProfile(), hasAnySuperadmin()]);
      setProfile(p);
      setHasSuperAdmin(anyAdmin);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erreur d'authentification");
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    refresh();
    if (!isSupabaseConfigured) return;
    const { data } = onAuthStateChange(() => {
      refresh();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const login: AuthContextValue["login"] = async (identifier, password, group) => {
    if (!isSupabaseConfigured) return { ok: false, error: "Supabase non configuré." };
    setLoading(true);
    try {
      await signInWithPassword(identifier, password);
      const p = await getCurrentProfile();
      if (!p || !p.active) {
        await signOut();
        return { ok: false, error: "Compte introuvable ou inactif." };
      }
      if (group) {
        const inAdmin = p.role === "superadmin" || p.role === "admin" || p.role === "partner_admin";
        const inPartner = p.role === "partner" || p.role === "partner_admin";
        const okGroup = (group === "admin" && inAdmin) || (group === "partner" && inPartner) || group === p.role;
        if (!okGroup) {
          await signOut();
          return { ok: false, error: "Ce compte n'est pas autorisé pour cet espace." };
        }
      }
      setProfile(p);
      setHasSuperAdmin(await hasAnySuperadmin());
      await writeAudit({ action: "LOGIN", entity_type: "profiles", entity_id: p.id, description: `Connexion ${p.username}` });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Identifiants incorrects." };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!isSupabaseConfigured) return;
    try {
      if (profile) {
        await writeAudit({ action: "LOGOUT", entity_type: "profiles", entity_id: profile.id, description: `Déconnexion ${profile.username}` });
      }
    } catch {
      /* ignore audit failure on logout */
    }
    await signOut();
    setProfile(null);
  };

  const bootstrap: AuthContextValue["bootstrap"] = async (payload) => {
    if (!isSupabaseConfigured) return { ok: false, error: "Supabase non configuré." };
    setLoading(true);
    try {
      const already = await hasAnySuperadmin();
      if (already) return { ok: false, error: "Un Administrateur Supérieur existe déjà." };
      const p = await bootstrapFirstSuperadmin(payload);
      setProfile(p);
      setHasSuperAdmin(true);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Échec de l'initialisation." };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    loading,
    profile,
    role: profile?.role ?? null,
    hasSuperAdmin,
    error,
    refresh,
    login,
    logout,
    bootstrap,
  }), [ready, loading, profile, hasSuperAdmin, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
