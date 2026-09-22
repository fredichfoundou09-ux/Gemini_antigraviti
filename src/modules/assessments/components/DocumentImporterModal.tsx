import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, FolderPlus, Download, X } from "lucide-react";
import { Modal, Btn, Field, Select, Input } from "@/lib/ui";
import { AssessmentDocument } from "../types";
import { useStore } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  allowedModules: Array<{ id: string; titre: string }>;
  testsList?: Array<{ id: string; titre: string }>;
}

export function DocumentImporterModal({ open, onClose, allowedModules, testsList = [] }: Props) {
  const { user, db, update, log } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [moduleId, setModuleId] = useState(allowedModules[0]?.id || "");
  const [testId, setTestId] = useState("");
  const [targetGroupe, setTargetGroupe] = useState("");
  const [destination, setDestination] = useState<"supports" | "evaluation">("supports");
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setTitre("");
    setDescription("");
    setModuleId(allowedModules[0]?.id || "");
    setTestId("");
    setTargetGroupe("");
    setDestination("supports");
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!titre) {
      setTitre(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toastMsg.error("Fichier manquant", "Veuillez sélectionner un fichier à importer.");
      return;
    }
    if (!titre.trim()) {
      toastMsg.error("Titre obligatoire", "Veuillez donner un titre à ce document.");
      return;
    }

    setUploading(true);

    try {
      let fileUrl = "";
      let storageKey = "";

      // 1. Si Supabase Storage est disponible, uploader dans le bucket 'course-files'
      if (isSupabaseConfigured) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `docs/${Date.now()}_${cleanName}`;
        const { data: uploadData, error: upErr } = await supabase.storage.from("course-files").upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });

        if (!upErr && uploadData?.path) {
          storageKey = uploadData.path;
          const { data: pubData } = supabase.storage.from("course-files").getPublicUrl(uploadData.path);
          fileUrl = pubData?.publicUrl || "";
        }
      }

      // Fallback DataURL si hors-ligne ou échec storage
      if (!fileUrl) {
        fileUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      // Si rattaché aux cours/supports pédagogiques existants
      if (destination === "supports") {
        const newCourseDoc = {
          id: `DOC-${Date.now().toString(36)}`,
          titre,
          description,
          moduleId,
          teacherId: user?.id || "admin",
          type: "document" as const,
          content: description || `Document pédagogique : ${file.name}`,
          date: new Date().toISOString().slice(0, 10),
          groupe: targetGroupe || undefined,
          audience: targetGroupe ? ("groupe" as const) : ("module" as const),
          publie: true,
          files: [
            {
              id: `f-${Math.random().toString(36).slice(2, 8)}`,
              name: titre,
              originalName: file.name,
              mime: file.type || "application/octet-stream",
              size: file.size,
              dataUrl: fileUrl,
              uploadedAt: new Date().toISOString(),
            },
          ],
        };

        update((d) => ({
          ...d,
          courses: [newCourseDoc, ...d.courses],
        }));

        if (isSupabaseConfigured) {
          try {
            await supabase.from("courses").insert({
              titre: newCourseDoc.titre,
              description: newCourseDoc.description,
              module_id: moduleId,
              teacher_id: user?.id,
              type: "document",
              date_publication: new Date().toISOString(),
              publie: true,
              files: JSON.stringify(newCourseDoc.files),
            });
          } catch (e) {
            console.warn("Notice sync supabase document:", e);
          }
        }
      }

      log(`Document pédagogique importé : ${titre} (${file.name})`);
      toastMsg.success("Document importé avec succès ✓", "Il est désormais disponible dans les ressources pédagogiques.");
      onClose();
      reset();
    } catch (err: any) {
      console.error("Erreur import document:", err);
      toastMsg.error("Échec de l'import", err.message || "Impossible de charger le document.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importer un document pédagogique">
      <div className="space-y-4">
        {/* Rappel d'indépendance */}
        <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-3 text-xs text-blue-200">
          <p className="font-semibold text-blue-300">📁 Dépôt de supports de cours (Fonction indépendante)</p>
          <p className="mt-1 text-slate-300">
            Ce formulaire charge directement des fichiers (.PDF, .DOCX, .XLSX, .MD) en tant que ressources pédagogiques sans créer de questions d'évaluation.
          </p>
        </div>

        {/* Sélection du fichier */}
        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-6 text-center transition hover:border-blue-400/40 hover:bg-blue-400/[0.02]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.md,.txt,.zip"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-400/10 text-blue-400">
              <Upload size={24} />
            </div>
            <p className="mt-2 text-sm font-bold text-white">Sélectionner un document</p>
            <p className="mt-0.5 text-xs text-slate-400">PDF, Word, Excel, PowerPoint, Markdown ou Archive</p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-blue-400" />
              <div>
                <p className="font-bold text-white">{file.name}</p>
                <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(1)} Ko</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="rounded-lg p-1 text-slate-400 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <Field label="Titre du document">
          <Input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex : Guide pratique de cybersécurité offensive"
          />
        </Field>

        <Field label="Description / Contexte (optionnel)">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instructions de lecture, chapitre visé..."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Module associé">
            <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              {allowedModules.map((m) => (
                <option key={m.id} value={m.id}>{m.titre}</option>
              ))}
            </Select>
          </Field>
          <Field label="Groupe cible (optionnel)">
            <Input
              value={targetGroupe}
              onChange={(e) => setTargetGroupe(e.target.value)}
              placeholder="Tous les apprenants ou Groupe A"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
          <Btn variant="ghost" onClick={onClose} disabled={uploading}>Annuler</Btn>
          <Btn onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Envoi en cours..." : "Enregistrer le document"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
