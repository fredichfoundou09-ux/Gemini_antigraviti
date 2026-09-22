import React, { useState, useEffect } from "react";
import {
  ClipboardCheck, Clock, CheckCircle2, AlertTriangle, FileText,
  Search, Filter, Send, Download, ArrowRight,
} from "lucide-react";
import { Assignment, AssignmentSubmission } from "../types";
import { getDeadlineInfo, getLocalAssignments, getLocalSubmissions } from "../services/assignmentService";
import { StudentAssignmentModal } from "../components/StudentAssignmentModal";
import { Badge, Btn, Card, Empty, Input, PageHead, Select } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export function StudentAssignmentsPage() {
  const { db, user } = useStore();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"all" | "to_do" | "submitted" | "graded">("all");
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("");

  const [activeModalAssignment, setActiveModalAssignment] = useState<Assignment | null>(null);

  const student = db.students.find((s) => s.userId === user?.id);

  // Charger les devoirs auxquels l'apprenant a droit
  const loadData = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && student) {
        // Charger les devoirs publiés
        const { data: assData, error: assErr } = await supabase
          .from("assignments")
          .select("*, attachments:assignment_attachments(*)")
          .in("statut", ["publie", "ouvert"])
          .order("date_limite", { ascending: true });

        // Charger mes remises
        const { data: subData, error: subErr } = await supabase
          .from("assignment_submissions")
          .select("*, files:assignment_submission_files(*)")
          .eq("student_id", student.id)
          .order("date_remise", { ascending: false });

        if (!assErr && assData) {
          const mappedAss: Assignment[] = assData.map((a: any) => ({
            id: a.id,
            titre: a.titre,
            description: a.description || "",
            consignes: a.consignes,
            formation: a.formation,
            moduleId: a.module_id,
            chapitreId: a.chapitre_id,
            teacherId: a.teacher_id,
            dateCreation: a.date_creation,
            datePublication: a.date_publication,
            dateOuverture: a.date_ouverture,
            dateLimite: a.date_limite ? a.date_limite.slice(0, 10) : "",
            heureLimite: a.heure_limite || "23:59",
            dureeEstimeeMinutes: a.duree_estimee_minutes,
            nbFichiersMax: a.nb_fichiers_max || 3,
            tailleMaxMo: a.taille_max_mo || 10,
            formatsAutorises: a.formats_autorises || ["pdf", "docx"],
            bareme: Number(a.bareme || 20),
            seuilReussite: Number(a.seuil_reussite || 10),
            statut: a.statut,
            audience: a.audience,
            targetGroupe: a.target_groupe,
            targetStudentIds: a.target_student_ids,
            autoriserRemiseTardive: a.autoriser_remise_tardive,
            tentativesMax: a.tentatives_max,
            correctionVisibleImmediatement: a.correction_visible_immediatement,
            attachments: (a.attachments || []).map((att: any) => ({
              id: att.id,
              assignmentId: att.assignment_id,
              fileName: att.file_name,
              originalName: att.original_name,
              fileUrl: att.file_url,
              mime: att.mime,
              size: att.size,
              storagePath: att.storage_path,
              createdAt: att.created_at,
            })),
          }));
          setAssignments(mappedAss);
        } else {
          setAssignments(getLocalAssignments().filter((a) => a.statut === "publie" || a.statut === "ouvert"));
        }

        if (!subErr && subData) {
          const mappedSubs: AssignmentSubmission[] = subData.map((s: any) => ({
            id: s.id,
            assignmentId: s.assignment_id,
            studentId: s.student_id,
            version: s.version || 1,
            texte: s.texte,
            statut: s.statut,
            dateRemise: s.date_remise,
            note: s.note !== null ? Number(s.note) : undefined,
            appreciation: s.appreciation,
            commentairesPrives: s.commentaires_prives,
            pointsForts: s.points_forts,
            pointsAmelioration: s.points_amelioration,
            corrigePar: s.corrige_par,
            dateCorrection: s.date_correction,
            publie: s.publie !== false,
            files: (s.files || []).map((f: any) => ({
              id: f.id,
              submissionId: f.submission_id,
              fileName: f.file_name,
              originalName: f.original_name,
              fileUrl: f.file_url,
              mime: f.mime,
              size: f.size,
              storagePath: f.storage_path,
              createdAt: f.created_at,
            })),
          }));
          setSubmissions(mappedSubs);
        } else {
          setSubmissions(getLocalSubmissions().filter((s) => s.studentId === student.id));
        }
      } else {
        setAssignments(getLocalAssignments().filter((a) => a.statut === "publie" || a.statut === "ouvert"));
        setSubmissions(student ? getLocalSubmissions().filter((s) => s.studentId === student.id) : []);
      }
    } catch (e) {
      console.warn("Erreur chargement devoirs apprenant:", e);
      setAssignments(getLocalAssignments().filter((a) => a.statut === "publie" || a.statut === "ouvert"));
      setSubmissions(student ? getLocalSubmissions().filter((s) => s.studentId === student.id) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, student]);

  if (!student) {
    return (
      <Empty
        icon={<ClipboardCheck size={40} />}
        title="Profil apprenant introuvable"
        sub="Veuillez contacter l'administration si vous êtes inscrit comme apprenant."
      />
    );
  }

  // Filtrage d'audience
  const myAssignments = assignments.filter((a) => {
    if (a.audience === "all") return true;
    if (a.audience === "formation" && a.formation) return student.formation === a.formation;
    if (a.audience === "groupe" && a.targetGroupe) return student.groupe === a.targetGroupe;
    if (a.audience === "apprenants" && a.targetStudentIds) return a.targetStudentIds.includes(student.id);
    return student.modules?.includes(a.moduleId);
  });

  // Filtrage par onglet & recherche
  const filteredAssignments = myAssignments.filter((a) => {
    const mySub = submissions.find((s) => s.assignmentId === a.id);
    const isSubmitted = !!mySub;
    const isGraded = mySub && (mySub.statut === "corrige" || mySub.statut === "retourne");

    if (activeTab === "to_do" && isSubmitted) return false;
    if (activeTab === "submitted" && (!isSubmitted || isGraded)) return false;
    if (activeTab === "graded" && !isGraded) return false;

    if (selectedModule && a.moduleId !== selectedModule) return false;

    if (search) {
      const q = search.toLowerCase();
      const matchTitle = a.titre.toLowerCase().includes(q);
      const matchDesc = (a.description || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Compteurs
  const todoCount = myAssignments.filter((a) => !submissions.some((s) => s.assignmentId === a.id)).length;
  const submittedCount = myAssignments.filter((a) => {
    const s = submissions.find((sub) => sub.assignmentId === a.id);
    return s && s.statut !== "corrige" && s.statut !== "retourne";
  }).length;
  const gradedCount = myAssignments.filter((a) => {
    const s = submissions.find((sub) => sub.assignmentId === a.id);
    return s && (s.statut === "corrige" || s.statut === "retourne");
  }).length;

  return (
    <div className="space-y-6">
      <PageHead
        title="Mes Devoirs & Travaux"
        subtitle="Consultez les devoirs assignés, déposez vos travaux et découvrez les retours de vos formateurs"
      />

      {/* Onglets */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-1 text-xs">
        {[
          { id: "all", label: `Tous les devoirs (${myAssignments.length})` },
          { id: "to_do", label: `À faire (${todoCount})` },
          { id: "submitted", label: `Remis en attente (${submittedCount})` },
          { id: "graded", label: `Corrigés & Notés (${gradedCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 font-semibold rounded-t-lg transition-all shrink-0 ${
              activeTab === tab.id
                ? "bg-slate-800 text-cyan-300 border-b-2 border-cyan-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un devoir..."
            className="text-xs py-1.5 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <Select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="text-xs py-1 w-48"
        >
          <option value="">Tous mes modules</option>
          {db.modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.numero}. {m.titre}
            </option>
          ))}
        </Select>
      </div>

      {/* Liste des devoirs */}
      {filteredAssignments.length === 0 ? (
        <Empty
          icon={<ClipboardCheck size={40} />}
          title="Aucun devoir dans cette catégorie"
          sub="Vous n'avez aucun devoir en attente pour le moment."
        />
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((asg) => {
            const mod = db.modules.find((m) => m.id === asg.moduleId);
            const tch = db.teachers.find((t) => t.id === asg.teacherId);
            const deadline = getDeadlineInfo(asg);
            const mySub = submissions.find((s) => s.assignmentId === asg.id);

            const isSubmitted = !!mySub;
            const isGraded = mySub && (mySub.statut === "corrige" || mySub.statut === "retourne");

            return (
              <Card
                key={asg.id}
                className="p-5"
                glow={isGraded ? "green" : isSubmitted ? "cyan" : deadline.isOverdue ? "red" : "gold"}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-white text-base truncate">
                        {asg.titre}
                      </h3>

                      {isGraded ? (
                        <Badge color="green">Noté : {mySub.note} / {asg.bareme} pts</Badge>
                      ) : isSubmitted ? (
                        <Badge color={mySub.statut === "en_retard" ? "red" : "cyan"}>
                          {mySub.statut === "en_retard" ? "Remis en retard" : "Remis (en correction)"}
                        </Badge>
                      ) : (
                        <Badge color={deadline.badgeColor}>{deadline.formattedRemaining}</Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">
                      Module : <strong>{mod ? `${mod.numero}. ${mod.titre}` : "Module"}</strong>
                      {tch ? ` · Enseignant : ${tch.prenom} ${tch.nom}` : ""}
                      {` · Date limite : ${asg.dateLimite} à ${asg.heureLimite || "23:59"}`}
                    </p>

                    {asg.description && (
                      <p className="text-xs text-slate-300 line-clamp-2">{asg.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>Barème : <strong className="text-slate-200">{asg.bareme} pts</strong></span>
                      <span>Seuil : <strong className="text-slate-200">{asg.seuilReussite} pts</strong></span>
                      <span>Fichiers joints au sujet : <strong className="text-cyan-400">{asg.attachments?.length || 0}</strong></span>
                      {isSubmitted && (
                        <span className="text-emerald-400">
                          ✓ Remis le {new Date(mySub.dateRemise).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <Btn
                      variant={isGraded ? "outline" : isSubmitted ? "outline" : "green"}
                      className="text-xs py-2"
                      onClick={() => setActiveModalAssignment(asg)}
                    >
                      {isGraded ? "Voir ma note & retour" : isSubmitted ? "Consulter ma remise" : "Ouvrir & Remettre"}
                      <ArrowRight size={13} />
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de remise et consultation */}
      {activeModalAssignment && (
        <StudentAssignmentModal
          open={!!activeModalAssignment}
          onClose={() => setActiveModalAssignment(null)}
          assignment={activeModalAssignment}
          submission={submissions.find((s) => s.assignmentId === activeModalAssignment.id) || null}
          onSubmitted={loadData}
        />
      )}
    </div>
  );
}
