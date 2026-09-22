import React, { useState, useRef } from "react";
import {
  Upload, FileText, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, Settings2, Trash2, Eye, HelpCircle, X
} from "lucide-react";
import { Modal, Btn, Badge, Card, Field, Select, Input } from "@/lib/ui";
import { parseMarkdownAssessment, ParsedMarkdownAssessment } from "../parsers/markdownParser";
import { parseExcelAssessment, ParsedExcelResult, ColumnMapping, convertRowsToQuestions } from "../parsers/excelParser";
import { Assessment, AssessmentQuestion } from "../types";
import { toastMsg } from "@/lib/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onAssessmentGenerated: (generatedData: Partial<Assessment>) => void;
  allowedModules: Array<{ id: string; titre: string; numero?: number }>;
  currentTeacherId: string;
}

export function AssessmentGeneratorModal({
  open,
  onClose,
  onAssessmentGenerated,
  allowedModules,
  currentTeacherId,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"md" | "excel" | null>(null);
  const [loading, setLoading] = useState(false);

  // Résultats d'analyse
  const [parsedMd, setParsedMd] = useState<ParsedMarkdownAssessment | null>(null);
  const [parsedExcel, setParsedExcel] = useState<ParsedExcelResult | null>(null);
  const [excelMapping, setExcelMapping] = useState<ColumnMapping | null>(null);
  const [showMappingConfig, setShowMappingConfig] = useState(false);

  // Métadonnées à appliquer
  const [selectedModuleId, setSelectedModuleId] = useState(allowedModules[0]?.id || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setFileType(null);
    setParsedMd(null);
    setParsedExcel(null);
    setExcelMapping(null);
    setShowMappingConfig(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLoading(true);

    const ext = f.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "md" || ext === "markdown" || ext === "txt") {
        setFileType("md");
        const text = await f.text();
        const res = parseMarkdownAssessment(text);
        setParsedMd(res);
        toastMsg.success("Fichier Markdown analysé", `${res.questions.length} question(s) détectée(s)`);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        setFileType("excel");
        const res = await parseExcelAssessment(f);
        setParsedExcel(res);
        setExcelMapping(res.detectedMapping);
        if (res.isAmbiguous) {
          setShowMappingConfig(true);
        }
        toastMsg.success("Fichier Excel analysé", `${res.questions.length} question(s) détectée(s)`);
      } else {
        toastMsg.error("Format non supporté", "Veuillez importer un fichier .MD, .XLSX ou .CSV.");
        reset();
      }
    } catch (err: any) {
      console.error("Erreur parsing fichier:", err);
      toastMsg.error("Erreur d'analyse", err.message || "Le fichier n'a pas pu être lu correctement.");
      reset();
    } finally {
      setLoading(false);
    }
  };

  const currentQuestions: AssessmentQuestion[] = parsedMd
    ? parsedMd.questions
    : parsedExcel
    ? parsedExcel.questions
    : [];

  const handleUpdateExcelMapping = (updated: ColumnMapping) => {
    setExcelMapping(updated);
    if (parsedExcel) {
      const regenerated = convertRowsToQuestions(parsedExcel.rows, updated);
      setParsedExcel({
        ...parsedExcel,
        detectedMapping: updated,
        questions: regenerated,
      });
      toastMsg.info("Questions recalculées selon le nouveau mapping");
    }
  };

  const handleProceedToEditor = () => {
    if (!currentQuestions || currentQuestions.length === 0) {
      toastMsg.error("Aucune question", "Aucune question n'a été détectée dans le fichier.");
      return;
    }

    const title = parsedMd?.titre || file?.name.replace(/\.[^/.]+$/, "") || "Évaluation importée";
    const duree = parsedMd?.duree || 45;
    const bareme = parsedMd?.bareme || currentQuestions.reduce((a, b) => a + (b.points || 1), 0);

    onAssessmentGenerated({
      titre: title,
      moduleId: selectedModuleId,
      teacherId: currentTeacherId,
      consignes: parsedMd?.consignes || "Veuillez lire attentivement chaque question avant de répondre.",
      description: parsedMd?.description || `Épreuve générée à partir du document ${file?.name}`,
      duree,
      bareme,
      seuilReussite: Math.round(bareme / 2),
      statut: "brouillon", // JAMAIS publié automatiquement
      questions: currentQuestions,
    });

    onClose();
    reset();
  };

  return (
    <Modal open={open} onClose={onClose} title="Générateur d'évaluation automatique" wide>
      <div className="space-y-5">
        {/* Bandeau explicatif */}
        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3.5 text-xs text-slate-300">
          <p className="font-semibold text-cyan-300">⚡ Génération intelligente depuis vos fichiers (.MD, .XLSX)</p>
          <p className="mt-1 text-slate-400">
            Le système détecte automatiquement les consignes, les questions, les choix de réponses, les solutions et les barèmes.
            L'évaluation générée sera créée en <strong className="text-amber-300">Brouillon</strong> et ouverte dans l'éditeur pour validation humaine avant toute publication.
          </p>
        </div>

        {/* Zone de sélection du fichier */}
        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 text-center transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.02]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 group-hover:scale-105 transition">
              <Upload size={28} />
            </div>
            <p className="mt-3 text-sm font-bold text-white">Cliquez pour importer un document</p>
            <p className="mt-1 text-xs text-slate-400">Formats supportés : Markdown (.MD) ou Tableur Excel (.XLSX, .CSV)</p>
            <div className="mt-4 flex gap-2">
              <span className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">.MD (Questions, QCM, VF, Barèmes)</span>
              <span className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">.XLSX (Colonnes détectées automatiquement)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fichier chargé */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-400">
                  {fileType === "md" ? <FileText size={20} /> : <FileSpreadsheet size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{file.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} Ko • {currentQuestions.length} question(s) détectée(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {fileType === "excel" && (
                  <Btn
                    variant="outline"
                    className="text-xs py-1.5"
                    onClick={() => setShowMappingConfig(!showMappingConfig)}
                  >
                    <Settings2 size={13} /> {showMappingConfig ? "Masquer le mapping" : "Ajuster les colonnes"}
                  </Btn>
                )}
                <Btn variant="ghost" className="text-xs py-1.5" onClick={reset}>
                  <X size={14} /> Changer de fichier
                </Btn>
              </div>
            </div>

            {/* Modalité de mapping Excel si demandé */}
            {fileType === "excel" && showMappingConfig && excelMapping && parsedExcel && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.03] p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Settings2 size={14} /> Correspondance des colonnes Excel → SENTINEL’S
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <Field label="Colonne Question">
                    <Select
                      value={excelMapping.questionCol}
                      onChange={(e) => handleUpdateExcelMapping({ ...excelMapping, questionCol: e.target.value })}
                    >
                      {parsedExcel.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                  <Field label="Colonne Type (optionnel)">
                    <Select
                      value={excelMapping.typeCol || ""}
                      onChange={(e) => handleUpdateExcelMapping({ ...excelMapping, typeCol: e.target.value || undefined })}
                    >
                      <option value="">— Auto / Détecté —</option>
                      {parsedExcel.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                  <Field label="Colonne Réponse / Corrigé">
                    <Select
                      value={excelMapping.reponseCol || ""}
                      onChange={(e) => handleUpdateExcelMapping({ ...excelMapping, reponseCol: e.target.value || undefined })}
                    >
                      <option value="">— Aucune —</option>
                      {parsedExcel.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                  <Field label="Colonne Points / Barème">
                    <Select
                      value={excelMapping.pointsCol || ""}
                      onChange={(e) => handleUpdateExcelMapping({ ...excelMapping, pointsCol: e.target.value || undefined })}
                    >
                      <option value="">— Par défaut (1 pt) —</option>
                      {parsedExcel.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                  <Field label="Colonne Explication">
                    <Select
                      value={excelMapping.explicationCol || ""}
                      onChange={(e) => handleUpdateExcelMapping({ ...excelMapping, explicationCol: e.target.value || undefined })}
                    >
                      <option value="">— Aucune —</option>
                      {parsedExcel.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {/* Module d'affectation */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Associer au module">
                <Select value={selectedModuleId} onChange={(e) => setSelectedModuleId(e.target.value)}>
                  {allowedModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.numero ? `${m.numero}. ` : ""}{m.titre}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 w-full text-xs text-slate-400">
                  Total barème estimé : <strong className="text-white">{currentQuestions.reduce((a, b) => a + (b.points || 1), 0)} points</strong>
                </div>
              </div>
            </div>

            {/* Aperçu des questions détectées */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 max-h-[320px] overflow-y-auto space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Aperçu des questions structurées ({currentQuestions.length})
              </p>
              {currentQuestions.map((q, idx) => (
                <div key={q.id || idx} className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-200">
                      {idx + 1}. {q.question}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge color="cyan">{q.type.toUpperCase()}</Badge>
                      <Badge color="gold">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                    </div>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {q.options.map((opt, oIdx) => {
                        const isGood = opt === q.bonneReponse || (q.bonnesReponses && q.bonnesReponses.includes(opt));
                        return (
                          <span
                            key={oIdx}
                            className={`rounded px-2 py-0.5 text-[11px] border ${
                              isGood
                                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 font-medium"
                                : "border-white/5 bg-white/[0.02] text-slate-400"
                            }`}
                          >
                            {opt} {isGood && "✓"}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "courte" && q.bonneReponse && (
                    <p className="mt-1.5 text-slate-400">
                      Réponse attendue : <strong className="text-emerald-300 font-mono">{q.bonneReponse}</strong>
                    </p>
                  )}
                  {q.type === "numerique" && (
                    <p className="mt-1.5 text-slate-400">
                      Valeur attendue : <strong className="text-emerald-300 font-mono">{q.valeurNumerique ?? q.bonneReponse}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4">
              <span className="text-xs text-amber-300/80 flex items-center gap-1">
                <AlertTriangle size={13} />
                L'évaluation s'ouvrira dans l'éditeur avant toute mise en ligne.
              </span>
              <div className="flex items-center gap-2">
                <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
                <Btn onClick={handleProceedToEditor} disabled={currentQuestions.length === 0}>
                  Ouvrir dans l'éditeur <ArrowRight size={15} />
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
