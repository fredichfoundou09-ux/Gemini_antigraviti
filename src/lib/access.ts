import { Course, DB, ScheduleItem, User } from "./types";

/** Un apprenant peut-il voir ce cours ? */
export function studentCanSeeCourse(db: DB, studentId: string, c: Course): boolean {
  if (c.publie === false) return false;
  const s = db.students.find((x) => x.id === studentId);
  if (!s) return false;
  // RÈGLE STRICTE : L'apprenant ne peut voir QUE les cours des modules auxquels il est inscrit
  if (!s.modules || !s.modules.includes(c.moduleId)) return false;

  // Ciblage explicite d'apprenants
  if (c.audience === "apprenants" && c.studentIds && c.studentIds.length > 0) {
    return c.studentIds.includes(s.id);
  }
  // Ciblage par groupe
  if (c.audience === "groupe" && c.groupe) {
    if ((s as any).groupe && (s as any).groupe !== c.groupe) return false;
  }
  return true;
}

/** Un enseignant peut-il gérer ce cours ? */
export function teacherCanManageCourse(db: DB, userId: string, c: Course): boolean {
  const t = db.teachers.find((x) =>
    x.userId === userId ||
    (x.email && x.email.toLowerCase().trim() === userId.toLowerCase().trim())
  );
  if (!t) return false;
  return c.teacherId === t.id || (t.modules || []).includes(c.moduleId);
}

/** Liste des cours accessibles à l'utilisateur courant. */
export function coursesFor(db: DB, user: User | null): Course[] {
  if (!user) return [];
  if (user.role === "superadmin" || user.role === "admin") return db.courses;
  if (user.role === "teacher") {
    const t = db.teachers.find((x) =>
      x.userId === user.id ||
      (user.linkedId && x.id === user.linkedId) ||
      (user.email && x.email && x.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    );
    if (!t) return [];
    return db.courses.filter((c) => c.teacherId === t.id || (t.modules || []).includes(c.moduleId));
  }
  // student
  const s = db.students.find((x) =>
    x.userId === user.id ||
    (user.linkedId && x.id === user.linkedId) ||
    (user.email && x.email && x.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  );
  if (!s) return [];
  return db.courses.filter((c) => studentCanSeeCourse(db, s.id, c));
}

/** Un apprenant est-il concerné par ce créneau ? */
export function studentConcernedBySchedule(db: DB, studentId: string, s: ScheduleItem): boolean {
  const stu = db.students.find((x) => x.id === studentId);
  if (!stu) return false;
  // RÈGLE STRICTE : L'apprenant ne voit QUE les créneaux des modules auxquels il est inscrit
  if (!stu.modules || !stu.modules.includes(s.moduleId)) return false;

  if (s.studentIds && s.studentIds.length > 0) return s.studentIds.includes(stu.id);
  if (s.groupe && (stu as any).groupe && (stu as any).groupe !== s.groupe) return false;
  return (!s.formation || stu.formation === s.formation);
}

/** Créneaux visibles pour l'utilisateur courant. */
export function scheduleFor(db: DB, user: User | null): ScheduleItem[] {
  if (!user) return [];
  if (user.role === "superadmin" || user.role === "admin") return db.schedule;
  if (user.role === "teacher") {
    const t = db.teachers.find((x) =>
      x.userId === user.id ||
      (user.linkedId && x.id === user.linkedId) ||
      (user.email && x.email && x.email.toLowerCase().trim() === user.email.toLowerCase().trim())
    );
    if (!t) return [];
    return db.schedule.filter((s) => s.teacherId === t.id || (t.modules || []).includes(s.moduleId));
  }
  const s = db.students.find((x) =>
    x.userId === user.id ||
    (user.linkedId && x.id === user.linkedId) ||
    (user.email && x.email && x.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  );
  if (!s) return [];
  return db.schedule.filter((x) => studentConcernedBySchedule(db, s.id, x));
}

/** Apprenants concernés par un créneau (pour l'affichage côté enseignant). */
export function studentsOfSchedule(db: DB, s: ScheduleItem) {
  if (s.studentIds && s.studentIds.length > 0) {
    return db.students.filter((x) => s.studentIds!.includes(x.id));
  }
  return db.students.filter((x) => x.formation === s.formation && x.modules.includes(s.moduleId));
}

/** Apprenants destinataires d'un cours (pour l'affichage côté enseignant). */
export function studentsOfCourse(db: DB, c: Course) {
  if (c.audience === "apprenants" && c.studentIds?.length) {
    return db.students.filter((x) => c.studentIds!.includes(x.id));
  }
  if (c.audience === "groupe" && c.groupe) {
    return db.students.filter((x) => (x as any).groupe === c.groupe || (x.modules.includes(c.moduleId) && (!c.formation || x.formation === c.formation)));
  }
  return db.students.filter((x) => x.modules.includes(c.moduleId));
}
