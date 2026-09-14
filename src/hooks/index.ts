/**
 * Point d'entrée centralisé de la couche de hooks de l'application Sentinelles.
 * Exporte l'ensemble des hooks spécialisés et génériques pour Supabase et l'état applicatif.
 */

export { useAudit } from "./useAudit";
export { useEnia } from "./useEnia";
export { useFormations } from "./useFormations";
export { useNotifications } from "./useNotifications";
export { useStudents } from "./useStudents";
export { useSupabaseQuery } from "./useSupabaseQuery";
export { usePresence, isUserActiveOnline } from "./usePresence";
export { useBackgroundSync } from "./useBackgroundSync";
