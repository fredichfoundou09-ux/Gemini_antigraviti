import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck, Lock, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, Field, Input, PageHead } from "@/lib/ui";
import { validatePassword, passwordScore } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

export function AccountActivationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { db, update, log } = useStore();

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setLoading(false);
        setTokenValid(false);
        return;
      }

      if (isSupabaseConfigured) {
        try {
          const { data, error: rpcErr } = await supabase.rpc("consume_invitation_token", {
            p_token: token,
          });

          if (rpcErr || !data?.success) {
            setTokenValid(false);
            setError(data?.message || "Lien d'invitation invalide ou expiré.");
          } else {
            setTokenValid(true);
            setInvitationData(data);
          }
        } catch (err: any) {
          setTokenValid(false);
          setError("Impossible de vérifier le lien d'invitation.");
        }
      } else {
        // En mode démo local
        setTokenValid(true);
        setInvitationData({ email: "formateur@sentinelle.local", role: "teacher" });
      }

      setLoading(false);
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.error || "Mot de passe trop faible.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSupabaseConfigured && invitationData) {
        // 1. Mettre à jour l'utilisateur si email fourni
        if (invitationData.email) {
          const { error: upErr } = await supabase.auth.updateUser({
            password: password,
          });
          if (upErr) {
            console.warn("UpdateUser auth warning:", upErr.message);
          }
        }

        // 2. Marquer le token comme consommé
        await supabase
          .from("account_invitations")
          .update({ used_at: new Date().toISOString() })
          .eq("token", token);
      }

      // Enregistrement local fallback / audit
      log(`Compte activé avec succès via invitation sécurisée`);
      toastMsg.success("Mot de passe défini avec succès ✓", "Vous pouvez maintenant vous connecter.");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Échec de l'activation.");
    } finally {
      setSubmitting(false);
    }
  };

  const score = passwordScore(password);

  return (
    <div className="bg-circuit scanlines relative flex min-h-[calc(100vh-65px)] items-center justify-center p-4 sm:p-6">
      <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 w-full max-w-md">
        {/* En-tête officiel */}
        <div className="mb-6 text-center">
          <img
            src="/logo.png"
            alt="SENTINELLE NUMÉRIQUE"
            className="mx-auto mb-3 h-16 w-16 object-contain drop-shadow-[0_0_20px_rgba(0,229,255,0.7)]"
          />
          <h1 className="font-display text-2xl font-black text-white">Activation de Compte</h1>
          <p className="mt-1 text-xs text-slate-400">Définissez votre mot de passe personnel sécurisé</p>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Vérification de la validité du lien d'invitation…
            </div>
          ) : !tokenValid ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm font-bold text-white">Lien d'activation expiré ou invalide</p>
              <p className="text-xs text-slate-400">
                {error || "Ce lien temporaire (48h) a déjà été utilisé ou n'est plus valable. Veuillez demander un nouveau lien à votre administrateur."}
              </p>
              <Link to="/connexion">
                <Btn variant="outline" className="w-full mt-2">Retour à la connexion</Btn>
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-base font-bold text-white">Compte activé avec succès !</p>
              <p className="text-xs text-slate-400">
                Votre mot de passe a été enregistré de façon chiffrée. Vous pouvez dès maintenant accéder à votre espace de formation.
              </p>
              <Link to="/connexion">
                <Btn className="w-full mt-3">
                  Aller à la connexion <ArrowRight size={16} />
                </Btn>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-slate-300">
                <p className="font-bold text-cyan-300">Invitation vérifiée ✓</p>
                <p className="mt-1">Rôle assigné : <span className="font-semibold text-white uppercase">{invitationData?.role || "Formateur"}</span></p>
                {invitationData?.email && <p>Email : <span className="text-slate-200">{invitationData.email}</span></p>}
              </div>

              <Field label="Nouveau mot de passe">
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    required
                    autoFocus
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              {/* Jauge de robustesse du mot de passe */}
              {password && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Robustesse : {score >= 6 ? "Excellente" : score >= 4 ? "Bonne" : "Moyenne"}</span>
                    <span>{score}/8</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all ${
                        score <= 3
                          ? "w-1/4 bg-red-500"
                          : score <= 5
                          ? "w-2/4 bg-amber-400"
                          : score <= 7
                          ? "w-3/4 bg-cyan-400"
                          : "w-full bg-emerald-400"
                      }`}
                    />
                  </div>
                </div>
              )}

              <Field label="Confirmer le mot de passe">
                <div className="relative">
                  <KeyRound size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    required
                    className="pl-9"
                  />
                </div>
              </Field>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 font-semibold">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Btn type="submit" className="w-full py-3" disabled={submitting}>
                <ShieldCheck size={16} /> {submitting ? "Enregistrement…" : "Activer mon compte"}
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
