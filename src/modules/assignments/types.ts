import { Formation } from "@/lib/types";

export type AssignmentStatus =
  | "brouillon"
  | "enregistre"
  | "publie"
  | "ouvert"
  | "ferme"
  | "archive";

export type SubmissionStatus =
  | "brouillon"
  | "remis"
  | "en_retard"
  | "en_correction"
  | "corrige"
  | "retourne";

export type AssignmentAudience = "all" | "formation" | "module" | "groupe" | "apprenants";

export interface AssignmentAttachment {
  id: string;
  assignmentId?: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mime: string;
  size: number;
  storagePath?: string;
  createdAt?: string;
}

export interface AssignmentSubmissionFile {
  id: string;
  submissionId?: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mime: string;
  size: number;
  storagePath?: string;
  createdAt?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentNom?: string;
  studentPrenom?: string;
  studentEmail?: string;
  studentPhoto?: string;
  version: number;
  texte?: string;
  statut: SubmissionStatus;
  dateRemise: string; // ISO string
  note?: number;
  appreciation?: string;
  commentairesPrives?: string;
  pointsForts?: string;
  pointsAmelioration?: string;
  corrigePar?: string;
  dateCorrection?: string;
  publie: boolean;
  files?: AssignmentSubmissionFile[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  titre: string;
  description?: string;
  consignes: string;
  formation?: Formation;
  moduleId: string;
  chapitreId?: string;
  teacherId: string;
  dateCreation: string;
  datePublication?: string;
  dateOuverture?: string;
  dateLimite: string; // YYYY-MM-DD
  heureLimite?: string; // HH:MM
  dureeEstimeeMinutes?: number;
  nbFichiersMax: number;
  tailleMaxMo: number;
  formatsAutorises: string[]; // ex: ['pdf', 'docx', 'xlsx', 'zip', 'png', 'jpg']
  bareme: number;
  seuilReussite: number;
  statut: AssignmentStatus;
  audience: AssignmentAudience;
  targetGroupe?: string;
  targetStudentIds?: string[];
  autoriserRemiseTardive: boolean;
  tentativesMax: number; // 1, 2, 3, ou 0 pour illimité
  correctionVisibleImmediatement: boolean;
  attachments?: AssignmentAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentValidationDiagnostic {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AssignmentDocument {
  id: string;
  titre: string;
  description?: string;
  moduleId?: string;
  teacherId?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}
