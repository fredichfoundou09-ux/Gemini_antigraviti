/**
 * Validateurs Zod centralisés pour les formulaires critiques.
 * Remplace la validation manuelle dispersée dans les composants.
 */
import { z } from "zod";

export const studentSchema = z.object({
  nom: z.string().min(2, "Nom trop court (minimum 2 caractères)"),
  prenom: z.string().min(2, "Prénom trop court (minimum 2 caractères)"),
  telephone: z.string().min(8, "Numéro de téléphone invalide"),
  whatsapp: z.string().min(8, "Numéro WhatsApp invalide"),
  email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
  formation: z.enum(["informatique", "industriel"], { message: "Formation invalide" }),
  niveau: z.string().min(1, "Niveau d'étude requis"),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const paymentSchema = z.object({
  montant: z.number().positive("Le montant doit être positif"),
  mode: z.string().min(1, "Mode de paiement requis"),
  type: z.enum(["inscription", "formation"]),
  libelle: z.string().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const preRegistrationSchema = z.object({
  nom: z.string().min(2, "Nom requis"),
  prenom: z.string().min(2, "Prénom requis"),
  telephone: z.string().min(8, "Téléphone requis"),
  whatsapp: z.string().min(8, "WhatsApp requis"),
  email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
  niveau: z.string().min(1, "Niveau requis"),
  formation: z.enum(["informatique", "industriel"]),
});
export type PreRegistrationInput = z.infer<typeof preRegistrationSchema>;

export const userPasswordSchema = z.object({
  password: z.string()
    .min(12, "Minimum 12 caractères")
    .regex(/[A-Z]/, "Une majuscule requise")
    .regex(/[a-z]/, "Une minuscule requise")
    .regex(/[0-9]/, "Un chiffre requis")
    .regex(/[^A-Za-z0-9]/, "Un caractère spécial requis"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

/** Valide et retourne les erreurs formatées */
export function validate<T>(schema: z.ZodType<T>, data: unknown): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  result.error.issues.forEach((e) => {
    const key = e.path.map(String).join(".") || "_root";
    errors[key] = e.message;
  });
  return { ok: false, errors };
}
