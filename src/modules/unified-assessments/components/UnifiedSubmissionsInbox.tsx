import React, { useState, useMemo } from "react";
import {
  ClipboardCheck, TestTube2, Download, CheckCircle2, Clock,
  AlertTriangle, Search, Filter, PenLine, User, Calendar,
  Check, FileText, Award, Eye, ShieldAlert, ArrowUpDown, ChevronRight,
  TrendingUp, RefreshCw, Trash2
} from "lucide-react";
import { Assignment, AssignmentSubmission } from "@/modules/assignments/types";
import { Assessment, AssessmentQuestion, AssessmentResultSummary } from "@/modules/assessments/types";
import { gradeAssignmentSubmission, deleteSubmission } from "@/modules/assignments/services/assignmentService";
import { deleteTestResult } from "@/modules/assessments/services/assessmentService";
import { notifyAssessmentEvent, broadcastSubmissionsChange } from "../services/unifiedSyncService";
import { Btn, Badge, Card, Empty, Field, Input, Modal, Select, Textarea } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { humanSize, fileKind } from "@/lib/files";
import { exportCsv } from "@/lib/export";

export interface UnifiedSubmissionItem {
  id: string;
  sourceType: "devoir" | "evaluation";
  parentId: string; // assignmentId ou testId
  parentTitle: string;
  moduleId: string;
  studentId: string;
  studentNom: string;
  studentPrenom: string;
  studentMatricule?: string;
  dateRemise: string;
  heureRemise?: string;
  estEnRetard: boolean;
  statut: "a_corriger" | "corrige" | "en_retard" | "en_cours";
  note?: number;
  bareme: number;
  pourcentage?: number;
  // Spécifique devoirs
  devoirSubmission?: AssignmentSubmission;
  devoirAssignment?: Assignment;
  // Spécifique évaluations
  evaluationResult?: AssessmentResultSummary;
  evaluationAssessment?: Assessment;
}

interface UnifiedSubmissionsInboxProps {
  assignments: Assignment[];
  assessments: Assessment[];
  submissions: AssignmentSubmission[];
  results: AssessmentResultSummary[];
  preselectedParentId?: string;
  onRefresh?: () => void;
  onNavigateToTab?: (tab: "devoirs" | "tests") => void;
}

export function UnifiedSubmissionsInbox({
  assignments,
  assessments,
  submissions,
  results,
  preselectedParentId,
  onRefresh,
  onNavigateToTab,
}: UnifiedSubmissionsInboxProps) {
  const { db, user, update, log, notify } = useStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "devoir" | "evaluation">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "to_grade" | "graded" | "late">("all");
  const [selectedParentId, setSelectedParentId] = useState<string>(preselectedParentId || "all");

  // Modal de suppression (Onglet 3)
  const [deletingItem, setDeletingItem] = useState<UnifiedSubmissionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      if (deletingItem.sourceType === "devoir" && deletingItem.devoirSubmission) {
        const res = await deleteSubmission(deletingItem.devoirSubmission.id);
        if (!res.success) throw new Error(res.error || "Impossible de supprimer la remise.");
        toastMsg.success("Remise supprimée", `La remise de ${deletingItem.studentNom} a été supprimée.`);
      } else if (deletingItem.sourceType === "evaluation" && deletingItem.evaluationResult) {
        const res = await deleteTestResult(deletingItem.evaluationResult.id);
        if (!res.success) throw new Error(res.error || "Impossible de supprimer le résultat.");
        update((d) => ({
          ...d,
          results: d.results.filter((r) => r.id !== deletingItem.evaluationResult?.id),
        }));
        toastMsg.success("Résultat supprimé", `Le résultat de ${deletingItem.studentNom} a été supprimé.`);
      }

      broadcastSubmissionsChange();
      setDeletingItem(null);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toastMsg.error("Erreur de suppression", e.message || "Échec de l'opération.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Modal de notation devoir
  const [gradingSubmission, setGradingSubmission] = useState<{
    submission: AssignmentSubmission;
    assignment: Assignment;
  } | null>(null);
  const [noteVal, setNoteVal] = useState("");
  const [appreciationVal, setAppreciationVal] = useState("");
  const [pointsFortsVal, setPointsFortsVal] = useState("");
  const [pointsAmeliorationVal, setPointsAmeliorationVal] = useState("");
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

  // Modal de consultation évaluation (QCM / Test)
  const [viewingTestResult, setViewingTestResult] = useState<{
    result: AssessmentResultSummary;
    assessment: Assessment;
  } | null>(null);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});
  const [manualComments, setManualComments] = useState<Record<string, string>>({});

  // 1. Fusionner les remises de devoirs et résultats d'évaluations dans un tableau unifié
  const unifiedItems = useMemo<UnifiedSubmissionItem[]>(() => {
    const list: UnifiedSubmissionItem[] = [];

    // Remises de devoirs
    for (const sub of submissions) {
      const parentAssignment = assignments.find((a) => a.id === sub.assignmentId);
      const student = db.students.find((s) => s.id === sub.studentId);
      const parentTitle = parentAssignment?.titre || "Devoir sans titre";
      const bareme = parentAssignment?.bareme || 20;

      const isGraded = sub.statut === "corrige" || sub.statut === "retourne";
      const isLate = sub.statut === "en_retard" || Boolean((sub as any).latePenaltyApplied);

      list.push({
        id: `sub-${sub.id}`,
        sourceType: "devoir",
        parentId: sub.assignmentId,
        parentTitle,
        moduleId: parentAssignment?.moduleId || "",
        studentId: sub.studentId,
        studentNom: student?.nom || sub.studentId,
        studentPrenom: student?.prenom || "",
        studentMatricule: (student as any)?.matricule || student?.id,
        dateRemise: (sub.dateRemise || (sub as any).submittedAt || sub.createdAt || new Date().toISOString()).slice(0, 10),
        heureRemise: (sub as any).heureRemise || ((sub.dateRemise || (sub as any).submittedAt || sub.createdAt || "").length >= 16 ? (sub.dateRemise || (sub as any).submittedAt || sub.createdAt || "").slice(11, 16) : undefined),
        estEnRetard: !!isLate,
        statut: isGraded ? "corrige" : isLate ? "en_retard" : "a_corriger",
        note: sub.note,
        bareme,
        pourcentage: sub.note !== undefined ? Math.round((sub.note / bareme) * 100) : undefined,
        devoirSubmission: sub,
        devoirAssignment: parentAssignment,
      });
    }

    // Résultats d'évaluations / tests
    for (const res of results) {
      const parentAssessment = assessments.find((a) => a.id === res.testId);
      const student = db.students.find((s) => s.id === res.studentId);
      const parentTitle = parentAssessment?.titre || "Test sans titre";
      const bareme = res.bareme || parentAssessment?.bareme || 20;

      list.push({
        id: `res-${res.id}`,
        sourceType: "evaluation",
        parentId: res.testId,
        parentTitle,
        moduleId: parentAssessment?.moduleId || "",
        studentId: res.studentId,
        studentNom: res.studentNom || student?.nom || res.studentId,
        studentPrenom: res.studentPrenom || student?.prenom || "",
        studentMatricule: (student as any)?.matricule || student?.id,
        dateRemise: res.date,
        heureRemise: res.heure,
        estEnRetard: false,
        statut: "corrige",
        note: res.note,
        bareme,
        pourcentage: res.pourcentage !== undefined ? res.pourcentage : Math.round((res.note / bareme) * 100),
        evaluationResult: res,
        evaluationAssessment: parentAssessment,
      });
    }

    // Trier chronologiquement (plus récentes en tête)
    return list.sort((a, b) => new Date(b.dateRemise).getTime() - new Date(a.dateRemise).getTime());
  }, [submissions, results, assignments, assessments, db.students]);

  // 2. KPIs consolidés
  const totalCount = unifiedItems.length;
  const toGradeCount = unifiedItems.filter((i) => i.statut === "a_corriger" || i.statut === "en_retard").length;
  const gradedCount = unifiedItems.filter((i) => i.statut === "corrige").length;
  const lateCount = unifiedItems.filter((i) => i.estEnRetard).length;
  const avgScore = useMemo(() => {
    const scored = unifiedItems.filter((i) => i.note !== undefined && i.bareme > 0);
    if (!scored.length) return "—";
    const totalNormalized = scored.reduce((acc, i) => acc + ((i.note! / i.bareme) * 20), 0);
    return (totalNormalized / scored.length).toFixed(1) + " / 20";
  }, [unifiedItems]);

  // 3. Filtrage interactif
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // Filtre source (devoir vs evaluation)
      if (filterType !== "all" && item.sourceType !== filterType) return false;

      // Filtre statut
      if (filterStatus === "to_grade" && item.statut !== "a_corriger" && item.statut !== "en_retard") return false;
      if (filterStatus === "graded" && item.statut !== "corrige") return false;
      if (filterStatus === "late" && !item.estEnRetard) return false;

      // Filtre élément parent spécifique
      if (selectedParentId !== "all" && item.parentId !== selectedParentId) return false;

      // Filtre recherche textuelle
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesStudent = `${item.studentPrenom} ${item.studentNom}`.toLowerCase().includes(q);
        const matchesMatricule = item.studentMatricule?.toLowerCase().includes(q);
        const matchesTitle = item.parentTitle.toLowerCase().includes(q);
        if (!matchesStudent && !matchesMatricule && !matchesTitle) return false;
      }

      return true;
    });
  }, [unifiedItems, filterType, filterStatus, selectedParentId, search]);

  // 4. Ouvrir modale de notation de devoir
  const handleOpenGradeModal = (item: UnifiedSubmissionItem) => {
    if (!item.devoirSubmission || !item.devoirAssignment) return;
    setGradingSubmission({
      submission: item.devoirSubmission,
      assignment: item.devoirAssignment,
    });
    setNoteVal(item.devoirSubmission.note !== undefined ? String(item.devoirSubmission.note) : "");
    setAppreciationVal(item.devoirSubmission.appreciation || "");
    setPointsFortsVal(item.devoirSubmission.pointsForts || "");
    setPointsAmeliorationVal(item.devoirSubmission.pointsAmelioration || "");
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission) return;
    const { submission, assignment } = gradingSubmission;
    const num = parseFloat(noteVal.replace(",", "."));

    if (isNaN(num) || num < 0 || num > assignment.bareme) {
      toastMsg.error("Note invalide", `La note doit être comprise entre 0 et ${assignment.bareme} points.`);
      return;
    }

    setIsSubmittingGrade(true);
    try {
      const res = await gradeAssignmentSubmission(
        submission.id,
        num,
        assignment.bareme,
        appreciationVal,
        pointsFortsVal,
        pointsAmeliorationVal,
        true
      );

      if (res.success) {
        toastMsg.success("Note enregistrée ✓", `La note de ${num}/${assignment.bareme} a été validée et enregistrée dans le bulletin.`);
        setGradingSubmission(null);

        // Notifier l'apprenant concerné
        const studentObj = db.students.find((s) => s.id === submission.studentId);
        const targetUserId = studentObj?.userId || submission.studentId;
        if (targetUserId) {
          notifyAssessmentEvent({
            targetUserId,
            title: "Devoir noté",
            body: `Votre copie pour « ${assignment.titre} » a été notée : ${num}/${assignment.bareme} pts.${appreciationVal ? ` Remarque : « ${appreciationVal} »` : ""}`,
            type: "note",
            url: "/app/mes-evaluations-devoirs",
            storeNotify: notify,
          });
        }
        broadcastSubmissionsChange();

        if (onRefresh) onRefresh();
      } else {
        toastMsg.error("Erreur", res.error || "Impossible d'enregistrer la note.");
      }
    } catch (err: any) {
      toastMsg.error("Erreur", err.message || "Erreur de connexion.");
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  // 5. Export CSV consolidé
  const handleExportCsv = () => {
    const data = filteredItems.map((i) => ({
      Type: i.sourceType === "devoir" ? "Devoir" : "Évaluation / Test",
      Titre: i.parentTitle,
      Apprenant: `${i.studentNom} ${i.studentPrenom}`,
      Matricule: i.studentMatricule || "—",
      Date_Remise: i.dateRemise,
      Heure_Remise: i.heureRemise || "—",
      Ponctualite: i.estEnRetard ? "En retard" : "À l'heure",
      Note: i.note !== undefined ? `${i.note} / ${i.bareme}` : "En attente",
      Pourcentage: i.pourcentage !== undefined ? `${i.pourcentage}%` : "—",
      Statut: i.statut === "corrige" ? "Corrigé" : "À corriger",
    }));

    exportCsv(`remises-et-resultats-${new Date().toISOString().slice(0, 10)}`, data);
    toastMsg.success("Export CSV téléchargé ✓");
  };

  return (
    <div className="space-y-6">
      {/* KPIs Consolidés */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="p-4 bg-slate-900/60 border-cyan-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Remises</span>
            <ClipboardCheck size={18} className="text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{totalCount}</p>
          <span className="text-xs text-slate-400">Devoirs et examens</span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">À Corriger</span>
            <Clock size={18} className="text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-300">{toGradeCount}</p>
          <span className="text-xs text-slate-400">Copies en attente</span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Corrigées</span>
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{gradedCount}</p>
          <span className="text-xs text-slate-400">Notes validées</span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">En retard</span>
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-300">{lateCount}</p>
          <span className="text-xs text-slate-400">Délai dépassé</span>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Moyenne</span>
            <TrendingUp size={18} className="text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-300">{avgScore}</p>
          <span className="text-xs text-slate-400">Sur base de 20 pts</span>
        </Card>
      </div>

      {/* Barre de Filtres et Outils */}
      <Card className="p-4 bg-slate-900/80 border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par apprenant, matricule ou titre..."
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/60 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Filtre Type (Pill buttons) */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              onClick={() => setFilterType("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filterType === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Tous ({unifiedItems.length})
            </button>
            <button
              onClick={() => setFilterType("devoir")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filterType === "devoir" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <ClipboardCheck size={14} />
              Devoirs ({unifiedItems.filter((i) => i.sourceType === "devoir").length})
            </button>
            <button
              onClick={() => setFilterType("evaluation")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filterType === "evaluation" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              <TestTube2 size={14} />
              Évaluations ({unifiedItems.filter((i) => i.sourceType === "evaluation").length})
            </button>
          </div>

          {/* Filtre Statut */}
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="to_grade">À corriger / En attente</option>
              <option value="graded">Corrigés & Notés</option>
              <option value="late">En retard</option>
            </select>

            {/* Sélecteur de devoir/évaluation parent */}
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="max-w-[200px] truncate rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tous les devoirs & tests</option>
              <optgroup label="📋 Devoirs">
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titre}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🎯 Évaluations">
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titre}
                  </option>
                ))}
              </optgroup>
            </select>

            <Btn variant="outline" onClick={handleExportCsv} className="shrink-0 text-xs py-1 px-2.5">
              <Download size={14} /> Export CSV
            </Btn>
          </div>
        </div>
      </Card>

      {/* Liste des Remises & Copies */}
      {filteredItems.length === 0 ? (
        <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
          <Empty
            icon={<ClipboardCheck size={48} className="text-slate-600 mx-auto mb-3" />}
            title="Aucune remise trouvée"
            sub="Les remises de devoirs et les résultats d'évaluations passées s'afficheront ici en temps réel."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isDevoir = item.sourceType === "devoir";

            return (
              <Card
                key={item.id}
                className="p-4 transition hover:border-slate-700 bg-slate-900/60 border-slate-800"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Info Apprenant & Source */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        isDevoir
                          ? "border-cyan-500/30 bg-cyan-950/30 text-cyan-400"
                          : "border-purple-500/30 bg-purple-950/30 text-purple-400"
                      }`}
                    >
                      {isDevoir ? <ClipboardCheck size={20} /> : <TestTube2 size={20} />}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">
                          {item.studentNom} {item.studentPrenom}
                        </span>
                        {item.studentMatricule && (
                          <span className="text-xs text-slate-400 font-mono">({item.studentMatricule})</span>
                        )}
                        <Badge color={isDevoir ? "cyan" : "blue"}>
                          {isDevoir ? "Devoir" : "Évaluation"}
                        </Badge>
                        {item.estEnRetard ? (
                          <Badge color="red">En retard</Badge>
                        ) : (
                          <Badge color="green">À l'heure</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-medium text-slate-300">
                        {item.parentTitle}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-500" />
                          Remis le {item.dateRemise} {item.heureRemise ? `à ${item.heureRemise}` : ""}
                        </span>
                        {isDevoir && item.devoirSubmission?.files && (
                          <span className="flex items-center gap-1 text-cyan-400">
                            <FileText size={13} />
                            {item.devoirSubmission.files.length} fichier(s) joint(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note & Action */}
                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    {/* Score Box */}
                    <div className="text-right">
                      {item.note !== undefined ? (
                        <div>
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-lg font-bold text-white">{item.note}</span>
                            <span className="text-xs text-slate-400">/ {item.bareme}</span>
                          </div>
                          {item.pourcentage !== undefined && (
                            <span
                              className={`text-xs font-semibold ${
                                item.pourcentage >= 50 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {item.pourcentage}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge color="gold">À corriger</Badge>
                      )}
                    </div>

                    {/* Bouton d'action */}
                    {isDevoir ? (
                      <Btn
                        variant={item.note !== undefined ? "outline" : "primary"}
                        onClick={() => handleOpenGradeModal(item)}
                        className="gap-1.5 text-xs py-1 px-2.5"
                      >
                        <PenLine size={14} />
                        {item.note !== undefined ? "Modifier note" : "Noter la copie"}
                      </Btn>
                    ) : (
                      <Btn
                        variant="outline"
                        onClick={() => {
                          if (item.evaluationResult && item.evaluationAssessment) {
                            setViewingTestResult({
                              result: item.evaluationResult,
                              assessment: item.evaluationAssessment,
                            });
                          }
                        }}
                        className="gap-1.5 text-xs py-1 px-2.5 text-purple-300 hover:text-white"
                      >
                        <Eye size={14} />
                        Voir la copie
                      </Btn>
                    )}

                    {/* Bouton Supprimer (Onglet 3) */}
                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      title="Supprimer cette copie / ce résultat"
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

      {/* MODAL 1 : NOTATION D'UN DEVOIR */}
      {gradingSubmission && (
        <Modal
          open={!!gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          title={`Notation : ${gradingSubmission.assignment.titre}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <p className="font-semibold text-white">
                Apprenant : {gradingSubmission.submission.studentId}
              </p>
              <p className="text-xs text-slate-400">
                Remis le : {new Date((gradingSubmission.submission as any).submittedAt || (gradingSubmission.submission as any).dateRemise || gradingSubmission.submission.createdAt).toLocaleString("fr-FR")}
                {gradingSubmission.submission.statut === "en_retard" && (
                  <span className="ml-2 font-semibold text-rose-400">(Remise en retard)</span>
                )}
              </p>
              {(gradingSubmission.submission as any).comment && (
                <p className="mt-2 text-xs italic text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  « {(gradingSubmission.submission as any).comment} »
                </p>
              )}
            </div>

            {/* Fichiers déposés par l'étudiant */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Fichiers remis par l'apprenant :</label>
              {gradingSubmission.submission.files && gradingSubmission.submission.files.length > 0 ? (
                <div className="mt-1 space-y-1.5">
                  {gradingSubmission.submission.files.map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-xs"
                    >
                      <span className="truncate font-medium text-white max-w-[220px]">{f.fileName || f.name}</span>
                      <a
                        href={f.fileUrl || f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-1 text-cyan-300 hover:bg-cyan-500/30"
                      >
                        <Download size={12} /> Télécharger ({humanSize(f.fileSize || f.size || 0)})
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">Aucun fichier joint à cette copie.</p>
              )}
            </div>

            {/* Saisie Note et Barème */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Note (sur ${gradingSubmission.assignment.bareme} pts) *`}>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max={gradingSubmission.assignment.bareme}
                  value={noteVal}
                  onChange={(e) => setNoteVal(e.target.value)}
                  placeholder={`Ex: 16`}
                  className="font-bold text-cyan-300 text-lg"
                />
              </Field>
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 flex flex-col justify-center">
                <span className="text-xs text-slate-400">Barème officiel :</span>
                <span className="text-lg font-bold text-white">{gradingSubmission.assignment.bareme} points</span>
              </div>
            </div>

            <Field label="Appréciation globale (affichée à l'apprenant)">
              <Textarea
                rows={3}
                value={appreciationVal}
                onChange={(e) => setAppreciationVal(e.target.value)}
                placeholder="Excellente analyse, code propre et bien structuré..."
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Points forts">
                <Input
                  value={pointsFortsVal}
                  onChange={(e) => setPointsFortsVal(e.target.value)}
                  placeholder="Ex: Rigueur, syntaxe..."
                />
              </Field>
              <Field label="Axes d'amélioration">
                <Input
                  value={pointsAmeliorationVal}
                  onChange={(e) => setPointsAmeliorationVal(e.target.value)}
                  placeholder="Ex: Gestion des erreurs..."
                />
              </Field>
            </div>

            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Btn variant="outline" onClick={() => setGradingSubmission(null)}>
                Annuler
              </Btn>
              <Btn onClick={handleSaveGrade} disabled={isSubmittingGrade}>
                {isSubmittingGrade ? "Validation..." : "Valider et enregistrer au bulletin"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2 : CONSULTATION COPIE ÉVALUATION (QCM / TEST) */}
      {viewingTestResult && (
        <Modal
          open={!!viewingTestResult}
          onClose={() => setViewingTestResult(null)}
          title={`Copie d'examen : ${viewingTestResult.assessment.titre}`}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <div>
                <span className="text-slate-400">Apprenant :</span>
                <p className="font-semibold text-white">{viewingTestResult.result.studentNom || viewingTestResult.result.studentId}</p>
              </div>
              <div>
                <span className="text-slate-400">Note obtenue :</span>
                <p className="font-bold text-cyan-400 text-sm">{viewingTestResult.result.note} / {viewingTestResult.result.bareme}</p>
              </div>
              <div>
                <span className="text-slate-400">Date & heure :</span>
                <p className="text-white">{viewingTestResult.result.date} {viewingTestResult.result.heure || ""}</p>
              </div>
              <div>
                <span className="text-slate-400">Statut :</span>
                <Badge color={viewingTestResult.result.statut === "reussi" ? "green" : "red"}>
                  {viewingTestResult.result.statut === "reussi" ? "Réussi" : "Échoué"}
                </Badge>
              </div>
            </div>

            {/* Questions et réponses données */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Détail des questions ({viewingTestResult.assessment.questions.length})
              </h4>

              {viewingTestResult.assessment.questions.map((q, idx) => {
                const repDonnee = viewingTestResult.result.reponses
                  ? viewingTestResult.result.reponses[q.id]
                  : undefined;
                const isCorrect = repDonnee === q.bonneReponse;

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white">
                        {idx + 1}. {q.question}
                      </span>
                      <span className="text-slate-400 font-mono">({q.points} pt{q.points > 1 ? "s" : ""})</span>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Réponse de l'apprenant :</span>
                        <span className={`font-semibold ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                          {repDonnee !== undefined ? String(repDonnee) : "Non répondu"}
                        </span>
                      </div>
                      {q.bonneReponse && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>Bonne réponse :</span>
                          <span className="text-slate-300 font-medium">{q.bonneReponse}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <Btn variant="outline" onClick={() => setViewingTestResult(null)}>
                Fermer
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3 : CONFIRMATION DE SUPPRESSION (Onglet 3) */}
      {deletingItem && (
        <Modal
          open={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          title="Confirmer la suppression"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={24} className="shrink-0 text-red-400" />
              <div>
                <p className="font-semibold text-white">Cette action est irréversible.</p>
                <p className="text-xs text-red-300">
                  Voulez-vous vraiment supprimer la copie / le résultat de{" "}
                  <strong>
                    {deletingItem.studentPrenom} {deletingItem.studentNom}
                  </strong>{" "}
                  pour « {deletingItem.parentTitle} » ?
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="outline" onClick={() => setDeletingItem(null)}>
                Annuler
              </Btn>
              <Btn
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-500 text-white gap-1.5"
              >
                <Trash2 size={14} />
                {isDeleting ? "Suppression..." : "Supprimer définitivement"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
