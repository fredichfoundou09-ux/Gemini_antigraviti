import { uid } from "@/lib/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export type AutomatedTriggerType =
  | "absence_unjustified"
  | "grade_excellence"
  | "grade_remedial"
  | "payment_due"
  | "new_enrollment"
  | "custom";

export interface AutomatedRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomatedTriggerType;
  target_role: "student" | "teacher" | "all";
  subject_template: string;
  body_template: string;
  requires_human_approval: boolean;
  is_active: boolean;
  created_at: string;
  last_run_at?: string;
}

export interface AutomatedMessageDraft {
  id: string;
  rule_id: string;
  rule_name: string;
  recipient_id: string;
  recipient_name: string;
  recipient_role: string;
  subject: string;
  body: string;
  generated_at: string;
  status: "pending_approval" | "approved" | "rejected" | "sent";
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  sent_at?: string;
}

const STORAGE_KEY_RULES = "sn_ai_automated_rules";
const STORAGE_KEY_DRAFTS = "sn_ai_automated_drafts";

export const DEFAULT_RULES: AutomatedRule[] = [
  {
    id: "rule-absence-alert",
    name: "Relance pour absence non justifiée",
    description: "Détecte les absences non régularisées et prépare un message de sensibilisation personnalisé.",
    trigger: "absence_unjustified",
    target_role: "student",
    subject_template: "Alerte Assiduité — Régularisation d'absence pour {{student_name}}",
    body_template: `Bonjour {{student_name}},\n\nNous constatons une absence non justifiée enregistrée récemment sur la matière {{course_name}}.\n\nNous vous rappelons que l'assiduité est obligatoire pour valider vos crédits de formation.\n\nMerci de vous rapprocher de la coordination pédagogique ou de déposer votre justificatif.\n\nCordialement,\nSentinelles Numériques`,
    requires_human_approval: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "rule-grade-excellence",
    name: "Félicitations pour performance académique remarquable",
    description: "Envoie un mot d'encouragement aux apprenants ayant obtenu une note égale ou supérieure à 16/20.",
    trigger: "grade_excellence",
    target_role: "student",
    subject_template: "Félicitations pour vos résultats remarquables en {{course_name}} !",
    body_template: `Bravo {{student_name}} !\n\nL'équipe pédagogique tient à vous féliciter pour votre excellente note ({{grade}}/20) obtenue lors de l'évaluation sur {{course_name}}.\n\nContinuez sur cette dynamique d'excellence technologique.\n\nBien cordialement,\nLa Direction Académique`,
    requires_human_approval: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "rule-payment-reminder",
    name: "Rappel d'échéance de scolarité",
    description: "Prévient les apprenants ayant un solde de formation restant à régler avant la date limite.",
    trigger: "payment_due",
    target_role: "student",
    subject_template: "Rappel — Échéance de frais de formation pour {{student_name}}",
    body_template: `Bonjour {{student_name}},\n\nSauf erreur de notre part, une échéance sur vos frais de formation arrive à son terme (Solde restant : {{balance}} FCFA).\n\nNous vous invitons à vous rapprocher du service financier pour régulariser votre situation.\n\nBien à vous,\nService Comptabilité & Trésorerie`,
    requires_human_approval: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "rule-welcome-student",
    name: "Bienvenue et intégration d'un nouvel apprenant",
    description: "Prépare le pack d'accueil et les identifiants pour tout apprenant nouvellement inscrit.",
    trigger: "new_enrollment",
    target_role: "student",
    subject_template: "Bienvenue chez Sentinelles Numériques, {{student_name}} !",
    body_template: `Bonjour et bienvenue {{student_name}},\n\nVotre inscription au sein du cursus {{formation_name}} est désormais confirmée.\n\nVous pouvez dès à présent consulter votre emploi du temps et vos supports de cours sur la plateforme.\n\nL'équipe reste à vos côtés tout au long de votre parcours.\n\nExcellente rentrée,\nSentinelles Numériques`,
    requires_human_approval: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

/**
 * Récupère les règles d'automatisation IA configurées.
 */
export function getAutomatedRules(): AutomatedRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Erreur lecture automated rules:", e);
  }
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(DEFAULT_RULES));
  return DEFAULT_RULES;
}

/**
 * Enregistre ou met à jour une règle d'automatisation.
 */
export function saveAutomatedRule(rule: Partial<AutomatedRule> & { name: string; trigger: AutomatedTriggerType }): AutomatedRule {
  const rules = getAutomatedRules();
  const existingIdx = rules.findIndex((r) => r.id === rule.id);

  const updatedRule: AutomatedRule = {
    id: rule.id || uid("rule"),
    name: rule.name,
    description: rule.description || "",
    trigger: rule.trigger,
    target_role: rule.target_role || "student",
    subject_template: rule.subject_template || "Notification Sentinelles Numériques",
    body_template: rule.body_template || "Message officiel de l'établissement.",
    requires_human_approval: rule.requires_human_approval ?? true,
    is_active: rule.is_active ?? true,
    created_at: rule.created_at || new Date().toISOString(),
    last_run_at: rule.last_run_at,
  };

  let newRules: AutomatedRule[];
  if (existingIdx >= 0) {
    newRules = [...rules];
    newRules[existingIdx] = updatedRule;
  } else {
    newRules = [updatedRule, ...rules];
  }

  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(newRules));
  return updatedRule;
}

/**
 * Active ou désactive une règle d'automatisation.
 */
export function toggleAutomatedRule(ruleId: string, isActive: boolean): AutomatedRule[] {
  const rules = getAutomatedRules().map((r) => (r.id === ruleId ? { ...r, is_active: isActive } : r));
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
  return rules;
}

/**
 * Récupère les brouillons de messages IA en attente d'approbation ou traités.
 */
export function getAutomatedDrafts(): AutomatedMessageDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Erreur lecture automated drafts:", e);
  }
  return [];
}

/**
 * Génère des brouillons basés sur une règle et des données contextuelles réelles.
 */
export function generateDraftsForRule(
  rule: AutomatedRule,
  recipients: Array<{
    id: string;
    name: string;
    role?: string;
    course_name?: string;
    grade?: number;
    balance?: number;
    formation_name?: string;
  }>
): AutomatedMessageDraft[] {
  const currentDrafts = getAutomatedDrafts();
  const created: AutomatedMessageDraft[] = [];

  for (const recipient of recipients) {
    let subject = rule.subject_template
      .replace(/{{student_name}}/g, recipient.name)
      .replace(/{{course_name}}/g, recipient.course_name || "le module")
      .replace(/{{grade}}/g, String(recipient.grade ?? ""))
      .replace(/{{balance}}/g, String(recipient.balance ?? ""))
      .replace(/{{formation_name}}/g, recipient.formation_name || "votre formation");

    let body = rule.body_template
      .replace(/{{student_name}}/g, recipient.name)
      .replace(/{{course_name}}/g, recipient.course_name || "le module")
      .replace(/{{grade}}/g, String(recipient.grade ?? ""))
      .replace(/{{balance}}/g, String(recipient.balance ?? ""))
      .replace(/{{formation_name}}/g, recipient.formation_name || "votre formation");

    const draft: AutomatedMessageDraft = {
      id: uid("draft"),
      rule_id: rule.id,
      rule_name: rule.name,
      recipient_id: recipient.id,
      recipient_name: recipient.name,
      recipient_role: recipient.role || "student",
      subject,
      body,
      generated_at: new Date().toISOString(),
      status: rule.requires_human_approval ? "pending_approval" : "approved",
    };

    created.push(draft);
  }

  const updatedDrafts = [...created, ...currentDrafts];
  localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(updatedDrafts));

  // Mettre à jour last_run_at de la règle
  const rules = getAutomatedRules().map((r) =>
    r.id === rule.id ? { ...r, last_run_at: new Date().toISOString() } : r
  );
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));

  return created;
}

/**
 * Approuve un brouillon de message généré par l'IA et l'envoie dans la messagerie.
 */
export function approveDraft(draftId: string, adminUserId: string): { ok: boolean; draft?: AutomatedMessageDraft } {
  const drafts = getAutomatedDrafts();
  const draftIdx = drafts.findIndex((d) => d.id === draftId);
  if (draftIdx === -1) return { ok: false };

  const draft = drafts[draftIdx];
  draft.status = "sent";
  draft.approved_by = adminUserId;
  draft.approved_at = new Date().toISOString();
  draft.sent_at = new Date().toISOString();

  // Envoi réel dans la persistance locale de messages
  try {
    const raw = localStorage.getItem("sn_db_v2");
    const db = raw ? JSON.parse(raw) : { messages: [] };
    if (!Array.isArray(db.messages)) db.messages = [];
    db.messages.push({
      id: uid("msg"),
      conversation_id: "conv-auto-" + draft.id,
      sender_id: adminUserId || "system-ai",
      sender_name: "Sentinel AI (Contrôlé par Direction)",
      sender_role: "admin",
      recipient_id: draft.recipient_id,
      recipient_name: draft.recipient_name,
      recipient_role: draft.recipient_role,
      subject: draft.subject,
      body: draft.body,
      created_at: new Date().toISOString(),
      read: false,
      is_automated_ai: true,
    });
    localStorage.setItem("sn_db_v2", JSON.stringify(db));
  } catch (e) {
    console.warn("Erreur insertion message local:", e);
  }

  localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(drafts));
  return { ok: true, draft };
}

/**
 * Rejette un brouillon avec motif explicite.
 */
export function rejectDraft(draftId: string, reason: string): { ok: boolean; draft?: AutomatedMessageDraft } {
  const drafts = getAutomatedDrafts();
  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) return { ok: false };

  draft.status = "rejected";
  draft.rejection_reason = reason;

  localStorage.setItem(STORAGE_KEY_DRAFTS, JSON.stringify(drafts));
  return { ok: true, draft };
}

/**
 * Valide en lot une liste de brouillons.
 */
export function batchApproveDrafts(draftIds: string[], adminUserId: string): number {
  let count = 0;
  for (const id of draftIds) {
    const res = approveDraft(id, adminUserId);
    if (res.ok) count++;
  }
  return count;
}
