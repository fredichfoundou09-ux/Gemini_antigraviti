import React, { useEffect, useState } from "react";
import {
  Briefcase,
  GraduationCap,
  TrendingUp,
  Users,
  Plus,
  CheckCircle,
  Clock,
  MapPin,
  Mail,
  Edit2,
  Trash2,
  Printer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { alumniService, AlumniFollowUp, JobOffer } from "@/modules/alumni/services/alumniService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Select, Textarea, printHTML } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const AlumniAndInternshipsPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [activeTab, setActiveTab] = useState<"insertion" | "offres">("insertion");
  const [followUps, setFollowUps] = useState<AlumniFollowUp[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalFollowed: 0,
    employedCount: 0,
    furtherStudyCount: 0,
    seekingCount: 0,
    insertionRate: 0,
  });
  const [offers, setOffers] = useState<JobOffer[]>([]);

  // Modales
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);

  const [newOffer, setNewOffer] = useState({
    title: "",
    company: "",
    type: "stage" as const,
    location: "Brazzaville",
    contact_email: "",
    description: "",
  });

  const [newFollowUp, setNewFollowUp] = useState({
    student_id: "",
    milestone: "6_months" as const,
    status: "employed" as const,
    employer_name: "",
    job_title: "",
    salary_range: "",
    notes: "",
  });

  // Édition Offre
  const [editingOffer, setEditingOffer] = useState<JobOffer | null>(null);
  const [editOfferModal, setEditOfferModal] = useState(false);
  const [editOfferData, setEditOfferData] = useState({
    title: "",
    company: "",
    type: "stage" as const,
    location: "",
    contact_email: "",
    description: "",
  });

  const isStaff =
    profile?.role === "superadmin" || profile?.role === "admin" || profile?.role === "partner_admin";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [fuList, mets, jobList] = await Promise.all([
      alumniService.getFollowUps(),
      alumniService.getInsertionMetrics(),
      alumniService.getJobOffers(),
    ]);
    setFollowUps(fuList);
    setMetrics(mets);
    setOffers(jobList);
  };

  const handleCreateOffer = async () => {
    if (!newOffer.title.trim() || !newOffer.company.trim()) {
      toastMsg.error("Champs obligatoires", "Veuillez renseigner le titre et l'entreprise.");
      return;
    }
    const res = await alumniService.createJobOffer(newOffer);
    if (res.success) {
      toastMsg.success("Offre publiée", "L'offre est maintenant accessible aux apprenants.");
      setShowAddOffer(false);
      setNewOffer({
        title: "",
        company: "",
        type: "stage",
        location: "Brazzaville",
        contact_email: "",
        description: "",
      });
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleOpenEditOffer = (offer: JobOffer) => {
    setEditingOffer(offer);
    setEditOfferData({
      title: offer.title,
      company: offer.company,
      type: offer.type,
      location: offer.location || "",
      contact_email: offer.contact_email || "",
      description: offer.description || "",
    });
    setEditOfferModal(true);
  };

  const handleSaveEditOffer = async () => {
    if (!editingOffer) return;
    const res = await alumniService.updateJobOffer(editingOffer.id, editOfferData);
    if (res.success) {
      toastMsg.success("Offre modifiée", "Les informations ont été mises à jour.");
      setEditOfferModal(false);
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette offre ?")) return;
    const res = await alumniService.deleteJobOffer(id);
    if (res.success) {
      toastMsg.success("Offre supprimée", "L'offre a été retirée du catalogue.");
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!newFollowUp.student_id) {
      toastMsg.error("Sélection requise", "Veuillez choisir un apprenant.");
      return;
    }
    const res = await alumniService.recordFollowUp(newFollowUp);
    if (res.success) {
      toastMsg.success("Suivi enregistré", "Le statut d'insertion a été mis à jour.");
      setShowAddFollowUp(false);
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteFollowUp = async (id: string) => {
    if (!window.confirm("Supprimer cette entrée de suivi ?")) return;
    const res = await alumniService.deleteFollowUp(id);
    if (res.success) {
      toastMsg.success("Suivi supprimé", "L'enregistrement a été supprimé.");
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handlePrintInsertionReport = () => {
    const rowsHtml = followUps
      .map((f) => {
        const stu = db.students.find((s) => s.id === f.student_id);
        return `
        <tr>
          <td><strong>${stu ? `${stu.prenom} ${stu.nom}` : f.student_id}</strong></td>
          <td>${f.milestone.replace('_', ' ')}</td>
          <td>
            <span class="badge-official" style="${
              f.status === 'employed'
                ? 'background:#f0fdf4;border-color:#16a34a;color:#16a34a'
                : f.status === 'further_study'
                ? 'background:#f0f9ff;border-color:#0284c7;color:#0369a1'
                : 'background:#fffbeb;border-color:#d97706;color:#d97706'
            }">
              ${f.status.toUpperCase()}
            </span>
          </td>
          <td>${f.job_title || '—'} ${f.employer_name ? `chez ${f.employer_name}` : ''}</td>
          <td>${f.contacted_at ? f.contacted_at.slice(0, 10) : '—'}</td>
        </tr>
      `;
      })
      .join("");

    printHTML(
      `Rapport_Insertion_Alumni_${new Date().toISOString().slice(0, 10)}`,
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge-official">OBSERVATOIRE OFFICIEL DE L'INSERTION PROFESSIONNELLE</span>
            <h1 style="margin:8px 0 2px 0;font-size:20px;color:#0c4a6e">Bilan de l'Emploi & Stages Diplômés</h1>
            <p style="margin:0;font-size:11px;color:#64748b">Suivi longitudinal à 3, 6 et 12 mois après certification</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:26px;font-weight:900;color:#0284c7;font-family:monospace">${metrics.insertionRate}%</div>
            <div style="font-size:11px;color:#64748b">Taux d'insertion global (${metrics.employedCount} en poste sur ${metrics.totalFollowed})</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Apprenant / Diplômé</th>
              <th>Échéance</th>
              <th>Statut Professionnel</th>
              <th>Entreprise & Poste</th>
              <th>Dernier contact</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#64748b">Aucun diplômé enregistré pour le moment.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
          <div>Direction du Partenariat et de l'Insertion Professionnelle · République du Congo</div>
          <div>Émis le ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </div>
    `
    );
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Insertion Professionnelle, Alumni & Stages"
        subtitle="Observatoire de l'emploi à 3, 6 et 12 mois, réseau des anciens et opportunités certifiées"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={handlePrintInsertionReport} variant="outline" className="border-cyan-500/30 text-cyan-200">
              <Printer size={14} /> Imprimer Rapport d'Insertion
            </Btn>
            {isStaff && (
              <>
                <Btn onClick={() => setShowAddFollowUp(true)} variant="outline">
                  + Suivi Diplômé
                </Btn>
                <Btn
                  onClick={() => setShowAddOffer(true)}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
                >
                  <Plus size={14} /> Publier une offre
                </Btn>
              </>
            )}
          </div>
        }
      />

      {/* Onglets */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("insertion")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "insertion"
              ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          📊 Observatoire de l'Insertion ({followUps.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("offres")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "offres"
              ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              : "text-slate-400 hover:text-white"
          }`}
        >
          💼 Offres de Stages & Emplois ({offers.length})
        </button>
      </div>

      {activeTab === "insertion" ? (
        <div className="space-y-6">
          {/* Cartes KPI d'insertion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90">
              <span className="text-slate-400 text-xs">Taux d'insertion global</span>
              <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {metrics.insertionRate}%
              </p>
              <span className="text-[10px] text-slate-500">En emploi ou poursuite d'études</span>
            </Card>

            <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90">
              <span className="text-slate-400 text-xs">Diplômés en poste</span>
              <p className="text-2xl font-black font-mono text-cyan-300 mt-1">
                {metrics.employedCount}
              </p>
              <span className="text-[10px] text-slate-500">CDI, CDD ou stages confirmés</span>
            </Card>

            <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90">
              <span className="text-slate-400 text-xs">Poursuite d'études</span>
              <p className="text-2xl font-black font-mono text-blue-400 mt-1">
                {metrics.furtherStudyCount}
              </p>
              <span className="text-[10px] text-slate-500">Master ou spécialisations</span>
            </Card>

            <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90">
              <span className="text-slate-400 text-xs">En recherche active</span>
              <p className="text-2xl font-black font-mono text-amber-400 mt-1">
                {metrics.seekingCount}
              </p>
              <span className="text-[10px] text-slate-500">Accompagnés par le réseau</span>
            </Card>
          </div>

          {/* Tableau de suivi individuel */}
          <Card className="overflow-hidden border border-cyan-500/30 bg-[#0B1220]/90 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#07101E] text-cyan-300 uppercase text-[10px] tracking-wider border-b border-cyan-500/20">
                  <tr>
                    <th className="p-3">Diplômé</th>
                    <th className="p-3">Jalon</th>
                    <th className="p-3">Situation</th>
                    <th className="p-3">Poste & Entreprise</th>
                    <th className="p-3">Contact</th>
                    {isStaff && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {followUps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Aucun diplômé enregistré dans le suivi d'insertion.
                      </td>
                    </tr>
                  ) : (
                    followUps.map((f) => {
                      const stu = db.students.find((s) => s.id === f.student_id);
                      return (
                        <tr key={f.id} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-semibold text-white">
                            {stu ? `${stu.prenom} ${stu.nom}` : f.student_id}
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {f.milestone === "3_months"
                              ? "3 Mois"
                              : f.milestone === "6_months"
                              ? "6 Mois"
                              : "12 Mois"}
                          </td>
                          <td className="p-3">
                            <Badge
                              color={
                                f.status === "employed"
                                  ? "green"
                                  : f.status === "further_study"
                                  ? "blue"
                                  : f.status === "seeking"
                                  ? "gold"
                                  : "gray"
                              }
                            >
                              {f.status === "employed"
                                ? "En poste"
                                : f.status === "further_study"
                                ? "Études"
                                : f.status === "seeking"
                                ? "En recherche"
                                : "En attente"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {f.employer_name || f.job_title ? (
                              <span>
                                {f.job_title} {f.employer_name ? `chez ${f.employer_name}` : ""}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400 font-mono">
                            {f.contacted_at ? f.contacted_at.slice(0, 10) : "—"}
                          </td>
                          {isStaff && (
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteFollowUp(f.id)}
                                title="Supprimer ce suivi"
                                className="p-1 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* Catalogue des offres */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.length === 0 ? (
            <Card className="col-span-2 p-10 border border-cyan-500/30 bg-[#0B1220]/90 text-center text-slate-400">
              Aucune offre de stage ou d'emploi publiée actuellement.
            </Card>
          ) : (
            offers.map((offer) => (
              <Card
                key={offer.id}
                className="p-5 border border-cyan-500/30 bg-[#0B1220]/90 shadow-lg space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white">{offer.title}</h3>
                      <p className="text-xs text-cyan-300 font-semibold">{offer.company}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge color="blue">{offer.type.toUpperCase()}</Badge>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditOffer(offer)}
                          title="Modifier l'offre"
                          className="p-1 text-slate-400 hover:text-cyan-300"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {isStaff && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(offer.id)}
                          title="Supprimer l'offre"
                          className="p-1 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {offer.description && (
                    <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                      {offer.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-cyan-400" /> {offer.location || "Congo"}
                  </span>
                  {offer.contact_email && (
                    <a
                      href={`mailto:${offer.contact_email}?subject=Candidature : ${offer.title}`}
                      className="text-cyan-300 font-bold hover:underline flex items-center gap-1"
                    >
                      <Mail size={13} /> Postuler
                    </a>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal Créer Offre */}
      <Modal open={showAddOffer} onClose={() => setShowAddOffer(false)} title="Publier une offre de stage ou d'emploi">
        <div className="space-y-4">
          <Field label="Intitulé du poste">
            <Input
              value={newOffer.title}
              onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
              placeholder="ex: Stagiaire Analyste SOC"
            />
          </Field>
          <Field label="Entreprise / Partenaire">
            <Input
              value={newOffer.company}
              onChange={(e) => setNewOffer({ ...newOffer, company: e.target.value })}
              placeholder="ex: ENI Congo, MTN..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type de contrat">
              <Select
                value={newOffer.type}
                onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value as any })}
              >
                <option value="stage">Stage</option>
                <option value="cdd">CDD</option>
                <option value="cdi">CDI</option>
                <option value="freelance">Freelance</option>
              </Select>
            </Field>
            <Field label="Lieu">
              <Input
                value={newOffer.location}
                onChange={(e) => setNewOffer({ ...newOffer, location: e.target.value })}
                placeholder="Brazzaville, Pointe-Noire"
              />
            </Field>
          </div>
          <Field label="Email de contact pour postuler">
            <Input
              value={newOffer.contact_email}
              onChange={(e) => setNewOffer({ ...newOffer, contact_email: e.target.value })}
              placeholder="rh@entreprise.cg"
            />
          </Field>
          <Field label="Description des missions">
            <Textarea
              value={newOffer.description}
              onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
              placeholder="Détails du stage, compétences recherchées..."
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowAddOffer(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateOffer} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Diffuser l'offre
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Modifier Offre */}
      <Modal open={editOfferModal} onClose={() => setEditOfferModal(false)} title="Modifier l'offre">
        <div className="space-y-4">
          <Field label="Intitulé du poste">
            <Input
              value={editOfferData.title}
              onChange={(e) => setEditOfferData({ ...editOfferData, title: e.target.value })}
            />
          </Field>
          <Field label="Entreprise">
            <Input
              value={editOfferData.company}
              onChange={(e) => setEditOfferData({ ...editOfferData, company: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={editOfferData.type}
                onChange={(e) => setEditOfferData({ ...editOfferData, type: e.target.value as any })}
              >
                <option value="stage">Stage</option>
                <option value="cdd">CDD</option>
                <option value="cdi">CDI</option>
                <option value="freelance">Freelance</option>
              </Select>
            </Field>
            <Field label="Lieu">
              <Input
                value={editOfferData.location}
                onChange={(e) => setEditOfferData({ ...editOfferData, location: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              value={editOfferData.contact_email}
              onChange={(e) => setEditOfferData({ ...editOfferData, contact_email: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={editOfferData.description}
              onChange={(e) => setEditOfferData({ ...editOfferData, description: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setEditOfferModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSaveEditOffer} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Suivi Diplômé */}
      <Modal open={showAddFollowUp} onClose={() => setShowAddFollowUp(false)} title="Enregistrer le suivi d'un diplômé">
        <div className="space-y-4">
          <Field label="Apprenant diplômé">
            <Select
              value={newFollowUp.student_id}
              onChange={(e) => setNewFollowUp({ ...newFollowUp, student_id: e.target.value })}
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
            <Field label="Jalon d'enquête">
              <Select
                value={newFollowUp.milestone}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, milestone: e.target.value as any })}
              >
                <option value="3_months">3 Mois</option>
                <option value="6_months">6 Mois</option>
                <option value="12_months">12 Mois</option>
              </Select>
            </Field>
            <Field label="Statut professionnel">
              <Select
                value={newFollowUp.status}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, status: e.target.value as any })}
              >
                <option value="employed">En poste / Salarié / Stage</option>
                <option value="further_study">Poursuite d'études</option>
                <option value="seeking">En recherche active</option>
                <option value="pending">En attente de nouvelles</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entreprise d'accueil">
              <Input
                value={newFollowUp.employer_name}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, employer_name: e.target.value })}
                placeholder="ex: TotalEnergies, MTN..."
              />
            </Field>
            <Field label="Intitulé du poste">
              <Input
                value={newFollowUp.job_title}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, job_title: e.target.value })}
                placeholder="ex: Développeur, SOC Analyst..."
              />
            </Field>
          </div>
          <Field label="Commentaires & Notes">
            <Textarea
              value={newFollowUp.notes}
              onChange={(e) => setNewFollowUp({ ...newFollowUp, notes: e.target.value })}
              placeholder="Évolution de carrière, satisfaction de l'employeur..."
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowAddFollowUp(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateFollowUp} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
