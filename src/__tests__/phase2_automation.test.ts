import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScheduleAutomation, isSessionFinished, isSessionActive } from "@/lib/automation/scheduleAutomation";
import { teacherFinanceSummary } from "@/lib/teacher";
import type { DB, ScheduleItem, Student, Teacher, Module, AttendanceRecord, TeacherHour, LogEntry } from "@/lib/types";

// In-memory mock localStorage
const localStore: Record<string, string> = {};
beforeEach(() => {
  for (const k in localStore) delete localStore[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => { localStore[k] = String(v); },
    removeItem: (k: string) => { delete localStore[k]; },
    clear: () => { for (const k in localStore) delete localStore[k]; },
  });
});

describe("Phase 2 — Automatisations métier sensibles", () => {
  const dummyModule: Module = {
    id: "MOD_TEST",
    numero: 1,
    titre: "Sécurité Réseau",
    icon: "shield",
    formation: "informatique",
    notions: ["Pare-feu"],
    duree: "20h",
    chapitres: [],
  };

  const dummyTeacher: Teacher = {
    id: "TCH_1",
    nom: "Kouassi",
    prenom: "Alain",
    email: "alain.kouassi@test.ci",
    phone: "0102030405",
    specialite: "Réseaux",
    tarifHoraire: 2500,
    modules: ["MOD_TEST"],
    formations: ["informatique"],
  };

  const dummyStudent1: Student = {
    id: "STU_1",
    nom: "Yao",
    prenom: "Boris",
    dateNaissance: "2000-01-01",
    sexe: "M",
    email: "boris@test.ci",
    telephone: "0708091011",
    whatsapp: "0708091011",
    adresse: "Abidjan",
    niveau: "Licence",
    formation: "informatique",
    statut: "actif",
    statutPaiement: "paye",
    dateInscription: "2026-01-01",
    modules: ["MOD_TEST"],
  };

  const dummyStudent2: Student = {
    id: "STU_2",
    nom: "Koffi",
    prenom: "Christelle",
    dateNaissance: "2001-02-02",
    sexe: "F",
    email: "christelle@test.ci",
    telephone: "0708091012",
    whatsapp: "0708091012",
    adresse: "Yopougon",
    niveau: "Master",
    formation: "informatique",
    statut: "actif",
    statutPaiement: "paye",
    dateInscription: "2026-01-01",
    modules: ["MOD_TEST"],
  };

  const createInitialDb = (sched: ScheduleItem[]): DB => ({
    users: [],
    students: [dummyStudent1, dummyStudent2],
    teachers: [dummyTeacher],
    modules: [dummyModule],
    courses: [],
    schedule: sched,
    attendance: [],
    payments: [],
    paymentSchedules: [],
    teacherHours: [],
    teacherPayments: [],
    submissions: [],
    fileActivities: [],
    tests: [],
    results: [],
    grades: [],
    messages: [],
    notifications: [],
    certificates: [],
    scholarships: [],
    advantages: [],
    partners: [],
    announcements: [],
    invoices: [],
    registrations: [],
    enia: {} as any,
    settings: {} as any,
    version: 1,
    log: [],
  });

  it("2.1 & 2.2 — Marque automatiquement la présence et crédite les heures d'enseignant une fois la séance terminée", () => {
    const simulatedNow = new Date();
    simulatedNow.setHours(10, 30, 0, 0);
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const todayDay = dayNames[simulatedNow.getDay()];

    const pastSession: ScheduleItem = {
      id: "SCHED_PAST_1",
      moduleId: "MOD_TEST",
      teacherId: "TCH_1",
      jour: todayDay,
      heureDebut: "08:00",
      heureFin: "10:00",
      salle: "Labo 1",
      formation: "informatique",
    };

    let db = createInitialDb([pastSession]);
    const update = (fn: (d: DB) => DB) => {
      db = fn(db);
    };

    // Vérifier les fonctions utilitaires temporelles
    expect(isSessionFinished(pastSession, simulatedNow)).toBe(true);

    // Exécution de l'automatisation
    const result = runScheduleAutomation(db, update, undefined, simulatedNow);

    expect(result.attendanceMarked).toBe(2); // Les 2 étudiants inscrits ont été pointés présents
    expect(result.teacherHoursStaged).toBe(1); // La séance est validée

    // Vérifier les présences dans la base
    expect(db.attendance.length).toBe(2);
    expect(db.attendance.every((a: AttendanceRecord) => a.statut === "present")).toBe(true);

    // Vérifier les heures enseignants créées et validées
    expect(db.teacherHours.length).toBe(1);
    expect(db.teacherHours[0].valide).toBe(true);
    expect(db.teacherHours[0].heures).toBe(2);
    expect(db.teacherHours[0].montant).toBe(2500); // Forfait séance 2 500 FCFA

    // Vérifier le solde calculé de l'enseignant via le module financier officiel
    const summary = teacherFinanceSummary(db, "TCH_1");
    expect(summary.solde).toBe(2500);
    expect(summary.heuresValidees).toBe(2);

    // Vérifier la génération des notifications et logs
    expect(db.notifications.length).toBeGreaterThan(0);
    expect(db.log.some((l: LogEntry) => l.action.includes("Pointage automatique"))).toBe(true);
    expect(db.log.some((l: LogEntry) => l.action.includes("Auto-Rémunération"))).toBe(true);
  });

  it("2.1 & 2.2 — Idempotence : Ne double pas les présences ni les rémunérations lors d'un second passage", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const todayDay = dayNames[new Date().getDay()];

    const pastSession: ScheduleItem = {
      id: "SCHED_PAST_2",
      moduleId: "MOD_TEST",
      teacherId: "TCH_1",
      jour: todayDay,
      heureDebut: "08:00",
      heureFin: "10:00",
      salle: "Labo 1",
      formation: "informatique",
    };

    let db = createInitialDb([pastSession]);
    const update = (fn: (d: DB) => DB) => {
      db = fn(db);
    };
    const simulatedNow = new Date(`${todayStr}T10:30:00`);

    // 1er passage
    runScheduleAutomation(db, update, undefined, simulatedNow);
    const initialSolde = teacherFinanceSummary(db, "TCH_1").solde;
    const initialAttendanceCount = db.attendance.length;
    const initialHoursCount = db.teacherHours.length;

    // 2ème passage immédiat (re-run du cron ou rechargement page)
    const secondResult = runScheduleAutomation(db, update, undefined, simulatedNow);

    expect(secondResult.attendanceMarked).toBe(0);
    expect(secondResult.teacherHoursStaged).toBe(0);
    expect(db.attendance.length).toBe(initialAttendanceCount);
    expect(db.teacherHours.length).toBe(initialHoursCount);
    expect(teacherFinanceSummary(db, "TCH_1").solde).toBe(initialSolde);
  });

  it("2.1 — Ne valide pas prématurément les heures si la séance n'est pas encore terminée", () => {
    const simulatedMorning = new Date();
    simulatedMorning.setHours(11, 0, 0, 0);
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const todayDay = dayNames[simulatedMorning.getDay()];

    const futureSession: ScheduleItem = {
      id: "SCHED_FUTURE",
      moduleId: "MOD_TEST",
      teacherId: "TCH_1",
      jour: todayDay,
      heureDebut: "14:00",
      heureFin: "16:00",
      salle: "Labo 1",
      formation: "informatique",
    };

    let db = createInitialDb([futureSession]);
    const update = (fn: (d: DB) => DB) => {
      db = fn(db);
    };

    // Il est 11h du matin : la séance n'a pas commencé
    expect(isSessionFinished(futureSession, simulatedMorning)).toBe(false);
    expect(isSessionActive(futureSession, simulatedMorning)).toBe(false);

    const res = runScheduleAutomation(db, update, undefined, simulatedMorning);
    expect(res.teacherHoursStaged).toBe(0);
    expect(res.attendanceMarked).toBe(0);
    expect(db.teacherHours.length).toBe(0);
    expect(db.attendance.length).toBe(0);
    expect(teacherFinanceSummary(db, "TCH_1").solde).toBe(0);
  });
});
