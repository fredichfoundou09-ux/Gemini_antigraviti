import { Role, DB, ModuleRestriction } from "../types";

export interface AiAccessPolicy {
  systemEnabled: boolean;
  disabledRoles: Role[];
  disabledUserIds: string[];
  allowedModuleKeys?: string[];
  prohibitDuringExam: boolean;
}

const STORAGE_KEY = "sn_ai_policy";

export const DEFAULT_AI_POLICY: AiAccessPolicy = {
  systemEnabled: true,
  disabledRoles: [],
  disabledUserIds: [],
  prohibitDuringExam: true,
};

let memoryPolicy: AiAccessPolicy = { ...DEFAULT_AI_POLICY };

/**
 * Récupère la politique d'accès IA actuelle (stockée ou défaut)
 */
export function getAiPolicy(): AiAccessPolicy {
  try {
    if (typeof localStorage === "undefined") return memoryPolicy;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryPolicy;
    return { ...DEFAULT_AI_POLICY, ...JSON.parse(raw) };
  } catch {
    return memoryPolicy;
  }
}

/**
 * Sauvegarde la politique d'accès IA
 */
export function saveAiPolicy(policy: Partial<AiAccessPolicy>): AiAccessPolicy {
  const current = getAiPolicy();
  const updated = { ...current, ...policy };
  memoryPolicy = updated;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore fallback
  }
  return updated;
}

/**
 * Vérifie si un utilisateur donné a le droit d'utiliser l'assistant IA dans son contexte actuel.
 * Ordre de priorité strict :
 * 1. Niveau Système (Désactivation globale ou module 'ia' bloqué)
 * 2. Mode Examen sécurisé (Interdit formellement pendant les épreuves)
 * 3. Niveau Rôle (Restrictions administratives par rôle)
 * 4. Niveau Utilisateur (Restriction ciblée par compte)
 * 5. Niveau Module contextuel
 */
export function canUserAccessAi(
  user: { id?: string; role?: Role } | null,
  context?: { inExam?: boolean; moduleKey?: string; db?: DB }
): { allowed: boolean; reason?: string } {
  const policy = getAiPolicy();

  // 1. Niveau Système : Désactivation générale
  if (!policy.systemEnabled) {
    return {
      allowed: false,
      reason: "L'assistant IA est temporairement désactivé au niveau du système par la direction.",
    };
  }

  // 1.b Système : Blocage global du module 'ia' dans les restrictions administratives
  if (context?.db?.moduleRestrictions) {
    const r = context.db.moduleRestrictions.find((item: ModuleRestriction) => item.moduleKey === "ia");
    if (r && r.bloque) {
      const roleRestricted = r.roles && user?.role && r.roles.includes(user.role);
      const userRestricted = r.userIds && user?.id && r.userIds.includes(user.id);
      const allRestricted = (!r.roles || r.roles.length === 0) && (!r.userIds || r.userIds.length === 0) && user?.role !== "admin" && user?.role !== "superadmin";
      if (roleRestricted || userRestricted || allRestricted) {
        return {
          allowed: false,
          reason: r.raison || "Le module Intelligence Artificielle est verrouillé pour votre profil par l'administrateur.",
        };
      }
    }
  }

  // 2. Niveau Examen : Interdiction stricte pendant les évaluations
  const isExamActive =
    context?.inExam ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem("sn_in_exam") === "true");
  if (policy.prohibitDuringExam && isExamActive) {
    return {
      allowed: false,
      reason: "L'assistant IA est strictement interdit pendant le déroulement d'un examen ou d'une évaluation sous surveillance.",
    };
  }

  // Si aucun utilisateur authentifié
  if (!user || !user.role) {
    return {
      allowed: false,
      reason: "Authentification requise pour interagir avec l'assistant IA.",
    };
  }

  // 3. Niveau Rôle : Vérification des rôles restreints
  if (policy.disabledRoles && policy.disabledRoles.includes(user.role)) {
    return {
      allowed: false,
      reason: `L'assistant IA est restreint pour le rôle « ${user.role} ».`,
    };
  }

  // 4. Niveau Utilisateur : Vérification du compte individuel
  if (user.id && policy.disabledUserIds && policy.disabledUserIds.includes(user.id)) {
    return {
      allowed: false,
      reason: "Votre accès personnel à l'assistant IA a été suspendu par un administrateur.",
    };
  }

  // 5. Niveau Module contextuel
  if (
    context?.moduleKey &&
    policy.allowedModuleKeys &&
    policy.allowedModuleKeys.length > 0 &&
    !policy.allowedModuleKeys.includes(context.moduleKey)
  ) {
    return {
      allowed: false,
      reason: `L'assistant IA n'est pas autorisé dans l'espace « ${context.moduleKey} ».`,
    };
  }

  return { allowed: true };
}
