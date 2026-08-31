// Source unique pour le type Role — évite les conflits d'import.
export type Role = "superadmin" | "admin" | "partner_admin" | "teacher" | "student" | "partner";

export type Formation = "informatique" | "industriel";

export interface Chapter {
  id: string;
  titre: string;
  contenu: string;
}

export interface Module {
  id: string;
  formation: Formation;
  numero: number;
  titre: string;
  icon: string;
  notions: string[];
  description?: string;
  objectifs?: string[];
  programme?: string;
  chapitres?: Chapter[];
  duree?: string;
  supports?: string;
  infosSupp?: string;
  image?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  name: string;
  email?: string;
  phone?: string;
  linkedId?: string;
  createdAt: string;
  actif?: boolean;
  permissions?: string[];
}

export interface Student {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: "M" | "F";
  telephone: string;
  whatsapp: string;
  email: string;
  adresse: string;
  niveau: string;
  formation: Formation;
  modules: string[];
  groupe?: string;
  photo?: string;
  dateInscription: string;
  statutPaiement: "paye" | "partiel" | "impaye";
  statut: "actif" | "inactif";
  userId?: string;
}

export interface Teacher {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  email: string;
  phone: string;
  modules: string[];
  userId?: string;
  photo?: string;
  formations?: Formation[];
  infosPro?: string;
  diplomes?: string;
  actif?: boolean;
  typeContrat?: string;
  tarifHoraire?: number;
  tarifsParModule?: Record<string, number>;
  heuresPrevues?: number;
}

export interface Advantage {
  id: string;
  titre: string;
  description: string;
  explication: string;
  infosSupp?: string;
  image?: string;
  icon?: string;
  ordre: number;
}

export interface Partner {
  id: string;
  nom: string;
  description?: string;
  contact?: string;
  logo?: string;
  url?: string;
  actif: boolean;
}

export interface Announcement {
  id: string;
  titre: string;
  contenu: string;
  date: string;
  actif: boolean;
  couleur?: "cyan" | "red" | "green" | "gold";
}

export interface PreRegistration {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  whatsapp: string;
  email: string;
  niveau: string;
  formation: Formation;
  modules: string[];
  date: string;
  statut: "en_attente" | "confirmee" | "refusee";
}

export interface CourseFile {
  id: string;
  name: string;
  originalName: string;
  mime: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface Course {
  id: string;
  titre: string;
  description: string;
  moduleId: string;
  teacherId: string;
  type: "cours" | "document" | "devoir";
  content: string;
  date: string;
  formation?: Formation;
  groupe?: string;
  studentIds?: string[];
  audience?: "module" | "groupe" | "apprenants";
  files?: CourseFile[];
  publie?: boolean;
}

export interface ScheduleItem {
  id: string;
  jour: string;
  heureDebut: string;
  heureFin: string;
  date?: string;
  moduleId: string;
  teacherId: string;
  salle: string;
  formation: Formation;
  groupe?: string;
  studentIds?: string[];
}

export type AttendanceStatus = "present" | "absent" | "retard";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  moduleId: string;
  statut: AttendanceStatus;
  heure: string;
  salle: string;
  teacherId: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  type: "inscription" | "formation";
  libelle: string;
  montant: number;
  date: string;
  dueDate?: string;
  createdBy?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  invoiceId?: string;
  type: "inscription" | "formation";
  libelle: string;
  montant: number;
  date: string;
  heure?: string;
  mode: string;
  reference?: string;
  observation?: string;
  createdBy?: string;
  createdByName?: string;
  // rétro-compat (jamais utilisé comme source de vérité)
  statut?: "paye" | "partiel" | "impaye";
  reste?: number;
}

export type FinancialStatus = "impaye" | "partiel" | "paye" | "retard";

export interface FinancialSummary {
  totalDu: number;
  totalPaye: number;
  solde: number;
  statut: FinancialStatus;
  invoices: Invoice[];
  payments: Payment[];
  schedules?: PaymentSchedule[];
}

export interface PaymentSchedule {
  id: string;
  studentId: string;
  invoiceId?: string;
  installmentNumber: number;
  label: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: "impaye" | "partiel" | "paye" | "retard";
}

export interface Question {
  id: string;
  question: string;
  type: "qcm" | "vf" | "courte";
  options?: string[];
  bonneReponse: string;
  points: number;
  explication?: string;
}

export interface Test {
  id: string;
  titre: string;
  moduleId: string;
  chapitreId?: string;
  teacherId: string;
  questions: Question[];
  date: string;
  duree: number;
  bareme?: number;
  dateDebut?: string;
  dateFin?: string;
  difficulte?: "facile" | "moyen" | "difficile";
  tentatives?: number;
  afficherCorrections?: boolean;
  validationRequise?: boolean;
}

export interface TestResult {
  id: string;
  testId: string;
  studentId: string;
  note: number;
  pourcentage: number;
  date: string;
  heure?: string;
  reponses?: Record<string, string>;
  valide?: boolean;
  statut?: "reussi" | "echoue";
}

export interface Grade {
  id: string;
  studentId: string;
  moduleId: string;
  note: number;
  appreciation: string;
  date: string;
}

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  subject: string;
  body: string;
  date: string;
  lu: boolean;
}

export interface Notification {
  id: string;
  toId: string;
  title: string;
  body: string;
  date: string;
  lu: boolean;
  type: string;
}

export interface Certificate {
  id: string;
  studentId: string;
  numero: string;
  formation: Formation;
  periode: string;
  resultat: string;
  note: number;
  date: string;
  modules?: string[];
}

export type ScholarshipStatus =
  | "en_attente" | "test_programme" | "test_effectue"
  | "admis" | "non_admis" | "bourse_attribuee";

export interface Scholarship {
  id: string;
  studentId: string;
  statut: ScholarshipStatus;
  date: string;
}

export interface LogEntry {
  id: string;
  date: string;
  user: string;
  action: string;
}

export interface FeeRow {
  id: string;
  label: string;
  modules: number;
  montant: number;
}

export interface TeacherHour {
  id: string;
  scheduleId?: string;
  teacherId: string;
  moduleId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  heures: number;
  tarifApplique: number;
  montant: number;
  valide: boolean;
  validePar?: string;
  dateValidation?: string;
}

export interface TeacherPayment {
  id: string;
  teacherId: string;
  montant: number;
  date: string;
  heure?: string;
  mode: string;
  reference?: string;
  observation?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface Submission {
  id: string;
  courseId: string;
  moduleId: string;
  studentId: string;
  teacherId: string;
  texte?: string;
  fichier?: CourseFile;
  date: string;
  heure: string;
  note?: number;
  appreciation?: string;
  valide?: boolean;
  dateCorrection?: string;
}

export interface FileActivity {
  id: string;
  courseId: string;
  courseTitre: string;
  userId: string;
  userName: string;
  action: "ouvert" | "telecharge";
  date: string;
  heure: string;
}

export interface SiteContent {
  branding: { name: string; subtitle: string; tagline: string; badge: string };
  hero: { responsibleName: string; responsibleTitle: string; responsibleImage: string; highlight: string };
  infos: { debut: string; lieu: string; duree: string; whatsapp: string[]; inscription: string };
  frais: { inscription: number; informatique: FeeRow[]; industriel: FeeRow[] };
  formations: {
    informatique: { titre: string; description: string };
    industriel: { titre: string; description: string };
  };
  avantages: string[];
  advantageImage?: string;
  bourse: { title: string; subtitle: string; button: string };
  partenaires: string[];
  preInscription: { enabled: boolean; title: string; description: string };
  contact: { email: string; adresse: string };
}

export interface EniaFeeItem { id: string; label: string; value: string; ordre: number }
export interface EniaPieceGroup { id: string; titre: string; pieces: string[]; fraisDepot?: string; ordre: number }
export interface EniaAdvantage { id: string; titre: string; description: string; ordre: number }
export interface EniaPartner { id: string; nom: string; description?: string; logoUrl?: string; url?: string; telephone?: string; email?: string; actif: boolean; ordre: number }

export interface EniaContent {
  visible: boolean;
  titre: string;
  sousTitre: string;
  presentation: string;
  bourseTitre: string;
  bourseIntro: string;
  bourseConcretement: string;
  bourseAvantages: EniaAdvantage[];
  bourseHighlights: string[];
  fraisScolaires: EniaFeeItem[];
  pieces: EniaPieceGroup[];
  noteInscription: string;
  affiche: string;
  allowDownloadAffiche: boolean;
  lien: { nom: string; url: string; description: string; actif: boolean };
  partenaires: EniaPartner[];
}

export interface DB {
  version: number;
  settings: SiteContent;
  modules: Module[];
  users: User[];
  students: Student[];
  teachers: Teacher[];
  registrations: PreRegistration[];
  courses: Course[];
  schedule: ScheduleItem[];
  attendance: AttendanceRecord[];
  invoices: Invoice[];
  payments: Payment[];
  paymentSchedules: PaymentSchedule[];
  teacherHours: TeacherHour[];
  teacherPayments: TeacherPayment[];
  submissions: Submission[];
  fileActivities: FileActivity[];
  tests: Test[];
  results: TestResult[];
  grades: Grade[];
  messages: Message[];
  notifications: Notification[];
  certificates: Certificate[];
  scholarships: Scholarship[];
  advantages: Advantage[];
  partners: Partner[];
  announcements: Announcement[];
  enia: EniaContent;
  log: LogEntry[];
}
