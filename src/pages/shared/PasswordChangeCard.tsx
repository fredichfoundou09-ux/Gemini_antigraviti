import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Card, Field, Input, Btn } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { passwordStrong } from "@/lib/auth";
import { useStore } from "@/lib/store";

export function PasswordChangeCard() {
  const { user } = useStore();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword) {
      toastMsg.error("Mot de passe manquant", "Veuillez saisir un nouveau mot de passe.");
      return;
    }

    if (newPassword.length < 8) {
      toastMsg.error("Mot de passe trop court", "Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toastMsg.error("Non concordance", "Les deux mots de passe saisis ne sont pas identiques.");
      return;
    }

    const check = passwordStrong(newPassword);
    if (!check.ok) {
      toastMsg.error("Mot de passe insuffisant", check.reason || "Veuillez choisir un mot de passe plus robuste.");
      return;
    }

    setLoading(true);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;

        // Mise à jour de la conformité du profil
        if (user?.id) {
          try {
            await supabase.from("profiles").update({
              must_change_password: false,
            }).eq("id", user.id);

            await supabase.from("audit_logs").insert({
              user_id: user.id,
              action: "PASSWORD_CHANGE",
              entity_type: "profiles",
              entity_id: user.id,
              description: "Modification autonome du mot de passe utilisateur",
            });
          } catch { /* ignore audit */ }
        }

        toastMsg.success("Mot de passe mis à jour ✓", "Votre nouveau mot de passe est désormais actif pour toutes vos connexions.");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err: any) {
        toastMsg.error("Échec de mise à jour", err.message || "Impossible de modifier le mot de passe actuellement.");
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      toastMsg.success("Mot de passe mis à jour en local ✓");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
          <Lock size={18} />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-white">Sécurité du compte</h3>
          <p className="text-xs text-slate-400">Modifier votre mot de passe de connexion</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nouveau mot de passe">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Confirmer le nouveau mot de passe">
          <Input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Répétez le mot de passe"
          />
        </Field>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-slate-400 space-y-1">
          <p className="flex items-center gap-1.5 text-cyan-300 font-semibold">
            <ShieldCheck size={13} /> Recommandations :
          </p>
          <p>• Au moins 8 caractères de longueur</p>
          <p>• Une majuscule, une minuscule et un chiffre ou symbole</p>
        </div>

        <Btn type="submit" disabled={loading || !newPassword} className="w-full">
          {loading ? "Mise à jour en cours..." : "Enregistrer le nouveau mot de passe"}
        </Btn>
      </form>
    </Card>
  );
}
