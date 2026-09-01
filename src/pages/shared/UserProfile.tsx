import { useState } from "react";
import {
  UserCircle2, Phone, Mail, MapPin, ShieldCheck, KeyRound, Lock, Eye, EyeOff,
  CheckCircle2, AlertTriangle, GraduationCap, Building2, UserCheck, Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Btn, Card, Field, Input, PageHead, Badge, readImage } from "@/lib/ui";
import { validatePassword, passwordScore } from "@/lib/auth";
import { toastMsg } from "@/lib/toast";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState("");

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
      setCurrentPassword("");
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
      </div>
    </div>
  );
}
