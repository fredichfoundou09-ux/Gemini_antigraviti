import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck, TestTube2, Inbox, Calendar, Clock, Download,
  CheckCircle2, AlertTriangle, FileText, Send, Award, ArrowRight,
  ShieldAlert, BookOpen
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { PageHead, Btn, Card, Badge, Empty } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

// Devoirs
import { Assignment, AssignmentSubmission } from "@/modules/assignments/types";
import {
  getDeadlineInfo,
  getLocalAssignments,
  getLocalSubmissions
} from "@/modules/assignments/services/assignmentService";
import { StudentAssignmentModal } from "@/modules/assignments/components/StudentAssignmentModal";

// Évaluations
import { Assessment, AssessmentResultSummary, AssessmentStatus } from "@/modules/assessments/types";
import { AssessmentRunner } from "@/modules/assessments/components/AssessmentRunner";

// Règles de visibilité apprenant
import { assignmentsFor, assessmentsFor } from "@/lib/access";

// Synchronisation temps réel
import { subscribeToAssessmentsSync } from "../services/unifiedSyncService";

/** Convertit db.tests vers Assessment[] */
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
    statut: (t.statut as AssessmentStatus) || "publie",
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

interface Props {
  defaultTab?: "devoirs" | "tests" | "mes_remises";
}

export function UnifiedStudentAssessmentsAssignmentsPage({ defaultTab = "devoirs" }: Props) {
  const { db, user } = useStore();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<"devoirs" | "tests" | "mes_remises">(defaultTab);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<AssessmentResultSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal de remise de devoir
  const [activeAssignmentToSubmit, setActiveAssignmentToSubmit] = useState<Assignment | null>(null);

  // Runner d'examen
  const [runningAssessment, setRunningAssessment] = useState<Assessment | null>(null);

  // Trouver l'étudiant connecté
  const student = useMemo(() => {
    return (
      db.students.find(
        (s) =>
          s.userId === user?.id ||
          (user?.linkedId && s.id === user.linkedId) ||
          s.id === user?.id ||
          (user?.email && s.email && s.email.toLowerCase().trim() === user.email.toLowerCase().trim())
      ) ||
      (user?.role === "student"
        ? ({
            id: user.id,
            nom: user.name || "Apprenant",
            prenom: "",
            email: user.email || "",
            userId: user.id,
          } as any)
        : null)
    );
  }, [db.students, user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Devoirs
      if (isSupabaseConfigured) {
        const { data: aData } = await supabase
          .from("assignments")
          .select("*, attachments:assignment_attachments(*)")
          .in("statut", ["publie", "ouvert"]);

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
          setAssignments(mappedA);
        } else {
          setAssignments(getLocalAssignments());
        }

        // Remises de cet étudiant
        if (student) {
          const { data: sData } = await supabase
            .from("assignment_submissions")
            .select("*, files:assignment_submission_files(*)")
            .eq("student_id", student.id);

          if (sData) {
            const mappedSubs: AssignmentSubmission[] = sData.map((row: any) => ({
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
            setSubmissions(mappedSubs);
          } else {
            setSubmissions(getLocalSubmissions().filter((s) => s.studentId === student.id));
          }
        }
      } else {
        setAssignments(getLocalAssignments());
        setSubmissions(student ? getLocalSubmissions().filter((s) => s.studentId === student.id) : []);
      }

      // 2. Évaluations
      setAssessments(mapDbTestsToAssessments(db.tests));
      setResults(student ? (db.results.filter((r) => r.studentId === student.id) as any) : []);
    } catch (err) {
      console.error("Erreur de chargement données apprenant:", err);
      setAssignments(getLocalAssignments());
      setSubmissions(student ? getLocalSubmissions().filter((s) => s.studentId === student.id) : []);
      setAssessments(mapDbTestsToAssessments(db.tests));
      setResults(student ? (db.results.filter((r) => r.studentId === student.id) as any) : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const sub = subscribeToAssessmentsSync(() => {
      loadData();
    });
    return () => {
      sub?.unsubscribe?.();
    };
  }, [user, student]);

  // Filtrer les devoirs et tests accessibles à cet apprenant
  const myAssignments = useMemo(() => {
    return assignmentsFor(db, user, assignments);
  }, [db, user, assignments]);

  const myAssessments = useMemo(() => {
    return assessmentsFor(db, user, assessments);
  }, [db, user, assessments]);

  // Devoirs restants à rendre
  const pendingAssignments = useMemo(() => {
    const submittedIds = new Set(submissions.map((s) => s.assignmentId));
    return myAssignments.filter((a) => !submittedIds.has(a.id));
  }, [myAssignments, submissions]);

  // Tests restants à passer
  const pendingAssessments = useMemo(() => {
    const passedTestIds = new Set(results.map((r) => r.testId));
    return myAssessments.filter((t) => !passedTestIds.has(t.id));
  }, [myAssessments, results]);

  return (
    <div className="space-y-6">
      <PageHead
        title="Devoirs & Évaluations"
        subtitle="Consultez vos travaux à rendre, passez vos examens et suivez vos résultats"
      />

      {/* Navigation entre les 3 onglets */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("devoirs")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "devoirs"
              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/50"
          }`}
        >
          <ClipboardCheck size={18} />
          <span>Devoirs à rendre</span>
          {pendingAssignments.length > 0 && (
            <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs text-slate-950 font-bold">
              {pendingAssignments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tests")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "tests"
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/50"
          }`}
        >
          <TestTube2 size={18} />
          <span>Évaluations à passer</span>
          {pendingAssessments.length > 0 && (
            <span className="rounded-full bg-purple-500 px-2 py-0.5 text-xs text-white font-bold">
              {pendingAssessments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("mes_remises")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "mes_remises"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900/50"
          }`}
        >
          <Inbox size={18} />
          <span>Mes Remises & Notes</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {submissions.length + results.length}
          </span>
        </button>
      </div>

      {/* ONGLET 1 : DEVOIRS À RENDRE */}
      {activeTab === "devoirs" && (
        <div className="space-y-4">
          {pendingAssignments.length === 0 ? (
            <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
              <Empty
                icon={<CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />}
                title="Vous êtes à jour !"
                sub="Aucun devoir en attente de remise pour le moment."
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingAssignments.map((a) => {
                const deadline = getDeadlineInfo(a);
                return (
                  <Card key={a.id} className="p-5 flex flex-col justify-between bg-slate-900/60 border-slate-800">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge color="cyan">{a.moduleId || "Devoir"}</Badge>
                        <Badge color={deadline.badgeColor}>
                          {deadline.formattedRemaining}
                        </Badge>
                      </div>

                      <h3 className="mt-3 font-bold text-white text-base">{a.titre}</h3>
                      <p className="mt-1 text-xs text-slate-300 line-clamp-3">{a.consignes}</p>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                        <span>Barème : <strong className="text-white">{a.bareme} pts</strong></span>
                        <span>Date limite : <strong className="text-white">{a.dateLimite ? new Date(`${a.dateLimite}T${a.heureLimite || "23:59"}:00`).toLocaleDateString("fr-FR") : "Non définie"}</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                      <Btn
                        onClick={() => setActiveAssignmentToSubmit(a)}
                        className="gap-1.5 w-full sm:w-auto"
                      >
                        <Send size={14} /> Déposer mon travail
                      </Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : ÉVALUATIONS À PASSER */}
      {activeTab === "tests" && (
        <div className="space-y-4">
          {pendingAssessments.length === 0 ? (
            <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
              <Empty
                icon={<CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />}
                title="Aucun examen en attente"
                sub="Vous avez passé toutes les évaluations programmées."
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingAssessments.map((t) => {
                return (
                  <Card key={t.id} className="p-5 flex flex-col justify-between bg-slate-900/60 border-slate-800">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge color="blue">{t.moduleId || "Évaluation"}</Badge>
                        <Badge color="cyan">{t.duree} minutes</Badge>
                      </div>

                      <h3 className="mt-3 font-bold text-white text-base">{t.titre}</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {t.questions.length} questions • Barème : {t.bareme} pts • Seuil : {t.seuilReussite} pts
                      </p>

                      {t.modeSecurise && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
                          <ShieldAlert size={14} />
                          <span>Mode sécurisé actif (anti-triche, perte de focus surveillée)</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                      <Btn
                        onClick={() => setRunningAssessment(t)}
                        className="gap-1.5 w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white"
                      >
                        <TestTube2 size={14} /> Démarrer l'examen
                      </Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 3 : MES REMISES & NOTES CONSOLIDÉES */}
      {activeTab === "mes_remises" && (
        <div className="space-y-4">
          {submissions.length === 0 && results.length === 0 ? (
            <Card className="p-12 text-center bg-slate-900/40 border-slate-800">
              <Empty
                icon={<Inbox size={48} className="text-slate-600 mx-auto mb-3" />}
                title="Historique vide"
                sub="Vos devoirs remis et évaluations passées apparaîtront ici."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Devoirs remis */}
              {submissions.map((sub) => {
                const parent = assignments.find((a) => a.id === sub.assignmentId);
                return (
                  <Card key={sub.id} className="p-4 bg-slate-900/60 border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge color="cyan">Devoir</Badge>
                          <span className="font-semibold text-white">{parent?.titre || "Devoir"}</span>
                          {sub.statut === "en_retard" ? (
                            <Badge color="red">Remis en retard</Badge>
                          ) : (
                            <Badge color="green">Remis à l'heure</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Remis le {new Date((sub as any).submittedAt || (sub as any).dateRemise || sub.createdAt).toLocaleString("fr-FR")}
                        </p>
                        {sub.appreciation && (
                          <p className="mt-2 text-xs italic text-cyan-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            Appréciation enseignant : « {sub.appreciation} »
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        {sub.note !== undefined ? (
                          <div>
                            <span className="text-lg font-bold text-emerald-400">{sub.note}</span>
                            <span className="text-xs text-slate-400"> / {(sub as any).bareme || parent?.bareme || 20} pts</span>
                          </div>
                        ) : (
                          <Badge color="gold">En attente de correction</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {/* Évaluations passées */}
              {results.map((res) => {
                const parent = assessments.find((a) => a.id === res.testId);
                return (
                  <Card key={res.id} className="p-4 bg-slate-900/60 border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge color="blue">Évaluation</Badge>
                          <span className="font-semibold text-white">{parent?.titre || "Examen"}</span>
                          <Badge color={res.statut === "reussi" ? "green" : "red"}>
                            {res.statut === "reussi" ? "Réussi" : "Échoué"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Passé le {res.date} {res.heure ? `à ${res.heure}` : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <div>
                          <span className="text-lg font-bold text-white">{res.note}</span>
                          <span className="text-xs text-slate-400"> / {res.bareme} pts</span>
                        </div>
                        <span className="text-xs font-semibold text-purple-300">{res.pourcentage}%</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Déposer Devoir */}
      {activeAssignmentToSubmit && (
        <StudentAssignmentModal
          open={!!activeAssignmentToSubmit}
          assignment={activeAssignmentToSubmit}
          submission={submissions.find((s) => s.assignmentId === activeAssignmentToSubmit.id) || null}
          onClose={() => setActiveAssignmentToSubmit(null)}
          onSubmitted={() => {
            setActiveAssignmentToSubmit(null);
            loadData();
            setActiveTab("mes_remises");
          }}
        />
      )}

      {/* Modal Runner Examen */}
      {runningAssessment && student && (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4 overflow-y-auto">
          <AssessmentRunner
            rawAssessment={runningAssessment}
            studentId={student.id}
            studentName={`${student.prenom} ${student.nom}`}
            onFinish={() => {
              setRunningAssessment(null);
              loadData();
              setActiveTab("mes_remises");
            }}
            onCancel={() => setRunningAssessment(null)}
          />
        </div>
      )}
    </div>
  );
}
