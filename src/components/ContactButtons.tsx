import React from "react";
import { Link } from "react-router-dom";
import { Phone, MessagesSquare, Mail } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Normalise un numéro de téléphone pour WhatsApp (format international sans + ni espaces).
 * Par défaut, applique l'indicatif international du Congo-Brazzaville (+242).
 */
export function normalizePhoneForWhatsApp(
  rawPhone?: string | null,
  defaultCountryCode = "242"
): string | null {
  if (!rawPhone) return null;
  // Conserver uniquement les chiffres
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;

  // Supprimer les zéros initiaux de préfixe international (00242 -> 242)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Si le numéro commence déjà par l'indicatif Congo (242) ou un autre indicatif pays >= 11 chiffres
  if (digits.startsWith(defaultCountryCode) && digits.length >= 10) {
    return digits;
  }

  // Format local Congo : 9 chiffres débutant par 0 (ex. 06 999 99 99 ou 05 555 55 55)
  if (digits.length === 9 && digits.startsWith("0")) {
    return `${defaultCountryCode}${digits.slice(1)}`;
  }

  // Format local 8 chiffres (ex. 6 999 99 99 ou 5 555 55 55)
  if (digits.length === 8) {
    return `${defaultCountryCode}${digits}`;
  }

  // Numéro complet international déjà formaté (ex: 336..., 243...)
  if (digits.length >= 9) {
    return digits;
  }

  // Moins de 7 chiffres : numéro incomplet / invalide
  return null;
}

export interface ContactButtonsProps {
  phone?: string | null;
  userId?: string | null;
  email?: string | null;
  name?: string;
  size?: "sm" | "md";
  showLabels?: boolean;
  className?: string;
}

export function ContactButtons({
  phone,
  userId,
  email,
  name = "Contact",
  size = "md",
  showLabels = false,
  className,
}: ContactButtonsProps) {
  const cleanWhatsApp = normalizePhoneForWhatsApp(phone);
  const cleanTel = phone ? phone.replace(/[^\d+]/g, "") : null;

  const isSmall = size === "sm";

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {/* WhatsApp */}
      {cleanWhatsApp && (
        <a
          href={`https://wa.me/${cleanWhatsApp}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center justify-center gap-1 font-semibold rounded-lg transition-all",
            "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50",
            isSmall ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
          )}
          title={`Contacter ${name} sur WhatsApp`}
          aria-label={`WhatsApp ${name}`}
        >
          <span className="font-bold text-emerald-400">WA</span>
          {showLabels && <span>WhatsApp</span>}
        </a>
      )}

      {/* Appel téléphonique direct */}
      {cleanTel && (
        <a
          href={`tel:${cleanTel}`}
          className={cn(
            "inline-flex items-center justify-center gap-1 font-semibold rounded-lg transition-all",
            "border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10 hover:text-white hover:border-white/20",
            isSmall ? "p-1.5 text-[11px]" : "px-2.5 py-1.5 text-xs"
          )}
          title={`Appeler ${name} (${phone})`}
          aria-label={`Appeler ${name}`}
        >
          <Phone size={isSmall ? 12 : 13} className="text-emerald-400" />
          {showLabels && <span>Appeler</span>}
        </a>
      )}

      {/* Messagerie interne Sentinelle */}
      {userId && (
        <Link
          to={`/app/messages?to=${userId}`}
          className={cn(
            "inline-flex items-center justify-center gap-1 font-semibold rounded-lg transition-all",
            "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/50",
            isSmall ? "p-1.5 text-[11px]" : "px-2.5 py-1.5 text-xs"
          )}
          title={`Envoyer un message interne à ${name}`}
          aria-label={`Message interne à ${name}`}
        >
          <MessagesSquare size={isSmall ? 12 : 13} className="text-cyan-400" />
          {showLabels && <span>Message</span>}
        </Link>
      )}

      {/* Email */}
      {email && (
        <a
          href={`mailto:${email}`}
          className={cn(
            "inline-flex items-center justify-center gap-1 font-semibold rounded-lg transition-all",
            "border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white",
            isSmall ? "p-1.5 text-[11px]" : "px-2.5 py-1.5 text-xs"
          )}
          title={`Envoyer un email à ${name} (${email})`}
          aria-label={`Email à ${name}`}
        >
          <Mail size={isSmall ? 12 : 13} className="text-sky-400" />
          {showLabels && <span>Email</span>}
        </a>
      )}
    </div>
  );
}
