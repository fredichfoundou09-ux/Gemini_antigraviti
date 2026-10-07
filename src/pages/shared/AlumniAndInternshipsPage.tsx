import React, { useEffect, useState } from "react";
import { Briefcase, GraduationCap, TrendingUp, Users, Plus, CheckCircle, Clock, MapPin, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { alumniService, AlumniFollowUp, JobOffer } from "@/modules/alumni/services/alumniService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Select, Textarea } from "@/lib/ui";
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
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);

  // Form states
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

  const isStaff = profile?.role === "superadmin" || profile?.role === "admin" || profile?.role === "partner_admin";

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
    if (!newOffer.title || !newOffer.company) {
      toastMsg.error("Champs obligatoires", "Veuillez renseigner le titre et l'entreprise.");
      return;
    }
    const res = await alumniService.createJobOffer(newOffer);
    if (res.success) {
      toastMsg.success("Offre publiée", "L'offre de stage est maintenant accessible aux apprenants.");
      setShowAddOffer(false);
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

  return (
    <div className="space-y-6">
      <PageHead
        title="Insertion Professionnelle, Alumni & Stages"
        subtitle="Observatoire de l'emploi à 3, 6 et 12 mois, réseau des anciens et opportunités"
        actions={
          isStaff ? (
            <div className="flex gap-2">
              <Btn onClick={() => setShowAddFollowUp(true)} variant="outline">
                + Suivi Diplômé
              </Btn>
              <Btn onClick={() => setShowAddOffer(true)} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
                <Plus size={14} /> Publier une offre
              </Btn>
            </div>
          ) : undefined
        }
      />

      {/* Onglets */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("insertion")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "insertion" ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          📊 Observatoire de l'Insertion ({followUps.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("offres")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "offres" ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          💼 Offres de Stages & Emplois ({offers.length})
        </button>
      </div>

      {activeTab === "insertion" ? (
        <div className="space-y-6">
          {/* Cartes KPI d'insertion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border border-white/10 bg-black/60">
              <span className="text-white/50 text-xs">Taux d'insertion global</span>
              <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {metrics.insertionRate}%
              </p>
              <span className="text-[10px] text-white/40">En poste ou poursuite d'études</span>
            </Card>

            <Card className="p-4 border border-white/10 bg-black/60">
              <span className="text-white/50 text-xs">En emploi / Freelance</span>
              <p className="text-2xl font-black font-mono text-white mt-1">
                {metrics.employedCount}
              </p>
              <span className="text-[10px] text-white/40">Diplômés en activité</span>
            </Card>

            <Card className="p-4 border border-white/10 bg-black/60">
              <span className="text-white/50 text-xs">Poursuite d'études</span>
              <p className="text-2xl font-black font-mono text-cyan-400 mt-1">
                {metrics.furtherStudyCount}
              </p>
              <span className="text-[10px] text-white/40">Spécialisation ENIA / Master</span>
            </Card>

            <Card className="p-4 border border-white/10 bg-black/60">
              <span className="text-white/50 text-xs">En recherche active</span>
              <p className="text-2xl font-black font-mono text-amber-400 mt-1">
                {metrics.seekingCount}
              </p>
              <span className="text-[10px] text-white/40">Accompagnement en cours</span>
            </Card>
          </div>

          {/* Tableau des suivis individuels */}
          <Card className="overflow-hidden border border-white/10 bg-black/60">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-red-500" />
                Derniers Suivis d'Insertion
              </h3>
              <span className="text-xs text-white/50 font-mono">Relances 3m / 6m / 12m</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#E60000] text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Apprenant</th>
                    <th className="p-3">Jalon</th>
                    <th className="p-3">Statut Actuel</th>
                    <th className="p-3">Entreprise / Poste</th>
                    <th className="p-3">Date du contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {followUps.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-white/50">
                        Aucun suivi d'insertion enregistré.
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
                          <td className="p-3 font-mono text-white/80">
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
                              <span className="text-white/40">—</span>
                            )}
                          </td>
                          <td className="p-3 text-white/60 font-mono">
                            {f.contacted_at ? f.contacted_at.slice(0, 10) : "—"}
                          </td>
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
            <Card className="col-span-2 p-8 text-center text-white/60">
              Aucune offre de stage ou d'emploi publiée actuellement.
            </Card>
          ) : (
            offers.map((offer) => (
              <Card key={offer.id} className="p-5 border border-white/10 bg-black/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">{offer.title}</h3>
                    <p className="text-xs text-white/70 font-semibold">{offer.company}</p>
                  </div>
                  <Badge color="red">{offer.type.toUpperCase()}</Badge>
                </div>

                {offer.description && (
                  <p className="text-xs text-white/60 line-clamp-3">{offer.description}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {offer.location || "Congo"}
                  </span>
                  {offer.contact_email && (
                    <a
                      href={`mailto:${offer.contact_email}?subject=Candidature Stage : ${offer.title}`}
                      className="text-red-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Mail size={12} /> Postuler
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
          <Btn onClick={handleCreateOffer} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white">
            Diffuser l'offre
          </Btn>
        </div>
      </Modal>

      {/* Modal Créer Suivi */}
      <Modal open={showAddFollowUp} onClose={() => setShowAddFollowUp(false)} title="Enregistrer un suivi d'insertion">
        <div className="space-y-4">
          <Field label="Apprenant diplômé">
            <Select
              value={newFollowUp.student_id}
              onChange={(e) => setNewFollowUp({ ...newFollowUp, student_id: e.target.value })}
            >
              <option value="">Sélectionner un apprenant</option>
              {db.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.prenom} {s.nom} ({s.id})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jalon temporel">
              <Select
                value={newFollowUp.milestone}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, milestone: e.target.value as any })}
              >
                <option value="3_months">3 Mois</option>
                <option value="6_months">6 Mois</option>
                <option value="12_months">12 Mois</option>
              </Select>
            </Field>
            <Field label="Statut d'insertion">
              <Select
                value={newFollowUp.status}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, status: e.target.value as any })}
              >
                <option value="employed">En poste / Indépendant</option>
                <option value="further_study">Poursuite d'études</option>
                <option value="seeking">En recherche d'emploi</option>
                <option value="pending">En attente de nouvelles</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employeur">
              <Input
                value={newFollowUp.employer_name}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, employer_name: e.target.value })}
                placeholder="Nom de l'entreprise"
              />
            </Field>
            <Field label="Intitulé du poste">
              <Input
                value={newFollowUp.job_title}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, job_title: e.target.value })}
                placeholder="Poste occupé"
              />
            </Field>
          </div>
          <Field label="Notes / Observations">
            <Input
              value={newFollowUp.notes}
              onChange={(e) => setNewFollowUp({ ...newFollowUp, notes: e.target.value })}
              placeholder="Commentaires d'entretien..."
            />
          </Field>
          <Btn onClick={handleCreateFollowUp} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white">
            Enregistrer le suivi
          </Btn>
        </div>
      </Modal>
    </div>
  );
};
