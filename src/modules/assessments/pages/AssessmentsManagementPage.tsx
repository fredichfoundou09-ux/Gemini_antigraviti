import React, { useState } from "react";
import {
  PlusCircle, FileSpreadsheet, Upload, Eye, CheckCircle2, Trash2, Copy,
  Archive, FileDown, Search, Filter, Layers, Clock, FileText, AlertTriangle, ArrowUpDown
} from "lucide-react";
import { Assessment, AssessmentStatus, AssessmentQuestion } from "../types";
import { AssessmentEditor } from "../components/AssessmentEditor";
import { AssessmentGeneratorModal } from "../components/AssessmentGeneratorModal";
import { DocumentImporterModal } from "../components/DocumentImporterModal";
import { AssessmentPreviewModal } from "../components/AssessmentPreviewModal";
import { AssessmentResultsView } from "../components/AssessmentResultsView";
import { generateAssessmentDocx, downloadBlob } from "../exporters/docxExport";
import { generateAssessmentPdf, downloadPdf } from "../exporters/pdfExport";
import { persistAssessmentToSupabase } from "../services/assessmentService";
import { useStore } from "@/lib/store";
import { PageHead, Btn, Card, Badge, Empty, Select, Input, Modal } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export function AssessmentsManagementPage() {
  const { db, user, update, log } = useStore();

  // Mode actif : liste | edition | resultats
  const [viewMode, setViewMode] = useState<"list" | "edit" | "results">("list");
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [inspectingResults, setInspectingResults] = useState<Assessment | null>(null);

  // Modales
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [documentImporterOpen, setDocumentImporterOpen] = useState(false);
  const [previewingAssessment, setPreviewingAssessment] = useState<Assessment | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<AssessmentStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  // Détermination des droits du formateur
  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const allowedModules = db.modules.filter((m) => {
    if (!teacher) return true;
    return (teacher.modules || []).includes(m.id) || (teacher.formations || []).includes(m.formation);
  });

  // Convertir db.tests existants vers le modèle unifié Assessment
  const allAssessments: Assessment[] = db.tests.map((t: any) => ({
    id: t.id,
    titre: t.titre,
    description: t.description || "",
    moduleId: t.moduleId,
    chapitreId: t.chapitreId,
    teacherId: t.teacherId || teacher?.id || "",
    questions: (t.questions || []).map((q: any, idx: number) => ({
      id: q.id || `q-${idx}`,
      question: q.question,
      type: q.type || "qcm",
      options: q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []),
      bonneReponse: q.bonneReponse || "",
      bonnesReponses: q.bonnesReponses || (q.bonneReponse ? [q.bonneReponse] : []),
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
  }));

  // Filtrage selon rôle et critères de recherche
  const filteredAssessments = allAssessments.filter((a) => {
    if (teacher && !allowedModules.some((m) => m.id === a.moduleId)) return false;
    if (statusFilter !== "all" && a.statut !== statusFilter) return false;
    if (moduleFilter !== "all" && a.moduleId !== moduleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.titre.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "Général";
  const teacherName = (id: string) => {
    const t = db.teachers.find((x) => x.id === id);
    return t ? `${t.prenom} ${t.nom}` : "Équipe pédagogique";
  };

  // Actions
  const handleCreateBlank = () => {
    const blank: Assessment = {
      id: `TST-${Date.now().toString(36)}`,
      titre: "",
      description: "",
      moduleId: allowedModules[0]?.id || "",
      teacherId: teacher?.id || db.teachers[0]?.id || "",
      questions: [
        {
          id: `Q-1-${Date.now().toString(36)}`,
          question: "Première question",
          type: "qcm",
          options: ["Choix A", "Choix B", "Choix C", "Choix D"],
          bonneReponse: "Choix A",
          points: 2,
          ordre: 1,
          obligatoire: true,
        },
      ],
      date: new Date().toISOString().slice(0, 10),
      duree: 45,
      bareme: 20,
      seuilReussite: 10,
      difficulte: "moyen",
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      consignes: "Lisez attentivement l'énoncé de chaque question avant de sélectionner votre réponse.",
      statut: "brouillon",
      audience: "module",
      modeSecurise: false,
      bloquerCopierColler: true,
      bloquerClicDroit: false,
      navigationLibre: true,
    };
    setEditingAssessment(blank);
    setViewMode("edit");
  };

  const handleAssessmentGenerated = (generated: Partial<Assessment>) => {
    const newAssess: Assessment = {
      id: `TST-${Date.now().toString(36)}`,
      titre: generated.titre || "Nouvelle évaluation générée",
      description: generated.description || "",
      moduleId: generated.moduleId || allowedModules[0]?.id || "",
      teacherId: generated.teacherId || teacher?.id || db.teachers[0]?.id || "",
      questions: generated.questions || [],
      date: new Date().toISOString().slice(0, 10),
      duree: generated.duree || 45,
      bareme: generated.bareme || 20,
      seuilReussite: generated.seuilReussite || 10,
      difficulte: generated.difficulte || "moyen",
      tentatives: 1,
      afficherCorrections: true,
      validationRequise: false,
      consignes: generated.consignes || "",
      statut: "brouillon",
      audience: "module",
      modeSecurise: false,
      bloquerCopierColler: true,
      bloquerClicDroit: false,
      navigationLibre: true,
    };
    setEditingAssessment(newAssess);
    setViewMode("edit");
  };

  const handleSaveDraft = async (assess: Assessment) => {
    const updated = { ...assess, statut: "brouillon" as const };
    update((d) => ({
      ...d,
      tests: [updated, ...d.tests.filter((x) => x.id !== updated.id)],
    }));
    await persistAssessmentToSupabase(updated);
    log(`Évaluation enregistrée en brouillon : ${updated.titre}`);
    setViewMode("list");
  };

  const handlePublish = async (assess: Assessment) => {
    const updated = {
      ...assess,
      statut: "publie" as const,
      datePublication: new Date().toISOString(),
    };
    update((d) => ({
      ...d,
      tests: [updated, ...d.tests.filter((x) => x.id !== updated.id)],
      notifications: [
        {
          id: `NTF-${Date.now().toString(36)}`,
          toId: "all",
          title: `Nouvelle évaluation : ${updated.titre}`,
          body: `L'évaluation du module ${modName(updated.moduleId)} est désormais ouverte.`,
          date: new Date().toISOString().slice(0, 10),
          lu: false,
          type: "test",
        },
        ...d.notifications,
      ],
    }));
    await persistAssessmentToSupabase(updated);
    log(`Évaluation publiée : ${updated.titre} (${updated.questions.length} questions)`);
    setViewMode("list");
  };

  const handleDuplicate = (assess: Assessment) => {
    const duplicated: Assessment = {
      ...assess,
      id: `TST-${Date.now().toString(36)}`,
      titre: `${assess.titre} (Copie)`,
      statut: "brouillon",
      date: new Date().toISOString().slice(0, 10),
      questions: assess.questions.map((q, i) => ({
        ...q,
        id: `Q-${Date.now().toString(36)}-${i}`,
      })),
    };
    update((d) => ({
      ...d,
      tests: [duplicated, ...d.tests],
    }));
    toastMsg.success("Évaluation dupliquée en brouillon ✓");
  };

  const handleArchive = async (assess: Assessment) => {
    const nextStatus: AssessmentStatus = assess.statut === "archive" ? "publie" : "archive";
    const updated = { ...assess, statut: nextStatus };
    update((d) => ({
      ...d,
      tests: d.tests.map((x) => x.id === assess.id ? updated : x),
    }));
    await persistAssessmentToSupabase(updated);
    toastMsg.info(nextStatus === "archive" ? "Évaluation archivée" : "Évaluation désarchivée");
  };

  const handleDelete = (assess: Assessment) => {
    const hasAttempts = db.results.some((r) => r.testId === assess.id);
    if (hasAttempts) {
      toastMsg.error("Suppression bloquée", "Cette évaluation possède déjà des tentatives d'apprenants. Vous pouvez l'archiver à la place.");
      return;
    }
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer l'évaluation "${assess.titre}" ?`)) return;

    update((d) => ({
      ...d,
      tests: d.tests.filter((x) => x.id !== assess.id),
    }));
    log(`Évaluation supprimée : ${assess.titre}`);
    toastMsg.success("Évaluation supprimée");
  };

  // Exports DOCX et PDF
  const handleExportDocx = async (assess: Assessment, includeSolutions: boolean) => {
    try {
      const blob = await generateAssessmentDocx(assess, {
        includeSolutions,
        moduleName: modName(assess.moduleId),
        teacherName: teacherName(assess.teacherId),
      });
      const suffix = includeSolutions ? "corrige-enseignant" : "epreuve-apprenant";
      downloadBlob(blob, `${assess.titre.toLowerCase().replace(/\s+/g, "_")}_${suffix}.docx`);
      toastMsg.success("Export DOCX généré avec succès ✓");
    } catch (e: any) {
      toastMsg.error("Échec export DOCX", e.message);
    }
  };

  const handleExportPdf = (assess: Assessment, includeSolutions: boolean) => {
    try {
      const doc = generateAssessmentPdf(assess, {
        includeSolutions,
        moduleName: modName(assess.moduleId),
        teacherName: teacherName(assess.teacherId),
      });
      const suffix = includeSolutions ? "corrige-enseignant" : "epreuve-apprenant";
      downloadPdf(doc, `${assess.titre.toLowerCase().replace(/\s+/g, "_")}_${suffix}.pdf`);
      toastMsg.success("Export PDF généré avec succès ✓");
    } catch (e: any) {
      toastMsg.error("Échec export PDF", e.message);
    }
  };

  // Écran d'édition
  if (viewMode === "edit" && editingAssessment) {
    return (
      <AssessmentEditor
        initialAssessment={editingAssessment}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onPreview={(a) => setPreviewingAssessment(a)}
        onCancel={() => {
          setEditingAssessment(null);
          setViewMode("list");
        }}
        allowedModules={allowedModules}
      />
    );
  }

  // Écran des résultats
  if (viewMode === "results" && inspectingResults) {
    return (
      <AssessmentResultsView
        assessment={inspectingResults}
        onBack={() => {
          setInspectingResults(null);
          setViewMode("list");
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête principal */}
      <PageHead
        title="Tests & Évaluations"
        subtitle="Gestion, génération de fichiers, passage sécurisé et corrections numériques"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="outline" onClick={() => setDocumentImporterOpen(true)}>
              <Upload size={15} /> Importer un document
            </Btn>
            <Btn variant="outline" onClick={() => setGeneratorOpen(true)}>
              <FileSpreadsheet size={15} /> Générer une évaluation
            </Btn>
            <Btn onClick={handleCreateBlank} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold">
              <PlusCircle size={15} /> Créer manuellement
            </Btn>
          </div>
        }
      />

      {/* Onglets de statuts du cycle de vie (Section #1 & #12) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-3">
        {[
          { key: "all", label: "Toutes" },
          { key: "brouillon", label: "Brouillons" },
          { key: "publie", label: "Publiées" },
          { key: "en_cours", label: "En cours" },
          { key: "termine", label: "Terminées" },
          { key: "corrige", label: "Corrigées" },
          { key: "archive", label: "Archivées" },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          const countForTab = tab.key === "all"
            ? allAssessments.length
            : allAssessments.filter((a) => a.statut === tab.key).length;

          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/40 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                isActive ? "bg-cyan-400 text-slate-950 font-bold" : "bg-white/10 text-slate-400"
              }`}>
                {countForTab}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barre de filtres et recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[240px] max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre ou mot-clé..."
            className="flex-1 bg-transparent placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="text-xs"
          >
            <option value="all">Tous les modules</option>
            {allowedModules.map((m) => (
              <option key={m.id} value={m.id}>{m.titre}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Grille des évaluations */}
      {filteredAssessments.length === 0 ? (
        <Empty
          icon={<FileText size={40} />}
          title="Aucune évaluation trouvée"
          sub="Créez votre première évaluation manuellement ou générez-la à partir d'un fichier Markdown ou Excel."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssessments.map((a) => {
            const resultsCount = db.results.filter((r) => r.testId === a.id).length;
            const hasStartedAttempts = resultsCount > 0;

            const badgeColor =
              a.statut === "publie"
                ? "green"
                : a.statut === "brouillon"
                ? "gold"
                : a.statut === "archive"
                ? "gray"
                : "cyan";

            return (
              <Card key={a.id} className="p-5 flex flex-col justify-between hover:border-white/20 transition">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge color={badgeColor}>{a.statut.toUpperCase()}</Badge>
                    <span className="text-[11px] text-slate-500 font-mono">{a.date}</span>
                  </div>

                  <h3 className="font-display mt-2 text-base font-bold text-white line-clamp-1">
                    {a.titre}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                    {modName(a.moduleId)}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Questions</span>
                      <p className="font-semibold text-white mt-0.5">{a.questions.length}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Durée</span>
                      <p className="font-semibold text-white mt-0.5">{a.duree} min</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Barème</span>
                      <p className="font-semibold text-amber-300 mt-0.5">/{a.bareme}</p>
                    </div>
                  </div>

                  {a.modeSecurise && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-red-300/90 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Mode examen sécurisé actif
                    </div>
                  )}
                </div>

                {/* Actions contextuelles */}
                <div className="mt-5 pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Btn
                      variant="outline"
                      className="flex-1 text-xs py-1.5"
                      onClick={() => {
                        setEditingAssessment(a);
                        setViewMode("edit");
                      }}
                    >
                      Modifier
                    </Btn>
                    <Btn
                      variant="outline"
                      className="text-xs py-1.5 px-2.5"
                      onClick={() => setPreviewingAssessment(a)}
                      title="Prévisualiser apprenant"
                    >
                      <Eye size={14} />
                    </Btn>
                    <Btn
                      variant="ghost"
                      className="text-xs py-1.5 px-2.5 relative"
                      onClick={() => {
                        setInspectingResults(a);
                        setViewMode("results");
                      }}
                      title="Voir les résultats"
                    >
                      <CheckCircle2 size={15} />
                      {resultsCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950">
                          {resultsCount}
                        </span>
                      )}
                    </Btn>
                  </div>

                  {/* Menu secondaire d'actions */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleExportDocx(a, false)}
                        className="rounded p-1 text-slate-400 hover:text-white"
                        title="Télécharger l'épreuve Word (.DOCX)"
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        onClick={() => handleExportPdf(a, false)}
                        className="rounded p-1 text-slate-400 hover:text-white"
                        title="Télécharger l'épreuve PDF"
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={() => handleExportPdf(a, true)}
                        className="rounded p-1 text-emerald-400 hover:text-emerald-300"
                        title="Télécharger le corrigé professeur (.PDF)"
                      >
                        Corrigé
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicate(a)}
                        className="rounded p-1 text-slate-400 hover:text-white"
                        title="Dupliquer"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => handleArchive(a)}
                        className="rounded p-1 text-slate-400 hover:text-white"
                        title={a.statut === "archive" ? "Désarchiver" : "Archiver"}
                      >
                        <Archive size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="rounded p-1 text-red-400 hover:text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modale Générateur */}
      <AssessmentGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onAssessmentGenerated={handleAssessmentGenerated}
        allowedModules={allowedModules}
        currentTeacherId={teacher?.id || "admin"}
      />

      {/* Modale Importer un document */}
      <DocumentImporterModal
        open={documentImporterOpen}
        onClose={() => setDocumentImporterOpen(false)}
        allowedModules={allowedModules}
        testsList={allAssessments.map((a) => ({ id: a.id, titre: a.titre }))}
      />

      {/* Modale Prévisualisation */}
      <AssessmentPreviewModal
        assessment={previewingAssessment}
        open={!!previewingAssessment}
        onClose={() => setPreviewingAssessment(null)}
      />
    </div>
  );
}
