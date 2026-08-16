import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck, GraduationCap, UserCircle2, LogIn, Eye, EyeOff, Lock, AlertTriangle,
  CheckCircle2, XCircle, Sparkles, ArrowRight, ShieldAlert, KeyRound, User as UserIcon,
  Mail, Handshake,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { Btn, Field, Input, Card } from "@/lib/ui";
import { checkPassword, passwordScore, getLockState, formatDuration } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasAnySuperadmin as sbHasAnySuperadmin } from "@/lib/supabase/auth";

type Group = "admin" | "teacher" | "student" | "partner";

const GROUPS: { key: Group; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "admin",   label: "Administrateur", icon: <ShieldCheck size={20} />, hint: "Direction & gestion" },
  { key: "teacher", label: "Formateur",       icon: <GraduationCap size={20} />, hint: "Espace pédagogique" },
  { key: "student", label: "Apprenant",       icon: <UserCircle2 size={20} />,   hint: "Espace personnel" },
  { key: "partner", label: "Partenaire",      icon: <Handshake size={20} />,     hint: "Lecture institutionnelle" },
];

export function LoginPage() {
  const local = useStore();
  const auth  = useAuth();
  const navigate = useNavigate();

  const [group,    setGroup]    = useState<Group>("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [locked,   setLocked]   = useState<{ ms: number } | null>(null);
  const [showFirst, setShowFirst] = useState(false);

  // ---- Vérification serveur de l'existence d'un superadmin ----
  // null = pas encore chargé, true/false = réponse connue
  const [serverHasAdmin, setServerHasAdmin] = useState<boolean | null>(
    isSupabaseConfigured ? null : local.hasSuperAdmin
  );
  const checkDone = useRef(false);

  useEffect(() => {
    if (checkDone.current) return;
    checkDone.current = true;

    if (!isSupabaseConfigured) {
      // Mode local : on lit directement le store
      setServerHasAdmin(local.hasSuperAdmin);
      return;
    }

    let alive = true;
    sbHasAnySuperadmin()
      .then((v) => { if (alive) setServerHasAdmin(v); })
      .catch(() => {
        // Sécurité : en cas d'erreur réseau on laisse le bouton visible
        // (l'utilisateur verra "déjà initialisé" si nécessaire dans le modal)
        if (alive) setServerHasAdmin(false);
      });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resync quand le store local change (création de compte réussie)
  useEffect(() => {
    if (!isSupabaseConfigured) setServerHasAdmin(local.hasSuperAdmin);
  }, [local.hasSuperAdmin]);

  // Resync quand Supabase confirme un premier superadmin
  useEffect(() => {
    if (isSupabaseConfigured && auth.hasSuperAdmin) setServerHasAdmin(true);
  }, [auth.hasSuperAdmin]);

  // Minuterie déverrouillage anti-bruteforce
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => {
      const l = getLockState(username);
      if (!l.locked) { setLocked(null); setError(""); }
      else setLocked({ ms: l.remainingMs });
    }, 1000);
    return () => clearInterval(t);
  }, [locked, username]);

  // ---- Connexion ----
  // Bouton "Première configuration" visible seulement quand la vérité serveur
  // confirme explicitement qu'aucun superadmin n'existe.
  const canFirstBoot = serverHasAdmin === false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);

    const res = isSupabaseConfigured
      ? await auth.login(username, password, group)
      : await local.login(username, password, group as any);

    setBusy(false);
    if (res.ok) {
      setPassword("");
      navigate("/app/dashboard");
    } else {
      setError(res.error || "Identifiants incorrects.");
      if ((res as any).locked && (res as any).remainingMs)
        setLocked({ ms: (res as any).remainingMs });
    }
  };

  return (
    <div className="bg-circuit scanlines relative flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-14">
      <div className="bg-grid-hex pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md">

        {/* En-tête */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_30px_-6px_rgba(0,229,255,0.9)]">
            <ShieldCheck size={26} className="text-white" />
          </div>
          <p className="font-display text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">SENTINELLES NUMÉRIQUES</p>
          <h1 className="font-display mt-1 text-2xl font-black text-white">Espace sécurisé</h1>
        </div>

        <Card className="p-6">
          {/* Bandeau première utilisation */}
          {canFirstBoot && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-300">Première utilisation</p>
                <p className="text-xs text-slate-300">Aucun compte n'est encore configuré. Créez le compte Administrateur Supérieur pour démarrer.</p>
              </div>
            </div>
          )}

          {/* Sélecteur de rôle */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => { setGroup(g.key); setError(""); }}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                  group === g.key
                    ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_-6px_rgba(0,229,255,0.6)]"
                    : "border-white/10 text-slate-400 hover:bg-white/5"
                )}
              >
                {g.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">{g.label}</span>
              </button>
            ))}
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <Field label="Nom d'utilisateur">
              <div className="relative">
                <UserIcon size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Votre identifiant"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  autoFocus
                  className="pl-9"
                />
              </div>
            </Field>

            <Field label="Mot de passe">
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label="Afficher le mot de passe"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold",
                locked
                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                  : "border-red-500/30 bg-red-500/5 text-red-400"
              )}>
                {locked
                  ? <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                  : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                <span>
                  {locked
                    ? `Compte temporairement verrouillé — ${formatDuration(locked.ms)} restantes.`
                    : error}
                </span>
              </div>
            )}

            <Btn type="submit" className="w-full py-3" disabled={busy || !!locked}>
              <LogIn size={17} /> {busy ? "Connexion…" : "Se connecter"}
            </Btn>
          </form>

          {/* Zone bas de carte */}
          <div className="mt-5 border-t border-white/5 pt-4 text-center">
            {serverHasAdmin === null ? (
              /* Chargement en cours — on n'affiche rien pour éviter tout clic accidentel */
              <p className="text-[11px] text-slate-600 animate-pulse">Vérification du statut…</p>
            ) : canFirstBoot ? (
              <>
                <p className="text-xs text-slate-400">Première utilisation ?</p>
                <button
                  type="button"
                  onClick={() => setShowFirst(true)}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <KeyRound size={14} /> Créer le premier compte <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
                  <CheckCircle2 size={13} /> Plateforme déjà initialisée
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  La création du compte principal n'est plus disponible. Contactez l'administrateur système.
                </p>
              </div>
            )}
          </div>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          Pas encore inscrit(e) ?{" "}
          <Link to="/pre-inscription" className="font-bold text-cyan-300 hover:underline">Pré-inscription en ligne</Link>
        </p>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] uppercase tracking-[0.2em] text-slate-600">
          <Lock size={10} /> Connexion chiffrée · {isSupabaseConfigured ? "Supabase Auth" : "Mode local"}
        </p>
      </div>

      {/* Modal création premier Admin Sup */}
      {showFirst && (
        <FirstAdminModal
          onClose={() => setShowFirst(false)}
          onDone={() => {
            setShowFirst(false);
            setServerHasAdmin(true); // Masque immédiatement le bouton
            navigate("/app/dashboard");
          }}
        />
      )}
    </div>
  );
}

/* ================================================================
   MODAL — Création du premier compte Administrateur Supérieur
   ================================================================ */
function FirstAdminModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const local = useStore();
  const auth  = useAuth();

  const [name,     setName]     = useState("");
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [show,     setShow]     = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [blocked,  setBlocked]  = useState(false);
  const [blockChecked, setBlockChecked] = useState(false);

  // Vérification serveur : déjà un superadmin ?
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const exists = isSupabaseConfigured
          ? await sbHasAnySuperadmin()
          : local.hasSuperAdmin;
        if (alive) { setBlocked(exists); setBlockChecked(true); }
      } catch {
        if (alive) { setBlocked(false); setBlockChecked(true); }
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks = checkPassword(password);
  const score  = passwordScore(password);
  const strong = checks.length && checks.upper && checks.lower && checks.digit && checks.special && checks.notCommon;
  const match  = confirm.length > 0 && confirm === password;
  const barColor = score <= 3 ? "bg-red-500" : score <= 5 ? "bg-amber-400" : "bg-emerald-400";
  const barLabel = score <= 3 ? "Faible"     : score <= 5 ? "Moyen"        : "Fort";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validations
    if (!name.trim()) return setError("Le nom complet est requis.");
    if (!username.trim()) return setError("L'identifiant est requis.");
    if (!/^[a-z0-9._-]{3,32}$/i.test(username.trim()))
      return setError("Identifiant invalide (3-32 caractères, lettres/chiffres/._-).");
    if (!email.trim() || !email.includes("@"))
      return setError("Un email valide est requis.");
    if (!strong)
      return setError("Le mot de passe ne respecte pas tous les critères de sécurité.");
    if (!match)
      return setError("Les deux mots de passe ne correspondent pas.");

    setBusy(true);
    try {
      const res = isSupabaseConfigured
        ? await auth.bootstrap({ name: name.trim(), username: username.trim().toLowerCase(), email: email.trim(), password })
        : await local.createFirstAdmin({ name: name.trim(), username: username.trim().toLowerCase(), email: email.trim(), password });

      if (!res.ok) {
        setError(res.error || "Une erreur est survenue.");
      } else {
        setPassword(""); setConfirm("");
        onDone();
      }
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  // Contenu si déjà initialisé
  if (blockChecked && blocked) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <Card className="max-w-md p-6 text-center">
          <ShieldAlert size={32} className="mx-auto text-red-400" />
          <h2 className="font-display mt-3 text-lg font-black text-white">Configuration déjà effectuée</h2>
          <p className="mt-2 text-sm text-slate-400">
            Un Administrateur Supérieur existe déjà. La création du compte principal n'est plus disponible.
          </p>
          <Btn className="mt-4" onClick={onClose}>Fermer</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-[#081021] shadow-[0_0_60px_-12px_rgba(0,229,255,0.5)]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600">
              <KeyRound size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">Première configuration</p>
              <h3 className="font-display text-base font-black text-white">Créer le compte Admin Sup</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >✕</button>
        </div>

        {/* Formulaire */}
        <form onSubmit={submit} className="space-y-4 p-6" autoComplete="off">
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs text-slate-300">
            <p className="mb-1 flex items-center gap-1.5 font-bold text-cyan-300">
              <ShieldCheck size={13} /> Compte principal — Administrateur Supérieur
            </p>
            <p className="text-slate-400">
              Ce compte permet de configurer la plateforme, de créer les autres utilisateurs et de gérer l'ensemble des données.
            </p>
          </div>

          <Field label="Nom complet">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom Prénom"
              required
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identifiant (username)" hint="3-32 car. — lettres, chiffres, ._-">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                placeholder="ex: admin"
                spellCheck={false}
                required
              />
            </Field>
            <Field label="Email">
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemple.com"
                  required
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <Field label="Mot de passe">
            <div className="relative">
              <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="12 caractères minimum"
                autoComplete="new-password"
                required
                className="pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          {/* Indicateur de force */}
          {password.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400">Force</span>
                <span className={cn("font-bold", score <= 3 ? "text-red-400" : score <= 5 ? "text-amber-300" : "text-emerald-300")}>{barLabel}</span>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className={cn("h-full transition-all", barColor)} style={{ width: `${(score / 8) * 100}%` }} />
              </div>
              <ul className="grid grid-cols-2 gap-1">
                <Rule ok={checks.length}   label="12 caractères minimum" />
                <Rule ok={checks.upper}    label="Une majuscule" />
                <Rule ok={checks.lower}    label="Une minuscule" />
                <Rule ok={checks.digit}    label="Un chiffre" />
                <Rule ok={checks.special}  label="Un caractère spécial" />
                <Rule ok={checks.notCommon} label="Non trop courant" />
              </ul>
            </div>
          )}

          <Field label="Confirmer le mot de passe">
            <div className="relative">
              <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retaper le mot de passe"
                autoComplete="new-password"
                required
                className="pl-9"
              />
            </div>
            {confirm.length > 0 && (
              <p className={cn("mt-1 flex items-center gap-1 text-[11px] font-semibold", match ? "text-emerald-300" : "text-red-400")}>
                {match
                  ? <><CheckCircle2 size={11} /> Les mots de passe correspondent</>
                  : <><XCircle size={11} /> Les mots de passe ne correspondent pas</>}
              </p>
            )}
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={onClose} type="button">Annuler</Btn>
            <Btn
              type="submit"
              disabled={!name.trim() || !email.trim() || !strong || !match || busy}
            >
              <ShieldCheck size={16} />
              {busy ? "Création en cours…" : "Créer le compte principal"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1.5 text-[11px]", ok ? "text-emerald-300" : "text-slate-500")}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {label}
    </li>
  );
}
