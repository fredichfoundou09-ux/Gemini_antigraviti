import React, { useState, useEffect } from "react";
import {
  ClipboardCheck, Plus, Search, Filter, FolderPlus,
  Calendar, Clock, CheckCircle2, AlertTriangle, Eye,
  Edit3, Trash2, Archive, Copy, BookOpen, User,
  FileText, ArrowRight,
} from "lucide-react";
import { Assignment, AssignmentSubmission, AssignmentStatus } from "../types";
import { getDeadlineInfo, persistAssignmentToSupabase, getLocalAssignments, getLocalSubmissions } from "../services/assignmentService";
import { AssignmentEditorModal } from "../components/AssignmentEditorModal";
import { AssignmentPreviewModal } from "../components/AssignmentPreviewModal";
import { AssignmentSubmissionsView } from "../components/AssignmentSubmissionsView";
import { AssignmentDocumentImporterModal } from "../components/AssignmentDocumentImporterModal";
import { Btn, Badge, Card, Empty, Field, Input, PageHead, Select } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

export function AssignmentsManagementPage() {
  const { db, user } = useStore();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [activeTab, setActiveTab] = useState<"all" | AssignmentStatus | "a_corriger">("all");
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedFormation, setSelectedFormation] = useState("");

  // Modals & Navigation
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedAssignmentForEdit, setSelectedAssignmentForEdit] = useState<Assignment | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAssignment, setPreviewAssignment] = useState<Assignment | null>(null);

  const [documentImporterOpen, setDocumentImporterOpen] = useState(false);

  const [activeGradingAssignment, setActiveGradingAssignment] = useState<Assignment | null>(null);

  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const teacher = db.teachers.find((t) => t.userId === user?.id);

  // Charger les devoirs et remises depuis Supabase ou cache
  const loadData = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Charger les devoirs
        let qAss = supabase.from("assignments").select("*, attachments:assignment_attachments(*)");
        if (!isAdmin && teacher) {
          qAss = qAss.or(`teacher_id.eq.${teacher.id},module_id.in.(${teacher.modules?.map((m) => `"${m}"`).join(",") || "00000000-0000-0000-0000-000000000000"})`);
        }
        const { data: assData, error: assErr } = await qAss.order("date_creation", { ascending: false });

        // 2. Charger les remises
        let qSub = supabase.from("assignment_submissions").select("*, files:assignment_submission_files(*)");
        const { data: subData, error: subErr } = await qSub.order("date_remise", { ascending: false });

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
          setAssignments(getLocalAssignments());
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
          setSubmissions(getLocalSubmissions());
        }
      } else {
        setAssignments(getLocalAssignments());
        setSubmissions(getLocalSubmissions());
      }
    } catch (e) {
      console.warn("Erreur chargement devoirs:", e);
      setAssignments(getLocalAssignments());
      setSubmissions(getLocalSubmissions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Duplication d'un devoir
  const handleDuplicate = async (asg: Assignment) => {
    const clone: Assignment = {
      ...asg,
      id: `ASG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      titre: `${asg.titre} (Copie)`,
      statut: "brouillon",
      dateCreation: new Date().toISOString(),
      datePublication: undefined,
    };
    await persistAssignmentToSupabase(clone);
    toastMsg.success("Devoir dupliqué", "La copie a été créée en mode brouillon.");
    loadData();
  };

  // Archivage / Désarchivage
  const handleToggleArchive = async (asg: Assignment) => {
    const newStatus: AssignmentStatus = asg.statut === "archive" ? "publie" : "archive";
    const updated = { ...asg, statut: newStatus };
    await persistAssignmentToSupabase(updated);
    toastMsg.success(newStatus === "archive" ? "Devoir archivé" : "Devoir restauré");
    loadData();
  };

  // Suppression d'un brouillon
  const handleDeleteDraft = async (asg: Assignment) => {
    if (!confirm(`Supprimer définitivement le brouillon « ${asg.titre} » ?`)) return;
    if (isSupabaseConfigured) {
      await supabase.from("assignments").delete().eq("id", asg.id);
    }
    toastMsg.success("Brouillon supprimé");
    loadData();
  };

  // Filtrage
  const filteredAssignments = assignments.filter((a) => {
    // Onglet
    if (activeTab === "all") {
      if (a.statut === "archive") return false; // Par défaut, cacher les archivés dans "Tous"
    } else if (activeTab === "a_corriger") {
      const subs = submissions.filter((s) => s.assignmentId === a.id);
      const toGrade = subs.some((s) => s.statut === "remis" || s.statut === "en_retard" || s.statut === "en_correction");
      if (!toGrade) return false;
    } else if (a.statut !== activeTab) {
      return false;
    }

    // Module
    if (selectedModule && a.moduleId !== selectedModule) return false;
    // Formation
    if (selectedFormation && a.formation !== selectedFormation) return false;
    // Recherche
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = a.titre.toLowerCase().includes(q);
      const matchDesc = (a.description || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // KPIs
  const totalCount = assignments.filter((a) => a.statut !== "archive").length;
  const draftCount = assignments.filter((a) => a.statut === "brouillon" || a.statut === "enregistre").length;
  const publishedCount = assignments.filter((a) => a.statut === "publie" || a.statut === "ouvert").length;
  const toGradeCount = assignments.filter((a) => {
    const subs = submissions.filter((s) => s.assignmentId === a.id);
    return subs.some((s) => s.statut === "remis" || s.statut === "en_retard" || s.statut === "en_correction");
  }).length;
  const archivedCount = assignments.filter((a) => a.statut === "archive").length;

  // Si l'enseignant est dans la vue détaillée de correction d'un devoir
  if (activeGradingAssignment) {
    const relevantSubs = submissions.filter((s) => s.assignmentId === activeGradingAssignment.id);
    return (
      <AssignmentSubmissionsView
        assignment={activeGradingAssignment}
        submissions={relevantSubs}
        onBack={() => setActiveGradingAssignment(null)}
        onRefresh={loadData}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Gestion des Devoirs & Remises"
        subtitle="Créez, planifiez, diffusez et notez les travaux pédagogiques de vos apprenants"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="outline"
              className="text-xs py-2"
              onClick={() => setDocumentImporterOpen(true)}
            >
              <FolderPlus size={14} /> Dépôt documentaire
            </Btn>

            <Btn
              variant="green"
              className="text-xs py-2 font-bold"
              onClick={() => {
                setSelectedAssignmentForEdit(null);
                setEditorOpen(true);
              }}
            >
              <Plus size={14} /> Nouveau devoir
            </Btn>
          </div>
        }
      />

      {/* Cartes KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center" glow="cyan">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Total devoirs</span>
          <span className="text-xl font-bold text-white">{totalCount}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Brouillons</span>
          <span className="text-xl font-bold text-slate-300">{draftCount}</span>
        </Card>
        <Card className="p-3 text-center" glow="green">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Publiés / En cours</span>
          <span className="text-xl font-bold text-emerald-400">{publishedCount}</span>
        </Card>
        <Card className="p-3 text-center" glow="gold">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">À corriger</span>
          <span className="text-xl font-bold text-amber-300">{toGradeCount}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Archivés</span>
          <span className="text-xl font-bold text-slate-500">{archivedCount}</span>
        </Card>
      </div>

      {/* Onglets de statut (Cycle de vie) */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-1 text-xs">
        {[
          { id: "all", label: `Tous (${totalCount})` },
          { id: "brouillon", label: `Brouillons (${draftCount})` },
          { id: "publie", label: `Publiés (${publishedCount})` },
          { id: "a_corriger", label: `À corriger (${toGradeCount})` },
          { id: "archive", label: `Archivés (${archivedCount})` },
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

      {/* Barre de filtres et recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre ou mot-clé..."
            className="text-xs py-1.5 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="text-xs py-1 w-44"
          >
            <option value="">Tous les modules</option>
            {db.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.numero}. {m.titre}
              </option>
            ))}
          </Select>

          <Select
            value={selectedFormation}
            onChange={(e) => setSelectedFormation(e.target.value)}
            className="text-xs py-1 w-36"
          >
            <option value="">Toutes filières</option>
            <option value="informatique">Informatique</option>
            <option value="industriel">Industriel</option>
          </Select>
        </div>
      </div>

      {/* Liste des devoirs */}
      {filteredAssignments.length === 0 ? (
        <div className="space-y-3">
          <Empty
            icon={<ClipboardCheck size={40} />}
            title="Aucun devoir dans cette section"
            sub="Créez votre premier devoir ou modifiez vos filtres de recherche."
          />
          <div className="text-center">
            <Btn
              variant="green"
              className="text-xs py-2"
              onClick={() => {
                setSelectedAssignmentForEdit(null);
                setEditorOpen(true);
              }}
            >
              <Plus size={14} /> Créer un devoir
            </Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((asg) => {
            const mod = db.modules.find((m) => m.id === asg.moduleId);
            const tch = db.teachers.find((t) => t.id === asg.teacherId);
            const deadline = getDeadlineInfo(asg);

            const asgSubs = submissions.filter((s) => s.assignmentId === asg.id);
            const toGrade = asgSubs.filter((s) => s.statut === "remis" || s.statut === "en_retard" || s.statut === "en_correction").length;
            const graded = asgSubs.filter((s) => s.statut === "corrige" || s.statut === "retourne").length;
            const totalSubmitted = asgSubs.length;

            const isDraft = asg.statut === "brouillon" || asg.statut === "enregistre";
            const isArchived = asg.statut === "archive";

            return (
              <Card
                key={asg.id}
                className="p-5"
                glow={toGrade > 0 ? "gold" : isDraft ? "none" : "green"}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-white text-base truncate">
                        {asg.titre}
                      </h3>

                      {isDraft ? (
                        <Badge color="gray">Brouillon</Badge>
                      ) : isArchived ? (
                        <Badge color="red">Archivé</Badge>
                      ) : (
                        <Badge color={deadline.badgeColor}>
                          {deadline.formattedRemaining}
                        </Badge>
                      )}

                      {toGrade > 0 && (
                        <Badge color="gold">{toGrade} copie(s) à corriger</Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">
                      Module : <strong>{mod ? `${mod.numero}. ${mod.titre}` : "Non spécifié"}</strong>
                      {tch ? ` · Formateur : ${tch.prenom} ${tch.nom}` : ""}
                      {` · Échéance : ${asg.dateLimite} à ${asg.heureLimite || "23:59"}`}
                    </p>

                    {asg.description && (
                      <p className="text-xs text-slate-300 line-clamp-2">{asg.description}</p>
                    )}

                    {/* Métriques de remise */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>Barème : <strong className="text-slate-200">{asg.bareme} pts</strong></span>
                      <span>Copies reçues : <strong className="text-cyan-300">{totalSubmitted}</strong></span>
                      <span>Copies notées : <strong className="text-emerald-400">{graded}</strong></span>
                      <span>Pièces jointes : <strong className="text-slate-200">{asg.attachments?.length || 0}</strong></span>
                    </div>
                  </div>

                  {/* Boutons d'actions */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Bouton Corriger */}
                    {!isDraft && (
                      <Btn
                        variant={toGrade > 0 ? "green" : "outline"}
                        className="text-xs py-1.5"
                        onClick={() => setActiveGradingAssignment(asg)}
                      >
                        <ClipboardCheck size={14} />
                        {toGrade > 0 ? `Corriger (${toGrade})` : `Consulter copies (${totalSubmitted})`}
                      </Btn>
                    )}

                    {/* Prévisualiser */}
                    <button
                      onClick={() => {
                        setPreviewAssignment(asg);
                        setPreviewOpen(true);
                      }}
                      className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                      title="Prévisualiser la vue apprenant"
                    >
                      <Eye size={14} />
                    </button>

                    {/* Modifier */}
                    <button
                      onClick={() => {
                        setSelectedAssignmentForEdit(asg);
                        setEditorOpen(true);
                      }}
                      className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                      title="Modifier la configuration"
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* Dupliquer */}
                    <button
                      onClick={() => handleDuplicate(asg)}
                      className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                      title="Dupliquer le devoir"
                    >
                      <Copy size={14} />
                    </button>

                    {/* Archiver / Désarchiver */}
                    <button
                      onClick={() => handleToggleArchive(asg)}
                      className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                      title={isArchived ? "Restaurer" : "Archiver"}
                    >
                      <Archive size={14} />
                    </button>

                    {/* Supprimer si brouillon */}
                    {isDraft && (
                      <button
                        onClick={() => handleDeleteDraft(asg)}
                        className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                        title="Supprimer le brouillon"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <AssignmentEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        assignment={selectedAssignmentForEdit}
        onSaved={loadData}
        onPreview={(asg) => {
          setPreviewAssignment(asg);
          setPreviewOpen(true);
        }}
      />

      <AssignmentPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        assignment={previewAssignment}
      />

      <AssignmentDocumentImporterModal
        open={documentImporterOpen}
        onClose={() => setDocumentImporterOpen(false)}
      />
    </div>
  );
}
