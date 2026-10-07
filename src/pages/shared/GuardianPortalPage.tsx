import React, { useEffect, useState } from "react";
import { ShieldCheck, Clock, Wallet, PenLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { guardianService, StudentGuardianLink } from "@/modules/guardians/services/guardianService";
import { Card, PageHead, Badge, Btn, Empty } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const GuardianPortalPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [links, setLinks] = useState<StudentGuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    loadPortalData();
  }, [profile]);

  const loadPortalData = async () => {
    setLoading(true);
    try {
      const data = await guardianService.getGuardianPortalData(profile?.id || "mock-guardian");
      setLinks(data.links);
      if (data.links.length > 0) {
        setSelectedStudentId(data.links[0].student_id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentLink = links.find((l) => l.student_id === selectedStudentId);
  const currentStudent = db.students.find((s) => s.id === selectedStudentId);

  // Données filtrées selon les permissions accordées au tuteur
  const studentGrades = (db.results || []).filter((r: any) => r.studentId === selectedStudentId);
  const studentAttendance = db.attendance.filter((a) => a.studentId === selectedStudentId);
  const studentInvoices = db.invoices.filter((i) => i.studentId === selectedStudentId);

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

  return (
    <div className="space-y-6">
      <PageHead
        title="Portail Parents, Tuteurs & Employeurs"
        subtitle="Consultation en lecture seule, sécurisée et soumise au consentement explicite"
      />

      {loading ? (
        <Card className="p-8 text-center text-white/60">Chargement des données du portail...</Card>
      ) : links.length === 0 ? (
        <Card className="p-8">
          <Empty
            icon={<ShieldCheck size={36} />}
            title="Aucun apprenant rattaché"
            sub="Vous n'avez actuellement aucun compte apprenant sous votre tutelle ou le consentement légal n'a pas encore été validé par l'administration."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Sélecteur d'apprenant si le tuteur suit plusieurs étudiants */}
          {links.length > 1 && (
            <div className="flex gap-2 border-b border-white/10 pb-3">
              {links.map((link) => {
                const s = db.students.find((stu) => stu.id === link.student_id);
                return (
                  <button
                    key={link.id}
                    onClick={() => setSelectedStudentId(link.student_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedStudentId === link.student_id
                        ? "bg-[#E60000] text-white"
                        : "bg-white/5 text-white/70 hover:text-white"
                    }`}
                  >
                    {s ? `${s.prenom} ${s.nom}` : link.student_id}
                  </button>
                );
              })}
            </div>
          )}

          {currentLink && currentStudent && (
            <div className="space-y-6">
              {/* Carte apprenant et statut du consentement */}
              <Card className="p-5 border border-white/10 bg-black/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center font-bold text-white text-lg">
                      {currentStudent.prenom.charAt(0)}
                    </div>
                    <div>
                      <p className="text-base font-black text-white">
                        {currentStudent.prenom} {currentStudent.nom}
                      </p>
                      <p className="text-xs text-white/60 font-mono">
                        Identifiant : {currentStudent.id} · Relation : {currentLink.relationship}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge color={currentLink.is_active ? "green" : "red"}>
                      {currentLink.is_active ? "Consentement Actif" : "Accès Révoqué"}
                    </Badge>
                    {(profile?.role === "superadmin" || profile?.role === "admin") && (
                      <Btn
                        variant="outline"
                        onClick={() => handleRevokeConsent(currentLink.id)}
                        className="text-xs border-red-500/40 text-red-300 hover:bg-red-950/40"
                      >
                        Révoquer le consentement
                      </Btn>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-4 text-xs text-white/70">
                  <span className="flex items-center gap-1">
                    {currentLink.can_view_grades ? "✓" : "✗"} Notes académiques
                  </span>
                  <span className="flex items-center gap-1">
                    {currentLink.can_view_attendance ? "✓" : "✗"} Présences & Émargements
                  </span>
                  <span className="flex items-center gap-1">
                    {currentLink.can_view_finances ? "✓" : "✗"} Échéancier financier
                  </span>
                </div>
              </Card>

              {/* Rubrique 1 : Notes et Évaluations */}
              {currentLink.can_view_grades && (
                <Card className="p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <PenLine size={16} className="text-red-500" />
                    Résultats & Évaluations Récentes
                  </h3>
                  {studentGrades.length === 0 ? (
                    <p className="text-xs text-white/50 italic">Aucune note enregistrée pour le moment.</p>
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
                            <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
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
              {currentLink.can_view_attendance && (
                <Card className="p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-red-500" />
                    Pointages & Assiduité
                  </h3>
                  {studentAttendance.length === 0 ? (
                    <p className="text-xs text-white/50 italic">Aucun pointage enregistré.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentAttendance.slice(0, 10).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs"
                        >
                          <span className="text-white/80">{a.date} à {a.heure || "08:00"}</span>
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
              {currentLink.can_view_finances && (
                <Card className="p-5">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Wallet size={16} className="text-red-500" />
                    Facturation & Règlements
                  </h3>
                  {studentInvoices.length === 0 ? (
                    <p className="text-xs text-white/50 italic">Aucune facture émise.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{inv.libelle || `Facture #${inv.id}`}</p>
                            <p className="text-[11px] text-white/50 font-mono">
                              Échéance : {inv.dueDate || inv.date || "Immédiate"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold font-mono text-white">{inv.montant} FCFA</p>
                            <Badge color="blue">
                              {inv.type}
                            </Badge>
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
    </div>
  );
};
