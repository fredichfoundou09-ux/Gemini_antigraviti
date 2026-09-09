import { Course, DB, ScheduleItem, Teacher, User } from "./types";

/**
 * Résout la liste consolidée des IDs de modules d'un enseignant :
 * 1. Modules explicitement assignés (teacher.modules / table teacher_modules)
 * 2. Modules des cours où l'enseignant est explicitement désigné comme formateur (course.teacherId)
 * 3. Modules des créneaux de planning où l'enseignant intervient (schedule.teacherId)
 * 4. (Optionnel / hors production par défaut) Heuristique basée sur la spécialité.
 */
export function getTeacherModuleIds(
  teacher: Teacher | undefined | null,
  db: DB,
  options?: { heuristic?: boolean }
): string[] {
  if (!teacher) return [];
  const set = new Set<string>();

  // 1. Modules explicitement déclarés / assignés
  if (Array.isArray(teacher.modules)) {
    for (const m of teacher.modules) {
      if (m && typeof m === "string" && m.trim()) {
        set.add(m.trim());
      }
    }
  }

  // 2. Modules via cours assignés
  if (Array.isArray(db.courses)) {
    for (const c of db.courses) {
      if ((c.teacherId === teacher.id || (teacher.userId && c.teacherId === teacher.userId)) && c.moduleId) {
        set.add(c.moduleId);
      }
    }
  }

  // 3. Modules via créneaux de planning assignés
  if (Array.isArray(db.schedule)) {
    for (const s of db.schedule) {
      if ((s.teacherId === teacher.id || (teacher.userId && s.teacherId === teacher.userId)) && s.moduleId) {
        set.add(s.moduleId);
      }
    }
  }

  // 4. Heuristique optionnelle (désactivée par défaut)
  if (options?.heuristic && set.size === 0 && teacher.specialite && Array.isArray(db.modules)) {
    const specLower = teacher.specialite.toLowerCase().trim();
    if (specLower) {
      const match = db.modules.find(
        (m) =>
          m.id.toLowerCase() === specLower ||
          m.titre.toLowerCase().includes(specLower) ||
          specLower.includes(m.titre.toLowerCase())
      );
      if (match) {
        set.add(match.id);
      }
    }
  }

  return Array.from(set);
}

/** Un apprenant peut-il voir ce cours ? */
export function studentCanSeeCourse(db: DB, studentId: string, c: Course): boolean {
  if (c.publie === false) return false;
  const s = db.students.find((x) => x.id === studentId);
  if (!s) return false;
  if (!s.modules || !s.modules.includes(c.moduleId)) return false;

  if (c.audience === "apprenants" && c.studentIds && c.studentIds.length > 0) {
    return c.studentIds.includes(s.id);
  }
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
  if (c.teacherId === t.id || (t.userId && c.teacherId === t.userId)) return true;
  const teacherModules = getTeacherModuleIds(t, db);
  return teacherModules.includes(c.moduleId);
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
    const teacherModules = getTeacherModuleIds(t, db);
    return db.courses.filter((c) => c.teacherId === t.id || (t.userId && c.teacherId === t.userId) || teacherModules.includes(c.moduleId));
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
    const teacherModules = getTeacherModuleIds(t, db, { heuristic: true });
    return db.schedule.filter((s) => {
      const isMyTeacher = s.teacherId === t.id || (t.userId && s.teacherId === t.userId);
      if (isMyTeacher) return true;
      if (s.teacherId && s.teacherId !== t.id && s.teacherId !== t.userId) return false;
      return teacherModules.includes(s.moduleId);
    });
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
  return db.students.filter((x) => (!s.formation || x.formation === s.formation) && (x.modules || []).includes(s.moduleId));
}

/** Apprenants destinataires d'un cours (pour l'affichage côté enseignant). */
export function studentsOfCourse(db: DB, c: Course) {
  if (c.audience === "apprenants" && c.studentIds?.length) {
    return db.students.filter((x) => c.studentIds!.includes(x.id));
  }
  if (c.audience === "groupe" && c.groupe) {
    return db.students.filter((x) => (x as any).groupe === c.groupe || ((x.modules || []).includes(c.moduleId) && (!c.formation || x.formation === c.formation)));
  }
  return db.students.filter((x) => (x.modules || []).includes(c.moduleId));
}

/** Trouve le formateur assigné à un module spécifique (via planning, cours ou assignation directe) */
export function teacherOfModule(db: DB, moduleId: string): Teacher | undefined {
  if (!moduleId) return undefined;
  // 1. Chercher d'abord dans le planning officiel
  const slot = (db.schedule || []).find((s) => s.moduleId === moduleId && s.teacherId);
  if (slot) {
    const t = db.teachers.find((x) => x.id === slot.teacherId || x.userId === slot.teacherId);
    if (t) return t;
  }
  // 2. Chercher dans les cours publiés
  const course = (db.courses || []).find((c) => c.moduleId === moduleId && c.teacherId);
  if (course) {
    const t = db.teachers.find((x) => x.id === course.teacherId || x.userId === course.teacherId);
    if (t) return t;
  }
  // 3. Chercher dans les modules consolidés de l'enseignant
  return db.teachers.find((t) => getTeacherModuleIds(t, db, { heuristic: true }).includes(moduleId));
}

export interface TeacherWithStudentContext {
  teacher: Teacher;
  modules: DB["modules"];
  scheduleSlots: ScheduleItem[];
}

/**
 * Retourne la liste des formateurs enseignant aux modules de l'apprenant,
 * avec le détail des modules partagés et des créneaux de cours.
 */
export function teachersOfStudent(db: DB, studentId: string): TeacherWithStudentContext[] {
  const student = db.students.find((s) => s.id === studentId || s.userId === studentId);
  if (!student) return [];
  const sMods = new Set(student.modules || []);

  const result: TeacherWithStudentContext[] = [];

  for (const t of db.teachers) {
    const tModIds = getTeacherModuleIds(t, db);
    const commonModIds = tModIds.filter((mid) => sMods.has(mid));

    const slots = (db.schedule || []).filter(
      (sch) =>
        (sch.teacherId === t.id || sch.teacherId === t.userId) &&
        (commonModIds.includes(sch.moduleId) || sMods.has(sch.moduleId))
    );

    if (commonModIds.length > 0 || slots.length > 0) {
      const allModIds = Array.from(new Set([...commonModIds, ...slots.map((s) => s.moduleId)]));
      const commonModules = db.modules.filter((m) => allModIds.includes(m.id));
      result.push({
        teacher: t,
        modules: commonModules,
        scheduleSlots: slots,
      });
    }
  }

  return result;
}

export interface StudentWithTeacherContext {
  student: Student;
  modules: DB["modules"];
  scheduleSlots: ScheduleItem[];
}

/**
 * Retourne la liste des apprenants inscrits aux matières enseignées par un formateur.
 */
export function studentsOfTeacher(db: DB, teacherId: string): StudentWithTeacherContext[] {
  const teacher = db.teachers.find((t) => t.id === teacherId || t.userId === teacherId);
  if (!teacher) return [];
  const tModIds = new Set(getTeacherModuleIds(teacher, db));

  const result: StudentWithTeacherContext[] = [];

  for (const s of db.students) {
    const sModIds = s.modules || [];
    const commonModIds = sModIds.filter((mid) => tModIds.has(mid));

    const slots = (db.schedule || []).filter(
      (sch) =>
        (sch.teacherId === teacher.id || sch.teacherId === teacher.userId) &&
        (commonModIds.includes(sch.moduleId) || sModIds.includes(sch.moduleId))
    );

    if (commonModIds.length > 0 || slots.length > 0) {
      const allModIds = Array.from(new Set([...commonModIds, ...slots.map((sch) => sch.moduleId)]));
      const commonModules = db.modules.filter((m) => allModIds.includes(m.id));
      result.push({
        student: s,
        modules: commonModules,
        scheduleSlots: slots,
      });
    }
  }

  return result;
}

/**
 * Retourne tous les formateurs intervenant sur un module donné (déclaré, cours ou emploi du temps).
 */
export function teachersOfModule(db: DB, moduleId: string): Teacher[] {
  const set = new Set<Teacher>();
  for (const t of db.teachers) {
    const tModIds = getTeacherModuleIds(t, db);
    if (tModIds.includes(moduleId)) {
      set.add(t);
    }
  }
  return Array.from(set);
}

/**
 * Retourne la liste pure des apprenants (Student[]) suivant au moins un module d'un formateur.
 */
export function getStudentsOfTeacher(db: DB, teacherId: string): Student[] {
  return studentsOfTeacher(db, teacherId).map((item) => item.student);
}

/**
 * Retourne la liste pure des formateurs (Teacher[]) enseignant à cet apprenant.
 */
export function getTeachersOfStudent(db: DB, studentId: string): Teacher[] {
  return teachersOfStudent(db, studentId).map((item) => item.teacher);
}

