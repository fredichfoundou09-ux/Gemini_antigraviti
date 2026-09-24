import { useState, useEffect } from "react";
import {
  UserCircle2, Phone, MapPin, ShieldCheck, KeyRound, Lock, Eye, EyeOff,
  Bell, BellRing, Volume2, Smartphone, CheckCircle2, AlertCircle,
  QrCode, Copy, Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Btn, Card, Field, Input, PageHead, Badge, Modal, readImage } from "@/lib/ui";
import { validatePassword, passwordScore } from "@/lib/auth";
import { toastMsg } from "@/lib/toast";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  playNotificationChime,
} from "@/lib/pushNotifications";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  isUser2faEnabled,
  saveAdminTotpConfig,
  removeAdminTotpConfig,
} from "@/lib/totp";

export function UnifiedProfilePage() {
  const { db, user, update, log } = useStore();

  if (!user) {
    return (
      <div className="p-6 text-center text-slate-400">
        Veuillez vous connecter pour accéder à votre profil.
      </div>
    );
  }

  // Fiche métier associée selon le rôle
  const student = user.role === "student" ? db.students.find((s) => s.userId === user.id || s.id === user.id) : null;
  const teacher = user.role === "teacher" ? db.teachers.find((t) => t.userId === user.id || t.id === user.id) : null;

  // États du formulaire profil
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || student?.telephone || teacher?.phone || "");
  const [whatsapp, setWhatsapp] = useState(student?.whatsapp || teacher?.phone || "");
  const [adresse, setAdresse] = useState(student?.adresse || "");
  const [photo, setPhoto] = useState(student?.photo || teacher?.photo || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // États du changement de mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState("");

  // États des notifications natives
  const [notifPerm, setNotifPerm] = useState(() => getNotificationPermission());
  const [testingNotif, setTestingNotif] = useState(false);

  // États 2FA TOTP pour les comptes administrateurs
  const isAdmin = user.role === "admin" || user.role === "superadmin";
  const [is2faActive, setIs2faActive] = useState(false);
  const [setupStep, setSetupStep] = useState<"idle" | "configuring">("idle");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving2fa, setSaving2fa] = useState(false);
  const [confirmDisable2fa, setConfirmDisable2fa] = useState(false);

  useEffect(() => {
    if (user?.id && isAdmin) {
      isUser2faEnabled(user.id).then(setIs2faActive).catch(() => {});
    }
  }, [user?.id, isAdmin]);

  const start2faSetup = () => {
    const sec = generateTotpSecret();
    const uri = generateTotpUri("Sentinelles Numériques", user?.email || user?.username || "admin", sec);
    setTotpSecret(sec);
    setTotpUri(uri);
    setTotpCode("");
    setTotpError("");
    setSetupStep("configuring");
  };

  const cancel2faSetup = () => {
    setSetupStep("idle");
    setTotpSecret("");
    setTotpUri("");
    setTotpCode("");
    setTotpError("");
  };

  const copySecret = () => {
    if (!totpSecret) return;
    navigator.clipboard?.writeText(totpSecret).then(() => {
      setCopied(true);
      toastMsg.info("Clé copiée !", "Collez-la dans votre application d'authentification.");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const confirmAndActivate2fa = async () => {
    if (!user?.id || !totpSecret) return;
    if (totpCode.length !== 6) {
      setTotpError("Le code doit comporter 6 chiffres.");
      return;
    }
    setSaving2fa(true);
    setTotpError("");

    try {
      const isValid = await verifyTotpCode(totpSecret, totpCode);
      if (!isValid) {
        setTotpError("Code incorrect ou expiré. Assurez-vous que l'heure de votre téléphone est à l'heure automatique.");
        return;
      }

      await saveAdminTotpConfig(user.id, totpSecret, true);
      setIs2faActive(true);
      setSetupStep("idle");
      setTotpSecret("");
      setTotpUri("");
      setTotpCode("");
      toastMsg.success("2FA activé avec succès !", "Votre compte est désormais protégé par validation TOTP.");
      log(`2FA activé pour l'administrateur ${user.username}`);
    } catch (err: any) {
      setTotpError(err.message || "Erreur lors de l'activation du 2FA");
    } finally {
      setSaving2fa(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!user?.id) return;
    setSaving2fa(true);
    try {
      await removeAdminTotpConfig(user.id);
      setIs2faActive(false);
      setConfirmDisable2fa(false);
      toastMsg.info("2FA désactivé", "L'authentification en deux étapes a été retirée.");
      log(`2FA désactivé pour l'administrateur ${user.username}`);
    } finally {
      setSaving2fa(false);
    }
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setNotifPerm(res);
    if (res === "granted") {
      toastMsg.success("Notifications autorisées !", "Vous recevrez les alertes de messages et rappels d'emploi du temps.");
      sendTestNotification();
    } else if (res === "denied") {
      toastMsg.error("Notifications bloquées", "Veuillez débloquer les notifications dans les paramètres de votre navigateur.");
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      const ok = await sendTestNotification();
      if (ok) {
        toastMsg.success("Notification émise !", "Vérifiez le haut de votre écran (bannière système).");
      } else {
        toastMsg.warning("Action requise", "Veuillez autoriser les notifications sur cet appareil.");
        handleRequestPermission();
      }
    } finally {
      setTestingNotif(false);
    }
  };

  const handlePlayChime = () => {
    playNotificationChime();
    toastMsg.info("Signal sonore", "Carillon cyber émis via le haut-parleur de votre appareil.");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      setPhoto(dataUrl);
      toastMsg.info("Photo chargée", "N'oubliez pas d'enregistrer les modifications.");
    } catch {
      toastMsg.error("Erreur image", "Impossible de lire ce fichier.");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      // 1. Sauvegarde côté Supabase
      if (isSupabaseConfigured) {
        // Mise à jour de la table profiles
        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
          })
          .eq("id", user.id);

        if (pErr) console.warn("Supabase profiles update warning:", pErr.message);

        // Mise à jour de la fiche élève si apprenant
        if (student) {
          await supabase
            .from("students")
            .update({
              telephone: phone.trim(),
              whatsapp: whatsapp.trim(),
              adresse: adresse.trim(),
              photo_url: photo || null,
            })
            .eq("id", student.id);
        }

        // Mise à jour de la fiche enseignant si formateur
        if (teacher) {
          await supabase
            .from("teachers")
            .update({
              phone: phone.trim(),
              photo_url: photo || null,
            })
            .eq("id", teacher.id);
        }

        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      }

      // 2. Mise à jour locale dans le store
      update((d) => {
        const nextUsers = d.users.map((u) => (u.id === user.id ? { ...u, name, phone, email } : u));
        let nextStudents = d.students;
        let nextTeachers = d.teachers;

        if (student) {
          nextStudents = d.students.map((s) =>
            s.id === student.id ? { ...s, telephone: phone, whatsapp, adresse, photo } : s
          );
        }
        if (teacher) {
          nextTeachers = d.teachers.map((t) =>
            t.id === teacher.id ? { ...t, phone, photo } : t
          );
        }

        return {
          ...d,
          users: nextUsers,
          students: nextStudents,
          teachers: nextTeachers,
        };
      });

      log(`Profil mis à jour : ${name}`);
      toastMsg.success("Profil mis à jour avec succès ✓");
    } catch (err: any) {
      toastMsg.error("Erreur sauvegarde", err.message || "Échec de mise à jour");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");

    const check = validatePassword(newPassword);
    if (!check.valid) {
      setPassError(check.error || "Mot de passe trop faible.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSavingPass(true);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw error;
      }

      toastMsg.success("Mot de passe modifié avec succès ✓");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassError(err.message || "Échec du changement de mot de passe.");
    } finally {
      setSavingPass(false);
    }
  };

  const passScore = passwordScore(newPassword);

  return (
    <div className="space-y-6">
      <PageHead
        title="Mon profil"
        subtitle={`Espace personnel — ${user.name || user.username} (${user.role.toUpperCase()})`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Colonne gauche : Carte d'identité et informations institutionnelles */}
        <div className="space-y-5">
          <Card className="relative overflow-hidden p-6 border-cyan-400/30 bg-gradient-to-br from-[#0B1733] to-[#070D1E]">
            <div className="flex items-start gap-4">
              {photo ? (
                <img
                  src={photo}
                  alt={user.name}
                  className="h-20 w-20 rounded-2xl border-2 border-cyan-400/60 object-cover shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
                  <UserCircle2 size={44} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-black text-white">{name || user.username}</h2>
                  <Badge color={user.role === "superadmin" ? "red" : user.role === "admin" ? "cyan" : user.role === "teacher" ? "blue" : "green"}>
                    {user.role}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-cyan-300">{user.username}</p>
                <p className="mt-1 text-xs text-slate-400">{email || "Aucun e-mail renseigné"}</p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-400/20">
                  <span>📷 Modifier ma photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Champs institutionnels (Lecture seule / Sécurité) */}
            <div className="mt-6 space-y-2 border-t border-white/10 pt-4 text-xs">
              <p className="font-bold uppercase tracking-wider text-slate-400">Paramètres système protégés</p>
              <div className="flex justify-between text-slate-300">
                <span>Rôle attribué :</span>
                <span className="font-mono font-bold text-white capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Identifiant interne :</span>
                <span className="font-mono text-slate-400">{user.id}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Statut du compte :</span>
                <span className="font-bold text-emerald-400">Actif</span>
              </div>
              {student && (
                <div className="flex justify-between text-slate-300">
                  <span>Formation suivie :</span>
                  <span className="font-bold text-cyan-300">{student.formation === "informatique" ? "Génie Informatique" : "Génie Industriel"}</span>
                </div>
              )}
              {teacher && (
                <div className="flex justify-between text-slate-300">
                  <span>Spécialité :</span>
                  <span className="font-bold text-blue-300">{teacher.specialite || "Pédagogie"}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Bloc de sécurité / changement de mot de passe */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={18} className="text-cyan-300" />
              <h3 className="font-display text-sm font-bold text-white">Changer mon mot de passe</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Field label="Nouveau mot de passe">
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>

              {newPassword && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Robustesse : {passScore >= 6 ? "Excellente" : passScore >= 4 ? "Bonne" : "Moyenne"}</span>
                    <span>{passScore}/8</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all ${
                        passScore <= 3
                          ? "w-1/4 bg-red-500"
                          : passScore <= 5
                          ? "w-2/4 bg-amber-400"
                          : passScore <= 7
                          ? "w-3/4 bg-cyan-400"
                          : "w-full bg-emerald-400"
                      }`}
                    />
                  </div>
                </div>
              )}

              <Field label="Confirmer le nouveau mot de passe">
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  required
                />
              </Field>

              {passError && (
                <p className="rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-xs text-red-300 font-semibold">
                  {passError}
                </p>
              )}

              <Btn type="submit" disabled={savingPass || !newPassword} className="w-full">
                {savingPass ? "Mise à jour…" : "Mettre à jour mon mot de passe"}
              </Btn>
            </form>
          </Card>

          {/* Bloc Sécurité 2FA TOTP pour Administrateurs */}
          {isAdmin && (
            <Card className="p-6 border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-cyan-950/20 shadow-[0_0_20px_rgba(0,229,255,0.06)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-cyan-400" />
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">Validation 2FA (TOTP)</h3>
                    <p className="text-[11px] text-slate-400">Protection renforcée pour l'administration</p>
                  </div>
                </div>
                {is2faActive ? (
                  <Badge color="green">2FA Actif</Badge>
                ) : (
                  <Badge color="gray">Désactivé</Badge>
                )}
              </div>

              {is2faActive ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 size={15} /> Compte administrateur hautement protégé
                    </p>
                    <p className="mt-1 text-slate-300 leading-relaxed">
                      La double authentification TOTP est active. Un code à 6 chiffres depuis votre application d'authentification vous sera demandé à chaque connexion.
                    </p>
                  </div>
                  <Btn
                    variant="outline"
                    onClick={() => setConfirmDisable2fa(true)}
                    className="w-full text-xs text-rose-300 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-400"
                  >
                    Désactiver la protection 2FA
                  </Btn>
                </div>
              ) : setupStep === "idle" ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Protégez votre compte avec Google Authenticator, Microsoft Authenticator ou n'importe quelle application TOTP standard.
                  </p>
                  <Btn onClick={start2faSetup} className="w-full text-xs">
                    <QrCode size={14} /> Configurer le 2FA maintenant
                  </Btn>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    1. Scannez ce QR Code avec votre application d'authentification :
                  </p>
                  <div className="p-3 bg-white rounded-xl mx-auto w-fit shadow-lg border border-white/20">
                    <QRCodeSVG value={totpUri} size={150} />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 text-xs">
                    <p className="text-slate-400 text-[11px] mb-1">Clé de configuration manuelle :</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-cyan-300 font-bold tracking-widest text-xs select-all truncate">
                        {totpSecret}
                      </code>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="shrink-0 p-1.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 transition"
                        title="Copier la clé secrète"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      2. Saisissez le code à 6 chiffres généré :
                    </label>
                    <Input
                      value={totpCode}
                      onChange={(e) => {
                        setTotpCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6));
                        setTotpError("");
                      }}
                      placeholder="123456"
                      className="text-center font-mono font-bold tracking-widest text-lg"
                      maxLength={6}
                    />
                    {totpError && (
                      <p className="mt-1.5 text-xs text-rose-400 font-medium">{totpError}</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Btn variant="ghost" onClick={cancel2faSetup} className="flex-1 text-xs">
                      Annuler
                    </Btn>
                    <Btn
                      onClick={confirmAndActivate2fa}
                      disabled={totpCode.length !== 6 || saving2fa}
                      className="flex-1 text-xs"
                    >
                      {saving2fa ? "Validation…" : "Activer le 2FA"}
                    </Btn>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Colonne droite : Coordonnées modifiables par l'utilisateur */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-white">Coordonnées personnelles</h3>
              <p className="text-xs text-slate-400">Informations de contact modifiables à tout moment</p>
            </div>
            <ShieldCheck size={18} className="text-cyan-400" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label="Nom complet">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>

            <Field label="Adresse e-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numéro de téléphone">
                <div className="relative">
                  <Phone size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+242 06..." className="pl-9" />
                </div>
              </Field>

              <Field label="Numéro WhatsApp">
                <div className="relative">
                  <Phone size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+242 06..." className="pl-9" />
                </div>
              </Field>
            </div>

            <Field label="Adresse physique">
              <div className="relative">
                <MapPin size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Brazzaville, Congo" className="pl-9" />
              </div>
            </Field>

            <div className="pt-3">
              <Btn type="submit" disabled={savingProfile} className="w-full">
                {savingProfile ? "Enregistrement…" : "Enregistrer les modifications"}
              </Btn>
            </div>
          </form>
        </Card>

        {/* Bloc Système : Notifications Push & Alertes PWA */}
        <Card className="p-6 lg:col-span-2 border-cyan-500/30 bg-gradient-to-br from-[#0B111A] via-[#0E1B2E] to-[#07102B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <BellRing size={20} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  Notifications Push Système & Alertes d'Emploi du Temps
                  <span className="hidden sm:inline-flex rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-400/25">
                    OS & PWA
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Alertes natives au premier plan et en arrière-plan (Smartphone & Ordinateur)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {notifPerm === "granted" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                  <CheckCircle2 size={13} /> Active & Autorisée
                </span>
              ) : notifPerm === "denied" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-300">
                  <AlertCircle size={13} /> Bloquée dans le navigateur
                </span>
              ) : notifPerm === "unsupported" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/30 bg-slate-500/15 px-3 py-1 text-xs font-bold text-slate-400">
                  Non supporté
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                  En attente d'autorisation
                </span>
              )}
            </div>
          </div>

          {/* Fonctionnalités couvertes */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 font-bold text-xs text-white">
                <span>💬</span> Messages instantanés
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                Bannière en haut de l'écran lors de la réception d'un message même si l'application est réduite.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                <span>⏰</span> Rappel cours 15 min avant
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                Vérification continue de l'emploi du temps avec alerte anticipée contenant la salle et le formateur.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 font-bold text-xs text-cyan-300">
                <span>🔔</span> Démarrage de séance
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                Vibration + carillon cyber et alerte immédiate pile au moment où la séance commence.
              </p>
            </div>
          </div>

          {/* Message si bloqué */}
          {notifPerm === "denied" && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">Les notifications sont bloquées dans votre navigateur.</p>
                <p className="text-[11px] text-red-200/80 mt-0.5">
                  Pour les réactiver : cliquez sur le cadenas ou l'icône de réglages à gauche de l'URL du navigateur, passez « Notifications » sur « Autoriser », puis actualisez la page.
                </p>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="mt-5 flex flex-wrap items-center gap-3 pt-3 border-t border-white/5">
            {notifPerm !== "granted" && notifPerm !== "unsupported" && (
              <button
                type="button"
                onClick={handleRequestPermission}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-400/20 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/30 hover:border-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.25)] transition"
              >
                <Bell size={15} />
                Activer les notifications sur cet appareil
              </button>
            )}

            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testingNotif}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:border-cyan-400/40 hover:bg-white/10 transition"
            >
              <Smartphone size={15} className="text-cyan-400" />
              {testingNotif ? "Envoi du test…" : "Tester la notification push"}
            </button>

            <button
              type="button"
              onClick={handlePlayChime}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-amber-400/40 hover:bg-white/10 transition"
            >
              <Volume2 size={15} className="text-amber-400" />
              Tester le son cyber
            </button>
          </div>
        </Card>
      </div>

      {/* Modal confirmation de désactivation 2FA */}
      <Modal open={confirmDisable2fa} onClose={() => setConfirmDisable2fa(false)} title="Désactivation du 2FA">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Êtes-vous certain de vouloir désactiver l'authentification à deux facteurs ? Votre compte administrateur sera moins protégé contre les compromissions de mot de passe.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setConfirmDisable2fa(false)}>Annuler</Btn>
            <Btn variant="red" onClick={handleDisable2fa} disabled={saving2fa}>
              {saving2fa ? "Désactivation…" : "Confirmer la désactivation"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
