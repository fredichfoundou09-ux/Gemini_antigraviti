import React, { useState } from "react";
import {
  FileText, PlayCircle, Eye, CheckCircle2, Clock, Award, ShieldAlert,
  Search, AlertCircle, ChevronRight, RotateCcw
} from "lucide-react";
import { Assessment, AssessmentQuestion } from "../types";
import { AssessmentRunner } from "../components/AssessmentRunner";
import { useStore } from "@/lib/store";
import { PageHead, Btn, Card, Badge, Empty, Modal } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export function StudentAssessmentsPage() {
  const { db, user } = useStore();
  const student = db.students.find((s) => s.userId === user?.id);

  const [activeRunningAssessment, setActiveRunningAssessment] = useState<Assessment | null>(null);
  const [reviewingResult, setReviewingResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<"todo" | "done" | "all">("all");

  if (!student) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        Profil étudiant introuvable. Veuillez vous reconnecter.
      </div>
    );
  }

  // Filtrer les évaluations publiées assignées à l'étudiant
  const assignedTests: Assessment[] = db.tests
    .filter((t: any) => {
      // Seules les évaluations publiées sont visibles pour l'apprenant (Section #1, #6)
      if (t.statut && t.statut !== "publie" && t.statut !== "en_cours") return false;

      // Ciblage par audience
      if (t.audience === "all") return true;
      if (t.audience === "groupe" && t.targetGroupe) {
        return student.groupe === t.targetGroupe;
      }
      if (t.audience === "apprenants" && Array.isArray(t.targetStudentIds)) {
        return t.targetStudentIds.includes(student.id);
      }
      // Par défaut : ciblage par module
      return (student.modules || []).includes(t.moduleId);
    })
    .map((t: any) => ({
      id: t.id,
      titre: t.titre,
      description: t.description || "",
      moduleId: t.moduleId,
      chapitreId: t.chapitreId,
      teacherId: t.teacherId,
      questions: (t.questions || []).map((q: any, i: number) => ({
        id: q.id || `q-${i}`,
        question: q.question,
        type: q.type || "qcm",
        options: q.options || (q.type === "vf" ? ["Vrai", "Faux"] : []),
        points: Number(q.points || 1),
        ordre: q.ordre || i + 1,
        obligatoire: q.obligatoire !== false,
        // Sécurité : NE JAMAIS transmettre bonneReponse au frontend apprenant !
        bonneReponse: undefined,
        bonnesReponses: undefined,
        explication: undefined,
      })),
      date: t.date || "",
      duree: Number(t.duree || 45),
      bareme: Number(t.bareme || 20),
      seuilReussite: Number(t.seuilReussite || 10),
      difficulte: t.difficulte || "moyen",
      tentatives: Number(t.tentatives || 1),
      afficherCorrections: t.afficherCorrections !== false,
      validationRequise: Boolean(t.validationRequise),
      consignes: t.consignes || "",
      statut: t.statut || "publie",
      audience: t.audience || "module",
      modeSecurise: Boolean(t.modeSecurise),
      bloquerCopierColler: t.bloquerCopierColler !== false,
      bloquerClicDroit: Boolean(t.bloquerClicDroit),
      navigationLibre: t.navigationLibre !== false,
    }));

  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "Module général";
  const teacherName = (id: string) => {
    const t = db.teachers.find((x) => x.id === id);
    return t ? `${t.prenom} ${t.nom}` : "Équipe pédagogique";
  };

  // Filtrage selon onglets et recherche
  const filteredList = assignedTests.filter((t) => {
    const attempts = db.results.filter((r) => r.testId === t.id && r.studentId === student.id);
    const isDone = attempts.length > 0;

    if (tabFilter === "todo" && isDone && attempts.length >= (t.tentatives || 1)) return false;
    if (tabFilter === "done" && !isDone) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.titre.toLowerCase().includes(q) || modName(t.moduleId).toLowerCase().includes(q);
    }
    return true;
  });

  // Si l'étudiant est en train de passer une évaluation
  if (activeRunningAssessment) {
    return (
      <AssessmentRunner
        rawAssessment={activeRunningAssessment}
        studentId={student.id}
        studentName={`${student.prenom} ${student.nom}`}
        onFinish={(res) => {
          setActiveRunningAssessment(null);
          toastMsg.success("Évaluation complétée !");
        }}
        onCancel={() => setActiveRunningAssessment(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Mes évaluations"
        subtitle="Épreuves en ligne chronométrées et suivi de vos résultats"
      />

      {/* Onglets et recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "Toutes mes épreuves" },
            { key: "todo", label: "À passer" },
            { key: "done", label: "Terminées" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTabFilter(tab.key as any)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                tabFilter === tab.key
                  ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white min-w-[200px]">
          <Search size={13} className="text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une épreuve..."
            className="bg-transparent placeholder-slate-500 focus:outline-none flex-1"
          />
        </div>
      </div>

      {/* Liste des évaluations */}
      {filteredList.length === 0 ? (
        <Empty
          icon={<Award size={40} />}
          title="Aucune évaluation disponible"
          sub="Toutes vos évaluations apparaîtront ici dès leur publication par vos formateurs."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredList.map((t) => {
            const attempts = db.results.filter((r) => r.testId === t.id && r.studentId === student.id);
            const latestResult = attempts[0];
            const maxAttempts = t.tentatives || 1;
            const canAttempt = attempts.length < maxAttempts;
            const bareme = t.bareme || 20;
            const seuil = t.seuilReussite || bareme / 2;
            const isPassed = latestResult && latestResult.note >= seuil;
            const canViewResult = latestResult && (latestResult.valide || !t.validationRequise);

            return (
              <Card key={t.id} className="p-5 flex flex-col justify-between hover:border-white/20 transition">
                <div>
                  <div className="flex items-center justify-between">
                    <Badge color="red">ÉVALUATION</Badge>
                    <div className="flex items-center gap-1.5">
                      {latestResult ? (
                        canViewResult ? (
                          <Badge color={isPassed ? "green" : "red"}>
                            {latestResult.note}/{bareme} ({latestResult.pourcentage}%)
                          </Badge>
                        ) : (
                          <Badge color="gold">En attente de validation</Badge>
                        )
                      ) : (
                        <Badge color="cyan">À composer</Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display mt-2 text-base font-bold text-white line-clamp-1">
                    {t.titre}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {modName(t.moduleId)} • {teacherName(t.teacherId)}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Questions</span>
                      <p className="font-semibold text-white mt-0.5">{t.questions.length}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Durée</span>
                      <p className="font-semibold text-cyan-300 mt-0.5">{t.duree} min</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Barème</span>
                      <p className="font-semibold text-amber-300 mt-0.5">/{bareme}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Tentatives autorisées : {attempts.length} / {maxAttempts}</span>
                    {t.modeSecurise && (
                      <span className="flex items-center gap-1 text-red-400 font-medium">
                        <ShieldAlert size={12} /> Épreuve sécurisée
                      </span>
                    )}
                  </div>
                </div>

                {/* Bouton d'action */}
                <div className="mt-5 pt-3 border-t border-white/5 flex gap-2">
                  <Btn
                    className="flex-1 font-bold"
                    variant={canAttempt ? "red" : "outline"}
                    disabled={!canAttempt}
                    onClick={() => setActiveRunningAssessment(t)}
                  >
                    <PlayCircle size={15} />
                    {attempts.length === 0 ? "Commencer l'évaluation" : canAttempt ? "Retenter l'épreuve" : "Épreuve terminée"}
                  </Btn>

                  {latestResult && canViewResult && t.afficherCorrections && (
                    <Btn
                      variant="ghost"
                      onClick={() => setReviewingResult({ test: t, result: latestResult })}
                      title="Consulter ma copie"
                    >
                      <Eye size={15} />
                    </Btn>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modale de révision de la copie pour l'étudiant */}
      <Modal
        open={!!reviewingResult}
        onClose={() => setReviewingResult(null)}
        title={reviewingResult ? `Copie corrigée — ${reviewingResult.test.titre}` : ""}
        wide
      >
        {reviewingResult && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <span className="font-display font-bold text-white text-sm">
                Score obtenu : {reviewingResult.result.note} / {reviewingResult.test.bareme} pts ({reviewingResult.result.pourcentage}%)
              </span>
              <Badge color={reviewingResult.result.note >= reviewingResult.test.seuilReussite ? "green" : "red"}>
                {reviewingResult.result.note >= reviewingResult.test.seuilReussite ? "Épreuve réussie ✓" : "Sous le seuil"}
              </Badge>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {reviewingResult.test.questions.map((q: any, idx: number) => {
                const given = reviewingResult.result.reponses?.[q.id];
                const givenStr = Array.isArray(given) ? given.join(", ") : String(given || "");
                return (
                  <div key={q.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1.5">
                    <p className="font-semibold text-white">{idx + 1}. {q.question} ({q.points} pts)</p>
                    <p className="text-slate-300">
                      Votre réponse : <strong className="text-cyan-300 font-mono">{givenStr || "—"}</strong>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Btn onClick={() => setReviewingResult(null)}>Fermer</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
