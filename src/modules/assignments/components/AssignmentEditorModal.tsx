import React, { useState, useEffect } from "react";
import {
  FileText, CheckCircle2, AlertTriangle, Upload, Trash2,
  Calendar, Clock, ShieldCheck, Eye, Save, Send,
} from "lucide-react";
import { Assignment, AssignmentAttachment } from "../types";
import { validateAssignmentForPublication, persistAssignmentToSupabase, uploadAssignmentAttachmentToStorage } from "../services/assignmentService";
import { Btn, Card, Field, Input, Modal, Select, Textarea } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { humanSize, fileKind } from "@/lib/files";

interface AssignmentEditorModalProps {
  open: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  onSaved: (saved: Assignment) => void;
  onPreview: (assignment: Assignment) => void;
}

const COMMON_FORMATS = [
  { id: "pdf", label: "PDF (.pdf)" },
  { id: "docx", label: "Word (.docx, .doc)" },
  { id: "xlsx", label: "Excel (.xlsx, .xls)" },
  { id: "pptx", label: "PowerPoint (.pptx)" },
  { id: "md", label: "Markdown (.md)" },
  { id: "txt", label: "Texte brut (.txt)" },
  { id: "zip", label: "Archive (.zip)" },
  { id: "png", label: "Images (.png, .jpg)" },
];

export function AssignmentEditorModal({
  open,
  onClose,
  assignment,
  onSaved,
  onPreview,
}: AssignmentEditorModalProps) {
  const { db, user } = useStore();

  const [form, setForm] = useState<Assignment>({
    id: "",
    titre: "",
    description: "",
    consignes: "",
    formation: "informatique",
    moduleId: "",
    teacherId: "",
    dateCreation: new Date().toISOString(),
    dateLimite: "",
    heureLimite: "23:59",
    dureeEstimeeMinutes: 60,
    nbFichiersMax: 3,
    tailleMaxMo: 10,
    formatsAutorises: ["pdf", "docx"],
    bareme: 20,
    seuilReussite: 10,
    statut: "brouillon",
    audience: "all",
    autoriserRemiseTardive: false,
    tentativesMax: 1,
    correctionVisibleImmediatement: true,
    attachments: [],
  });

  const [activeTab, setActiveTab] = useState<"general" | "consignes" | "parametres" | "fichiers">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (assignment) {
      setForm({ ...assignment });
    } else {
      // Formateur par défaut
      const currentTeacher = db.teachers.find((t) => t.userId === user?.id);
      const defaultMod = db.modules[0]?.id || "";
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);

      setForm({
        id: `ASG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        titre: "",
        description: "",
        consignes: "",
        formation: "informatique",
        moduleId: defaultMod,
        teacherId: currentTeacher?.id || db.teachers[0]?.id || "",
        dateCreation: new Date().toISOString(),
        dateLimite: tomorrow.toISOString().slice(0, 10),
        heureLimite: "23:59",
        dureeEstimeeMinutes: 120,
        nbFichiersMax: 3,
        tailleMaxMo: 10,
        formatsAutorises: ["pdf", "docx", "zip"],
        bareme: 20,
        seuilReussite: 10,
        statut: "brouillon",
        audience: "all",
        autoriserRemiseTardive: false,
        tentativesMax: 1,
        correctionVisibleImmediatement: true,
        attachments: [],
      });
    }
  }, [assignment, open, user, db.teachers, db.modules]);

  const validation = validateAssignmentForPublication(form);

  const handleToggleFormat = (fmtId: string) => {
    setForm((prev) => {
      const exists = prev.formatsAutorises.includes(fmtId);
      const updated = exists
        ? prev.formatsAutorises.filter((f) => f !== fmtId)
        : [...prev.formatsAutorises, fmtId];
      return { ...prev, formatsAutorises: updated };
    });
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newAttachments: AssignmentAttachment[] = [...(form.attachments || [])];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadAssignmentAttachmentToStorage(file, form.id);
        newAttachments.push({
          id: `ATT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          assignmentId: form.id,
          fileName: file.name,
          originalName: file.name,
          fileUrl: res.fileUrl,
          mime: file.type || "application/octet-stream",
          size: file.size,
          storagePath: res.storagePath,
          createdAt: new Date().toISOString(),
        });
      }
      setForm((prev) => ({ ...prev, attachments: newAttachments }));
      toastMsg.success("Pièce(s) jointe(s) ajoutée(s)");
    } catch (err: any) {
      toastMsg.error("Échec du téléversement", err.message || "Erreur inconnue");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.id !== attId),
    }));
  };

  const handleSaveDraft = async () => {
    if (!form.titre.trim()) {
      toastMsg.error("Titre manquant", "Veuillez saisir au moins un titre pour le devoir.");
      return;
    }
    setIsSaving(true);
    try {
      const draft = { ...form, statut: "brouillon" as const };
      const res = await persistAssignmentToSupabase(draft);
      if (!res.success) throw new Error(res.error);
      toastMsg.success("Brouillon enregistré", "Le devoir est enregistré en mode brouillon.");
      onSaved(draft);
      onClose();
    } catch (err: any) {
      toastMsg.error("Erreur de sauvegarde", err.message || "Impossible d'enregistrer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validation.isValid) {
      toastMsg.error("Publication bloquée", "Veuillez corriger les éléments obligatoires avant de publier.");
      return;
    }
    setIsSaving(true);
    try {
      const published = {
        ...form,
        statut: "publie" as const,
        datePublication: form.datePublication || new Date().toISOString(),
      };
      const res = await persistAssignmentToSupabase(published);
      if (!res.success) throw new Error(res.error);
      toastMsg.success("Devoir publié !", "Le devoir est désormais visible et disponible pour les apprenants.");
      onSaved(published);
      onClose();
    } catch (err: any) {
      toastMsg.error("Erreur de publication", err.message || "Impossible de publier.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={assignment ? `Modifier le devoir — ${form.titre || "Sans titre"}` : "Nouveau Devoir Pédagogique"}
      wide
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Volet gauche & centre (2 colonnes) : Contenu & Configuration */}
        <div className="lg:col-span-2 space-y-5">
          {/* Navigation par onglets */}
          <div className="flex border-b border-white/10 gap-2 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "general"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              1. Informations Générales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consignes")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "consignes"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              2. Consignes & Sujet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("parametres")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "parametres"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              3. Modalités & Barème
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("fichiers")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "fichiers"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              4. Pièces Jointes ({form.attachments?.length || 0})
            </button>
          </div>

          {/* Onglet 1 : Général */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <Field label="Titre du devoir *">
                <Input
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  placeholder="Ex : Travaux Pratiques — Audit de Sécurité et Analyse Réseau"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Formation">
                  <Select
                    value={form.formation || "informatique"}
                    onChange={(e) => setForm({ ...form, formation: e.target.value as any })}
                  >
                    <option value="informatique">Informatique & Cybersécurité</option>
                    <option value="industriel">Génie Industriel</option>
                  </Select>
                </Field>

                <Field label="Module associé *">
                  <Select
                    value={form.moduleId}
                    onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
                  >
                    <option value="">— Sélectionner un module —</option>
                    {db.modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.numero}. {m.titre}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Formateur responsable *">
                  <Select
                    value={form.teacherId}
                    onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                  >
                    <option value="">— Sélectionner un formateur —</option>
                    {db.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.prenom} {t.nom} ({t.specialite})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Audience cible">
                  <Select
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
                  >
                    <option value="all">Tous les apprenants du module</option>
                    <option value="formation">Toute la formation</option>
                    <option value="groupe">Un groupe spécifique</option>
                  </Select>
                </Field>
              </div>

              {form.audience === "groupe" && (
                <Field label="Identifiant du groupe / promotion">
                  <Input
                    value={form.targetGroupe || ""}
                    onChange={(e) => setForm({ ...form, targetGroupe: e.target.value })}
                    placeholder="Ex: Promotion Alpha 2026"
                  />
                </Field>
              )}

              <Field label="Description courte (optionnelle)">
                <Input
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Bref résumé des objectifs pédagogiques..."
                />
              </Field>
            </div>
          )}

          {/* Onglet 2 : Consignes & Sujet */}
          {activeTab === "consignes" && (
            <div className="space-y-4">
              <Field label="Consignes détaillées du devoir * (Markdown supporté)">
                <Textarea
                  rows={10}
                  value={form.consignes}
                  onChange={(e) => setForm({ ...form, consignes: e.target.value })}
                  placeholder="Rédigez ici les objectifs, les étapes attendues, les critères de notation et les règles de remise..."
                />
              </Field>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-300">
                <p className="font-semibold text-cyan-300 mb-1">💡 Bonnes pratiques :</p>
                <p>
                  Indiquez clairement le livrable attendu (ex : rapport PDF + code source en archive ZIP),
                  la structure de nommage des fichiers et les critères de notation.
                </p>
              </div>
            </div>
          )}

          {/* Onglet 3 : Paramètres & Échéance */}
          {activeTab === "parametres" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Date limite de remise *">
                  <Input
                    type="date"
                    value={form.dateLimite}
                    onChange={(e) => setForm({ ...form, dateLimite: e.target.value })}
                  />
                </Field>
                <Field label="Heure limite">
                  <Input
                    type="time"
                    value={form.heureLimite || "23:59"}
                    onChange={(e) => setForm({ ...form, heureLimite: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Barème maximal (pts)">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.bareme}
                    onChange={(e) => setForm({ ...form, bareme: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Seuil de réussite (pts)">
                  <Input
                    type="number"
                    min={0}
                    max={form.bareme}
                    value={form.seuilReussite}
                    onChange={(e) => setForm({ ...form, seuilReussite: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Durée estimée (min)">
                  <Input
                    type="number"
                    min={15}
                    value={form.dureeEstimeeMinutes || 60}
                    onChange={(e) => setForm({ ...form, dureeEstimeeMinutes: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Contraintes des fichiers rendus
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nombre max de fichiers">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={form.nbFichiersMax}
                      onChange={(e) => setForm({ ...form, nbFichiersMax: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Taille max par fichier (Mo)">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={form.tailleMaxMo}
                      onChange={(e) => setForm({ ...form, tailleMaxMo: Number(e.target.value) })}
                    />
                  </Field>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-2">Formats autorisés :</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_FORMATS.map((fmt) => {
                      const checked = form.formatsAutorises.includes(fmt.id);
                      return (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => handleToggleFormat(fmt.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                            checked
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                              : "border-white/10 bg-black/20 text-slate-400 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                              checked ? "border-emerald-400 bg-emerald-500 text-black" : "border-slate-500"
                            }`}
                          >
                            {checked && "✓"}
                          </span>
                          <span className="truncate">{fmt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Règles de remise & correction
                </p>

                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04]">
                  <input
                    type="checkbox"
                    checked={form.autoriserRemiseTardive}
                    onChange={(e) => setForm({ ...form, autoriserRemiseTardive: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Autoriser les remises tardives
                    </span>
                    <p className="text-[11px] text-slate-400">
                      L'apprenant pourra remettre après l'échéance, avec la mention « En retard ».
                    </p>
                  </div>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <Field label="Nombre maximal de remises autorisées">
                    <Select
                      value={form.tentativesMax}
                      onChange={(e) => setForm({ ...form, tentativesMax: Number(e.target.value) })}
                    >
                      <option value={1}>1 seule remise (Définitive)</option>
                      <option value={2}>2 remises</option>
                      <option value={3}>3 remises</option>
                      <option value={0}>Illimité (Tant que le devoir est ouvert)</option>
                    </Select>
                  </Field>

                  <Field label="Visibilité de la correction">
                    <Select
                      value={form.correctionVisibleImmediatement ? "immediate" : "manuelle"}
                      onChange={(e) => setForm({ ...form, correctionVisibleImmediatement: e.target.value === "immediate" })}
                    >
                      <option value="immediate">Immédiate dès validation par le formateur</option>
                      <option value="manuelle">Manuelle (Diffusion différée)</option>
                    </Select>
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 4 : Pièces jointes du formateur */}
          {activeTab === "fichiers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Documents de cours & Sujet officiel</h4>
                  <p className="text-xs text-slate-400">
                    Ces documents seront téléchargeables par les apprenants.
                  </p>
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">
                    <Upload size={13} /> {isUploading ? "Envoi..." : "Ajouter un fichier"}
                  </span>
                  <input
                    type="file"
                    multiple
                    disabled={isUploading}
                    onChange={handleAttachmentUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {(!form.attachments || form.attachments.length === 0) ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                  <FileText size={32} className="mx-auto mb-2 text-slate-600" />
                  Aucune pièce jointe. Vous pouvez joindre un énoncé PDF, un tableau Excel ou une archive de ressources.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <FileText size={16} className="text-cyan-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">{att.originalName}</span>
                        <span className="text-slate-500 text-[11px] shrink-0">
                          · {fileKind(att.mime, att.originalName)} · {humanSize(att.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Volet droit (1 colonne) : Checklist de validation en direct & Actions */}
        <div className="space-y-4">
          <Card className="p-4 bg-slate-900/60 border-white/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 mb-3">
              <ShieldCheck size={15} /> Checklist de publication
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className={form.titre.trim() ? "text-emerald-400" : "text-red-400"}>
                  {form.titre.trim() ? "✓" : "✕"}
                </span>
                <span className={form.titre.trim() ? "text-slate-300" : "text-slate-500"}>
                  Titre du devoir renseigné
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.moduleId ? "text-emerald-400" : "text-red-400"}>
                  {form.moduleId ? "✓" : "✕"}
                </span>
                <span className={form.moduleId ? "text-slate-300" : "text-slate-500"}>
                  Module associé valide
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.teacherId ? "text-emerald-400" : "text-red-400"}>
                  {form.teacherId ? "✓" : "✕"}
                </span>
                <span className={form.teacherId ? "text-slate-300" : "text-slate-500"}>
                  Formateur responsable désigné
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.consignes.trim() ? "text-emerald-400" : "text-red-400"}>
                  {form.consignes.trim() ? "✓" : "✕"}
                </span>
                <span className={form.consignes.trim() ? "text-slate-300" : "text-slate-500"}>
                  Consignes rédigées
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.dateLimite ? "text-emerald-400" : "text-red-400"}>
                  {form.dateLimite ? "✓" : "✕"}
                </span>
                <span className={form.dateLimite ? "text-slate-300" : "text-slate-500"}>
                  Date limite de remise définie ({form.dateLimite || "non fixée"})
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.bareme > 0 ? "text-emerald-400" : "text-red-400"}>
                  {form.bareme > 0 ? "✓" : "✕"}
                </span>
                <span className="text-slate-300">
                  Barème : {form.bareme} pts (Seuil : {form.seuilReussite} pts)
                </span>
              </div>

              <div className="flex items-start gap-2">
                <span className={form.formatsAutorises.length > 0 ? "text-emerald-400" : "text-red-400"}>
                  {form.formatsAutorises.length > 0 ? "✓" : "✕"}
                </span>
                <span className="text-slate-300">
                  Formats ({form.formatsAutorises.length}) · Max {form.nbFichiersMax} fichiers
                </span>
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-[11px] text-red-300">
                <p className="font-semibold flex items-center gap-1 mb-1">
                  <AlertTriangle size={12} /> Éléments bloquants :
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {validation.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Btn
              variant="outline"
              className="w-full text-xs py-2 justify-center"
              onClick={() => onPreview(form)}
            >
              <Eye size={14} /> Prévisualiser (Vue Apprenant)
            </Btn>

            <Btn
              variant="ghost"
              className="w-full text-xs py-2 justify-center border border-white/10"
              disabled={isSaving}
              onClick={handleSaveDraft}
            >
              <Save size={14} /> Enregistrer en Brouillon
            </Btn>

            <Btn
              variant="green"
              className="w-full text-xs py-2.5 justify-center font-bold"
              disabled={!validation.isValid || isSaving}
              onClick={handlePublish}
            >
              <Send size={14} /> {isSaving ? "Publication..." : "Valider & Publier"}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
