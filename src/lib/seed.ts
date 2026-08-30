import { DB, EniaContent } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

// ============================================================
// Base PROPRE — aucun compte, aucune donnée fictive.
// Le premier Admin Sup est créé via l'écran « Première configuration ».
// ============================================================

export function defaultEniaContent(): EniaContent {
  const id = (p: string, n: number) => `${p}-${n}`;
  return {
    visible: true,
    titre: "ENIA 2.0",
    sousTitre: "École du Numérique et de l'Intelligence Artificielle",
    presentation:
      "ENIA 2.0 est une école supérieure spécialisée en numérique et intelligence artificielle, qui forme les étudiants à travers une approche pratique orientée vers l'emploi, l'innovation et la création d'entreprises.",
    bourseTitre: "Bourse ENIA 2.0",
    bourseIntro:
      "Programme lancé en 2024 permettant aux étudiants de se former dans un cadre complet, structuré et entièrement pris en charge.",
    bourseConcretement:
      "Le programme ne concerne pas uniquement les cours : il vise à intégrer l'étudiant dans un environnement complet favorisant l'apprentissage, la création et la réussite professionnelle.",
    bourseAvantages: [
      { id: id("ea", 1), titre: "Formation 100 % financée pendant 3 ans", description: "Prise en charge globale permettant de se concentrer sur les études.", ordre: 1 },
      { id: id("ea", 2), titre: "Restauration entièrement prise en charge", description: "Repas couverts pendant la durée de la formation.", ordre: 2 },
      { id: id("ea", 3), titre: "Transport assuré via des bus scolaires", description: "Accès facilité au campus par abonnement bus scolaire.", ordre: 3 },
      { id: id("ea", 4), titre: "Kits scolaires offerts", description: "Matériel pédagogique fourni à l'inscription.", ordre: 4 },
      { id: id("ea", 5), titre: "Assurance et services de santé inclus", description: "Couverture santé et services associés.", ordre: 5 },
      { id: id("ea", 6), titre: "Encadrement, stages et suivi professionnel", description: "Accompagnement jusqu'à l'insertion professionnelle.", ordre: 6 },
      { id: id("ea", 7), titre: "Visites en entreprise", description: "Immersion concrète dans le monde professionnel.", ordre: 7 },
    ],
    bourseHighlights: ["Formation pratique", "Insertion professionnelle", "Accès facilité aux stages"],
    fraisScolaires: [],
    pieces: [],
    noteInscription: "Les frais d'inscription ne sont pas remboursables.",
    affiche: "",
    allowDownloadAffiche: true,
    lien: { nom: "Site officiel ENIA 2.0", url: "https://enia.cg", description: "Visitez le site officiel d'ENIA 2.0 pour plus d'informations.", actif: true },
    partenaires: [],
  };
}

export function emptySettings(): DB["settings"] {
  return {
    branding: {
      name: "SENTINELLES NUMÉRIQUES",
      subtitle: "Centre de Formation en Génie Informatique et Génie Industriel",
      tagline: "Formons aujourd'hui les talents numériques et industriels qui construiront l'avenir.",
      badge: "SENTINELLES • ACADEMY",
    },
    hero: {
      responsibleName: "Coach Fredich FOUNDOU",
      responsibleTitle: "Étudiant-chercheur en Génie Informatique à ENIA 2.0",
      responsibleImage: "https://tvcuwhgqhrcvdgwlviju.supabase.co/storage/v1/object/public/public-media/hero/responsable-1788000712264.jpeg",
      highlight: "RESPONSABLE DU CENTRE",
    },
    infos: {
      debut: "10 août",
      lieu: "Institut de Jeunes Sourds (ENIA 2.0), Brazzaville",
      duree: "3 mois intensifs",
      whatsapp: ["06 63 28 87 4", "06 53 67 40 3"],
      inscription: "Ouverte — 5 000 FCFA",
    },
    frais: {
      inscription: 5000,
      informatique: [
        { id: "fr-inf-1", label: "1 module", modules: 1, montant: 3500 },
        { id: "fr-inf-2", label: "Inscription + 1 module", modules: 1, montant: 8500 },
      ],
      industriel: [
        { id: "fr-ind-1", label: "3 modules", modules: 3, montant: 5000 },
        { id: "fr-ind-2", label: "6 modules", modules: 6, montant: 10000 },
        { id: "fr-ind-3", label: "Programme complet (12 modules)", modules: 12, montant: 20000 },
      ],
    },
    formations: {
      informatique: { titre: "GÉNIE INFORMATIQUE", description: "Formation intensive et pratique en développement web, cybersécurité et réseaux." },
      industriel: { titre: "GÉNIE INDUSTRIEL", description: "Formation pratique en électrotechnique, automatismes, électronique et maintenance." },
    },
    avantages: [
      "Formation 100% pratique avec ateliers et laboratoires technologiques dédiés",
      "Accompagnement et mentorat personnalisé vers l’emploi et l’entrepreneuriat",
      "Préparation aux certifications internationales et réseau d’entreprises partenaires",
      "Possibilité d’accès direct à la Bourse d’excellence ENIA 2.0 (100% financée pendant 3 ans)",
    ],
    bourse: { title: "3 ANS D'ÉTUDES", subtitle: "100% GRATUITES À ENIA 2.0.", button: "BOURSE MON AVENIR" },
    partenaires: [
      "ENIA 2.0 — École du Numérique et de l’Intelligence Artificielle",
      "FSH Company",
    ],
    preInscription: {
      enabled: true,
      title: "Pré-inscription en ligne",
      description: "Réservez votre place dès maintenant.",
    },
    contact: { email: "contact@sentinelles-numeriques.cg", adresse: "Institut de Jeunes Sourds (ENIA 2.0), Brazzaville" },
  };
}

export function emptyDB(preserveUsers?: DB["users"]): DB {
  const users = preserveUsers ?? [];
  return {
    version: 1,
    settings: emptySettings(),
    modules: [],
    users,
    students: [],
    teachers: [],
    registrations: [],
    courses: [],
    schedule: [],
    attendance: [],
    invoices: [],
    payments: [],
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
    enia: defaultEniaContent(),
    log: [
      { id: `LOG-${Date.now()}`, date: today(), user: "Système", action: "Initialisation — base propre créée" },
    ],
  };
}

/* ---------- Initialisation sélective ---------- */
export type ResetCategory =
  | "demo" | "formations" | "modules" | "students" | "teachers" | "admins"
  | "partners" | "courses" | "schedule" | "attendance" | "tests" | "grades"
  | "payments" | "certificates" | "scholarships" | "notifications" | "content" | "messages" | "enia";

export const RESET_CATEGORIES: { key: ResetCategory; label: string; desc: string }[] = [
  { key: "demo", label: "Toutes les données", desc: "Réinitialise TOUT et repart d'une base propre (garde l'Admin Sup)" },
  { key: "formations", label: "Formations & tarifs", desc: "Titres, descriptions et grilles tarifaires" },
  { key: "modules", label: "Modules", desc: "Tous les modules et leurs fiches" },
  { key: "students", label: "Apprenants", desc: "Apprenants et leurs comptes" },
  { key: "teachers", label: "Formateurs", desc: "Enseignants et leurs comptes" },
  { key: "admins", label: "Administrateurs", desc: "Comptes admin/gestionnaires (sauf Admin Sup)" },
  { key: "partners", label: "Partenaires", desc: "Partenaires institutionnels" },
  { key: "courses", label: "Cours & supports", desc: "Cours, documents et devoirs" },
  { key: "schedule", label: "Emplois du temps", desc: "Créneaux et planning" },
  { key: "attendance", label: "Présences", desc: "Historique des présences" },
  { key: "tests", label: "Tests / évaluations", desc: "Tests, questions et résultats" },
  { key: "grades", label: "Notes", desc: "Notes des apprenants" },
  { key: "payments", label: "Paiements", desc: "Paiements et reçus" },
  { key: "certificates", label: "Certificats", desc: "Certificats émis" },
  { key: "scholarships", label: "Bourses", desc: "Statuts de bourse" },
  { key: "notifications", label: "Notifications", desc: "Notifications et messages" },
  { key: "content", label: "Avantages & annonces", desc: "Avantages, annonces et contenu du site" },
  { key: "enia", label: "Module ENIA 2.0", desc: "Contenu, affiche, frais, pièces et partenaires ENIA" },
];

export function resetCategories(db: DB, cats: ResetCategory[]): DB {
  // Réinitialisation totale : on préserve UNIQUEMENT le premier Admin Sup existant.
  if (cats.includes("demo")) {
    const adminSup = db.users.find((u) => u.role === "superadmin");
    return emptyDB(adminSup ? [adminSup] : []);
  }

  let next: DB = { ...db };
  const has = (c: ResetCategory) => cats.includes(c);

  if (has("formations")) {
    next.settings = {
      ...next.settings,
      frais: { inscription: 0, informatique: [], industriel: [] },
      formations: {
        informatique: { titre: "GÉNIE INFORMATIQUE", description: "" },
        industriel: { titre: "GÉNIE INDUSTRIEL", description: "" },
      },
    };
  }
  if (has("modules")) next.modules = [];
  if (has("students")) {
    const studentUserIds = new Set(next.students.map((s) => s.userId));
    next.students = [];
    next.registrations = [];
    next.users = next.users.filter((u) => u.role !== "student" && !studentUserIds.has(u.id));
  }
  if (has("teachers")) {
    const teacherUserIds = new Set(next.teachers.map((t) => t.userId));
    next.teachers = [];
    next.users = next.users.filter((u) => u.role !== "teacher" && !teacherUserIds.has(u.id));
  }
  if (has("admins")) {
    const keep = next.users.find((u) => u.role === "superadmin");
    next.users = next.users.filter((u) => (u.role !== "admin" && u.role !== "superadmin") || u.id === keep?.id);
  }
  if (has("partners")) { next.partners = []; next.settings = { ...next.settings, partenaires: [] }; }
  if (has("courses")) next.courses = [];
  if (has("schedule")) next.schedule = [];
  if (has("attendance")) next.attendance = [];
  if (has("tests")) { next.tests = []; next.results = []; }
  if (has("grades")) next.grades = [];
  if (has("payments")) next.payments = [];
  if (has("certificates")) next.certificates = [];
  if (has("scholarships")) next.scholarships = [];
  if (has("notifications")) { next.notifications = []; next.messages = []; }
  if (has("content")) { next.advantages = []; next.announcements = []; next.settings = { ...next.settings, avantages: [] }; }
  if (has("enia")) { next.enia = defaultEniaContent(); }

  next.log = [
    { id: `LOG-${Date.now()}`, date: today(), user: "Admin Sup", action: `Initialisation sélective : ${cats.join(", ")}` },
    ...next.log,
  ];
  return next;
}
