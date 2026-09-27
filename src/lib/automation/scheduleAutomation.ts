/**
 * Moteur d'automatisation pédagogique et d'assiduité lié à l'emploi du temps (Phase 2).
 * 
 * Rôles et responsabilités :
 * 1. Pointage automatique des présences (2.2) :
 *    - Détecte les séances planifiées en cours ou terminées pour la date du jour.
 *    - Marque automatiquement présents tous les apprenants inscrits au module / groupe concerné.
 *    - Émet une notification système à l'enseignant et à l'administration.
 *    - Enregistre une trace d'audit détaillée et horodatée.
 * 
 * 2. Reconnaissance et validation des heures d'enseignement (2.1) :
 *    - Détecte les séances achevées pour chaque enseignant.
 *    - Enregistre la séance terminée et génère une notification de validation le soir / fin de cours.
 *    - Permet l'attribution automatique des honoraires officiels (2 500 FCFA / séance)
 *      au compte du formateur dès validation, sans ressaisie manuelle.
 * 
 * Idempotence garantie : aucun doublon même si le traitement tourne toutes les minutes.
 */

import type { DB, ScheduleItem, AttendanceRecord, TeacherHour } from "@/lib/types";
import { today, uid, money } from "@/lib/ui";
import { hoursBetween, tarifFor } from "@/lib/teacher";
import { TEACHER_SESSION_RATE } from "@/lib/finance";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { createNotification } from "@/lib/supabase/communication";

export interface AutomationResult {
  attendanceMarked: number;
  sessionsDetected: number;
  teacherHoursStaged: number;
  logs: string[];
}

/**
 * Détermine si un créneau horaire est terminé aujourd'hui.
 * Format attendu : "HH:mm" ou "HHhMM"
 */
export function isSlotEnded(heureFin: string, now = new Date()): boolean {
  const cleanFin = heureFin.replace("h", ":").trim();
  const [finH, finM] = cleanFin.split(":").map(Number);
  if (isNaN(finH)) return false;

  const currentH = now.getHours();
  const currentM = now.getMinutes();

  if (currentH > finH) return true;
  if (currentH === finH && currentM >= (finM || 0)) return true;
  return false;
}

/**
 * Détermine si un créneau horaire a commencé aujourd'hui.
 */
export function isSlotStarted(heureDebut: string, now = new Date()): boolean {
  const cleanDebut = heureDebut.replace("h", ":").trim();
  const [debH, debM] = cleanDebut.split(":").map(Number);
  if (isNaN(debH)) return false;

  const currentH = now.getHours();
  const currentM = now.getMinutes();

  if (currentH > debH) return true;
  if (currentH === debH && currentM >= (debM || 0)) return true;
  return false;
}

/**
 * Détermine si la date d'une séance correspond à aujourd'hui ou si c'est le jour hebdomadaire correspondant.
 */
export function isSlotToday(slot: ScheduleItem, currentDateStr = today(), now = new Date()): boolean {
  if (slot.date && slot.date === currentDateStr) {
    return true;
  }
  // Si défini par jour de la semaine (lundi, mardi...)
  if (slot.jour) {
    const daysFr = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    const currentDayName = daysFr[now.getDay()];
    if (slot.jour.toLowerCase().includes(currentDayName)) {
      return true;
    }
  }
  return false;
}

/**
 * Retourne la liste des apprenants concernés par un créneau d'emploi du temps.
 */
export function getEnrolledStudentsForSlot(db: DB, slot: ScheduleItem): string[] {
  if (slot.studentIds && slot.studentIds.length > 0) {
    return slot.studentIds;
  }

  // Filtrage par module et formation
  return db.students
    .filter((s) => {
      if (s.statut !== "actif") return false;
      if (slot.formation && s.formation !== slot.formation) return false;
      if (slot.groupe && s.groupe && slot.groupe !== s.groupe) return false;
      if (slot.moduleId && Array.isArray(s.modules) && !s.modules.includes(slot.moduleId)) return false;
      return true;
    })
    .map((s) => s.id);
}

/**
 * Exécute l'automatisation complète des présences et des heures d'enseignement.
 * Conçu pour tourner en continu sans effet de bord en cas de ré-exécution.
 */
export function runScheduleAutomation(
  db: DB,
  update: (updater: (prev: DB) => DB) => void,
  logger?: (msg: string) => void,
  overrideNow?: Date
): AutomationResult {
  const now = overrideNow || new Date();
  const currentDateStr = today();
  const newAttendanceRecords: AttendanceRecord[] = [];
  const newTeacherHours: TeacherHour[] = [];
  const generatedLogs: string[] = [];

  const slotsToday = (db.schedule || []).filter((s) => isSlotToday(s, currentDateStr, now));

  for (const slot of slotsToday) {
    const hasStarted = isSlotStarted(slot.heureDebut, now);
    const hasEnded = isSlotEnded(slot.heureFin, now);

    // =========================================================================
    // 1. AUTOMATISATION DES PRÉSENCES (2.2)
    // Dès le début de la séance, tous les apprenants inscrits sont pointés présents.
    // =========================================================================
    if (hasStarted) {
      const studentIds = getEnrolledStudentsForSlot(db, slot);
      const mod = db.modules.find((m) => m.id === slot.moduleId);
      const modName = mod ? `${mod.numero}. ${mod.titre}` : slot.moduleId;

      let markedCountForSlot = 0;

      for (const sId of studentIds) {
        // Vérifier si un émargement existe déjà pour cet apprenant sur cette date et ce module
        const alreadyMarked = db.attendance.some(
          (a) => a.studentId === sId && a.date === currentDateStr && a.moduleId === slot.moduleId
        ) || newAttendanceRecords.some(
          (a) => a.studentId === sId && a.date === currentDateStr && a.moduleId === slot.moduleId
        );

        if (!alreadyMarked) {
          const rec: AttendanceRecord = {
            id: uid("ATT"),
            studentId: sId,
            date: currentDateStr,
            moduleId: slot.moduleId,
            statut: "present",
            heure: slot.heureDebut,
            salle: slot.salle || "Salle principale",
            teacherId: slot.teacherId || "admin",
          };
          newAttendanceRecords.push(rec);
          markedCountForSlot++;
        }
      }

      if (markedCountForSlot > 0) {
        const logMsg = `[Auto-Présence] ${markedCountForSlot} apprenant(s) pointé(s) présent(s) pour ${modName} (${slot.heureDebut}-${slot.heureFin}, ${slot.salle || "Salle"}).`;
        generatedLogs.push(logMsg);
        if (logger) logger(logMsg);

        // Notification envoyée au formateur
        if (slot.teacherId) {
          const teacherObj = db.teachers.find((t) => t.id === slot.teacherId || t.userId === slot.teacherId);
          const notifUserId = teacherObj?.userId || slot.teacherId;
          const notifTitle = `Présences validées automatiquement : ${modName}`;
          const notifBody = `${markedCountForSlot} apprenant(s) inscrits ont été enregistrés présents pour votre séance de ce jour.`;

          if (isSupabaseConfigured) {
            createNotification({
              user_id: notifUserId,
              title: notifTitle,
              body: notifBody,
              type: "presence",
            }).catch(() => {});
          }
        }
      }
    }

    // =========================================================================
    // 2. AUTOMATISATION DES HEURES ENSEIGNANT & RÉMUNÉRATION (2.1)
    // Dès la fin de la séance planifiée, le système reconnaît que le cours a été donné.
    // Une fiche d'heure est préparée/validée et le frais de cours est crédité.
    // =========================================================================
    if (hasEnded && slot.teacherId) {
      const teacher = db.teachers.find((t) => t.id === slot.teacherId || t.userId === slot.teacherId);
      const teacherId = teacher?.id || slot.teacherId;

      // Vérifier si cette séance a déjà été enregistrée pour cette date
      const alreadyRecorded = db.teacherHours.some(
        (h) => (h.scheduleId === slot.id && h.date === currentDateStr) ||
               (h.teacherId === teacherId && h.moduleId === slot.moduleId && h.date === currentDateStr)
      ) || newTeacherHours.some(
        (h) => (h.scheduleId === slot.id && h.date === currentDateStr) ||
               (h.teacherId === teacherId && h.moduleId === slot.moduleId && h.date === currentDateStr)
      );

      if (!alreadyRecorded) {
        const heures = hoursBetween(slot.heureDebut, slot.heureFin) || 2;
        const tarif = tarifFor(db, teacherId, slot.moduleId) || TEACHER_SESSION_RATE;
        const montant = tarif;

        const th: TeacherHour = {
          id: uid("TH"),
          scheduleId: slot.id,
          teacherId,
          moduleId: slot.moduleId,
          date: currentDateStr,
          heureDebut: slot.heureDebut,
          heureFin: slot.heureFin,
          heures,
          tarifApplique: tarif,
          montant,
          valide: true, // Automatiquement validée une fois la séance achevée
          validePar: "Système Automatique (Emploi du temps)",
          dateValidation: currentDateStr,
        };

        newTeacherHours.push(th);

        const modObj = db.modules.find((m) => m.id === slot.moduleId);
        const modTitle = modObj ? modObj.titre : "Cours";
        const thLogMsg = `[Auto-Rémunération] Séance achevée pour ${teacher?.prenom || "Formateur"} ${teacher?.nom || ""} : ${heures}h validées sur ${modTitle} (+${money(montant)} crédités).`;
        generatedLogs.push(thLogMsg);
        if (logger) logger(thLogMsg);

        // Notification envoyée au formateur le soir / à la fin de la séance
        const notifUserId = teacher?.userId || teacherId;
        const notifTitle = `Séance validée & honoraires attribués (${money(montant)})`;
        const notifBody = `Votre cours de ${modTitle} (${slot.heureDebut}-${slot.heureFin}) est terminé. Votre vacation de ${money(montant)} a été créditée automatiquement sur votre compte.`;

        if (isSupabaseConfigured) {
          createNotification({
            user_id: notifUserId,
            title: notifTitle,
            body: notifBody,
            type: "paiement",
          }).catch(() => {});
        }
      }
    }
  }

  // Application atomique des mises à jour dans le store si des modifications ont eu lieu
  if (newAttendanceRecords.length > 0 || newTeacherHours.length > 0) {
    const newLogEntries = [
      ...(newAttendanceRecords.length > 0 ? [{
        id: uid("LOG"),
        date: currentDateStr,
        user: "Système Automatique",
        action: `Pointage automatique : ${newAttendanceRecords.length} présence(s) enregistrée(s).`,
      }] : []),
      ...generatedLogs.map((msg) => ({
        id: uid("LOG"),
        date: currentDateStr,
        user: "Système Automatique",
        action: msg,
      })),
    ];

    update((prev) => ({
      ...prev,
      attendance: [...newAttendanceRecords, ...(prev.attendance || [])],
      teacherHours: [...newTeacherHours, ...(prev.teacherHours || [])],
      log: [...newLogEntries, ...(prev.log || [])],
      notifications: [
        ...newTeacherHours.map((h) => ({
          id: uid("NOTIF"),
          toId: h.teacherId,
          title: "Séance validée et rémunération créditée",
          body: `Votre séance a été validée automatiquement (+${h.montant} FCFA).`,
          date: currentDateStr,
          lu: false,
          type: "paiement",
        })),
        ...(prev.notifications || []),
      ],
    }));

    // Synchronisation Supabase si connecté
    if (isSupabaseConfigured) {
      if (newAttendanceRecords.length > 0) {
        (supabase
          .from("attendance")
          .upsert(
            newAttendanceRecords.map((a) => ({
              student_id: a.studentId,
              date: a.date,
              module_id: a.moduleId,
              statut: a.statut,
              heure: a.heure,
              salle: a.salle,
              teacher_id: a.teacherId,
            }))
          ) as any)
          .then(() => {})
          .catch((e: any) => console.warn("Sync auto-presence Supabase error:", e));
      }

      if (newTeacherHours.length > 0) {
        (supabase
          .from("teacher_hours")
          .insert(
            newTeacherHours.map((h) => ({
              schedule_id: h.scheduleId,
              teacher_id: h.teacherId,
              module_id: h.moduleId,
              date: h.date,
              heure_debut: h.heureDebut,
              heure_fin: h.heureFin,
              heures: h.heures,
              tarif_applique: h.tarifApplique,
              montant: h.montant,
              valide: h.valide,
              valide_par: h.validePar,
              date_validation: h.dateValidation,
            }))
          ) as any)
          .then(() => {})
          .catch((e: any) => console.warn("Sync auto-teacher_hours Supabase error:", e));
      }
    }
  }

  return {
    attendanceMarked: newAttendanceRecords.length,
    sessionsDetected: slotsToday.length,
    teacherHoursStaged: newTeacherHours.length,
    logs: generatedLogs,
  };
}

export function isSessionFinished(slot: ScheduleItem, now = new Date()): boolean {
  return isSlotToday(slot, today(), now) && isSlotEnded(slot.heureFin, now);
}

export function isSessionActive(slot: ScheduleItem, now = new Date()): boolean {
  return isSlotToday(slot, today(), now) && isSlotStarted(slot.heureDebut, now) && !isSlotEnded(slot.heureFin, now);
}

export function executeScheduleAutomation(
  db: DB,
  update: (updater: (prev: DB) => DB) => void,
  overrideNow?: Date
) {
  const res = runScheduleAutomation(db, update, undefined, overrideNow);
  return {
    markedAttendances: res.attendanceMarked,
    validatedSessions: res.teacherHoursStaged,
    creditedTeacherHours: res.teacherHoursStaged * 2,
    logs: res.logs,
  };
}
