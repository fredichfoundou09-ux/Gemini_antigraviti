import React, { useState, useMemo } from "react";
import {
  FileText, CheckCircle2, User, Search, Award, AlertCircle, Save,
  RotateCcw, Download, Check, Users
} from "lucide-react";
import { Assessment } from "@/modules/assessments/types";
import { Btn, Modal, Field, Input, Badge, Card, Select } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { notifyAssessmentEvent, broadcastSubmissionsChange } from "../services/unifiedSyncService";
import { generateClassGradeRoster } from "@/modules/assessments/exporters/printableExamPdf";

interface BatchPaperGradingModalProps {
  open: boolean;
  onClose: () => void;
  assessments: Assessment[];
  preselectedAssessmentId?: string;
  onSuccess?: () => void;
}

interface StudentGradeRow {
  studentId: string;
  nom: string;
  prenom: string;
  matricule?: string;
  groupe?: string;
  formation?: string;
  statut: "present" | "absent" | "dispense";
  note: string; // string for input handling
  appreciation: string;
}

export function BatchPaperGradingModal({
  open,
  onClose,
  assessments,
  preselectedAssessmentId,
  onSuccess,
}: BatchPaperGradingModalProps) {
  const { db, update, log, notify } = useStore();

  const [selectedTestId, setSelectedTestId] = useState<string>(
    preselectedAssessmentId || (assessments[0]?.id ?? "")
  );
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === selectedTestId),
    [assessments, selectedTestId]
  );

  const bareme = selectedAssessment?.bareme || 20;

  // Apprenants éligibles pour cette épreuve
  const eligibleStudents = useMemo(() => {
    if (!selectedAssessment) return [];
    return (db.students || []).filter((s) => {
      // Filtrer par module si l'étudiant a des modules
      if (s.modules && s.modules.length > 0 && selectedAssessment.moduleId) {
        if (!s.modules.includes(selectedAssessment.moduleId)) return false;
      }
      // Filtrer par formation si spécifié
      if (selectedAssessment.formation && s.formation && s.formation !== selectedAssessment.formation) {
        return false;
      }
      return true;
    });
  }, [db.students, selectedAssessment]);

  // Groupes uniques disponibles
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    eligibleStudents.forEach((s) => {
      if (s.groupe) set.add(s.groupe);
      if ((s as any).classe) set.add((s as any).classe);
    });
    return Array.from(set).sort();
  }, [eligibleStudents]);

  // État local des notes saisies : studentId -> StudentGradeRow
  const [rows, setRows] = useState<Record<string, StudentGradeRow>>({});

  // Initialisation des lignes à la sélection d'une épreuve
  React.useEffect(() => {
    if (!selectedAssessment) return;
    const initial: Record<string, StudentGradeRow> = {};

    eligibleStudents.forEach((s) => {
      // Vérifier si une note existe déjà dans db.results ou db.grades
      const existingRes = (db.results || []).find(
        (r) => (r.testId === selectedAssessment.id || (r as any).test_id === selectedAssessment.id) &&
               (r.studentId === s.id || (r as any).student_id === s.id)
      );
      const existingGrd = (db.grades || []).find(
        (g) => g.moduleId === selectedAssessment.moduleId && g.studentId === s.id
      );

      const existingNote = existingRes?.note !== undefined
        ? String(existingRes.note)
        : existingGrd?.note !== undefined
        ? String(Math.round(((existingGrd.note / 20) * bareme) * 10) / 10)
        : "";

      initial[s.id] = {
        studentId: s.id,
        nom: s.nom,
        prenom: s.prenom,
        matricule: (s as any).matricule || s.id.slice(0, 8),
        groupe: s.groupe || (s as any).classe || "Général",
        formation: s.formation,
        statut: "present",
        note: existingNote,
        appreciation: existingGrd?.appreciation || (existingNote ? `Examen papier : ${selectedAssessment.titre}` : ""),
      };
    });

    setRows(initial);
  }, [selectedAssessment, eligibleStudents, db.results, db.grades, bareme]);

  const updateRow = (studentId: string, patch: Partial<StudentGradeRow>) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...patch,
      },
    }));
  };

  // Filtrage des lignes pour l'affichage
  const displayedStudents = useMemo(() => {
    return eligibleStudents.filter((s) => {
      if (filterGroup !== "all") {
        const grp = s.groupe || (s as any).classe;
        if (grp !== filterGroup) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const fullName = `${s.prenom} ${s.nom}`.toLowerCase();
        const mat = ((s as any).matricule || s.id).toLowerCase();
        if (!fullName.includes(q) && !mat.includes(q)) return false;
      }
      return true;
    });
  }, [eligibleStudents, filterGroup, search]);

  // Remplissage rapide
  const handleSetAllPresent = () => {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], statut: "present" };
      });
      return next;
    });
    toastMsg.info("Tous les apprenants marqués comme présents.");
  };

  // Télécharger la fiche d'émargement / bordereau PDF
  const handleDownloadRosterPdf = () => {
    if (!selectedAssessment) return;
    const stuList = displayedStudents.map((s) => ({
      id: s.id,
      nom: s.nom,
      prenom: s.prenom,
      matricule: (s as any).matricule || s.id.slice(0, 10),
      groupe: s.groupe,
    }));
    const doc = generateClassGradeRoster(selectedAssessment, stuList, {
      moduleName: selectedAssessment.moduleId,
    });
    doc.save(`bordereau_notes_${selectedAssessment.titre.replace(/\s+/g, "_")}.pdf`);
    toastMsg.success("Bordereau PDF téléchargé ✓");
  };

  // Enregistrer toutes les notes saisies
  const handleSaveAll = async () => {
    if (!selectedAssessment) return;
    setIsSubmitting(true);

    try {
      let savedCount = 0;
      const todayStr = new Date().toISOString().slice(0, 10);
      const newResults: any[] = [];
      const newGrades: any[] = [];

      Object.values(rows).forEach((row) => {
        if (row.statut !== "present" || row.note.trim() === "") return;

        const val = parseFloat(row.note.replace(",", "."));
        if (isNaN(val) || val < 0 || val > bareme) return;

        const noteSur20 = Math.round(((val / (bareme || 20)) * 20) * 10) / 10;
        const resultId = `RES_PAPER_${selectedAssessment.id}_${row.studentId}`;
        const gradeId = `GRD_TEST_${resultId}`;

        // 1. Résultat d'évaluation
        newResults.push({
          id: resultId,
          testId: selectedAssessment.id,
          test_id: selectedAssessment.id,
          studentId: row.studentId,
          student_id: row.studentId,
          studentNom: row.nom,
          studentPrenom: row.prenom,
          note: val,
          bareme: bareme,
          pourcentage: Math.round((val / bareme) * 100),
          date: todayStr,
          heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          valide: true,
          statut: val >= (bareme / 2) ? "reussi" : "echoue",
          correctionType: "manuelle",
          reponses: {},
        });

        // 2. Note officielle pour bulletin
        newGrades.push({
          id: gradeId,
          studentId: row.studentId,
          student_id: row.studentId,
          moduleId: selectedAssessment.moduleId,
          note: noteSur20,
          appreciation: row.appreciation.trim() || `Examen physique : ${selectedAssessment.titre}`,
          date: todayStr,
        });

        // 3. Notification élève
        notifyAssessmentEvent({
          targetUserId: row.studentId,
          title: "Note d'examen saisie",
          body: `Votre note pour « ${selectedAssessment.titre} » a été enregistrée : ${val}/${bareme} pts (${noteSur20}/20).`,
          type: "note",
          url: "/app/mes-evaluations-devoirs",
          storeNotify: notify,
        });

        savedCount++;
      });

      if (savedCount === 0) {
        toastMsg.error("Aucune note saisie", "Veuillez renseigner au moins une note valide pour enregistrer.");
        setIsSubmitting(false);
        return;
      }

      // Mise à jour atomique dans le store global
      update((d) => {
        const studentIdsSaved = new Set(newResults.map((r) => r.studentId));
        return {
          ...d,
          results: [
            ...(d.results || []).filter(
              (r) => !(r.testId === selectedAssessment.id && studentIdsSaved.has(r.studentId))
            ),
            ...newResults,
          ],
          grades: [
            ...(d.grades || []).filter(
              (g) => !(g.moduleId === selectedAssessment.moduleId && studentIdsSaved.has(g.studentId))
            ),
            ...newGrades,
          ],
        };
      });

      log(`Bordereau examen papier validé pour « ${selectedAssessment.titre} » : ${savedCount} notes enregistrées.`);
      broadcastSubmissionsChange();
      toastMsg.success("Bordereau validé avec succès ✓", `${savedCount} note(s) synchronisée(s) vers le relevé de notes.`);

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toastMsg.error("Erreur d'enregistrement", e.message || "Échec de l'opération.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Saisie de bordereau — Examen Papier / Présentiel"
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* En-tête : Choix de l'épreuve & Filtre de groupe */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-white/10 bg-slate-900/60 p-3.5">
          <Field label="Évaluation / Examen concerné">
            <Select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="text-xs"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titre} ({a.duree} min • /{a.bareme} pts • {a.moduleId})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Filtrer par classe ou groupe">
            <Select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="text-xs"
            >
              <option value="all">Tous les groupes ({eligibleStudents.length} élèves)</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Barre d'actions rapides & Recherche */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Rechercher par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs py-1"
              />
            </div>
            <button
              type="button"
              onClick={handleSetAllPresent}
              className="text-[11px] rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              Tous présents
            </button>
          </div>

          <Btn
            variant="outline"
            className="text-xs py-1.5 px-3 gap-1.5"
            onClick={handleDownloadRosterPdf}
          >
            <Download size={13} /> Fiche d'émargement PDF
          </Btn>
        </div>

        {/* Tableau matriciel de saisie des notes */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold">
                  <th className="py-2.5 px-3">Apprenant</th>
                  <th className="py-2.5 px-3">Groupe</th>
                  <th className="py-2.5 px-3 w-28">Statut</th>
                  <th className="py-2.5 px-3 w-32">Note (/{bareme})</th>
                  <th className="py-2.5 px-3">Observation / Appréciation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {displayedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                      Aucun apprenant trouvé pour cette sélection.
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map((s) => {
                    const row = rows[s.id] || {
                      studentId: s.id,
                      nom: s.nom,
                      prenom: s.prenom,
                      statut: "present",
                      note: "",
                      appreciation: "",
                    };
                    const isPresent = row.statut === "present";

                    return (
                      <tr key={s.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-white">
                            {s.nom.toUpperCase()} {s.prenom}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {(s as any).matricule || s.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {s.groupe || (s as any).classe || "—"}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.statut}
                            onChange={(e) => updateRow(s.id, { statut: e.target.value as any })}
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                          >
                            <option value="present">Présent</option>
                            <option value="absent">Absent</option>
                            <option value="dispense">Dispensé</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max={bareme}
                              disabled={!isPresent}
                              value={row.note}
                              onChange={(e) => updateRow(s.id, { note: e.target.value })}
                              placeholder={`0 à ${bareme}`}
                              className={`w-full rounded-lg border px-2.5 py-1 text-xs font-bold text-white placeholder-slate-600 focus:outline-none ${
                                !isPresent
                                  ? "border-slate-850 bg-slate-900/40 text-slate-600 cursor-not-allowed"
                                  : row.note !== ""
                                  ? "border-cyan-500/60 bg-cyan-950/20 text-cyan-200"
                                  : "border-slate-800 bg-slate-900 focus:border-cyan-400"
                              }`}
                            />
                            <span className="pointer-events-none absolute right-2 text-[10px] text-slate-500 font-mono">
                              /{bareme}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            disabled={!isPresent}
                            value={row.appreciation}
                            onChange={(e) => updateRow(s.id, { appreciation: e.target.value })}
                            placeholder="Ex : Bon raisonnement, copie soignée..."
                            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pied de modal : Statistiques & Validation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              Notes saisies :{" "}
              <strong className="text-cyan-400">
                {Object.values(rows).filter((r) => r.statut === "present" && r.note.trim() !== "").length}
              </strong>{" "}
              sur {displayedStudents.length}
            </span>
          </div>

          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>
              Annuler
            </Btn>
            <Btn
              onClick={handleSaveAll}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
            >
              <Save size={14} />
              {isSubmitting ? "Validation..." : "Valider et synchroniser le relevé"}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
