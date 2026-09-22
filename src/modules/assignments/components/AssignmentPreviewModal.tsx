import React from "react";
import {
  FileText, Calendar, Clock, Download, AlertCircle,
  Upload, Shield, X,
} from "lucide-react";
import { Assignment } from "../types";
import { getDeadlineInfo } from "../services/assignmentService";
import { Badge, Btn, Modal } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { humanSize, fileKind, downloadFile } from "@/lib/files";

interface AssignmentPreviewModalProps {
  open: boolean;
  onClose: () => void;
  assignment: Assignment | null;
}

export function AssignmentPreviewModal({ open, onClose, assignment }: AssignmentPreviewModalProps) {
  const { db } = useStore();

  if (!assignment) return null;

  const mod = db.modules.find((m) => m.id === assignment.moduleId);
  const teacher = db.teachers.find((t) => t.id === assignment.teacherId);
  const deadline = getDeadlineInfo(assignment);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Aperçu Apprenant — ${assignment.titre || "Sans titre"}`}
      wide
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Bandeau d'information aperçu */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>
              <strong>Mode Prévisualisation :</strong> Voici exactement l'interface telle qu'elle apparaîtra à l'apprenant.
            </span>
          </div>
          <Badge color="gold">Aperçu formateur</Badge>
        </div>

        {/* En-tête du devoir */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-cyan-400">
                  {mod ? `${mod.numero}. ${mod.titre}` : "Module"}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  Formateur : {teacher ? `${teacher.prenom} ${teacher.nom}` : "Enseignant"}
                </span>
              </div>
              <h2 className="text-xl font-display font-bold text-white">{assignment.titre}</h2>
              {assignment.description && (
                <p className="text-xs text-slate-300 mt-1">{assignment.description}</p>
              )}
            </div>

            <div className="text-right">
              <Badge color={deadline.badgeColor}>
                {deadline.formattedRemaining}
              </Badge>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                <Calendar size={12} /> Échéance : {assignment.dateLimite} à {assignment.heureLimite || "23:59"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Barème</span>
              <span className="font-semibold text-white">{assignment.bareme} points</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Seuil de réussite</span>
              <span className="font-semibold text-white">{assignment.seuilReussite} points</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Fichiers max</span>
              <span className="font-semibold text-white">{assignment.nbFichiersMax} (max {assignment.tailleMaxMo} Mo)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Remise tardive</span>
              <span className="font-semibold text-white">
                {assignment.autoriserRemiseTardive ? "Acceptée (mention retard)" : "Refusée"}
              </span>
            </div>
          </div>
        </div>

        {/* Consignes détaillées */}
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-cyan-400" /> Consignes et modalités
          </h3>
          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-black/20 p-4 rounded-lg border border-white/5">
            {assignment.consignes || "Aucune consigne rédigée."}
          </div>
        </div>

        {/* Pièces jointes fournies */}
        {(assignment.attachments && assignment.attachments.length > 0) && (
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Documents joints au sujet</h3>
            <div className="space-y-2">
              {assignment.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={16} className="text-cyan-400 shrink-0" />
                    <span className="font-semibold text-white truncate">{att.originalName}</span>
                    <span className="text-slate-400 text-[11px]">
                      · {fileKind(att.mime, att.originalName)} · {humanSize(att.size)}
                    </span>
                  </div>
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 border border-cyan-400/40 px-2.5 py-1 rounded-md"
                  >
                    <Download size={13} /> Télécharger
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation de la zone de remise apprenant */}
        <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload size={16} className="text-cyan-400" /> Zone de remise de l'apprenant (Simulation)
            </h3>
            <Badge color="cyan">Formats : {assignment.formatsAutorises.join(", ")}</Badge>
          </div>

          <div className="rounded-lg border border-dashed border-white/20 p-6 text-center text-xs text-slate-400">
            <Upload size={24} className="mx-auto mb-2 text-slate-500" />
            <p className="font-semibold text-slate-300">Glissez-déposez vos fichiers ici ou parcourez vos documents</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Jusqu'à {assignment.nbFichiersMax} fichier(s) · {assignment.tailleMaxMo} Mo maximum par fichier
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Btn variant="outline" onClick={onClose}>Fermer l'aperçu</Btn>
        </div>
      </div>
    </Modal>
  );
}
