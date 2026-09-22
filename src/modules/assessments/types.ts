import { Formation } from "@/lib/types";

export type QuestionType =
  | "qcm"
  | "qcm_multiple"
  | "vf"
  | "courte"
  | "longue"
  | "numerique";

export type AssessmentStatus =
  | "brouillon"
  | "enregistre"
  | "publie"
  | "en_cours"
  | "termine"
  | "corrige"
  | "archive";

export type AssessmentAudience = "all" | "formation" | "module" | "groupe" | "apprenants";

export type DifficultyLevel = "facile" | "moyen" | "difficile";

export interface QuestionChoice {
  id: string;
  texte: string;
  estCorrecte?: boolean;
}

export interface AssessmentQuestion {
  id: string;
  testId?: string;
  question: string;
  type: QuestionType;
  options?: string[]; // Pour rétro-compatibilité
  choices?: QuestionChoice[]; // Modèle riche
  bonneReponse?: string; // Pour QCM unique, VF, courte
  bonnesReponses?: string[]; // Pour QCM multiple
  valeurNumerique?: number; // Pour numérique
  toleranceNumerique?: number; // Marge d'erreur tolérée
  points: number;
  explication?: string;
  ordre: number;
  obligatoire?: boolean;
  tempsLimiteSecondes?: number;
}

export interface Assessment {
  id: string;
  titre: string;
  description?: string;
  moduleId: string;
  chapitreId?: string;
  formation?: Formation;
  teacherId: string;
  questions: AssessmentQuestion[];
  date: string;
  dateDebut?: string;
  dateDebutHeure?: string;
  dateFin?: string;
  dateFinHeure?: string;
  duree: number; // en minutes
  bareme: number;
  seuilReussite: number;
  difficulte: DifficultyLevel;
  tentatives: number;
  afficherCorrections: boolean;
  validationRequise: boolean;
  consignes?: string;
  statut: AssessmentStatus;
  audience: AssessmentAudience;
  targetGroupe?: string;
  targetStudentIds?: string[];
  modeSecurise: boolean;
  bloquerCopierColler: boolean;
  bloquerClicDroit: boolean;
  navigationLibre: boolean;
  datePublication?: string;
  createdAt?: string;
}

export type ProctoringEventType =
  | "changement_onglet"
  | "perte_visibilite"
  | "sortie_plein_ecran"
  | "tentative_copier_coller"
  | "clic_droit"
  | "expiration_temps"
  | "reconnexion"
  | "deconnexion"
  | "touche_interdite";

export interface ProctoringLogEntry {
  id: string;
  attemptId: string;
  testId: string;
  studentId: string;
  typeEvenement: ProctoringEventType;
  details?: Record<string, any>;
  createdAt: string;
}

export type AttemptStatus = "en_cours" | "soumis" | "expire" | "corrige";

export interface AssessmentAttempt {
  id: string;
  testId: string;
  studentId: string;
  heureDebut: string;
  heureFinPrevue: string;
  heureFinReelle?: string;
  dureeUtiliseeSecondes: number;
  statut: AttemptStatus;
  reponsesTemporaires: Record<string, any>;
  noteTotale?: number;
  pourcentage?: number;
  correctionManuelleRequise: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AssessmentAnswerDetail {
  id: string;
  attemptId?: string;
  resultId?: string;
  questionId: string;
  reponseDonnee: string;
  reponseLongue?: string;
  choixMultiples?: string[];
  correct: boolean;
  pointsObtenus: number;
  noteManuelle?: number;
  commentaireFormateur?: string;
  statutCorrection: "auto" | "en_attente" | "corrige";
}

export interface AssessmentResultSummary {
  id: string;
  testId: string;
  studentId: string;
  studentNom?: string;
  studentPrenom?: string;
  studentEmail?: string;
  note: number;
  bareme: number;
  pourcentage: number;
  date: string;
  heure?: string;
  dureeUtilisee?: string;
  reponses?: Record<string, any>;
  valide: boolean;
  statut: "reussi" | "echoue";
  nbBonnes: number;
  nbMauvaises: number;
  nbNonRepondues: number;
  proctoringAlertsCount: number;
  detailsAnswers?: AssessmentAnswerDetail[];
}

export interface AssessmentDocument {
  id: string;
  titre: string;
  description?: string;
  formationId?: string;
  moduleId?: string;
  testId?: string;
  targetGroupe?: string;
  fichierNom: string;
  fichierTaille: number;
  fichierType: string;
  fichierUrl: string;
  storageKey?: string;
  createdAt: string;
}
