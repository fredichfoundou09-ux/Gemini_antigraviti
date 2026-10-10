import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Clock,
  Wallet,
  PenLine,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import {
  guardianService,
  Guardian,
  StudentGuardianLink,
} from "@/modules/guardians/services/guardianService";
import { Card, PageHead, Badge, Btn, Empty, Modal, Field, Input, Select, printHTML } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const GuardianPortalPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [links, setLinks] = useState<StudentGuardianLink[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGuardianData, setNewGuardianData] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    type: "parent" as const,
    relationship: "Parent",
    student_id: "",
    can_view_grades: true,
    can_view_attendance: true,
    can_view_finances: true,
  });

  const [showEditPermsModal, setShowEditPermsModal] = useState(false);
  const [editingLink, setEditingLink] = useState<StudentGuardianLink | null>(null);
  const [editPerms, setEditPerms] = useState({
    can_view_grades: true,
    can_view_attendance: true,
    can_view_finances: true,
  });

  const isStaff = profile?.role === "superadmin" || profile?.role === "admin";

  useEffect(() => {
    loadPortalData();
  }, [profile]);

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const [portalData, guardianList] = await Promise.all([
        guardianService.getGuardianPortalData(profile?.id || "mock-guardian"),
        guardianService.getGuardians(),
      ]);
      setGuardians(guardianList);

      // Si admin/staff et qu'aucune tutelle n'est trouvée pour son profil, afficher toutes les tutelles pour supervision
      let activeLinks = portalData.links;
      if (isStaff && activeLinks.length === 0 && db.students.length > 0) {
        const allStudentLinks: StudentGuardianLink[] = [];
        for (const stu of db.students.slice(0, 5)) {
          const lks = await guardianService.getStudentGuardians(stu.id);
          allStudentLinks.push(...lks);
        }
        activeLinks = allStudentLinks;
      }

      setLinks(activeLinks);
      if (activeLinks.length > 0) {
        setSelectedStudentId(activeLinks[0].student_id);
      } else if (db.students.length > 0) {
        setSelectedStudentId(db.students[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentLink = links.find((l) => l.student_id === selectedStudentId);
  const currentStudent = db.students.find((s) => s.id === selectedStudentId);

  // Données de l'apprenant sélectionné
  const studentGrades = (db.results || []).filter((r: any) => r.studentId === selectedStudentId);
  const studentAttendance = db.attendance.filter((a) => a.studentId === selectedStudentId);
  const studentInvoices = db.invoices.filter((i) => i.studentId === selectedStudentId);

  const handleCreateGuardianLink = async () => {
    if (!newGuardianData.nom.trim() || !newGuardianData.student_id) {
      toastMsg.error("Champs requis", "Veuillez renseigner le nom du tuteur et choisir un apprenant.");
      return;
    }

    // 1. Créer le profil tuteur
    const gRes = await guardianService.createGuardian({
      nom: newGuardianData.nom.trim(),
      prenom: newGuardianData.prenom.trim(),
      email: newGuardianData.email.trim(),
      telephone: newGuardianData.telephone.trim(),
      type: newGuardianData.type,
    });

    if (gRes.success && gRes.data) {
      // 2. Lier le tuteur à l'apprenant
      await guardianService.linkGuardian({
        guardian_id: gRes.data.id,
        student_id: newGuardianData.student_id,
        relationship: newGuardianData.relationship,
        can_view_grades: newGuardianData.can_view_grades,
        can_view_attendance: newGuardianData.can_view_attendance,
        can_view_finances: newGuardianData.can_view_finances,
      });

      toastMsg.success("Tuteur rattaché", "La tutelle a été configurée avec succès.");
      setShowAddModal(false);
      loadPortalData();
    } else {
      toastMsg.error("Erreur", gRes.error);
    }
  };

  const handleOpenEditPerms = (link: StudentGuardianLink) => {
    setEditingLink(link);
    setEditPerms({
      can_view_grades: link.can_view_grades,
      can_view_attendance: link.can_view_attendance,
      can_view_finances: link.can_view_finances,
    });
    setShowEditPermsModal(true);
  };

  const handleSavePerms = async () => {
    if (!editingLink) return;
    const res = await guardianService.updatePermissions(editingLink.id, editPerms);
    if (res.success) {
      toastMsg.success("Autorisations mises à jour", "Les droits d'accès ont été modifiés.");
      setShowEditPermsModal(false);
      loadPortalData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm("Êtes-vous certain de vouloir supprimer cette liaison de tutelle ?")) return;
    const res = await guardianService.deleteGuardianLink(linkId);
    if (res.success) {
      toastMsg.success("Tutelle supprimée", "L'accès du tuteur a été retiré.");
      loadPortalData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleRevokeConsent = async (linkId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir révoquer l'accès pour ce tuteur ?")) return;
    const res = await guardianService.revokeConsent(linkId);
    if (res.success) {
      toastMsg.success("Consentement révoqué", "L'accès aux données a été immédiatement coupé.");
      loadPortalData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handlePrintSummary = () => {
    if (!currentStudent) return;

    printHTML(
      `Fiche_Suivi_Tuteur_${currentStudent.prenom}_${currentStudent.nom}`,
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge-official">PORTAIL TUTEURS & PARENTS · SYNTHÈSE OFFICIELLE</span>
            <h1 style="margin:8px 0 2px 0;font-size:20px;color:#0c4a6e">${currentStudent.prenom} ${currentStudent.nom}</h1>
            <p style="margin:0;font-size:11px;color:#64748b">Matricule : <strong>${currentStudent.id}</strong> · Formation : <strong>${currentStudent.formation}</strong></p>
          </div>
          <div style="text-align:right">
            <span class="badge-official" style="background:#f0fdf4;border-color:#16a34a;color:#16a34a">CONSENTEMENT ACTIF</span>
            <p style="margin:4px 0 0;font-size:11px;color:#64748b">${new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <h3 style="font-size:13px;color:#0c4a6e;margin-top:16px">1. Évaluations & Notes récentes</h3>
        <table>
          <thead><tr><th>Épreuve</th><th style="width:100px;text-align:center">Note obtenue</th></tr></thead>
          <tbody>
            ${
              studentGrades.length > 0
                ? studentGrades.slice(0, 5).map((g: any) => `<tr><td>${g.testTitle || 'Évaluation'}</td><td style="text-align:center;font-weight:bold;font-family:monospace">${g.score} / ${g.totalPoints || 20}</td></tr>`).join('')
                : '<tr><td colspan="2" style="text-align:center;color:#64748b">Aucune note enregistrée</td></tr>'
            }
          </tbody>
        </table>

        <h3 style="font-size:13px;color:#0c4a6e;margin-top:16px">2. Assiduité & Pointages (Dernières séances)</h3>
        <table>
          <thead><tr><th>Date</th><th>Heure</th><th style="width:100px;text-align:center">Statut</th></tr></thead>
          <tbody>
            ${
              studentAttendance.length > 0
                ? studentAttendance.slice(0, 5).map((a) => `<tr><td>${a.date}</td><td>${a.heure || '08:00'}</td><td style="text-align:center">${a.statut === 'present' ? 'PRÉSENT' : 'ABSENT'}</td></tr>`).join('')
                : '<tr><td colspan="3" style="text-align:center;color:#64748b">Aucun pointage</td></tr>'
            }
          </tbody>
        </table>

        <h3 style="font-size:13px;color:#0c4a6e;margin-top:16px">3. Situation financière</h3>
        <table>
          <thead><tr><th>Désignation</th><th>Échéance</th><th style="width:120px;text-align:right">Montant</th></tr></thead>
          <tbody>
            ${
              studentInvoices.length > 0
                ? studentInvoices.map((inv) => `<tr><td>${inv.libelle || 'Frais de scolarité'}</td><td>${inv.dueDate || inv.date || 'Immédiate'}</td><td style="text-align:right;font-family:monospace;font-weight:bold">${inv.montant} FCFA</td></tr>`).join('')
                : '<tr><td colspan="3" style="text-align:center;color:#64748b">Aucune facture en attente</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `
    );
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Portail Parents, Tuteurs & Entreprises"
        subtitle="Consultation en lecture seule, sécurisée et soumise au consentement explicite (RGPD / DPO)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {currentStudent && (
              <Btn onClick={handlePrintSummary} variant="outline" className="border-cyan-500/30 text-cyan-200">
                <Printer size={14} /> Imprimer Fiche Tuteur
              </Btn>
            )}
            {isStaff && (
              <Btn
                onClick={() => setShowAddModal(true)}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
              >
                <Plus size={14} /> Rattacher un Tuteur
              </Btn>
            )}
          </div>
        }
      />

      {loading ? (
        <Card className="p-8 text-center text-slate-400">Chargement des données du portail...</Card>
      ) : links.length === 0 ? (
        <Card className="p-10 border border-cyan-500/30 bg-[#0B1220]/90 text-center">
          <Empty
            icon={<ShieldCheck size={36} className="text-cyan-400" />}
            title="Aucun apprenant rattaché actuellement"
            sub="Vous n'avez actuellement aucun compte apprenant sous votre tutelle ou le consentement n'a pas encore été configuré."
          />
          {isStaff && (
            <Btn onClick={() => setShowAddModal(true)} className="mt-4 bg-cyan-600 text-white font-bold">
              <Plus size={14} /> Configurer une tutelle
            </Btn>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Sélecteur d'apprenant */}
          {links.length > 1 && (
            <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
              {links.map((link) => {
                const s = db.students.find((stu) => stu.id === link.student_id);
                return (
                  <button
                    key={link.id}
                    onClick={() => setSelectedStudentId(link.student_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      selectedStudentId === link.student_id
                        ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                        : "bg-white/5 text-slate-300 hover:text-white"
                    }`}
                  >
                    {s ? `${s.prenom} ${s.nom}` : link.student_id} ({link.relationship})
                  </button>
                );
              })}
            </div>
          )}

          {currentStudent && (
            <div className="space-y-6">
              {/* Carte apprenant et statut du consentement */}
              <Card className="p-5 border border-cyan-500/30 bg-[#0B1220]/90 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-300 text-lg">
                      {currentStudent.prenom.charAt(0)}
                    </div>
                    <div>
                      <p className="text-base font-black text-white">
                        {currentStudent.prenom} {currentStudent.nom}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        Identifiant : {currentStudent.id} · Relation : {currentLink?.relationship || "Tutelle légale"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={currentLink?.is_active ? "green" : "red"}>
                      {currentLink?.is_active ? "Consentement Actif" : "Accès Révoqué"}
                    </Badge>

                    {isStaff && currentLink && (
                      <Btn
                        variant="outline"
                        onClick={() => handleOpenEditPerms(currentLink)}
                        className="text-xs border-cyan-500/30 text-cyan-300"
                      >
                        <Edit2 size={12} /> Droits d'accès
                      </Btn>
                    )}

                    {isStaff && currentLink && (
                      <Btn
                        variant="outline"
                        onClick={() => handleDeleteLink(currentLink.id)}
                        className="text-xs border-red-500/30 text-red-300 hover:bg-red-950/40"
                      >
                        <Trash2 size={12} /> Supprimer tutelle
                      </Btn>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    {currentLink?.can_view_grades ? "✓" : "✗"} Notes académiques
                  </span>
                  <span className="flex items-center gap-1">
                    {currentLink?.can_view_attendance ? "✓" : "✗"} Présences & Émargements
                  </span>
                  <span className="flex items-center gap-1">
                    {currentLink?.can_view_finances ? "✓" : "✗"} Échéancier financier
                  </span>
                </div>
              </Card>

              {/* Rubrique 1 : Notes et Évaluations */}
              {currentLink?.can_view_grades && (
                <Card className="p-5 border border-cyan-500/30 bg-[#0B1220]/90">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <PenLine size={16} className="text-cyan-400" />
                    Résultats & Évaluations Récentes
                  </h3>
                  {studentGrades.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucune note enregistrée pour le moment.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentGrades.map((g: any) => {
                        const test = db.tests.find((t) => t.id === g.testId);
                        return (
                          <div
                            key={g.id}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs"
                          >
                            <span className="font-semibold text-white">
                              {test?.titre || "Évaluation"}
                            </span>
                            <span className="font-mono font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                              {g.score} / {g.totalPoints || 20}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              )}

              {/* Rubrique 2 : Présences */}
              {currentLink?.can_view_attendance && (
                <Card className="p-5 border border-cyan-500/30 bg-[#0B1220]/90">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-cyan-400" />
                    Pointages & Assiduité
                  </h3>
                  {studentAttendance.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucun pointage enregistré.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentAttendance.slice(0, 8).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs"
                        >
                          <span className="text-slate-300">{a.date} à {a.heure || "08:00"}</span>
                          <Badge color={a.statut === "present" ? "green" : "red"}>
                            {a.statut === "present" ? "Présent(e)" : "Absent(e)"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Rubrique 3 : Finances et Échéanciers */}
              {currentLink?.can_view_finances && (
                <Card className="p-5 border border-cyan-500/30 bg-[#0B1220]/90">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Wallet size={16} className="text-cyan-400" />
                    Facturation & Règlements
                  </h3>
                  {studentInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucune facture émise.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{inv.libelle || `Facture #${inv.id}`}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Échéance : {inv.dueDate || inv.date || "Immédiate"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold font-mono text-cyan-300">{inv.montant} FCFA</p>
                            <Badge color="blue">{inv.type}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Créer Tutelle */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Rattacher un tuteur ou parent">
        <div className="space-y-4">
          <Field label="Apprenant à rattacher">
            <Select
              value={newGuardianData.student_id}
              onChange={(e) => setNewGuardianData({ ...newGuardianData, student_id: e.target.value })}
            >
              <option value="">Sélectionnez un apprenant...</option>
              {db.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom} {s.nom} ({s.id}) — {s.formation}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom du tuteur">
              <Input
                value={newGuardianData.nom}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, nom: e.target.value })}
                placeholder="ex: Mpassi"
              />
            </Field>
            <Field label="Prénom du tuteur">
              <Input
                value={newGuardianData.prenom}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, prenom: e.target.value })}
                placeholder="ex: Jean"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                value={newGuardianData.email}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, email: e.target.value })}
                placeholder="parent@cg.com"
              />
            </Field>
            <Field label="Téléphone">
              <Input
                value={newGuardianData.telephone}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, telephone: e.target.value })}
                placeholder="+242 06..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={newGuardianData.type}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, type: e.target.value as any })}
              >
                <option value="parent">Parent</option>
                <option value="tuteur">Tuteur légal</option>
                <option value="employeur">Employeur / Entreprise sponsor</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="Relation précisée">
              <Input
                value={newGuardianData.relationship}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, relationship: e.target.value })}
                placeholder="Père, Mère, Tuteur, DRH..."
              />
            </Field>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-[#07101E] p-3 space-y-2">
            <p className="text-xs font-bold text-cyan-300">Droits d'accès accordés (RGPD) :</p>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={newGuardianData.can_view_grades}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, can_view_grades: e.target.checked })}
              />
              Consulter les notes et évaluations
            </label>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={newGuardianData.can_view_attendance}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, can_view_attendance: e.target.checked })}
              />
              Consulter les présences et émargements
            </label>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={newGuardianData.can_view_finances}
                onChange={(e) => setNewGuardianData({ ...newGuardianData, can_view_finances: e.target.checked })}
              />
              Consulter les factures et règlements
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowAddModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateGuardianLink} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer la tutelle
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Modifier Droits */}
      <Modal open={showEditPermsModal} onClose={() => setShowEditPermsModal(false)} title="Modifier les autorisations d'accès">
        <div className="space-y-4">
          <div className="space-y-3 p-3 rounded-xl border border-cyan-500/20 bg-[#07101E]">
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={editPerms.can_view_grades}
                onChange={(e) => setEditPerms({ ...editPerms, can_view_grades: e.target.checked })}
              />
              Autoriser la consultation des notes
            </label>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={editPerms.can_view_attendance}
                onChange={(e) => setEditPerms({ ...editPerms, can_view_attendance: e.target.checked })}
              />
              Autoriser la consultation des présences
            </label>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={editPerms.can_view_finances}
                onChange={(e) => setEditPerms({ ...editPerms, can_view_finances: e.target.checked })}
              />
              Autoriser la consultation des finances
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowEditPermsModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSavePerms} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Mettre à jour
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
