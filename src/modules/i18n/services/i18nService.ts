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
