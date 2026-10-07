import React, { useEffect, useState } from "react";
import { Award, CheckCircle2, Clock, Printer, ShieldCheck, UserCheck, BarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import {
  competencyService,
  Competency,
  StudentCompetencyProgress,
} from "@/modules/competencies/services/competencyService";
import { Card, PageHead, Badge, Btn, Progress } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const CompetencyBookletPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [progressList, setProgressList] = useState<StudentCompetencyProgress[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const isTeacherOrAdmin = profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin";

  useEffect(() => {
    // Initialiser l'apprenant cible
    if (profile?.role === "student") {
      const stu = db.students.find((s) => s.userId === profile.id);
      if (stu) setSelectedStudentId(stu.id);
    } else if (db.students.length > 0) {
      setSelectedStudentId(db.students[0].id);
    }
    loadData();
  }, [profile, db.students]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentProgress(selectedStudentId);
    }
  }, [selectedStudentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const comps = await competencyService.getCompetencies();
      setCompetencies(comps);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentProgress = async (studentId: string) => {
    const list = await competencyService.getStudentCompetencies(studentId);
    setProgressList(list);
  };

  const currentStudent = db.students.find((s) => s.id === selectedStudentId);

  // Consolidation des compétences avec la progression de l'apprenant
  const mergedCompetencies = competencies.map((comp) => {
    const prog = progressList.find((p) => p.competency_id === comp.id);
    return {
      ...comp,
      score: prog?.score || 0,
      status: prog?.status || "not_acquired",
      validation_mode: prog?.validation_mode || "auto",
      validated_by: prog?.validated_by,
      acquired_at: prog?.acquired_at,
    };
  });

  const domains = Array.from(new Set(competencies.map((c) => c.domaine)));
  const filtered = selectedDomain === "all"
    ? mergedCompetencies
    : mergedCompetencies.filter((c) => c.domaine === selectedDomain);

  const acquiredCount = mergedCompetencies.filter(
    (c) => c.status === "acquired" || c.status === "mastered"
  ).length;
  const acquisitionRate =
    mergedCompetencies.length > 0
      ? Math.round((acquiredCount / mergedCompetencies.length) * 100)
      : 0;

  const handleValidateTeacher = async (comp: Competency, newStatus: "acquired" | "mastered") => {
    if (!selectedStudentId || !profile) return;
    const res = await competencyService.validateManuallyByTeacher(
      selectedStudentId,
      comp.id,
      profile.id,
      newStatus
    );
    if (res.success) {
      toastMsg.success("Compétence validée", `${comp.nom} marquée comme ${newStatus}.`);
      loadStudentProgress(selectedStudentId);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHead
          title="Livret & Référentiel de Compétences"
          subtitle="Suivi continu des acquis pédagogiques, validation formateur et export certifié"
          actions={
            <Btn onClick={handlePrint} variant="outline">
              <Printer size={14} /> Imprimer le Livret Officiel A4
            </Btn>
          }
        />
      </div>

      {/* Sélecteur d'apprenant pour formateurs / admins */}
      {isTeacherOrAdmin && db.students.length > 0 && (
        <Card className="p-4 border border-white/10 bg-black/60 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-white">Apprenant sélectionné :</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-lg border border-white/20 bg-black px-3 py-1.5 text-xs text-white"
            >
              {db.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom} {s.nom} ({s.id}) — {s.formation}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Résumé global & Jauge de progression */}
      <Card className="p-6 border border-white/10 bg-black/60 print:border-black print:bg-white print:text-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-black text-white print:text-black">
              {currentStudent ? `${currentStudent.prenom} ${currentStudent.nom}` : "Apprenant"}
            </h2>
            <p className="text-xs text-white/60 print:text-gray-600 font-mono">
              Matricule : {currentStudent?.id} · Formation : {currentStudent?.formation}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black font-mono text-white print:text-black">
              {acquisitionRate}%
            </p>
            <p className="text-xs text-white/60 print:text-gray-600">
              {acquiredCount} sur {mergedCompetencies.length} compétences acquises
            </p>
          </div>
        </div>

        <Progress value={acquisitionRate} />
      </Card>

      {/* Filtres par domaine */}
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        <button
          type="button"
          onClick={() => setSelectedDomain("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            selectedDomain === "all" ? "bg-[#E60000] text-white" : "bg-white/5 text-white/70 hover:text-white"
          }`}
        >
          Tous les domaines ({mergedCompetencies.length})
        </button>
        {domains.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDomain(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedDomain === d ? "bg-[#E60000] text-white" : "bg-white/5 text-white/70 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Tableau des compétences */}
      <Card className="overflow-hidden border border-white/10 bg-black/60 print:border-black print:bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white print:text-black">
            <thead className="bg-[#E60000] text-white uppercase text-[10px] tracking-wider print:bg-gray-100 print:text-black">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Compétence</th>
                <th className="p-3">Domaine</th>
                <th className="p-3 text-center">Niveau</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3 text-center">Statut</th>
                {isTeacherOrAdmin && <th className="p-3 text-right print:hidden">Validation Formateur</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 print:divide-gray-200">
              {filtered.map((comp) => {
                const isAcquired = comp.status === "acquired" || comp.status === "mastered";
                return (
                  <tr key={comp.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono font-bold text-white/90 print:text-black">{comp.code}</td>
                    <td className="p-3">
                      <p className="font-bold text-white print:text-black">{comp.nom}</p>
                      {comp.description && (
                        <p className="text-[11px] text-white/50 print:text-gray-500">{comp.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-white/70 print:text-gray-700">{comp.domaine}</td>
                    <td className="p-3 text-center font-mono">{comp.niveau_requis}</td>
                    <td className="p-3 text-center font-mono font-bold">
                      {comp.score ? `${comp.score}%` : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        color={
                          comp.status === "mastered"
                            ? "blue"
                            : comp.status === "acquired"
                            ? "green"
                            : comp.status === "in_progress"
                            ? "gold"
                            : "red"
                        }
                      >
                        {comp.status === "mastered"
                          ? "Maîtrisé"
                          : comp.status === "acquired"
                          ? "Acquis"
                          : comp.status === "in_progress"
                          ? "En cours"
                          : "Non acquis"}
                      </Badge>
                    </td>

                    {/* Actions de validation formateur (hybride) */}
                    {isTeacherOrAdmin && (
                      <td className="p-3 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleValidateTeacher(comp, "acquired")}
                            className="px-2 py-1 text-[10px] font-bold rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 cursor-pointer"
                            title="Valider comme acquis"
                          >
                            Acquis ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleValidateTeacher(comp, "mastered")}
                            className="px-2 py-1 text-[10px] font-bold rounded border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 cursor-pointer"
                            title="Valider comme maîtrisé"
                          >
                            Maîtrisé ★
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
