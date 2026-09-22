import React, { useState, useEffect } from "react";
import {
  FileText, Upload, Download, Trash2, FolderPlus,
  BookOpen, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { AssignmentDocument } from "../types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Btn, Card, Field, Input, Modal, Select, Textarea } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { humanSize, fileKind, safeFileName } from "@/lib/files";

interface AssignmentDocumentImporterModalProps {
  open: boolean;
  onClose: () => void;
}

export function AssignmentDocumentImporterModal({ open, onClose }: AssignmentDocumentImporterModalProps) {
  const { db, user } = useStore();

  const [documents, setDocuments] = useState<AssignmentDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedModule, setSelectedModule] = useState(db.modules[0]?.id || "");
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");

  const teacher = db.teachers.find((t) => t.userId === user?.id);

  // Charger les documents existants
  const loadDocuments = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("assignment_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) {
        setDocuments(
          data.map((d: any) => ({
            id: d.id,
            titre: d.titre,
            description: d.description || "",
            moduleId: d.module_id,
            teacherId: d.teacher_id,
            fileName: d.file_name,
            fileUrl: d.file_url,
            fileType: d.file_type,
            fileSize: d.file_size,
            createdAt: d.created_at,
          }))
        );
      }
    } catch (e) {
      console.warn("Erreur chargement documents:", e);
    }
  };

  useEffect(() => {
    if (open) {
      loadDocuments();
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const title = docTitle.trim() || file.name.replace(/\.[^/.]+$/, "");

    setIsUploading(true);
    try {
      let finalUrl = "";
      const safe = safeFileName(file.name);
      const ext = safe.split(".").pop() || "bin";
      const storagePath = `assignments/repo/${Date.now()}-${safe}`;

      if (isSupabaseConfigured) {
        const { error: upErr } = await supabase.storage.from("course-files").upload(storagePath, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
        if (upErr) throw upErr;

        const { data: pubData } = supabase.storage.from("course-files").getPublicUrl(storagePath);
        finalUrl = pubData.publicUrl;

        // Insertion dans public.assignment_documents
        const { error: insErr } = await supabase.from("assignment_documents").insert({
          titre: title,
          description: docDescription.trim() || null,
          module_id: selectedModule || null,
          teacher_id: teacher?.id || null,
          file_name: file.name,
          file_url: finalUrl,
          file_type: file.type || ext,
          file_size: file.size,
        });
        if (insErr) throw insErr;
      }

      toastMsg.success("Document déposé", `« ${title} » a été ajouté à la banque documentaire.`);
      setDocTitle("");
      setDocDescription("");
      loadDocuments();
    } catch (err: any) {
      toastMsg.error("Échec du dépôt", err.message || "Erreur de stockage");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce document de la bibliothèque ?")) return;
    try {
      if (isSupabaseConfigured) {
        await supabase.from("assignment_documents").delete().eq("id", id);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toastMsg.success("Document supprimé");
    } catch (e: any) {
      toastMsg.error("Erreur suppression", e.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dépôt Documentaire Indépendant (Ressources & Supports)"
      wide
    >
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* Rappel d'usage */}
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-300">
          <p className="font-semibold text-cyan-300 mb-0.5">ℹ️ Principe du dépôt documentaire :</p>
          <p>
            Ce module vous permet de stocker des énoncés types, des fiches de TD ou des grilles de barème (DOCX, PDF, XLSX, MD).
            <strong> Ces documents ne génèrent pas automatiquement de devoirs</strong> et restent des ressources de référence réutilisables.
          </p>
        </div>

        {/* Formulaire de versement */}
        <Card className="p-4 bg-slate-900/40 border-white/10 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Upload size={14} /> Téléverser un nouveau document
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Titre du document (optionnel)">
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Laisser vide pour utiliser le nom du fichier"
              />
            </Field>

            <Field label="Module associé">
              <Select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
              >
                <option value="">— Tous les modules —</option>
                {db.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.numero}. {m.titre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Description / Contexte (optionnel)">
            <Input
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="Ex: Énoncé type pour travaux pratiques de cryptographie"
            />
          </Field>

          <div className="flex justify-end pt-1">
            <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={14} /> {isUploading ? "Téléversement..." : "Sélectionner un fichier (PDF, Word, Excel, MD)"}
              <input
                type="file"
                disabled={isUploading}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.md,.txt,.zip"
              />
            </label>
          </div>
        </Card>

        {/* Liste des documents déjà déposés */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Documents déposés ({documents.length})
          </h4>

          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
              <FileText size={32} className="mx-auto mb-2 text-slate-600" />
              Aucun document dans le dépôt pour le moment.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const mod = db.modules.find((m) => m.id === doc.moduleId);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <FileText size={18} className="text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <h5 className="font-semibold text-white truncate">{doc.titre}</h5>
                        <p className="text-[11px] text-slate-400 truncate">
                          {doc.fileName} · {humanSize(doc.fileSize)} {mod ? `· ${mod.titre}` : ""}
                        </p>
                        {doc.description && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">{doc.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={doc.fileName}
                        className="inline-flex items-center gap-1 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 px-2.5 py-1 rounded text-xs"
                      >
                        <Download size={12} /> Télécharger
                      </a>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-red-400 hover:text-red-300 p-1.5"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-white/10">
          <Btn variant="outline" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </Modal>
  );
}
