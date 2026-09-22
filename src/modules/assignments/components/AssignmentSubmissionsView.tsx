import React, { useState } from "react";
import {
  ClipboardCheck, FileText, Download, CheckCircle2, Clock,
  AlertTriangle, ArrowLeft, Search, Filter, PenLine, User,
  Calendar, Check,
} from "lucide-react";
import { Assignment, AssignmentSubmission } from "../types";
import { gradeAssignmentSubmission } from "../services/assignmentService";
import { Btn, Badge, Card, Empty, Field, Input, Modal, Select, Textarea } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { humanSize, fileKind } from "@/lib/files";

interface AssignmentSubmissionsViewProps {
  assignment: Assignment;
  submissions: AssignmentSubmission[];
  onBack: () => void;
  onRefresh: () => void;
}

export function AssignmentSubmissionsView({
  assignment,
  submissions,
  onBack,
  onRefresh,
}: AssignmentSubmissionsViewProps) {
  const { db, user } = useStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);

  // Formulaire de notation
  const [noteVal, setNoteVal] = useState("");
  const [appreciationVal, setAppreciationVal] = useState("");
  const [pointsFortsVal, setPointsFortsVal] = useState("");
  const [pointsAmeliorationVal, setPointsAmeliorationVal] = useState("");
  const [publierVal, setPublierVal] = useState(true);
  const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);

  // Filtrer les apprenants du module/groupe
  const moduleStudents = db.students.filter((s) => {
    if (assignment.audience === "all") return true;
    if (assignment.audience === "formation" && assignment.formation) return s.formation === assignment.formation;
    if (assignment.audience === "groupe" && assignment.targetGroupe) return s.groupe === assignment.targetGroupe;
    if (assignment.audience === "apprenants" && assignment.targetStudentIds) return assignment.targetStudentIds.includes(s.id);
    return s.modules?.includes(assignment.moduleId);
  });

  // KPIs
  const totalStudents = Math.max(moduleStudents.length, submissions.length);
  const totalSubmissions = submissions.length;
  const toGradeCount = submissions.filter((s) => s.statut === "remis" || s.statut === "en_retard" || s.statut === "en_correction").length;
  const gradedCount = submissions.filter((s) => s.statut === "corrige" || s.statut === "retourne").length;
  const lateCount = submissions.filter((s) => s.statut === "en_retard").length;

  // Filtrage
  const filteredSubmissions = submissions.filter((s) => {
    const stu = db.students.find((x) => x.id === s.studentId);
    const stuName = `${stu?.prenom || ""} ${stu?.nom || ""}`.toLowerCase();
    const matchesSearch = !search || stuName.includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === "all") return true;
    if (filterStatus === "to_grade") return s.statut === "remis" || s.statut === "en_retard" || s.statut === "en_correction";
    if (filterStatus === "graded") return s.statut === "corrige" || s.statut === "retourne";
    if (filterStatus === "late") return s.statut === "en_retard";
    return true;
  });

  const handleOpenGradeModal = (sub: AssignmentSubmission) => {
    setGradingSubmission(sub);
    setNoteVal(sub.note !== undefined ? String(sub.note) : "");
    setAppreciationVal(sub.appreciation || "");
    setPointsFortsVal(sub.pointsForts || "");
    setPointsAmeliorationVal(sub.pointsAmelioration || "");
    setPublierVal(sub.publie !== false);
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission) return;

    const num = parseFloat(noteVal.replace(",", "."));
    if (isNaN(num) || num < 0 || num > assignment.bareme) {
      toastMsg.error(
        "Note invalide",
        `La note doit être comprise entre 0 et ${assignment.bareme} points.`
      );
      return;
    }

    setIsSubmittingGrade(true);
    try {
      const res = await gradeAssignmentSubmission(
        gradingSubmission.id,
        num,
        assignment.bareme,
        appreciationVal,
        pointsFortsVal,
        pointsAmeliorationVal,
        publierVal
      );

      if (!res.success) throw new Error(res.error);

      toastMsg.success("Correction enregistrée", `Note de ${num}/${assignment.bareme} attribuée.`);
      setGradingSubmission(null);
      onRefresh();
    } catch (err: any) {
      toastMsg.error("Échec de la notation", err.message || "Erreur serveur");
    } finally {
      setIsSubmittingGrade(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton retour */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={20} className="text-cyan-400" />
              Correction : {assignment.titre}
            </h2>
            <p className="text-xs text-slate-400">
              Barème : {assignment.bareme} pts · Date limite : {assignment.dateLimite} à {assignment.heureLimite || "23:59"}
            </p>
          </div>
        </div>

        <Btn variant="outline" className="text-xs py-1.5" onClick={onRefresh}>
          Actualiser les remises
        </Btn>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Apprenants ciblés</span>
          <span className="text-xl font-bold text-white">{totalStudents}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Devoirs remis</span>
          <span className="text-xl font-bold text-cyan-300">{totalSubmissions}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">À corriger</span>
          <span className="text-xl font-bold text-amber-300">{toGradeCount}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Corrigés</span>
          <span className="text-xl font-bold text-emerald-400">{gradedCount}</span>
        </Card>
        <Card className="p-3 text-center">
          <span className="text-slate-500 text-[10px] uppercase font-bold block">Remis en retard</span>
          <span className="text-xl font-bold text-red-400">{lateCount}</span>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un apprenant..."
            className="text-xs py-1.5 bg-transparent border-0 focus:ring-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs py-1 w-44"
          >
            <option value="all">Toutes les copies ({submissions.length})</option>
            <option value="to_grade">À corriger ({toGradeCount})</option>
            <option value="graded">Corrigées ({gradedCount})</option>
            <option value="late">En retard ({lateCount})</option>
          </Select>
        </div>
      </div>

      {/* Liste des copies */}
      {filteredSubmissions.length === 0 ? (
        <Empty
          icon={<ClipboardCheck size={40} />}
          title="Aucune copie trouvée"
          sub="Aucune remise d'apprenant ne correspond à vos filtres pour ce devoir."
        />
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((sub) => {
            const stu = db.students.find((x) => x.id === sub.studentId);
            const isLate = sub.statut === "en_retard";
            const isGraded = sub.statut === "corrige" || sub.statut === "retourne";

            return (
              <Card key={sub.id} className="p-4" glow={isGraded ? "green" : isLate ? "red" : "gold"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-300">
                        {stu?.prenom?.[0] || "A"}
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-white text-sm">
                          {stu ? `${stu.prenom} ${stu.nom}` : `Apprenant #${sub.studentId}`}
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          Matricule : {sub.studentId} · Remise #{sub.version}
                        </span>
                      </div>

                      {isGraded ? (
                        <Badge color="green">
                          Noté : {sub.note} / {assignment.bareme} pts
                        </Badge>
                      ) : isLate ? (
                        <Badge color="red">Remis en retard</Badge>
                      ) : (
                        <Badge color="gold">En attente de notation</Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={12} /> Déposé le {new Date(sub.dateRemise).toLocaleString("fr-FR")}
                    </p>

                    {/* Réponse rédigée en ligne */}
                    {sub.texte && (
                      <div className="rounded-lg border border-white/5 bg-black/30 p-3 text-xs text-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                          Réponse texte de l'apprenant :
                        </span>
                        <p className="whitespace-pre-wrap">{sub.texte}</p>
                      </div>
                    )}

                    {/* Fichiers remis */}
                    {(sub.files && sub.files.length > 0) && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Fichier(s) remis ({sub.files.length}) :
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sub.files.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={14} className="text-cyan-400 shrink-0" />
                                <span className="truncate font-medium text-slate-200">{f.originalName}</span>
                                <span className="text-slate-500 text-[10px]">· {humanSize(f.size)}</span>
                              </div>
                              <a
                                href={f.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={f.originalName}
                                className="text-cyan-400 hover:text-cyan-300 p-1 shrink-0"
                                title="Télécharger le fichier"
                              >
                                <Download size={14} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Retour déjà formulé */}
                    {isGraded && sub.appreciation && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-300">
                        <span className="font-semibold block mb-0.5">Appréciation formateur :</span>
                        <p className="text-slate-300">{sub.appreciation}</p>
                      </div>
                    )}
                  </div>

                  {/* Bouton d'action */}
                  <div>
                    <Btn
                      variant={isGraded ? "outline" : "primary"}
                      className="text-xs py-1.5"
                      onClick={() => handleOpenGradeModal(sub)}
                    >
                      <PenLine size={13} /> {isGraded ? "Modifier la note" : "Corriger la copie"}
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de notation */}
      <Modal
        open={!!gradingSubmission}
        onClose={() => setGradingSubmission(null)}
        title={`Correction — ${db.students.find((x) => x.id === gradingSubmission?.studentId)?.prenom || "Apprenant"}`}
      >
        <div className="space-y-4">
          <Field label={`Note obtenue (sur ${assignment.bareme} pts) *`}>
            <Input
              type="number"
              step={0.5}
              min={0}
              max={assignment.bareme}
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              placeholder={`Note entre 0 et ${assignment.bareme}`}
            />
          </Field>

          <Field label="Appréciation globale (visible de l'apprenant)">
            <Textarea
              rows={3}
              value={appreciationVal}
              onChange={(e) => setAppreciationVal(e.target.value)}
              placeholder="Commentaire général sur le travail fourni..."
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Points forts identifiés">
              <Input
                value={pointsFortsVal}
                onChange={(e) => setPointsFortsVal(e.target.value)}
                placeholder="Rigueur, structure..."
              />
            </Field>

            <Field label="Axes d'amélioration">
              <Input
                value={pointsAmeliorationVal}
                onChange={(e) => setPointsAmeliorationVal(e.target.value)}
                placeholder="Approfondir la documentation..."
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={publierVal}
              onChange={(e) => setPublierVal(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-xs text-slate-300">
              Diffuser immédiatement la note et l'appréciation à l'apprenant
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <Btn variant="ghost" onClick={() => setGradingSubmission(null)}>
              Annuler
            </Btn>
            <Btn
              variant="green"
              disabled={isSubmittingGrade || !noteVal}
              onClick={handleSaveGrade}
            >
              <CheckCircle2 size={15} /> {isSubmittingGrade ? "Validation..." : "Valider la note"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
