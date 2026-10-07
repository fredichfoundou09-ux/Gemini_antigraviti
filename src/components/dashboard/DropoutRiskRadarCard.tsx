import { useState, useMemo } from "react";
import {
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  User,
  PhoneCall,
  Calendar,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Card, Btn, Badge, Modal } from "@/lib/ui";
import {
  RiskScore,
  riskService,
  StudentFollowup,
} from "@/modules/students/services/riskService";

interface DropoutRiskRadarCardProps {
  scores: RiskScore[];
  onScoresUpdated: () => void;
  loading?: boolean;
}

export function DropoutRiskRadarCard({
  scores,
  onScoresUpdated,
  loading = false,
}: DropoutRiskRadarCardProps) {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [recalculating, setRecalculating] = useState(false);

  // Modale d'intervention / suivi
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<RiskScore | null>(null);
  const [followupType, setFollowupType] = useState<StudentFollowup["type"]>("appel");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDueDate, setFollowupDueDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
  );
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const stats = useMemo(() => {
    const critique = scores.filter((s) => s.level === "critique").length;
    const eleve = scores.filter((s) => s.level === "eleve").length;
    const modere = scores.filter((s) => s.level === "modere").length;
    const faible = scores.filter((s) => s.level === "faible").length;
    return { critique, eleve, modere, faible, total: scores.length };
  }, [scores]);

  const filteredScores = useMemo(() => {
    if (levelFilter === "all") return scores;
    return scores.filter((s) => s.level === levelFilter);
  }, [scores, levelFilter]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    const res = await riskService.computeRiskScores();
    if (res.success) {
      setFeedbackNotice(
        `Calcul actualisé : ${res.updatedCount || 0} apprenant(s) analysés, ${res.highRiskCount || 0} cas prioritaires.`
      );
      setTimeout(() => setFeedbackNotice(null), 5000);
      onScoresUpdated();
    } else {
      setFeedbackNotice(`Erreur : ${res.error}`);
      setTimeout(() => setFeedbackNotice(null), 5000);
    }
    setRecalculating(false);
  };

  const handleOpenFollowup = (s: RiskScore) => {
    setSelectedStudent(s);
    setFollowupNote("");
    setFollowupModalOpen(true);
  };

  const handleSaveFollowup = async () => {
    if (!selectedStudent || !followupNote.trim()) return;
    setSavingFollowup(true);
    const res = await riskService.addFollowup({
      student_id: selectedStudent.student_id,
      type: followupType,
      note: followupNote.trim(),
      due_date: followupDueDate,
      status: "ouvert",
    });

    if (res.success) {
      setFeedbackNotice(`Intervention consignée pour ${selectedStudent.student?.first_name || selectedStudent.student_id}.`);
      setTimeout(() => setFeedbackNotice(null), 5000);
      setFollowupModalOpen(false);
    } else {
      setFeedbackNotice(`Erreur enregistrement : ${res.error}`);
      setTimeout(() => setFeedbackNotice(null), 5000);
    }
    setSavingFollowup(false);
  };

  const getLevelBadge = (level: RiskScore["level"]) => {
    switch (level) {
      case "critique":
        return <Badge color="red">Risque Critique</Badge>;
      case "eleve":
        return <Badge color="red">Risque Élevé</Badge>;
      case "modere":
        return <Badge color="gold">Risque Modéré</Badge>;
      case "faible":
        return <Badge color="green">Risque Faible</Badge>;
      default:
        return <Badge color="gray">{level}</Badge>;
    }
  };

  return (
    <Card className="p-4 border-[var(--sn-line)] bg-[var(--sn-black)]">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--sn-line)] pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[var(--sn-red)]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Radar de Décrochage (Alerte Précoce & Rétention)
          </h3>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/80">
            N3 Explicable
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Btn
            variant="ghost"
            onClick={handleRecalculate}
            disabled={recalculating || loading}
            className="text-xs px-2.5 py-1"
          >
            <RefreshCw className={`h-3 w-3 ${recalculating ? "animate-spin" : ""}`} />
            Recalculer
          </Btn>
        </div>
      </div>

      {feedbackNotice && (
        <div className="mt-2.5 rounded-md border border-[var(--sn-line)] bg-white/[0.03] px-3 py-2 text-xs text-white">
          {feedbackNotice}
        </div>
      )}

      {/* Résumé analytique par niveaux */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setLevelFilter("critique")}
          className={`rounded border p-2.5 text-left transition-all cursor-pointer ${
            levelFilter === "critique"
              ? "border-[var(--sn-red)] bg-[var(--sn-red-dark)]/30"
              : "border-[var(--sn-line)] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <div className="text-[10px] font-bold uppercase text-[var(--sn-red)]">Critique (≥70%)</div>
          <div className="text-xl font-black text-white">{stats.critique}</div>
        </button>

        <button
          type="button"
          onClick={() => setLevelFilter("eleve")}
          className={`rounded border p-2.5 text-left transition-all cursor-pointer ${
            levelFilter === "eleve"
              ? "border-[var(--sn-red)] bg-white/[0.06]"
              : "border-[var(--sn-line)] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <div className="text-[10px] font-bold uppercase text-[var(--sn-red)]">Élevé (45–69%)</div>
          <div className="text-xl font-black text-white">{stats.eleve}</div>
        </button>

        <button
          type="button"
          onClick={() => setLevelFilter("modere")}
          className={`rounded border p-2.5 text-left transition-all cursor-pointer ${
            levelFilter === "modere"
              ? "border-amber-400 bg-amber-400/10"
              : "border-[var(--sn-line)] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <div className="text-[10px] font-bold uppercase text-amber-400">Modéré (20–44%)</div>
          <div className="text-xl font-black text-white">{stats.modere}</div>
        </button>

        <button
          type="button"
          onClick={() => setLevelFilter("faible")}
          className={`rounded border p-2.5 text-left transition-all cursor-pointer ${
            levelFilter === "faible"
              ? "border-emerald-400 bg-emerald-400/10"
              : "border-[var(--sn-line)] bg-white/[0.02] hover:bg-white/[0.04]"
          }`}
        >
          <div className="text-[10px] font-bold uppercase text-emerald-400">Faible (&lt;20%)</div>
          <div className="text-xl font-black text-white">{stats.faible}</div>
        </button>
      </div>

      {/* Tableau détaillé des apprenants prioritaires */}
      <div className="mt-3.5 overflow-x-auto">
        {filteredScores.length === 0 ? (
          <div className="py-8 text-center text-xs text-white/50">
            Aucun apprenant correspondant au filtre sélectionné.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--sn-line)] bg-white/[0.02] text-[10px] font-bold uppercase text-white/60">
              <tr>
                <th className="px-3 py-2">Apprenant</th>
                <th className="px-3 py-2">Niveau</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Facteurs explicatifs constatés</th>
                <th className="px-3 py-2 text-right">Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sn-line)]">
              {filteredScores.slice(0, 10).map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">
                    <div>
                      {item.student
                        ? `${item.student.first_name} ${item.student.last_name}`
                        : item.student_id}
                    </div>
                    <div className="text-[10px] text-white/40">{item.student_id}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {getLevelBadge(item.level)}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-white whitespace-nowrap">
                    {item.score}%
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {item.factors && item.factors.length > 0 ? (
                        item.factors.map((f, idx) => (
                          <span
                            key={idx}
                            className="rounded border border-[var(--sn-line)] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/90"
                          >
                            {f.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-white/40">Assiduité et résultats réguliers</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <Btn
                      variant="ghost"
                      onClick={() => handleOpenFollowup(item)}
                      className="px-2.5 py-1 text-[11px]"
                    >
                      <PhoneCall className="h-3 w-3 mr-1" />
                      Planifier suivi
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale d'intervention pédagogique */}
      <Modal
        open={followupModalOpen}
        onClose={() => setFollowupModalOpen(false)}
        title="Planifier une intervention de remédiation"
      >
        {selectedStudent && (
          <div className="space-y-3.5 text-xs">
            <div className="rounded border border-[var(--sn-line)] bg-white/[0.02] p-3">
              <div className="font-bold text-white">
                Apprenant : {selectedStudent.student?.first_name} {selectedStudent.student?.last_name} ({selectedStudent.student_id})
              </div>
              <div className="text-white/60 mt-1">
                Score de risque actuel : <strong className="text-[var(--sn-red)]">{selectedStudent.score}%</strong> ({selectedStudent.level})
              </div>
            </div>

            <div>
              <label className="block font-semibold uppercase text-white/70 mb-1">
                Type d'intervention
              </label>
              <select
                aria-label="Type d'intervention"
                value={followupType}
                onChange={(e) => setFollowupType(e.target.value as any)}
                className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
              >
                <option value="appel">Appel téléphonique de contact</option>
                <option value="convocation">Convocation pédagogique</option>
                <option value="tutorat">Séance de tutorat individuel</option>
                <option value="remediation">Séance de remédiation</option>
                <option value="entretien_tuteur">Entretien avec le tuteur / répondant</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold uppercase text-white/70 mb-1">
                Échéance de l'intervention
              </label>
              <input
                aria-label="Échéance de l'intervention"
                type="date"
                value={followupDueDate}
                onChange={(e) => setFollowupDueDate(e.target.value)}
                className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-white/70 mb-1">
                Notes et objectifs de l'intervention
              </label>
              <textarea
                rows={3}
                placeholder="Précisez le motif, les points de blocage et les actions convenues..."
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setFollowupModalOpen(false)}>
                Annuler
              </Btn>
              <Btn
                variant="primary"
                onClick={handleSaveFollowup}
                disabled={savingFollowup || !followupNote.trim()}
              >
                {savingFollowup ? "Enregistrement..." : "Valider l'intervention"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
