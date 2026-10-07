import React, { useEffect, useState } from "react";
import { FolderGit2, Search, Download, Tag, FileText, Plus, BookOpen, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { resourceService, EducationalResource } from "@/modules/resources/services/resourceService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Select, Textarea } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const ResourceLibraryPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [resources, setResources] = useState<EducationalResource[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newResource, setNewResource] = useState({
    title: "",
    description: "",
    module_id: "",
    file_url: "",
    file_type: "PDF",
    tagsStr: "cours, supports",
  });

  const isTeacherOrStaff = profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin";

  useEffect(() => {
    loadResources();
  }, [search, selectedTag, selectedModuleId]);

  const loadResources = async () => {
    const list = await resourceService.getResources({
      moduleId: selectedModuleId === "all" ? undefined : selectedModuleId,
      tag: selectedTag === "all" ? undefined : selectedTag,
      search: search.trim() || undefined,
    });
    setResources(list);
  };

  const handleCreateResource = async () => {
    if (!newResource.title || !newResource.file_url) {
      toastMsg.error("Champs obligatoires", "Veuillez renseigner le titre et l'URL du document.");
      return;
    }

    const tags = newResource.tagsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const res = await resourceService.createResource({
      title: newResource.title,
      description: newResource.description,
      module_id: newResource.module_id || undefined,
      file_url: newResource.file_url,
      file_type: newResource.file_type,
      tags,
      created_by: profile?.name || "Formateur",
    });

    if (res.success) {
      toastMsg.success("Ressource ajoutée", "Le document est maintenant accessible.");
      setShowAddModal(false);
      setNewResource({
        title: "",
        description: "",
        module_id: "",
        file_url: "",
        file_type: "PDF",
        tagsStr: "cours, supports",
      });
      loadResources();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDownload = async (r: EducationalResource) => {
    await resourceService.trackDownload(r.id);
    window.open(r.file_url, "_blank");
  };

  const allTags = Array.from(new Set(resources.flatMap((r) => r.tags || [])));

  return (
    <div className="space-y-6">
      <PageHead
        title="Bibliothèque de Ressources & Savoirs"
        subtitle="Catalogue centralisé de supports de cours, guides pratiques et manuels techniques"
        actions={
          isTeacherOrStaff ? (
            <Btn onClick={() => setShowAddModal(true)} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
              <Plus size={14} /> Ajouter une ressource
            </Btn>
          ) : undefined
        }
      />

      {/* Barre de recherche et filtres */}
      <Card className="p-4 border border-white/10 bg-black/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre..."
              className="w-full rounded-lg border border-white/15 bg-black py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/40 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
            >
              <option value="all">Tous les modules</option>
              {db.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
            >
              <option value="all">Toutes les étiquettes (tags)</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Grille des ressources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.length === 0 ? (
          <Card className="col-span-full p-8 text-center text-white/50">
            Aucun document ne correspond à vos critères de recherche.
          </Card>
        ) : (
          resources.map((r) => {
            const modObj = db.modules.find((m) => m.id === r.module_id);
            return (
              <Card key={r.id} className="p-5 border border-white/10 bg-black/60 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                        <FileText size={16} />
                      </div>
                      <h3 className="font-bold text-sm text-white line-clamp-1">{r.title}</h3>
                    </div>
                    <Badge color="red">{r.file_type || "DOC"}</Badge>
                  </div>

                  {modObj && (
                    <p className="text-[11px] font-mono text-white/50">{modObj.titre}</p>
                  )}

                  {r.description && (
                    <p className="text-xs text-white/70 line-clamp-2">{r.description}</p>
                  )}

                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.tags.map((t) => (
                        <span key={t} className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-white/60">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
                  <span>{r.downloads_count} téléchargement(s)</span>
                  <Btn onClick={() => handleDownload(r)} className="text-xs py-1 bg-[#E60000] hover:bg-[#FF2A2A] text-white">
                    <Download size={13} /> Ouvrir
                  </Btn>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal Ajout Ressource */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Publier une ressource documentaire">
        <div className="space-y-4">
          <Field label="Titre du document">
            <Input
              value={newResource.title}
              onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
              placeholder="ex: Guide de configuration Snort & Suricata"
            />
          </Field>
          <Field label="Module associé">
            <Select
              value={newResource.module_id}
              onChange={(e) => setNewResource({ ...newResource, module_id: e.target.value })}
            >
              <option value="">Général / Non rattaché</option>
              {db.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="URL du fichier (Cloud Storage / Lien externe)">
            <Input
              value={newResource.file_url}
              onChange={(e) => setNewResource({ ...newResource, file_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format">
              <Select
                value={newResource.file_type}
                onChange={(e) => setNewResource({ ...newResource, file_type: e.target.value })}
              >
                <option value="PDF">PDF</option>
                <option value="DOCX">Word (.docx)</option>
                <option value="ZIP">Archive (.zip)</option>
                <option value="VIDEO">Vidéo (.mp4)</option>
              </Select>
            </Field>
            <Field label="Étiquettes (séparées par virgules)">
              <Input
                value={newResource.tagsStr}
                onChange={(e) => setNewResource({ ...newResource, tagsStr: e.target.value })}
                placeholder="reseaux, securite, tp"
              />
            </Field>
          </div>
          <Field label="Description brève">
            <Textarea
              value={newResource.description}
              onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
              placeholder="Contenu synthétique du document..."
            />
          </Field>
          <Btn onClick={handleCreateResource} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold">
            Ajouter au catalogue
          </Btn>
        </div>
      </Modal>
    </div>
  );
};
