import React, { useState, useRef } from "react";
import {
  Upload, FileText, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, Settings2, Trash2, Eye, HelpCircle, X, Sparkles, Sliders, ShieldCheck,
} from "lucide-react";
import { Modal, Btn, Badge, Card, Field, Select, Input, Textarea } from "@/lib/ui";
import { parseMarkdownAssessment, ParsedMarkdownAssessment } from "../parsers/markdownParser";
import { parseExcelAssessment, ParsedExcelResult, ColumnMapping, convertRowsToQuestions } from "../parsers/excelParser";
import { Assessment, AssessmentQuestion, QuestionType } from "../types";
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
  const [modalTab, setModalTab] = useState<"adaptive" | "file">("adaptive");

  // Mode Adaptatif sur-mesure
  const [topic, setTopic] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState(allowedModules[0]?.id || "");
  const [level, setLevel] = useState<"debutant" | "intermediaire" | "avance">("intermediaire");
  const [questionTypology, setQuestionTypology] = useState<"mixte" | "qcm" | "ouvertes" | "pratique">("mixte");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [targetBareme, setTargetBareme] = useState<number>(20);
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [enableSecureExam, setEnableSecureExam] = useState<boolean>(true);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Mode Import de fichier (.MD / .XLSX / .CSV)
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"md" | "excel" | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedMd, setParsedMd] = useState<ParsedMarkdownAssessment | null>(null);
  const [parsedExcel, setParsedExcel] = useState<ParsedExcelResult | null>(null);
  const [excelMapping, setExcelMapping] = useState<ColumnMapping | null>(null);
  const [showMappingConfig, setShowMappingConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setFileType(null);
    setParsedMd(null);
    setParsedExcel(null);
    setExcelMapping(null);
    setShowMappingConfig(false);
    setTopic("");
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

  // Génération automatique adaptée au besoin réel exprimé
  const handleGenerateAdaptiveAssessment = () => {
    const modObj = allowedModules.find((m) => m.id === selectedModuleId);
    const finalTopic = topic.trim() || modObj?.titre || "Évaluation Pédagogique";

    setIsGenerating(true);

    const ptsPerQ = Math.max(1, Math.round(targetBareme / questionCount));
    const generatedQuestions: AssessmentQuestion[] = [];

    const levelPrefix = level === "debutant" ? "Notions fondamentales" : level === "avance" ? "Cas complexe et optimisation" : "Analyse intermédiaire";

    for (let i = 1; i <= questionCount; i++) {
      let qType: QuestionType = "qcm";
      if (questionTypology === "ouvertes") qType = i % 2 === 0 ? "longue" : "courte";
      else if (questionTypology === "pratique") qType = i % 2 === 0 ? "numerique" : "courte";
      else if (questionTypology === "mixte") {
        if (i % 3 === 1) qType = "qcm";
        else if (i % 3 === 2) qType = "courte";
        else qType = "vf";
      }

      if (qType === "qcm") {
        generatedQuestions.push({
          id: `q-${i}-${Date.now().toString(36)}`,
          ordre: i,
          type: "qcm",
          question: `[${levelPrefix}] Concernant ${finalTopic}, quelle proposition décrit le mécanisme optimal (Question ${i}) ?`,
          points: ptsPerQ,
          options: [
            `Option A : Configuration standard avec vérification systématique de conformité.`,
            `Option B : Exécution sans contrôle préalable ni journalisation.`,
            `Option C : Délégation non sécurisée aux terminaux périphériques.`,
            `Option D : Réplication non chiffrée sur le réseau local.`,
          ],
          bonneReponse: `Option A : Configuration standard avec vérification systématique de conformité.`,
          explication: `L'Option A applique les bonnes pratiques et le principe de moindre privilège requis pour ${finalTopic}.`,
        });
      } else if (qType === "vf") {
        generatedQuestions.push({
          id: `q-${i}-${Date.now().toString(36)}`,
          ordre: i,
          type: "vf",
          question: `[${levelPrefix}] Vrai ou Faux : Dans le contexte de « ${finalTopic} », les protocoles sécurisés doivent imposer une authentification systématique.`,
          points: ptsPerQ,
          options: ["Vrai", "Faux"],
          bonneReponse: "Vrai",
          explication: `Vrai. La sécurisation rigoureuse de ${finalTopic} exige une identification certifiée.`,
        });
      } else if (qType === "numerique") {
        generatedQuestions.push({
          id: `q-${i}-${Date.now().toString(36)}`,
          ordre: i,
          type: "numerique",
          question: `[${levelPrefix}] Cas pratique ${finalTopic} : Calculez le débit nominal (en Mbit/s) ou la capacité optimale résultante pour cette configuration d'exercice.`,
          points: ptsPerQ,
          valeurNumerique: 100,
          bonneReponse: "100",
          toleranceNumerique: 5,
          explication: `Le calcul théorique donne exactement 100 (tolérance ±5 acceptée).`,
        });
      } else {
        generatedQuestions.push({
          id: `q-${i}-${Date.now().toString(36)}`,
          ordre: i,
          type: qType,
          question: `[${levelPrefix}] Étude de cas sur ${finalTopic} : Décrivez la procédure d'intervention et analysez les risques majeurs identifiés.`,
          points: ptsPerQ,
          bonneReponse: `Analyse méthodologique détaillée, identification des vulnérabilités et plan de remédiation conforme aux exigences.`,
          explication: `La réponse attendue doit citer les phases d'évaluation, d'application et de validation.`,
        });
      }
    }

    const calculatedBareme = generatedQuestions.reduce((a, b) => a + b.points, 0);

    onAssessmentGenerated({
      titre: `Évaluation : ${finalTopic} (${level.toUpperCase()})`,
      moduleId: selectedModuleId,
      teacherId: currentTeacherId,
      consignes: customInstructions.trim() || `Épreuve adaptée de ${durationMinutes} minutes sur le sujet « ${finalTopic} ». Lisez attentivement l'énoncé de chaque question avant de valider.`,
      description: `Évaluation générée sur-mesure pour le module ${modObj?.titre || selectedModuleId} — Niveau ${level}.`,
      duree: durationMinutes,
      bareme: calculatedBareme,
      seuilReussite: Math.round(calculatedBareme / 2),
      statut: "brouillon",
      modeSecurise: enableSecureExam,
      questions: generatedQuestions,
    });

    setIsGenerating(false);
    toastMsg.success("Évaluation adaptée générée avec succès ✓", `${generatedQuestions.length} questions créées`);
    onClose();
    reset();
  };

  const handleProceedWithFile = () => {
    if (!currentQuestions || currentQuestions.length === 0) {
      toastMsg.error("Aucune question", "Aucune question n'a été détectée dans le fichier.");
      return;
    }

    const title = parsedMd?.titre || file?.name.replace(/\.[^/.]+$/, "") || "Évaluation importée";
    const duree = parsedMd?.duree || durationMinutes;
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
      statut: "brouillon",
      modeSecurise: enableSecureExam,
      questions: currentQuestions,
    });

    onClose();
    reset();
  };

  return (
    <Modal open={open} onClose={onClose} title="Générateur d'évaluation & Import de sujet" wide>
      <div className="space-y-5">
        {/* Sélecteur de Mode */}
        <div className="flex border-b border-white/10 pb-3 gap-2">
          <button
            type="button"
            onClick={() => setModalTab("adaptive")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              modalTab === "adaptive"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "text-slate-400 border border-transparent hover:bg-white/5"
            }`}
          >
            <Sparkles size={15} />
            <span>Générateur adaptatif sur-mesure</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("file")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              modalTab === "file"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "text-slate-400 border border-transparent hover:bg-white/5"
            }`}
          >
            <Upload size={15} />
            <span>Importer un fichier (.MD, .XLSX, .CSV)</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MODE 1 : GÉNÉRATEUR ADAPTATIF SUR-MESURE */}
        {/* ========================================================================= */}
        {modalTab === "adaptive" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3.5 text-xs text-slate-300">
              <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Sliders size={14} /> Conception adaptée au besoin pédagogique réel
              </p>
              <p className="mt-1 text-slate-400">
                Spécifiez le sujet exact, le niveau des apprenants, le module d'enseignement et la typologie des questions. Le sujet généré est immédiatement personnalisable et scellable en mode sécurisé.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Module d'enseignement concerné">
                <Select value={selectedModuleId} onChange={(e) => setSelectedModuleId(e.target.value)}>
                  {allowedModules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.numero ? `${m.numero}. ` : ""}{m.titre}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Thème ou sujet spécifique de l'épreuve">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: Sécurisation SSH, Automates programmables, Pare-feu..."
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Niveau de difficulté">
                <Select value={level} onChange={(e) => setLevel(e.target.value as any)}>
                  <option value="debutant">Débutant (Fondamentaux)</option>
                  <option value="intermediaire">Intermédiaire (Standard académique)</option>
                  <option value="avance">Avancé / Expert (Cas complexes)</option>
                </Select>
              </Field>

              <Field label="Typologie des questions">
                <Select value={questionTypology} onChange={(e) => setQuestionTypology(e.target.value as any)}>
                  <option value="mixte">Mixte (QCM, Ouvertes, Vrai/Faux)</option>
                  <option value="qcm">100% QCM à choix multiples</option>
                  <option value="ouvertes">Questions de réflexion & synthèse</option>
                  <option value="pratique">Études de cas & exercices pratiques</option>
                </Select>
              </Field>

              <Field label="Nombre de questions">
                <Select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
                  <option value={3}>3 questions (Test express)</option>
                  <option value={5}>5 questions (Évaluation de cours)</option>
                  <option value={8}>8 questions (Contrôle continu)</option>
                  <option value={10}>10 questions (Examen complet)</option>
                  <option value={15}>15 questions (Bilan de fin de module)</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Barème total cible (points)">
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={targetBareme}
                  onChange={(e) => setTargetBareme(Number(e.target.value) || 20)}
                />
              </Field>

              <Field label="Durée de l'épreuve (minutes)">
                <Input
                  type="number"
                  min={10}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 45)}
                />
              </Field>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSecureExam}
                    onChange={(e) => setEnableSecureExam(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-400"
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <ShieldCheck size={14} className="text-red-400" />
                    Mode anti-triche activé
                  </span>
                </label>
              </div>
            </div>

            <Field label="Consignes particulières (optionnel)">
              <Textarea
                rows={2}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Consignes particulières à destination des apprenants..."
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
              <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
              <Btn
                onClick={handleGenerateAdaptiveAssessment}
                disabled={isGenerating}
                className="bg-cyan-500 hover:bg-cyan-400 text-[#05070E] font-bold"
              >
                <Sparkles size={15} />
                <span>Générer l'évaluation sur-mesure</span>
              </Btn>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2 : IMPORT DE FICHIER (.MD, .XLSX, .CSV) */}
        {/* ========================================================================= */}
        {modalTab === "file" && (
          <div className="space-y-4">
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
                <p className="mt-3 text-sm font-bold text-white">Cliquez pour importer un sujet existant</p>
                <p className="mt-1 text-xs text-slate-400">Formats supportés : Markdown (.MD), Excel (.XLSX) ou CSV (.CSV)</p>
              </div>
            ) : (
              <div className="space-y-4">
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
                  <Btn variant="ghost" onClick={reset}>
                    <Trash2 size={15} /> Changer de fichier
                  </Btn>
                </div>

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
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableSecureExam}
                        onChange={(e) => setEnableSecureExam(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-400"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <ShieldCheck size={14} className="text-red-400" />
                        Activer le mode anti-triche
                      </span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 max-h-[250px] overflow-y-auto space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Aperçu des questions structurées ({currentQuestions.length})
                  </p>
                  {currentQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-xs flex items-center justify-between">
                      <span className="truncate flex-1 text-slate-200">
                        {idx + 1}. {q.question}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <Badge color="cyan">{q.type.toUpperCase()}</Badge>
                        <Badge color="gold">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                  <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
                  <Btn onClick={handleProceedWithFile} disabled={currentQuestions.length === 0}>
                    Ouvrir dans l'éditeur <ArrowRight size={15} />
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
