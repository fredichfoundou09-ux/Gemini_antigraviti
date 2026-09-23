import React, { useState } from "react";
import {
  FileText, Download, Upload, AlertCircle, CheckCircle2,
  Clock, Trash2, Send, AlertTriangle, Check, RotateCcw,
} from "lucide-react";
import { Assignment, AssignmentSubmission } from "../types";
import { getDeadlineInfo, submitAssignmentWork, uploadSubmissionFileToStorage } from "../services/assignmentService";
import { Badge, Btn, Field, Input, Modal, Textarea } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { humanSize, fileKind } from "@/lib/files";

interface StudentAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  submission: AssignmentSubmission | null;
  onSubmitted: () => void;
}

interface StagedFile {
  file: File;
  originalName: string;
  size: number;
  mime: string;
}

export function StudentAssignmentModal({
  open,
  onClose,
  assignment,
  submission,
  onSubmitted,
}: StudentAssignmentModalProps) {
  const { db, user } = useStore();

  const [texte, setTexte] = useState("");
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>("");

  if (!assignment) return null;

  const student = db.students.find(
    (s) =>
      s.userId === user?.id ||
      (user?.linkedId && s.id === user.linkedId) ||
      s.id === user?.id ||
      (user?.email && s.email && s.email.toLowerCase().trim() === user.email.toLowerCase().trim())
  );
  const mod = db.modules.find((m) => m.id === assignment.moduleId);
  const teacher = db.teachers.find((t) => t.id === assignment.teacherId);
  const deadline = getDeadlineInfo(assignment);

  const isGraded = submission && (submission.statut === "corrige" || submission.statut === "retourne");
  const isLate = deadline.isOverdue;
  const canSubmitLate = assignment.autoriserRemiseTardive;
  const isSubmissionBlocked = isLate && !canSubmitLate;

  // Tentatives
  const currentAttempts = submission?.version || 0;
  const maxAttempts = assignment.tentativesMax;
  const hasRemainingAttempts = maxAttempts === 0 || currentAttempts < maxAttempts;
  const isSubmissionAllowed = !isSubmissionBlocked && hasRemainingAttempts;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = assignment.nbFichiersMax - stagedFiles.length;
    if (remainingSlots <= 0) {
      toastMsg.error(
        "Quota atteint",
        `Vous ne pouvez pas joindre plus de ${assignment.nbFichiersMax} fichier(s) pour ce devoir.`
      );
      return;
    }

    const newStaged: StagedFile[] = [...stagedFiles];

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];

      // Vérifier la taille
      const maxBytes = assignment.tailleMaxMo * 1024 * 1024;
      if (file.size > maxBytes) {
        toastMsg.error(
          "Fichier trop volumineux",
          `Le fichier « ${file.name} » dépasse la taille maximale de ${assignment.tailleMaxMo} Mo.`
        );
        continue;
      }

      // Vérifier le format
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (assignment.formatsAutorises.length > 0 && !assignment.formatsAutorises.includes(ext)) {
        toastMsg.error(
          "Format refusé",
          `Le format .${ext} n'est pas autorisé pour ce devoir (Formats autorisés : ${assignment.formatsAutorises.join(", ")}).`
        );
        continue;
      }

      newStaged.push({
        file,
        originalName: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      });
    }

    setStagedFiles(newStaged);
    e.target.value = "";
  };

  const handleRemoveStagedFile = (idx: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const executeSubmission = async () => {
    if (!student) {
      toastMsg.error("Erreur", "Profil apprenant non identifié.");
      return;
    }

    if (!texte.trim() && stagedFiles.length === 0) {
      toastMsg.warning("Remise vide", "Veuillez saisir une réponse écrite ou joindre au moins un fichier.");
      return;
    }

    setIsSubmitting(true);
    setUploadStep("Téléversement sécurisé des fichiers...");

    try {
      // 1. Téléverser les fichiers vers Supabase Storage
      const uploadedFilesPayload: Array<{
        fileName: string;
        originalName: string;
        fileUrl: string;
        mime: string;
        size: number;
        storagePath?: string;
      }> = [];

      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
        setUploadStep(`Envoi du fichier ${i + 1}/${stagedFiles.length} (${item.originalName})...`);
        const uploadRes = await uploadSubmissionFileToStorage(item.file, assignment.id, student.id);
        uploadedFilesPayload.push({
          fileName: item.originalName,
          originalName: item.originalName,
          fileUrl: uploadRes.fileUrl,
          mime: item.mime,
          size: item.size,
          storagePath: uploadRes.storagePath,
        });
      }

      // 2. Enregistrer la remise côté serveur
      setUploadStep("Validation et enregistrement de votre remise...");
      const res = await submitAssignmentWork(
        assignment.id,
        texte.trim() || undefined,
        uploadedFilesPayload,
        student.id,
        isLate
      );

      if (!res.success) {
        throw new Error(res.error || "Impossible d'enregistrer la remise.");
      }

      toastMsg.success(
        "Devoir remis avec succès !",
        isLate
          ? "Votre devoir a été enregistré avec la mention « En retard »."
          : "Votre travail a été transmis au formateur."
      );

      setShowConfirmModal(false);
      setStagedFiles([]);
      setTexte("");
      onSubmitted();
      onClose();
    } catch (err: any) {
      toastMsg.error("Échec de la remise", err.message || "Erreur de transmission");
    } finally {
      setIsSubmitting(false);
      setUploadStep("");
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={assignment.titre}
        wide
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
          {/* En-tête statut & échéance */}
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-cyan-400 font-semibold mb-0.5">
                  {mod ? `${mod.numero}. ${mod.titre}` : "Module"} · Enseignant : {teacher ? `${teacher.prenom} ${teacher.nom}` : "Formateur"}
                </p>
                <h3 className="text-base font-bold text-white">{assignment.titre}</h3>
              </div>

              <div className="text-right">
                <Badge color={deadline.badgeColor}>
                  {deadline.formattedRemaining}
                </Badge>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                  <Clock size={12} /> Échéance : {assignment.dateLimite} à {assignment.heureLimite || "23:59"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2 border-t border-white/5">
              <span>Barème : <strong className="text-white">{assignment.bareme} pts</strong></span>
              <span>Seuil de réussite : <strong className="text-white">{assignment.seuilReussite} pts</strong></span>
              <span>Tentatives max : <strong className="text-white">{assignment.tentativesMax === 0 ? "Illimitées" : assignment.tentativesMax}</strong></span>
              <span>Remise tardive : <strong className={assignment.autoriserRemiseTardive ? "text-emerald-400" : "text-slate-400"}>{assignment.autoriserRemiseTardive ? "Autorisée" : "Interdite"}</strong></span>
            </div>
          </div>

          {/* Consignes du devoir */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText size={14} className="text-cyan-400" /> Consignes à respecter
            </h4>
            <div className="rounded-lg border border-white/5 bg-black/30 p-4 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {assignment.consignes}
            </div>
          </div>

          {/* Documents du sujet fournis par le formateur */}
          {(assignment.attachments && assignment.attachments.length > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Documents et ressources à télécharger ({assignment.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assignment.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-cyan-400 shrink-0" />
                      <span className="truncate font-medium text-white">{att.originalName}</span>
                      <span className="text-slate-500 text-[10px]">· {humanSize(att.size)}</span>
                    </div>
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={att.originalName}
                      className="text-cyan-300 hover:text-cyan-200 p-1 shrink-0"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rendu précédent / Note et correction */}
          {submission && (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Votre remise enregistrée (Version #{submission.version})
                </h4>
                {isGraded ? (
                  <Badge color="green">
                    Note : {submission.note} / {assignment.bareme} pts
                  </Badge>
                ) : (
                  <Badge color={submission.statut === "en_retard" ? "red" : "cyan"}>
                    {submission.statut === "en_retard" ? "Remis en retard" : "Remis (en attente de note)"}
                  </Badge>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Enregistrée le {new Date(submission.dateRemise).toLocaleString("fr-FR")}
              </p>

              {submission.texte && (
                <div className="rounded border border-white/5 bg-black/20 p-2.5 text-xs text-slate-300">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Votre réponse écrite :</span>
                  <p className="whitespace-pre-wrap">{submission.texte}</p>
                </div>
              )}

              {(submission.files && submission.files.length > 0) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fichiers transmis :</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {submission.files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded border border-white/5 bg-black/20 px-2.5 py-1.5 text-xs">
                        <span className="truncate text-slate-300">{f.originalName}</span>
                        <a href={f.fileUrl} target="_blank" rel="noreferrer" download={f.originalName} className="text-cyan-400 p-1">
                          <Download size={13} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retour et appréciation */}
              {isGraded && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-sm">
                      Note finale : {submission.note} / {assignment.bareme}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Corrigé le {submission.dateCorrection ? new Date(submission.dateCorrection).toLocaleDateString("fr-FR") : ""}
                    </span>
                  </div>
                  {submission.appreciation && (
                    <p className="text-slate-200">
                      <strong>Appréciation :</strong> {submission.appreciation}
                    </p>
                  )}
                  {submission.pointsForts && (
                    <p className="text-emerald-300">
                      <strong>Points forts :</strong> {submission.pointsForts}
                    </p>
                  )}
                  {submission.pointsAmelioration && (
                    <p className="text-amber-300">
                      <strong>Axes d'amélioration :</strong> {submission.pointsAmelioration}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Formulaire de remise */}
          {isSubmissionAllowed ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload size={16} className="text-cyan-400" />
                  {submission ? "Déposer une nouvelle version" : "Effectuer ma remise"}
                </h4>
                <span className="text-[11px] text-slate-400">
                  {stagedFiles.length} / {assignment.nbFichiersMax} fichier(s)
                </span>
              </div>

              {isLate && canSubmitLate && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>
                    La date limite est dépassée. Votre remise sera acceptée avec la mention <strong>« En retard »</strong>.
                  </span>
                </div>
              )}

              <Field label="Votre réponse rédigée (optionnelle si fichier joint)">
                <Textarea
                  rows={4}
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  placeholder="Rédigez vos explications ou vos réponses textuelles ici..."
                />
              </Field>

              {/* Zone de sélection des fichiers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Pièces jointes de votre travail</span>
                  <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-400/40 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10 ${stagedFiles.length >= assignment.nbFichiersMax ? "opacity-50 pointer-events-none" : ""}`}>
                    <Upload size={13} /> Parcourir les fichiers
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept={assignment.formatsAutorises.map((ext) => `.${ext}`).join(",")}
                    />
                  </label>
                </div>

                {stagedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {stagedFiles.map((sf, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-cyan-400 shrink-0" />
                          <span className="truncate font-medium text-slate-200">{sf.originalName}</span>
                          <span className="text-slate-500 text-[10px]">· {humanSize(sf.size)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedFile(idx)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  Formats acceptés : {assignment.formatsAutorises.join(", ")} · Max {assignment.tailleMaxMo} Mo par fichier.
                </p>
              </div>

              {/* Bouton de soumission */}
              <div className="flex justify-end pt-2">
                <Btn
                  variant="green"
                  disabled={isSubmitting || (!texte.trim() && stagedFiles.length === 0)}
                  onClick={() => setShowConfirmModal(true)}
                  className="font-bold text-xs py-2 px-4"
                >
                  <Send size={14} /> Vérifier et envoyer définitivement
                </Btn>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300 flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0" />
              <div>
                <p className="font-bold">Remises closes pour ce devoir</p>
                <p className="text-[11px] text-red-300/80 mt-0.5">
                  {isSubmissionBlocked
                    ? "La date limite de remise est dépassée et les remises tardives ne sont pas autorisées."
                    : "Vous avez atteint le nombre maximal de remises autorisées."}
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de confirmation avant envoi définitif (Exigence #9) */}
      <Modal
        open={showConfirmModal}
        onClose={() => !isSubmitting && setShowConfirmModal(false)}
        title="Confirmation de remise définitive"
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            <p className="font-bold mb-1">⚠️ Avertissement :</p>
            <p>
              Après validation, votre remise sera enregistrée comme définitive et transmise à votre formateur.
            </p>
          </div>

          <div className="space-y-2 border border-white/5 bg-black/20 p-3 rounded-lg">
            <p className="font-semibold text-white">Récapitulatif de votre remise :</p>
            <p className="text-slate-300">
              • Réponse écrite : {texte.trim() ? "Oui (renseignée)" : "Aucune"}
            </p>
            <p className="text-slate-300">
              • Pièces jointes : <strong>{stagedFiles.length} fichier(s)</strong>
            </p>
            {stagedFiles.map((f, i) => (
              <p key={i} className="text-slate-400 pl-4 text-[11px]">
                - {f.originalName} ({humanSize(f.size)})
              </p>
            ))}
          </div>

          {isSubmitting && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-center text-cyan-300 space-y-1">
              <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
              <p className="font-semibold">{uploadStep || "Envoi en cours..."}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Btn
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => setShowConfirmModal(false)}
            >
              Annuler & Modifier
            </Btn>
            <Btn
              variant="green"
              disabled={isSubmitting}
              onClick={executeSubmission}
              className="font-bold"
            >
              <CheckCircle2 size={14} /> Confirmer la remise définitive
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}
