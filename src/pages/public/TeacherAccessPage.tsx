import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck, Lock, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, UserCheck, Mail
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, Field, Input, PageHead } from "@/lib/ui";
import { validatePassword, passwordScore } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

export function TeacherAccessPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { db, update, log } = useStore();

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyAndConsumeToken() {
      if (!token.trim()) {
        setLoading(false);
        setTokenValid(false);
        setError("Aucun jeton d'accès fourni dans le lien.");
        return;
      }

      if (isSupabaseConfigured) {
        try {
          const { data, error: rpcErr } = await supabase.rpc("consume_teacher_access_token", {
            p_token: token.trim(),
          });

          if (rpcErr || !data?.success) {
            setTokenValid(false);
            setError(data?.message || "Ce lien d'accès à usage unique a déjà été utilisé ou a expiré. Veuillez vous connecter avec votre identifiant et votre mot de passe.");
          } else {
            setTokenValid(true);
            setTeacherData(data);
            setEmail(data.email || "");
          }
        } catch (err: any) {
          setTokenValid(false);
          setError("Impossible de valider le lien d'accès.");
        }
      } else {
        // Mode local fallback
        setTokenValid(true);
        setTeacherData({
          teacher_id: "T-TEST",
          user_id: "00000000-0000-0000-0000-000000000001",
          nom: "Enseignant",
          prenom: "Formateur",
          email: "enseignant@sentinelles.local",
          username: "ens_test"
        });
        setEmail("enseignant@sentinelles.local");
      }

      setLoading(false);
    }

    verifyAndConsumeToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.error || "Le mot de passe doit respecter les critères de sécurité.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSupabaseConfigured && teacherData) {
        const { data, error: compErr } = await supabase.rpc("complete_teacher_first_access", {
          p_teacher_id: teacherData.teacher_id,
          p_user_id: teacherData.user_id,
          p_email: email.trim(),
          p_new_password: password.trim(),
        });

        if (compErr || (data && data.success === false)) {
          throw new Error(compErr?.message || data?.message || "Erreur lors de la mise à jour");
        }

        // Tenter la connexion automatique avec le nouvel identifiant
        if (teacherData.username) {
          await supabase.auth.signInWithPassword({
            email: email.trim() || teacherData.email,
            password: password.trim(),
          }).catch(() => {});
        }
      }

      // Mise à jour de l'état local dans le store
      update((d) => {
        const nextTeachers = d.teachers.map((t) =>
          t.id === teacherData?.teacher_id ? { ...t, email: email.trim() } : t
        );
        const nextUsers = d.users.map((u) =>
          u.id === teacherData?.user_id ? { ...u, email: email.trim(), actif: true } : u
        );
        return { ...d, teachers: nextTeachers, users: nextUsers };
      });

      log(`Compte formateur activé et personnalisé : ${teacherData?.prenom} ${teacherData?.nom}`);
      toastMsg.success("Votre mot de passe et vos informations ont été enregistrés avec succès ✓");
      setSuccess(true);

      // Redirection vers l'espace de travail après 1.5 seconde
      setTimeout(() => {
        navigate("/connexion");
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Échec de l'enregistrement de votre compte.");
    } finally {
      setSubmitting(false);
    }
  };

  const score = passwordScore(password);

  return (
    <div className="bg-circuit scanlines relative flex min-h-[calc(100vh-65px)] items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-md">
        {loading ? (
          <Card className="p-8 text-center border-cyan-400/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
              <KeyRound size={28} className="animate-spin" />
            </div>
            <h2 className="font-display mt-4 text-lg font-bold text-white">Vérification de l'accès formateur…</h2>
            <p className="mt-2 text-xs text-slate-400">
              Validation sécurisée du lien et expiration à usage unique en cours.
            </p>
          </Card>
        ) : !tokenValid ? (
          <Card className="p-6 border-rose-500/40 bg-[#0c1222]/95 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="font-display mt-4 text-lg font-bold text-white">Lien expiré ou déjà utilisé</h2>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed">
              {error || "Ce lien d'accès à usage unique a déjà été consommé pour sécuriser votre compte. Il n'est plus réutilisable."}
            </p>
            <div className="mt-6">
              <Link to="/connexion">
                <Btn className="w-full">
                  Se connecter avec mes identifiants <ArrowRight size={16} />
                </Btn>
              </Link>
            </div>
          </Card>
        ) : success ? (
          <Card className="p-6 border-emerald-500/40 bg-[#0c1222]/95 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="font-display mt-4 text-xl font-bold text-white">Compte Formateur Prêt !</h2>
            <p className="mt-2 text-xs text-slate-300">
              Votre mot de passe et vos informations ont été enregistrés avec succès.
            </p>
            <p className="mt-4 text-[11px] text-cyan-300 font-mono">Redirection vers la page de connexion…</p>
            <div className="mt-5">
              <Link to="/connexion">
                <Btn className="w-full">Accéder à mon espace</Btn>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8 border-cyan-400/30 bg-[#0c1222]/95 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <UserCheck size={26} />
              </div>
              <h2 className="font-display mt-3 text-xl font-bold text-white">
                Bienvenue, {teacherData?.prenom} {teacherData?.nom}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Personnalisez vos accès pour sécuriser votre espace Formateur.
              </p>
            </div>

            {/* Avertissement lien unique consommé */}
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left text-[11px] text-emerald-300 flex items-start gap-2">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Lien à usage unique validé :</strong> Ce lien est désormais expiré. Vous utiliserez désormais votre propre mot de passe ci-dessous pour vous connecter.
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Identifiant de connexion</label>
                <input
                  type="text"
                  disabled
                  value={teacherData?.username || teacherData?.nom?.toLowerCase() || ""}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cyan-300 font-mono"
                />
              </div>

              <Field label="Adresse Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.email@exemple.com"
                  required
                />
              </Field>

              <Field label="Nouveau Mot de Passe">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Force : <strong className={score.color}>{score.label}</strong></span>
                      <span>{password.length} car.</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${
                          score.score <= 1 ? "bg-rose-500 w-1/4" : score.score === 2 ? "bg-amber-400 w-2/4" : score.score === 3 ? "bg-cyan-400 w-3/4" : "bg-emerald-400 w-full"
                        }`}
                      />
                    </div>
                  </div>
                )}
              </Field>

              <Field label="Confirmer le Mot de Passe">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  required
                />
              </Field>

              <Btn type="submit" disabled={submitting} className="w-full mt-2">
                {submitting ? "Enregistrement sécurisé…" : "Enregistrer et accéder à mon espace"}
              </Btn>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
