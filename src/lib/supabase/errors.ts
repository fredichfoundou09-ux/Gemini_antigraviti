/**
 * Couche centralisée de gestion et formatage des erreurs Supabase & PostgreSQL
 * Traduit les codes d'erreur SQL et codes réseau en messages clairs et bienveillants pour l'utilisateur.
 */

export function formatSupabaseError(error: any): string {
  if (!error) return "Une erreur inconnue est survenue.";

  // Si c'est déjà une chaîne
  if (typeof error === "string") return error;

  const code = error.code || error?.error?.code;
  const message = error.message || error?.error?.message || "";
  const details = error.details || error?.error?.details || "";

  // Journalisation technique dans la console développeur
  console.error("Supabase Error Caught:", { code, message, details, error });

  // Codes PostgreSQL standards
  switch (code) {
    case "23505":
      if (message.includes("reference") || details.includes("reference")) {
        return "Cette référence de paiement existe déjà dans le système comptable.";
      }
      if (message.includes("username") || details.includes("username")) {
        return "Cet identifiant (nom d'utilisateur) est déjà utilisé.";
      }
      if (message.includes("email") || details.includes("email")) {
        return "Cette adresse email est déjà associée à un compte.";
      }
      return "Un enregistrement avec ces informations existe déjà (doublon détecté).";

    case "42501":
      return "Permissions insuffisantes : vous n'avez pas le droit d'effectuer cette opération selon votre rôle.";

    case "23503":
      return "Impossible de modifier ou supprimer cet élément car il est lié à d'autres enregistrements actifs.";

    case "23502":
      return "Certains champs obligatoires sont manquants dans la requête.";

    case "22P02":
      return "Format de données non valide (ex: nombre ou identifiant attendu).";

    case "PGRST116":
      return "Aucun élément correspondant trouvé.";

    case "PGRST301":
      return "Votre session a expiré. Veuillez vous reconnecter.";

    default:
      break;
  }

  // Erreurs réseau / fetch
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network error")) {
    return "Impossible de contacter la base de données. Vérifiez votre connexion Internet.";
  }

  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("token")) {
    return "Session expirée ou invalide. Veuillez vous reconnecter.";
  }

  // Message par défaut lisible
  return message || details || "Une erreur inattendue est survenue lors de l'enregistrement.";
}
