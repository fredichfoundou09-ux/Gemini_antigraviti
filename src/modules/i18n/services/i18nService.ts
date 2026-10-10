export type SupportedLocale = "fr" | "ln" | "en";

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: "fr", name: "Français", flag: "🇨🇬" },
  { code: "ln", name: "Lingála", flag: "🇨🇬" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

const LOCALE_STORAGE_KEY = "sn_active_locale";

// Dictionnaires intégrés avec repli automatique vers le Français
const translations: Record<SupportedLocale, Record<string, string>> = {
  fr: {
    dashboard: "Tableau de bord",
    students: "Apprenants",
    teachers: "Formateurs",
    courses: "Cours & Devoirs",
    evaluations: "Évaluations",
    grades: "Notes",
    attendance: "Présences",
    schedule: "Emploi du temps",
    finances: "Finances",
    messages: "Messagerie",
    settings: "Paramètres",
    online: "En ligne",
    offline: "Hors ligne",
    sync_now: "Synchroniser maintenant",
    data_saver: "Économie de données",
    presence_verified: "Présence validée",
    certificate_authentic: "Certificat authentique",
    // Navigation labels
    "Tableau de bord": "Tableau de bord",
    "Apprenants": "Apprenants",
    "Enseignants": "Enseignants",
    "Heures enseignants": "Heures formateurs",
    "Formations & Modules": "Formations & Modules",
    "Emploi du temps": "Emploi du temps",
    "Présences": "Présences",
    "Calendrier visuel": "Calendrier visuel",
    "Bulletins de notes": "Bulletins de notes",
    "Cours & Supports": "Cours & Supports",
    "Évaluations & Devoirs": "Évaluations & Devoirs",
    "Notes": "Notes",
    "Paiements": "Paiements",
    "Certificats": "Certificats",
    "Messagerie": "Messagerie",
    "Notifications": "Notifications",
    "Corbeille & Sauvegardes": "Corbeille & Sauvegardes",
    "Compétences & Livret": "Compétences & Livret",
    "Qualité & Enquêtes": "Qualité & Enquêtes",
    "Portail Tuteurs": "Portail Tuteurs",
    "Alumni & Stages": "Alumni & Stages",
    "Forum Modules": "Forum Modules",
    "Ressources & Savoirs": "Ressources & Savoirs",
    "Paramètres": "Paramètres",
    "Mon profil": "Mon profil",
    "Mes cours": "Mes cours",
    "Mes notes": "Mes notes",
    "Mes présences": "Mes présences",
    "Mes paiements": "Mes paiements",
    "Devoirs & Évaluations": "Devoirs & Évaluations",
  },
  ln: {
    dashboard: "Etanda ya misala",
    students: "Bana-kelasi",
    teachers: "Balakisi",
    courses: "Mateya na Misala",
    evaluations: "Mekano",
    grades: "Bapwɛn",
    attendance: "Bozali na kelasi",
    schedule: "Manaka ya mikolo",
    finances: "Mbongo na Lifuti",
    messages: "Bansango",
    settings: "Bibongiseli",
    online: "O kati ya nzela",
    offline: "O libanda ya nzela",
    sync_now: "Bongisa sikoyo",
    data_saver: "Bomba megabytes",
    presence_verified: "Ozali ya solo",
    certificate_authentic: "Mukanda ya solo",
    // Navigation labels
    "Tableau de bord": "Etanda ya misala",
    "Apprenants": "Bana-kelasi",
    "Enseignants": "Balakisi",
    "Heures enseignants": "Bangonga ya balakisi",
    "Formations & Modules": "Mateya & Bituka",
    "Emploi du temps": "Manaka ya mikolo",
    "Présences": "Bozali na kelasi",
    "Calendrier visuel": "Kalandrie ya kotala",
    "Bulletins de notes": "Bikapo ya bapwɛn",
    "Cours & Supports": "Mateya na mikanda",
    "Évaluations & Devoirs": "Mekano na Misala",
    "Notes": "Bapwɛn",
    "Paiements": "Lifuti ya mbongo",
    "Certificats": "Mikanda ya lokumu",
    "Messagerie": "Bansango",
    "Notifications": "Bakebisi",
    "Corbeille & Sauvegardes": "Ebombelo & Kobomba",
    "Compétences & Livret": "Makoki na Buku",
    "Qualité & Enquêtes": "Bopeto na Mituna",
    "Portail Tuteurs": "Kiti ya Babateli",
    "Alumni & Stages": "Bana-kelasi ya kala & Misala",
    "Forum Modules": "Masolo ya mateya",
    "Ressources & Savoirs": "Biyano na Boyebi",
    "Paramètres": "Bibongiseli",
    "Mon profil": "Profil na ngai",
    "Mes cours": "Mateya na ngai",
    "Mes notes": "Bapwɛn na ngai",
    "Mes présences": "Bozali na ngai",
    "Mes paiements": "Mbongo na ngai",
    "Devoirs & Évaluations": "Misala & Mekano",
  },
  en: {
    dashboard: "Dashboard",
    students: "Students",
    teachers: "Instructors",
    courses: "Courses & Assignments",
    evaluations: "Assessments",
    grades: "Grades",
    attendance: "Attendance",
    schedule: "Timetable",
    finances: "Finances & Billing",
    messages: "Messaging",
    settings: "Settings",
    online: "Online",
    offline: "Offline",
    sync_now: "Sync now",
    data_saver: "Data Saver",
    presence_verified: "Attendance verified",
    certificate_authentic: "Authentic certificate",
    // Navigation labels
    "Tableau de bord": "Dashboard",
    "Apprenants": "Students",
    "Enseignants": "Instructors",
    "Heures enseignants": "Instructor Hours",
    "Formations & Modules": "Programs & Modules",
    "Emploi du temps": "Timetable",
    "Présences": "Attendance",
    "Calendrier visuel": "Visual Calendar",
    "Bulletins de notes": "Report Cards",
    "Cours & Supports": "Courses & Materials",
    "Évaluations & Devoirs": "Assessments & Assignments",
    "Notes": "Grades",
    "Paiements": "Payments",
    "Certificats": "Certificates",
    "Messagerie": "Messaging",
    "Notifications": "Notifications",
    "Corbeille & Sauvegardes": "Trash & Backups",
    "Compétences & Livret": "Competencies & Logbook",
    "Qualité & Enquêtes": "Quality & Surveys",
    "Portail Tuteurs": "Guardians Portal",
    "Alumni & Stages": "Alumni & Careers",
    "Forum Modules": "Module Forum",
    "Ressources & Savoirs": "Resources & Knowledge",
    "Paramètres": "Settings",
    "Mon profil": "My Profile",
    "Mes cours": "My Courses",
    "Mes notes": "My Grades",
    "Mes présences": "My Attendance",
    "Mes paiements": "My Payments",
    "Devoirs & Évaluations": "Assignments & Assessments",
  },
};

export const i18nService = {
  /**
   * Retourne la langue active
   */
  getLocale(): SupportedLocale {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as SupportedLocale;
      if (stored && translations[stored]) return stored;
    } catch {
      // silence
    }
    return "fr";
  },

  /**
   * Définit et persiste la langue active
   */
  setLocale(locale: SupportedLocale): void {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      window.dispatchEvent(new CustomEvent("sentinelles:locale-changed", { detail: { locale } }));
    } catch {
      // silence
    }
  },

  /**
   * Traduit une clé avec repli sur le français ou le texte par défaut
   */
  t(key: string, defaultText?: string): string {
    const current = this.getLocale();
    if (translations[current]?.[key]) {
      return translations[current][key];
    }
    if (translations.fr[key]) {
      return translations.fr[key];
    }
    return defaultText || key;
  },
};
