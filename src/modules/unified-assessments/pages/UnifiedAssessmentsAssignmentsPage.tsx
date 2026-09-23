import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck, TestTube2, Inbox, Plus, Sparkles, FileUp,
  Download, Search, Filter, BookOpen, Clock, Calendar, CheckCircle2,
  AlertTriangle, Users, Layers, Eye, Edit3, Trash2, Copy, Archive, ArrowRight,
  Award
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { PageHead, Btn, Card, Badge, Empty, Modal, Field, Input, Select, Textarea } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

// Devoirs / Assignments imports
import { Assignment, AssignmentSubmission, AssignmentStatus } from "@/modules/assignments/types";
import {
  getLocalAssignments,
  getLocalSubmissions,
  persistAssignmentToSupabase,
  getDeadlineInfo,
  deleteAssignment,
} from "@/modules/assignments/services/assignmentService";
import { AssignmentEditorModal } from "@/modules/assignments/components/AssignmentEditorModal";
import { AssignmentPreviewModal } from "@/modules/assignments/components/AssignmentPreviewModal";

// Évaluations / Assessments imports
import { Assessment, AssessmentStatus as TestStatus, AssessmentResultSummary } from "@/modules/assessments/types";
import {
  persistAssessmentToSupabase as persistTestToSupabase,
  deleteAssessment,
} from "@/modules/assessments/services/assessmentService";
import { AssessmentEditor } from "@/modules/assessments/components/AssessmentEditor";
import { AssessmentGeneratorModal } from "@/modules/assessments/components/AssessmentGeneratorModal";
import { AssessmentPreviewModal as TestPreviewModal } from "@/modules/assessments/components/AssessmentPreviewModal";
import { DocumentImporterModal } from "@/modules/assessments/components/DocumentImporterModal";
import { generateAssessmentDocx } from "@/modules/assessments/exporters/docxExport";
import { generateAssessmentPdf } from "@/modules/assessments/exporters/pdfExport";

// Boîte de réception unifiée & synchronisation
import { UnifiedSubmissionsInbox } from "../components/UnifiedSubmissionsInbox";
import {
  subscribeToAssessmentsSync,
  notifyAssessmentEvent,
  broadcastSubmissionsChange,
} from "../services/unifiedSyncService";

// Règles de sécurité et cloisonnement strict
import {
  resolveTeacherForUser,
  assignmentsFor,
  assessmentsFor,
  submissionsForUser,
  resultsForUser,
} from "@/lib/access";

interface Props {
  defaultTab?: "devoirs" | "tests" | "remises";
}

/** Convertit les entrées db.tests (store global) vers le modèle Assessment unifié */
function mapDbTestsToAssessments(tests: any[]): Assessment[] {
  return (tests || []).map((t: any) => ({
    id: t.id,
    titre: t.titre,
    description: t.description || "",
    moduleId: t.moduleId,
    chapitreId: t.chapitreId,
    teacherId: t.teacherId || "",
    questions: (t.questions || []).map((q: any, idx: number) => ({
      id: q.id || `q-${idx}`,
      question: q.question,
      type: q.type || "qcm",
      options: q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []),
      bonneReponse: q.bonneReponse || "",
      bonnesReponses: q.bonnesReponses || [],
      valeurNumerique: q.valeurNumerique,
      toleranceNumerique: q.toleranceNumerique,
      points: Number(q.points || 1),
      explication: q.explication || "",
      ordre: q.ordre || idx + 1,
      obligatoire: q.obligatoire !== false,
    })),
    date: t.date || new Date().toISOString().slice(0, 10),
    duree: Number(t.duree || 45),
    bareme: Number(t.bareme || 20),
    seuilReussite: Number(t.seuilReussite || (t.bareme ? t.bareme / 2 : 10)),
    difficulte: t.difficulte || "moyen",
    tentatives: Number(t.tentatives || 1),
    afficherCorrections: t.afficherCorrections !== false,
    validationRequise: Boolean(t.validationRequise),
    consignes: t.consignes || "",
    statut: t.statut || "publie",
    audience: t.audience || "module",
    targetGroupe: t.targetGroupe,
    targetStudentIds: t.targetStudentIds || [],
    modeSecurise: Boolean(t.modeSecurise),
    bloquerCopierColler: t.bloquerCopierColler !== false,
    bloquerClicDroit: Boolean(t.bloquerClicDroit),
    navigationLibre: t.navigationLibre !== false,
    datePublication: t.datePublication,
    createdAt: t.createdAt,
  }));
}

export function UnifiedAssessmentsAssignmentsPage({ defaultTab = "devoirs" }: Props) {
  const { db, user, update, log, notify } = useStore();
  const { profile } = useAuth();

  // Onglet principal unifié : 'devoirs' | 'tests' | 'remises'
  const [activeMainTab, setActiveMainTab] = useState<"devoirs" | "tests" | "remises">(defaultTab);

  // État local des devoirs & remises
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<AssignmentSubmission[]>([]);

  // État local des évaluations & résultats
  const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
  const [allResults, setAllResults] = useState<AssessmentResultSummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedParentIdForRemises, setSelectedParentIdForRemises] = useState<string>("all");

  // Modales de suppression
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sous-filtres cycle de vie
  const [assignmentSubFilter, setAssignmentSubFilter] = useState<"all" | "brouillon" | "publie" | "a_corriger" | "archive">("all");
  const [testSubFilter, setTestSubFilter] = useState<"all" | "brouillon" | "publie" | "termine" | "archive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modales Devoirs
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [previewingAssignment, setPreviewingAssignment] = useState<Assignment | null>(null);

  // Modales Évaluations
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [isTestEditorOpen, setIsTestEditorOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isDocImporterOpen, setIsDocImporterOpen] = useState(false);
  const [previewingAssessment, setPreviewingAssessment] = useState<Assessment | null>(null);

  // 1. Détermination du contexte utilisateur et enseignant
  const isStaff = user?.role === "superadmin" || user?.role === "admin";
  const teacher = resolveTeacherForUser(db, user);
  const currentTeacherId = teacher?.id || user?.id || "TCH-CURRENT";

  // 2. Chargement synchronisé des données Supabase et fallback
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Devoirs
      if (isSupabaseConfigured) {
        const { data: aData } = await supabase.from("assignments").select("*, attachments:assignment_attachments(*)");
        if (aData) {
          const mappedA: Assignment[] = aData.map((row: any) => ({
            id: row.id,
            titre: row.titre,
            description: row.description || "",
            consignes: row.consignes,
            formation: row.formation,
            moduleId: row.module_id,
            chapitreId: row.chapitre_id,
            teacherId: row.teacher_id,
            dateCreation: row.date_creation || row.created_at,
            datePublication: row.date_publication,
            dateOuverture: row.date_ouverture,
            dateLimite: row.date_limite ? row.date_limite.slice(0, 10) : "",
            heureLimite: row.heure_limite || "23:59",
            dureeEstimeeMinutes: row.duree_estimee_minutes,
            nbFichiersMax: row.nb_fichiers_max || 3,
            tailleMaxMo: row.taille_max_mo || 10,
            formatsAutorises: row.formats_autorises || ["pdf", "docx"],
            bareme: Number(row.bareme || 20),
            seuilReussite: Number(row.seuil_reussite || 10),
            statut: row.statut,
            audience: row.audience || "all",
            targetGroupe: row.target_groupe,
            targetStudentIds: row.target_student_ids,
            autoriserRemiseTardive: Boolean(row.autoriser_remise_tardive ?? row.allow_late_submission),
            tentativesMax: Number(row.tentatives_max ?? row.max_attempts ?? 1),
            correctionVisibleImmediatement: Boolean(row.correction_visible_immediatement),
            attachments: (row.attachments || row.assignment_attachments || []).map((att: any) => ({
              id: att.id,
              assignmentId: att.assignment_id,
              fileName: att.file_name || att.nom,
              originalName: att.original_name || att.nom,
              fileUrl: att.file_url || att.url,
              mime: att.mime || att.type_mime,
              size: att.size || att.taille,
              storagePath: att.storage_path,
              createdAt: att.created_at,
            })),
            createdAt: row.created_at,
          }));
          setAllAssignments(mappedA);
        } else {
          setAllAssignments(getLocalAssignments());
        }

        // Remises devoirs
        const { data: sData } = await supabase.from("assignment_submissions").select("*, files:assignment_submission_files(*)");
        if (sData) {
          const mappedS: AssignmentSubmission[] = sData.map((row: any) => ({
            id: row.id,
            assignmentId: row.assignment_id,
            studentId: row.student_id,
            version: row.version || row.attempt_number || 1,
            texte: row.texte || row.comment,
            statut: row.statut,
            dateRemise: row.date_remise || row.submitted_at || row.created_at,
            note: row.note !== null && row.note !== undefined ? Number(row.note) : undefined,
            bareme: Number(row.bareme || 20),
            appreciation: row.appreciation,
            commentairesPrives: row.commentaires_prives,
            pointsForts: row.points_forts,
            pointsAmelioration: row.points_amelioration,
            corrigePar: row.corrige_par,
            dateCorrection: row.date_correction,
            publie: row.publie !== false,
            files: (row.files || row.assignment_submission_files || []).map((f: any) => ({
              id: f.id,
              submissionId: f.submission_id,
              fileName: f.file_name,
              originalName: f.original_name,
              fileUrl: f.file_url,
              mime: f.mime || f.file_type,
              size: f.size || f.file_size,
              storagePath: f.storage_path,
              createdAt: f.created_at,
            })),
            createdAt: row.created_at,
          }));
          setAllSubmissions(mappedS);
        } else {
          setAllSubmissions(getLocalSubmissions());
        }
      } else {
        setAllAssignments(getLocalAssignments());
        setAllSubmissions(getLocalSubmissions());
      }

      // Évaluations & Tests — on charge depuis db.tests (store global)
      setAllAssessments(mapDbTestsToAssessments(db.tests));
      setAllResults(db.results as any);
    } catch (err) {
      console.error("Erreur de chargement unifié:", err);
      setAllAssignments(getLocalAssignments());
      setAllSubmissions(getLocalSubmissions());
      setAllAssessments(mapDbTestsToAssessments(db.tests));
      setAllResults(db.results as any);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const sub = subscribeToAssessmentsSync(loadData);
    return () => sub.unsubscribe();
  }, [user]);

  // 3. APPLICATION DU CLOISONNEMENT STRICT (RÈGLE SÉCURITÉ AUDIO USER) :
  // - Admin : voit TOUT
  // - Enseignant : voit UNIQUEMENT ce qu'il a composé lui-même, et UNIQUEMENT les remises/copies associées
  const myAssignments = useMemo(() => {
    return assignmentsFor(db, user, allAssignments);
  }, [db, user, allAssignments]);

  const myAssessments = useMemo(() => {
    return assessmentsFor(db, user, allAssessments);
  }, [db, user, allAssessments]);

  const mySubmissions = useMemo(() => {
    return submissionsForUser(db, user, allSubmissions, myAssignments);
  }, [db, user, allSubmissions, myAssignments]);

  const myResults = useMemo(() => {
    return resultsForUser(db, user, allResults, myAssessments);
  }, [db, user, allResults, myAssessments]);

  // 4. Filtrage dynamique Devoirs par sous-onglets
  const filteredAssignments = useMemo(() => {
    return myAssignments.filter((a) => {
      if (assignmentSubFilter === "brouillon" && a.statut !== "brouillon") return false;
      if (assignmentSubFilter === "publie" && a.statut !== "publie" && a.statut !== "ouvert") return false;
      if (assignmentSubFilter === "archive" && a.statut !== "archive") return false;
      if (assignmentSubFilter === "a_corriger") {
        const hasUnscored = mySubmissions.some((s) => s.assignmentId === a.id && s.note === undefined);
        if (!hasUnscored) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return a.titre.toLowerCase().includes(q) || (a.moduleId || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [myAssignments, mySubmissions, assignmentSubFilter, searchQuery]);

  // 5. Filtrage dynamique Évaluations par sous-onglets
  const filteredAssessments = useMemo(() => {
    return myAssessments.filter((t) => {
      if (testSubFilter === "brouillon" && t.statut !== "brouillon") return false;
      if (testSubFilter === "publie" && t.statut !== "publie" && t.statut !== "en_cours") return false;
      if (testSubFilter === "termine" && t.statut !== "termine") return false;
      if (testSubFilter === "archive" && t.statut !== "archive") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.titre.toLowerCase().includes(q) || (t.moduleId || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [myAssessments, testSubFilter, searchQuery]);

  // Navigation fluide vers la boîte de réception pour un devoir/test précis
  const handleJumpToSubmissions = (parentId: string) => {
    setSelectedParentIdForRemises(parentId);
    setActiveMainTab("remises");
  };

  // Actions Devoirs (Création / Enregistrement)
  const handleCreateAssignment = () => {
    const newA: Assignment = {
      id: `ASG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      titre: "",
      moduleId: db.modules[0]?.id || "",
      teacherId: currentTeacherId,
      consignes: "",
      bareme: 20,
      seuilReussite: 10,
      dateCreation: new Date().toISOString(),
      dateLimite: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      heureLimite: "23:59",
      nbFichiersMax: 3,
      tailleMaxMo: 10,
      formatsAutorises: ["pdf", "docx"],
      statut: "brouillon",
      audience: "all",
      autoriserRemiseTardive: true,
      tentativesMax: 1,
      correctionVisibleImmediatement: false,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    setEditingAssignment(newA);
    setIsEditorOpen(true);
  };

  const handleSaveAssignment = async (updated: Assignment) => {
    setIsEditorOpen(false);
    const existingIdx = allAssignments.findIndex((a) => a.id === updated.id);
    let newList: Assignment[];
    if (existingIdx >= 0) {
      newList = [...allAssignments];
      newList[existingIdx] = updated;
    } else {
      newList = [updated, ...allAssignments];
    }
    setAllAssignments(newList);
    await persistAssignmentToSupabase(updated);
    broadcastSubmissionsChange();

    // Notification aux apprenants si le devoir est publié
    if (updated.statut === "publie" || updated.statut === "ouvert") {
      notifyAssessmentEvent({
        targetUserId: "all",
        title: "Nouveau devoir disponible",
        body: `Le devoir « ${updated.titre} » est désormais accessible. Échéance : ${updated.dateLimite || "bientôt"}.`,
        type: "devoir",
        url: "/app/mes-evaluations-devoirs",
        storeNotify: notify,
      });
    }

    toastMsg.success("Devoir enregistré", `« ${updated.titre} » a été mis à jour.`);
  };

  const handleDeleteAssignmentConfirm = async () => {
    if (!deletingAssignment) return;
    setIsDeleting(true);
    try {
      const res = await deleteAssignment(deletingAssignment.id);
      if (!res.success) throw new Error(res.error || "Impossible de supprimer le devoir.");
      setAllAssignments((prev) => prev.filter((a) => a.id !== deletingAssignment.id));
      setAllSubmissions((prev) => prev.filter((s) => s.assignmentId !== deletingAssignment.id));
      broadcastSubmissionsChange();
      toastMsg.success("Devoir supprimé", `Le devoir « ${deletingAssignment.titre} » a été supprimé.`);
      setDeletingAssignment(null);
    } catch (e: any) {
      toastMsg.error("Erreur de suppression", e.message || "Échec.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions Évaluations (Création / Enregistrement / Suppression)
  const handleCreateAssessment = () => {
    const newTest: Assessment = {
      id: `TEST-${Date.now().toString(36)}`,
      titre: "",
      moduleId: db.modules[0]?.id || "",
      teacherId: currentTeacherId,
      questions: [],
      date: new Date().toISOString().slice(0, 10),
      duree: 45,
      bareme: 20,
      seuilReussite: 10,
      difficulte: "moyen",
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      statut: "brouillon",
      audience: "all",
      modeSecurise: true,
      bloquerCopierColler: true,
      bloquerClicDroit: true,
      navigationLibre: true,
      createdAt: new Date().toISOString(),
    };
    setEditingAssessment(newTest);
    setIsTestEditorOpen(true);
  };

  const handleSaveAssessment = async (updated: Assessment) => {
    setIsTestEditorOpen(false);
    const existingIdx = allAssessments.findIndex((t) => t.id === updated.id);
    let newList: Assessment[];
    if (existingIdx >= 0) {
      newList = [...allAssessments];
      newList[existingIdx] = updated;
    } else {
      newList = [updated, ...allAssessments];
    }
    setAllAssessments(newList);
    // Mettre à jour le store global
    update((d) => ({ ...d, tests: newList }));
    await persistTestToSupabase(updated);
    broadcastSubmissionsChange();

    // Notification aux apprenants si l'évaluation est publiée
    if (updated.statut === "publie") {
      notifyAssessmentEvent({
        targetUserId: "all",
        title: "Nouvelle évaluation programmée",
        body: `L'évaluation « ${updated.titre} » (${updated.duree} min) est ouverte pour passage.`,
        type: "evaluation",
        url: "/app/mes-evaluations-devoirs",
        storeNotify: notify,
      });
    }

    toastMsg.success("Évaluation enregistrée", `« ${updated.titre} » a été mise à jour.`);
  };

  const handleDeleteAssessmentConfirm = async () => {
    if (!deletingAssessment) return;
    setIsDeleting(true);
    try {
      const res = await deleteAssessment(deletingAssessment.id);
      if (!res.success) throw new Error(res.error || "Impossible de supprimer l'évaluation.");
      setAllAssessments((prev) => prev.filter((t) => t.id !== deletingAssessment.id));
      update((d) => ({
        ...d,
        tests: d.tests.filter((t) => t.id !== deletingAssessment.id),
        results: d.results.filter((r) => r.testId !== deletingAssessment.id),
      }));
      broadcastSubmissionsChange();
      toastMsg.success("Évaluation supprimée", `L'évaluation « ${deletingAssessment.titre} » a été supprimée.`);
      setDeletingAssessment(null);
    } catch (e: any) {
      toastMsg.error("Erreur de suppression", e.message || "Échec.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Si l'éditeur d'évaluation est ouvert, on affiche l'AssessmentEditor complet
  if (isTestEditorOpen && editingAssessment) {
    return (
      <div className="space-y-6">
        <AssessmentEditor
          initialAssessment={editingAssessment}
          onSaveDraft={async (draft) => {
            await handleSaveAssessment({ ...draft, statut: "brouillon" });
            setIsTestEditorOpen(false);
            setEditingAssessment(null);
          }}
          onPublish={async (pub) => {
            await handleSaveAssessment({ ...pub, statut: "publie" });
            setIsTestEditorOpen(false);
            setEditingAssessment(null);
          }}
          onPreview={(t) => setPreviewingAssessment(t)}
          onCancel={() => {
            setIsTestEditorOpen(false);
            setEditingAssessment(null);
          }}
          allowedModules={db.modules.map((m) => ({ id: m.id, titre: m.titre }))}
          allStudents={db.students.map((s) => ({ id: s.id, nom: s.nom, prenom: s.prenom }))}
        />

        {previewingAssessment && (
          <TestPreviewModal
            open={!!previewingAssessment}
            assessment={previewingAssessment}
            onClose={() => setPreviewingAssessment(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Unifié */}
      <PageHead
        title="Évaluations & Devoirs"
        subtitle={
          isStaff
            ? "Supervision complète des devoirs, examens en ligne et notation des remises"
            : `Espace formateur — ${teacher?.prenom || ""} ${teacher?.nom || ""} : vos devoirs, examens et copies d'apprenants`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn size="sm" variant="outline" onClick={() => setIsDocImporterOpen(true)} className="gap-1.5">
              <FileUp size={14} /> Importer Sujet
            </Btn>
            <Btn size="sm" variant="outline" onClick={() => setIsGeneratorOpen(true)} className="gap-1.5">
              <Sparkles size={14} className="text-cyan-400" /> Générateur QCM
            </Btn>
            <Btn size="sm" variant="outline" onClick={handleCreateAssessment} className="gap-1.5">
              <TestTube2 size={14} /> + Nouvelle Évaluation
            </Btn>
            <Btn size="sm" onClick={handleCreateAssignment} className="gap-1.5">
              <Plus size={14} /> + Nouveau Devoir
            </Btn>
          </div>
        }
      />

      {/* 3 ONGLETS PRINCIPAUX DU MODULE UNIFIÉ */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          {/* Onglet 1 : Devoirs */}
          <button
            onClick={() => {
              setActiveMainTab("devoirs");
              setSelectedParentIdForRemises("all");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeMainTab === "devoirs"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900/50"
            }`}
          >
            <ClipboardCheck size={18} />
            <span>Devoirs</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {myAssignments.length}
            </span>
          </button>

          {/* Onglet 2 : Évaluations / Tests */}
          <button
            onClick={() => {
              setActiveMainTab("tests");
              setSelectedParentIdForRemises("all");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeMainTab === "tests"
                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900/50"
            }`}
          >
            <TestTube2 size={18} />
            <span>Évaluations & Tests</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {myAssessments.length}
            </span>
          </button>

          {/* Onglet 3 : Remises & Résultats */}
          <button
            onClick={() => setActiveMainTab("remises")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeMainTab === "remises"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-900/50"
            }`}
          >
            <Inbox size={18} />
            <span>Remises & Résultats</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {mySubmissions.length + myResults.length}
            </span>
          </button>
        </div>

        {/* Indicateur de cloisonnement sécurisé */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Badge color={isStaff ? "gold" : "cyan"}>
            {isStaff ? "Accès Superviseur (Tous les enseignants)" : "Espace personnel cloisonné"}
          </Badge>
        </div>
      </div>

      {/* ================= CONTENU DE L'ONGLET 1 : DEVOIRS ================= */}
      {activeMainTab === "devoirs" && (
        <div className="space-y-4">
          {/* Sous-filtres cycle de vie */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
              {[
                { key: "all", label: "Tous" },
                { key: "publie", label: "Publiés" },
                { key: "brouillon", label: "Brouillons" },
                { key: "a_corriger", label: "À corriger" },
                { key: "archive", label: "Archivés" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setAssignmentSubFilter(f.key as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    assignmentSubFilter === f.key
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer les devoirs..."
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Liste des devoirs */}
          {filteredAssignments.length === 0 ? (
            <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
              <Empty
                icon={<ClipboardCheck size={48} className="text-slate-600 mx-auto mb-3" />}
                title="Aucun devoir dans cette section"
                sub="Créez un nouveau devoir avec barème, date limite et consignes pour vos apprenants."
              />
              <div className="mt-4">
                <Btn onClick={handleCreateAssignment}>+ Créer un devoir</Btn>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAssignments.map((a) => {
                const deadline = getDeadlineInfo(a);
                const subCount = mySubmissions.filter((s) => s.assignmentId === a.id).length;
                const unscoredCount = mySubmissions.filter(
                  (s) => s.assignmentId === a.id && s.note === undefined
                ).length;

                return (
                  <Card key={a.id} className="p-5 flex flex-col justify-between bg-slate-900/60 border-slate-800">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge color={a.statut === "publie" ? "green" : a.statut === "archive" ? "gray" : "gold"}>
                          {a.statut === "publie" ? "Publié" : a.statut === "archive" ? "Archivé" : "Brouillon"}
                        </Badge>
                        <Badge color={deadline.badgeColor}>{deadline.formattedRemaining}</Badge>
                      </div>

                      <h3 className="mt-3 font-bold text-white text-base line-clamp-1">{a.titre}</h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">{a.consignes || "Aucune consigne rédigée."}</p>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-3">
                        <div>
                          <span className="text-slate-500">Barème :</span>
                          <p className="font-semibold text-white">{a.bareme} pts</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Échéance :</span>
                          <p className="font-semibold text-white">
                            {a.dateLimite ? new Date(`${a.dateLimite}T${a.heureLimite || "23:59"}:00`).toLocaleDateString("fr-FR") : "Non définie"}
                          </p>
                        </div>
                      </div>

                      {/* Statut des copies */}
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-950/60 p-2 text-xs">
                        <span className="text-slate-400">Copies reçues :</span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-white">{subCount}</span>
                          {unscoredCount > 0 && (
                            <span className="text-amber-400 text-[11px]">({unscoredCount} à noter)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                      <Btn
                        size="sm"
                        variant="outline"
                        onClick={() => handleJumpToSubmissions(a.id)}
                        className="gap-2 border-cyan-500/50 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 font-semibold shadow-sm transition"
                      >
                        <Inbox size={14} className="text-cyan-400" />
                        <span>Consulter les remises</span>
                        <ArrowRight size={13} />
                      </Btn>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewingAssignment(a)}
                          title="Aperçu"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssignment(a);
                            setIsEditorOpen(true);
                          }}
                          title="Modifier"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAssignment(a)}
                          title="Supprimer ce devoir (Onglet 1)"
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENU DE L'ONGLET 2 : ÉVALUATIONS / TESTS ================= */}
      {activeMainTab === "tests" && (
        <div className="space-y-4">
          {/* Sous-filtres cycle de vie */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
              {[
                { key: "all", label: "Tous" },
                { key: "publie", label: "Publiés" },
                { key: "brouillon", label: "Brouillons" },
                { key: "termine", label: "Terminés" },
                { key: "archive", label: "Archivés" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTestSubFilter(f.key as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    testSubFilter === f.key
                      ? "bg-purple-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer les évaluations..."
                className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Liste des évaluations */}
          {filteredAssessments.length === 0 ? (
            <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
              <Empty
                icon={<TestTube2 size={48} className="text-slate-600 mx-auto mb-3" />}
                title="Aucune évaluation dans cette section"
                sub="Créez des questionnaires QCM, questions ouvertes ou importez des sujets d'examen."
              />
              <div className="mt-4 flex justify-center gap-2">
                <Btn onClick={handleCreateAssessment}>+ Créer une évaluation</Btn>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAssessments.map((t) => {
                const resCount = myResults.filter((r) => r.testId === t.id).length;

                return (
                  <Card key={t.id} className="p-5 flex flex-col justify-between bg-slate-900/60 border-slate-800">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge color={t.statut === "publie" ? "green" : t.statut === "archive" ? "gray" : "gold"}>
                          {t.statut === "publie" ? "Publié" : t.statut === "archive" ? "Archivé" : "Brouillon"}
                        </Badge>
                        <Badge color="purple">{t.duree} min</Badge>
                      </div>

                      <h3 className="mt-3 font-bold text-white text-base line-clamp-1">{t.titre}</h3>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {t.questions.length} questions • Barème : {t.bareme} pts • Seuil : {t.seuilReussite} pts
                      </p>

                      <div className="mt-4 rounded-lg bg-slate-950/60 p-2 text-xs flex items-center justify-between">
                        <span className="text-slate-400">Examens passés :</span>
                        <span className="font-bold text-white">{resCount} copie(s)</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                      <Btn
                        size="sm"
                        variant="outline"
                        onClick={() => handleJumpToSubmissions(t.id)}
                        className="gap-2 border-purple-500/50 bg-purple-950/20 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 font-semibold shadow-sm transition"
                      >
                        <Award size={14} className="text-purple-400" />
                        <span>Voir les résultats</span>
                        <ArrowRight size={13} />
                      </Btn>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewingAssessment(t)}
                          title="Aperçu"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssessment(t);
                            setIsTestEditorOpen(true);
                          }}
                          title="Modifier"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAssessment(t)}
                          title="Supprimer cette évaluation (Onglet 2)"
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENU DE L'ONGLET 3 : REMISES & RÉSULTATS ================= */}
      {activeMainTab === "remises" && (
        <UnifiedSubmissionsInbox
          assignments={myAssignments}
          assessments={myAssessments}
          submissions={mySubmissions}
          results={myResults}
          preselectedParentId={selectedParentIdForRemises}
          onRefresh={loadData}
          onNavigateToTab={(tab) => setActiveMainTab(tab)}
        />
      )}

      {/* MODALES DEVOIRS */}
      {editingAssignment && (
        <AssignmentEditorModal
          open={isEditorOpen}
          assignment={editingAssignment}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingAssignment(null);
          }}
          onSaved={(saved) => {
            handleSaveAssignment(saved);
            setIsEditorOpen(false);
            setEditingAssignment(null);
          }}
          onPreview={(a) => setPreviewingAssignment(a)}
        />
      )}

      {previewingAssignment && (
        <AssignmentPreviewModal
          open={!!previewingAssignment}
          assignment={previewingAssignment}
          onClose={() => setPreviewingAssignment(null)}
        />
      )}

      {/* APERÇU ÉVALUATION */}
      {previewingAssessment && (
        <TestPreviewModal
          open={!!previewingAssessment}
          assessment={previewingAssessment}
          onClose={() => setPreviewingAssessment(null)}
        />
      )}

      {/* GÉNÉRATEUR IA */}
      {isGeneratorOpen && (
        <AssessmentGeneratorModal
          open={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          allowedModules={db.modules.map((m) => ({ id: m.id, titre: m.titre }))}
          currentTeacherId={currentTeacherId}
          onAssessmentGenerated={(generatedData) => {
            setIsGeneratorOpen(false);
            const newT: Assessment = {
              id: `TEST-${Date.now().toString(36)}`,
              titre: generatedData.titre || `Évaluation Générée IA (${new Date().toLocaleDateString("fr-FR")})`,
              moduleId: generatedData.moduleId || db.modules[0]?.id || "",
              teacherId: currentTeacherId,
              questions: generatedData.questions || [],
              date: new Date().toISOString().slice(0, 10),
              duree: generatedData.duree || 45,
              bareme: generatedData.bareme || 20,
              seuilReussite: generatedData.seuilReussite || 10,
              difficulte: generatedData.difficulte || "moyen",
              tentatives: 1,
              afficherCorrections: true,
              validationRequise: false,
              statut: "brouillon",
              audience: "all",
              modeSecurise: true,
              bloquerCopierColler: true,
              bloquerClicDroit: true,
              navigationLibre: true,
              createdAt: new Date().toISOString(),
            };
            setEditingAssessment(newT);
            setIsTestEditorOpen(true);
          }}
        />
      )}

      {/* IMPORTEUR DE DOCUMENT */}
      {isDocImporterOpen && (
        <DocumentImporterModal
          open={isDocImporterOpen}
          onClose={() => setIsDocImporterOpen(false)}
          allowedModules={db.modules.map((m) => ({ id: m.id, titre: m.titre }))}
          testsList={myAssessments.map((t) => ({ id: t.id, titre: t.titre }))}
        />
      )}

      {/* MODAL DE CONFIRMATION DE SUPPRESSION DEVOIR (ONGLET 1) */}
      {deletingAssignment && (
        <Modal
          open={!!deletingAssignment}
          onClose={() => setDeletingAssignment(null)}
          title="Supprimer ce devoir"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-white">Attention : suppression définitive</p>
                <p className="mt-1 text-slate-300">
                  Êtes-vous sûr de vouloir supprimer le devoir <strong>« {deletingAssignment.titre} »</strong> ?
                  Toutes les remises et copies rendues par les apprenants pour ce devoir seront également supprimées.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn
                type="button"
                variant="outline"
                onClick={() => setDeletingAssignment(null)}
                disabled={isDeleting}
              >
                Annuler
              </Btn>
              <Btn
                type="button"
                className="bg-red-600 hover:bg-red-500 text-white gap-2 font-semibold"
                onClick={handleDeleteAssignmentConfirm}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? "Suppression en cours..." : "Confirmer la suppression"}</span>
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL DE CONFIRMATION DE SUPPRESSION ÉVALUATION (ONGLET 2) */}
      {deletingAssessment && (
        <Modal
          open={!!deletingAssessment}
          onClose={() => setDeletingAssessment(null)}
          title="Supprimer cette évaluation"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-white">Attention : suppression définitive</p>
                <p className="mt-1 text-slate-300">
                  Êtes-vous sûr de vouloir supprimer l'évaluation <strong>« {deletingAssessment.titre} »</strong> ?
                  Les questions, barèmes et tous les résultats d'examen associés seront définitivement effacés.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn
                type="button"
                variant="outline"
                onClick={() => setDeletingAssessment(null)}
                disabled={isDeleting}
              >
                Annuler
              </Btn>
              <Btn
                type="button"
                className="bg-red-600 hover:bg-red-500 text-white gap-2 font-semibold"
                onClick={handleDeleteAssessmentConfirm}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                <span>{isDeleting ? "Suppression en cours..." : "Confirmer la suppression"}</span>
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
