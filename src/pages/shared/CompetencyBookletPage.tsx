import React, { useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  UserCheck,
  BarChart2,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import {
  competencyService,
  Competency,
  StudentCompetencyProgress,
} from "@/modules/competencies/services/competencyService";
import { Card, PageHead, Badge, Btn, Progress, Modal, Field, Input, Select, Textarea, printHTML } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const CompetencyBookletPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [progressList, setProgressList] = useState<StudentCompetencyProgress[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Modales Compétence
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompData, setNewCompData] = useState({
    code: "",
    nom: "",
    description: "",
    domaine: "Cybersécurité",
    niveau_requis: 3,
  });

  const [editCompModal, setEditCompModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Competency | null>(null);
  const [editCompData, setEditCompData] = useState({
    code: "",
    nom: "",
    description: "",
    domaine: "",
    niveau_requis: 3,
  });

  const isTeacherOrAdmin =
    profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin";

  useEffect(() => {
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
  const filtered =
    selectedDomain === "all" ? mergedCompetencies : mergedCompetencies.filter((c) => c.domaine === selectedDomain);

  const acquiredCount = mergedCompetencies.filter(
    (c) => c.status === "acquired" || c.status === "mastered"
  ).length;
  const acquisitionRate =
    mergedCompetencies.length > 0 ? Math.round((acquiredCount / mergedCompetencies.length) * 100) : 0;

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

  const handleResetProgress = async (comp: Competency) => {
    if (!selectedStudentId) return;
    if (!window.confirm(`Réinitialiser l'état de la compétence « ${comp.nom} » ?`)) return;
    await competencyService.resetCompetencyProgress(selectedStudentId, comp.id);
    toastMsg.info("Progression réinitialisée", "La compétence est revenue à l'état initial.");
    loadStudentProgress(selectedStudentId);
  };

  const handleCreateCompetency = async () => {
    if (!newCompData.code.trim() || !newCompData.nom.trim()) {
      toastMsg.error("Champs requis", "Veuillez renseigner le code et le nom de la compétence.");
      return;
    }
    const res = await competencyService.createCompetency({
      code: newCompData.code.trim().toUpperCase(),
      nom: newCompData.nom.trim(),
      description: newCompData.description.trim(),
      domaine: newCompData.domaine.trim() || "Général",
      niveau_requis: Number(newCompData.niveau_requis) || 1,
    });
    if (res.success) {
      toastMsg.success("Compétence créée", "La compétence a été ajoutée au référentiel officiel.");
      setShowAddModal(false);
      setNewCompData({ code: "", nom: "", description: "", domaine: "Cybersécurité", niveau_requis: 3 });
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleOpenEdit = (comp: Competency) => {
    setEditingComp(comp);
    setEditCompData({
      code: comp.code,
      nom: comp.nom,
      description: comp.description || "",
      domaine: comp.domaine,
      niveau_requis: comp.niveau_requis,
    });
    setEditCompModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingComp) return;
    const res = await competencyService.updateCompetency(editingComp.id, {
      code: editCompData.code.trim().toUpperCase(),
      nom: editCompData.nom.trim(),
      description: editCompData.description.trim(),
      domaine: editCompData.domaine.trim(),
      niveau_requis: Number(editCompData.niveau_requis) || 1,
    });
    if (res.success) {
      toastMsg.success("Compétence mise à jour", "Les modifications sont enregistrées.");
      setEditCompModal(false);
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteCompetency = async (comp: Competency) => {
    if (!window.confirm(`Supprimer définitivement la compétence « ${comp.nom} » (${comp.code}) ?`)) return;
    const res = await competencyService.deleteCompetency(comp.id);
    if (res.success) {
      toastMsg.success("Compétence supprimée", "L'entrée a été retirée du référentiel.");
      loadData();
      if (selectedStudentId) loadStudentProgress(selectedStudentId);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handlePrintOfficialBooklet = () => {
    const studentName = currentStudent ? `${currentStudent.prenom} ${currentStudent.nom}` : "Apprenant";
    const studentMatricule = currentStudent?.id || "N/A";
    const studentFormation = currentStudent?.formation || "Formation d'excellence";

    const rowsHtml = mergedCompetencies
      .map(
        (c) => `
      <tr>
        <td><strong>${c.code}</strong></td>
        <td>
          <strong>${c.nom}</strong>
          ${c.description ? `<br><small style="color:#64748b">${c.description}</small>` : ''}
        </td>
        <td>${c.domaine}</td>
        <td style="text-align:center;font-family:monospace">${c.niveau_requis}</td>
        <td style="text-align:center;font-weight:bold">${c.score ? `${c.score}%` : '—'}</td>
        <td style="text-align:center">
          <span class="badge-official" style="${
            c.status === 'mastered'
              ? 'background:#f0fdf4;border-color:#16a34a;color:#16a34a'
              : c.status === 'acquired'
              ? 'background:#f0f9ff;border-color:#0284c7;color:#0369a1'
              : 'background:#fef2f2;border-color:#dc2626;color:#dc2626'
          }">
            ${c.status === 'mastered' ? 'MAÎTRISÉ' : c.status === 'acquired' ? 'ACQUIS' : c.status === 'in_progress' ? 'EN COURS' : 'NON ACQUIS'}
          </span>
        </td>
      </tr>
    `
      )
      .join("");

    printHTML(
      `Livret_Competences_${studentName.replace(/\s+/g, '_')}`,
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge-official">LIVRET OFFICIEL DE COMPÉTENCES & ACQUIS</span>
            <h1 style="margin:8px 0 2px 0;font-size:20px;color:#0c4a6e">${studentName}</h1>
            <p style="margin:0;font-size:11px;color:#64748b">Matricule : <strong>${studentMatricule}</strong> · Filière : <strong>${studentFormation}</strong></p>
          </div>
          <div style="text-align:right">
            <div style="font-size:26px;font-weight:900;color:#0284c7;font-family:monospace">${acquisitionRate}%</div>
            <div style="font-size:11px;color:#64748b">${acquiredCount} / ${mergedCompetencies.length} compétences validées</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:70px">Code</th>
              <th>Compétence & Description</th>
              <th>Domaine</th>
              <th style="text-align:center;width:60px">Niveau</th>
              <th style="text-align:center;width:60px">Score</th>
              <th style="text-align:center;width:110px">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center">Aucune compétence enregistrée.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
          <div>Édité le ${new Date().toLocaleDateString('fr-FR')} · Sentinelles Numériques</div>
          <div>Visa & Signature de la Direction Pédagogique : _______________</div>
        </div>
      </div>
    `
    );
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Livret & Référentiel de Compétences"
        subtitle="Suivi continu des acquis pédagogiques, validation formateur et export certifié"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={handlePrintOfficialBooklet} variant="outline" className="border-cyan-500/30 text-cyan-200">
              <Printer size={14} /> Imprimer le Livret Officiel A4
            </Btn>
            {isTeacherOrAdmin && (
              <Btn
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
              >
                <Plus size={14} /> Nouvelle Compétence
              </Btn>
            )}
          </div>
        }
      />

      {/* Sélecteur d'apprenant pour formateurs / admins */}
      {isTeacherOrAdmin && db.students.length > 0 && (
        <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
              Apprenant sélectionné :
            </span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-xl border border-cyan-500/30 bg-[#07101E] px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
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
      <Card className="p-6 border border-cyan-500/30 bg-[#0B1220]/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-black text-white">
              {currentStudent ? `${currentStudent.prenom} ${currentStudent.nom}` : "Apprenant"}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Matricule : {currentStudent?.id} · Formation : {currentStudent?.formation}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black font-mono text-cyan-300">{acquisitionRate}%</p>
            <p className="text-xs text-slate-400">
              {acquiredCount} sur {mergedCompetencies.length} compétences acquises
            </p>
          </div>
        </div>

        <Progress value={acquisitionRate} />
      </Card>

      {/* Filtres par domaine */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedDomain("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            selectedDomain === "all"
              ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              : "bg-white/5 text-slate-300 hover:text-white"
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
              selectedDomain === d
                ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                : "bg-white/5 text-slate-300 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Tableau des compétences */}
      <Card className="overflow-hidden border border-cyan-500/30 bg-[#0B1220]/90 shadow-lg p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white">
            <thead className="bg-[#07101E] text-cyan-300 uppercase text-[10px] tracking-wider border-b border-cyan-500/20">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Compétence</th>
                <th className="p-3">Domaine</th>
                <th className="p-3 text-center">Niveau</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3 text-center">Statut</th>
                {isTeacherOrAdmin && <th className="p-3 text-right">Actions Formateur</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((comp) => {
                return (
                  <tr key={comp.id} className="hover:bg-white/[0.02]">
                    <td className="p-3 font-mono font-bold text-cyan-300">{comp.code}</td>
                    <td className="p-3">
                      <p className="font-bold text-white">{comp.nom}</p>
                      {comp.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{comp.description}</p>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{comp.domaine}</td>
                    <td className="p-3 text-center font-mono">{comp.niveau_requis}</td>
                    <td className="p-3 text-center font-mono font-bold text-cyan-200">
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

                    {/* Actions Formateur : Validation, Réinitialisation, Édition, Suppression */}
                    {isTeacherOrAdmin && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
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
                          <button
                            type="button"
                            onClick={() => handleResetProgress(comp)}
                            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-white/5 cursor-pointer"
                            title="Réinitialiser l'état pour cet élève"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(comp)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-white/5 cursor-pointer"
                            title="Modifier cette compétence"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompetency(comp)}
                            className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-white/5 cursor-pointer"
                            title="Supprimer du référentiel"
                          >
                            <Trash2 size={12} />
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

      {/* Modal Créer Compétence */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Ajouter une compétence au référentiel">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code officiel (ex: SEC-03)">
              <Input
                value={newCompData.code}
                onChange={(e) => setNewCompData({ ...newCompData, code: e.target.value })}
                placeholder="SEC-03"
              />
            </Field>
            <Field label="Domaine">
              <Input
                value={newCompData.domaine}
                onChange={(e) => setNewCompData({ ...newCompData, domaine: e.target.value })}
                placeholder="Cybersécurité, Dév, Réseaux..."
              />
            </Field>
          </div>
          <Field label="Intitulé de la compétence">
            <Input
              value={newCompData.nom}
              onChange={(e) => setNewCompData({ ...newCompData, nom: e.target.value })}
              placeholder="ex: Sécurisation des environnements Kubernetes"
            />
          </Field>
          <Field label="Description détaillée">
            <Textarea
              value={newCompData.description}
              onChange={(e) => setNewCompData({ ...newCompData, description: e.target.value })}
              placeholder="Objectifs opérationnels d'évaluation..."
            />
          </Field>
          <Field label="Niveau requis (1 à 5)">
            <Select
              value={newCompData.niveau_requis}
              onChange={(e) => setNewCompData({ ...newCompData, niveau_requis: Number(e.target.value) })}
            >
              <option value={1}>Niveau 1 — Initiation</option>
              <option value={2}>Niveau 2 — Intermédiaire</option>
              <option value={3}>Niveau 3 — Avancé</option>
              <option value={4}>Niveau 4 — Expert</option>
              <option value={5}>Niveau 5 — Maîtrise globale</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowAddModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateCompetency} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Modifier Compétence */}
      <Modal open={editCompModal} onClose={() => setEditCompModal(false)} title="Modifier la compétence">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code officiel">
              <Input
                value={editCompData.code}
                onChange={(e) => setEditCompData({ ...editCompData, code: e.target.value })}
              />
            </Field>
            <Field label="Domaine">
              <Input
                value={editCompData.domaine}
                onChange={(e) => setEditCompData({ ...editCompData, domaine: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Intitulé de la compétence">
            <Input
              value={editCompData.nom}
              onChange={(e) => setEditCompData({ ...editCompData, nom: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={editCompData.description}
              onChange={(e) => setEditCompData({ ...editCompData, description: e.target.value })}
            />
          </Field>
          <Field label="Niveau requis">
            <Select
              value={editCompData.niveau_requis}
              onChange={(e) => setEditCompData({ ...editCompData, niveau_requis: Number(e.target.value) })}
            >
              <option value={1}>Niveau 1 — Initiation</option>
              <option value={2}>Niveau 2 — Intermédiaire</option>
              <option value={3}>Niveau 3 — Avancé</option>
              <option value={4}>Niveau 4 — Expert</option>
              <option value={5}>Niveau 5 — Maîtrise globale</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setEditCompModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSaveEdit} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Sauvegarder
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
