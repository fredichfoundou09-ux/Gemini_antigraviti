import { DB, TeacherHour, TeacherPayment } from "./types";

export interface TeacherFinanceSummary {
  heuresPrevues: number;
  heuresEffectuees: number;   // validées + en attente de validation
  heuresValidees: number;
  montantDu: number;          // somme des heures validées
  montantPaye: number;        // somme des paiements
  solde: number;              // montantDu - montantPaye
  hours: TeacherHour[];
  payments: TeacherPayment[];
  // Regroupement mensuel
  months: { key: string; label: string; effectuees: number; validees: number; montant: number }[];
}

export function teacherFinanceSummary(db: DB, teacherId: string): TeacherFinanceSummary {
  const hours = db.teacherHours.filter((h) => h.teacherId === teacherId).sort((a, b) => a.date.localeCompare(b.date));
  const payments = db.teacherPayments.filter((p) => p.teacherId === teacherId).sort((a, b) => a.date.localeCompare(b.date));
  const heuresValidees = hours.filter((h) => h.valide).reduce((a, h) => a + h.heures, 0);
  const heuresEffectuees = hours.reduce((a, h) => a + h.heures, 0);
  const montantDu = hours.filter((h) => h.valide).reduce((a, h) => a + h.montant, 0);
  const montantPaye = payments.reduce((a, p) => a + p.montant, 0);
  const teacher = db.teachers.find((t) => t.id === teacherId);
  const heuresPrevues = teacher?.heuresPrevues ?? 0;

  const monthsMap = new Map<string, { effectuees: number; validees: number; montant: number }>();
  hours.forEach((h) => {
    const key = h.date.slice(0, 7); // YYYY-MM
    const cur = monthsMap.get(key) ?? { effectuees: 0, validees: 0, montant: 0 };
    cur.effectuees += h.heures;
    if (h.valide) { cur.validees += h.heures; cur.montant += h.montant; }
    monthsMap.set(key, cur);
  });
  const months = Array.from(monthsMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, v]) => ({ key, label: monthLabel(key), ...v }));

  return {
    heuresPrevues, heuresEffectuees, heuresValidees, montantDu, montantPaye,
    solde: Math.max(0, montantDu - montantPaye),
    hours, payments, months,
  };
}

export function monthLabel(key: string): string {
  // key = YYYY-MM
  const [y, m] = key.split("-");
  const names = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${names[Math.min(11, Math.max(0, parseInt(m, 10) - 1))]} ${y}`;
}

/** Tarif horaire à appliquer pour un enseignant sur un module (avec override par module). */
export function tarifFor(db: DB, teacherId: string, moduleId?: string): number {
  const t = db.teachers.find((x) => x.id === teacherId);
  if (!t) return 0;
  if (moduleId && t.tarifsParModule && typeof t.tarifsParModule[moduleId] === "number") {
    return t.tarifsParModule[moduleId];
  }
  return t.tarifHoraire ?? 0;
}

/** Calcule la durée (en heures) entre deux heures "HH:MM". */
export function hoursBetween(debut: string, fin: string): number {
  const [h1, m1] = debut.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  if (isNaN(h1) || isNaN(h2)) return 0;
  const mins = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
  return Math.max(0, Math.round((mins / 60) * 10) / 10);
}

/** Prochaine référence de versement enseignant (VRS-XXXX). */
export function nextTeacherPayRef(db: DB): string {
  const max = db.teacherPayments.reduce((acc, p) => {
    const m = (p.reference || "").match(/VRS-(\d+)/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `VRS-${String(max + 1).padStart(4, "0")}`;
}
