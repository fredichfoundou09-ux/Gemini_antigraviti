import { useState } from "react";
import {
  Clock, CheckCircle2, XCircle, Timer, BadgeDollarSign, Save, ReceiptText, Wallet,
  CalendarDays, TrendingUp,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Stat, uid, today, money, printHTML } from "@/lib/ui";
import { teacherFinanceSummary, hoursBetween, tarifFor, nextTeacherPayRef } from "@/lib/teacher";

// Peut valider les heures : superadmin, admin (responsable financier).
const canValidate = (role?: string) => role === "superadmin" || role === "admin";

export function TeacherHoursPage() {
  const { db, user, update, log } = useStore();
  const [teacherId, setTeacherId] = useState("");
  const [creatingPay, setCreatingPay] = useState(false);
  const [pay, setPay] = useState({ montant: 0, mode: "Espèces", observation: "" });
  const [tab, setTab] = useState<"a_valider" | "historique" | "mensuel" | "paiements">("a_valider");

  const teacher = db.teachers.find((t) => t.id === teacherId);
  const summary = teacherFinanceSummary(db, teacherId);
  const canEdit = canValidate(user?.role);

  // Créneaux passés non encore validés : on liste les slots planifiés
  // auxquels cet enseignant est rattaché et qui n'ont pas encore d'heure créée.
  const pendingSlots = db.schedule
    .filter((s) => s.teacherId === teacherId)
    .filter((s) => !db.teacherHours.some((h) => h.scheduleId === s.id));

  const sortedHours = [...summary.hours].sort((a, b) => b.date.localeCompare(a.date));

  const validate = (slot: any) => {
    if (!teacher) return;
    const d = today();
    const heures = hoursBetween(slot.heureDebut, slot.heureFin) || 0;
    const tarif = tarifFor(db, teacherId, slot.moduleId);
    const montant = Math.round(heures * tarif * 100) / 100;
    const th = {
      id: uid("TH"), scheduleId: slot.id, teacherId: slot.teacherId ?? teacherId,
      moduleId: slot.moduleId, date: slot.date ?? d, heureDebut: slot.heureDebut, heureFin: slot.heureFin,
      heures, tarifApplique: tarif, montant, valide: true, validePar: user?.name, dateValidation: d,
    };
    update((d2) => ({ ...d2, teacherHours: [th, ...d2.teacherHours] }));
    log(`Heure validée : ${teacher.prenom} ${teacher.nom} — ${heures} h · ${money(montant)}`);
  };

  const invalidate = (hId: string) => {
    if (!canEdit) return;
    update((d) => ({ ...d, teacherHours: d.teacherHours.filter((h) => h.id !== hId) }));
    log(`Heure retirée : ${hId}`);
  };

  const savePay = () => {
    if (!teacher || pay.montant <= 0) return;
    const ref = nextTeacherPayRef(db);
    const p = { id: uid("TP"), teacherId, montant: +pay.montant, date: today(), heure: new Date().toTimeString().slice(0, 5), mode: pay.mode, reference: ref, observation: pay.observation || undefined, createdBy: user?.id, createdByName: user?.name };
    update((d) => ({ ...d, teacherPayments: [p, ...d.teacherPayments] }));
    log(`Versement enseignant ${ref} : ${teacher.prenom} ${teacher.nom} — ${money(p.montant)}`);
    setPay({ montant: 0, mode: "Espèces", observation: "" });
    setCreatingPay(false);
  };

  const receiptPay = (p: any) => {
    printHTML(`Versement ${p.reference ?? p.id}`, `
      <div class="receipt">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><h1 class="accent">SENTINELLES NUMÉRIQUES</h1><p>Paiement formateur</p></div>
          <div style="text-align:right"><p class="label">Référence</p><p class="font-mono">${p.reference ?? p.id}</p></div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <div class="grid">
          <div><p class="label">Formateur</p><p style="font-weight:700">${teacher?.prenom} ${teacher?.nom} (${teacherId})</p></div>
          <div><p class="label">Date</p><p>${p.date}${p.heure ? " à " + p.heure : ""}</p></div>
          <div><p class="label">Mode</p><p>${p.mode}</p></div>
          ${p.createdByName ? `<div><p class="label">Versé par</p><p>${p.createdByName}</p></div>` : ""}
          ${p.observation ? `<div><p class="label">Observation</p><p>${p.observation}</p></div>` : ""}
        </div>
        <div class="row" style="margin-top:16px"><span>Montant versé</span><span class="gold" style="font-size:20px;font-weight:800">${money(p.montant)}</span></div>
        <div class="row"><span>Total dû (heures validées)</span><span>${money(summary.montantDu)}</span></div>
        <div class="row"><span>Total déjà versé</span><span class="green">${money(summary.montantPaye)}</span></div>
        <div class="row"><span>Solde</span><span>${money(summary.solde)}</span></div>
        <p style="margin-top:24px;text-align:center" class="label">SENTINELLES NUMÉRIQUES — Paiement formateur</p>
      </div>`);
  };

  return (
    <div>
      <PageHead title="Heures & rémunération des enseignants" subtitle="Validation automatique basée sur l'emploi du temps"
        actions={<Btn onClick={() => setCreatingPay(true)} disabled={!teacherId || !canEdit}><BadgeDollarSign size={15} /> Enregistrer un versement</Btn>} />

      <Card className="mb-5 p-4">
        <Field label="Enseignant">
          <Select value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setTab("a_valider"); }}>
            <option value="">— Choisir —</option>
            {db.teachers.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.prenom} {t.nom}</option>)}
          </Select>
        </Field>
      </Card>

      {!teacher ? (
        <Empty icon={<Clock size={40} />} title="Sélectionnez un enseignant" sub="La validation des heures et le suivi financier apparaîtront ici." />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat icon={<Timer size={20} />} label="Prévues" value={`${teacher.heuresPrevues ?? 0} h`} color="blue" />
            <Stat icon={<Clock size={20} />} label="Effectuées" value={`${summary.heuresEffectuees} h`} color="cyan" />
            <Stat icon={<CheckCircle2 size={20} />} label="Validées" value={`${summary.heuresValidees} h`} color="green" />
            <Stat icon={<TrendingUp size={20} />} label="Dû" value={money(summary.montantDu)} color="gold" />
            <Stat icon={<BadgeDollarSign size={20} />} label="Payé" value={money(summary.montantPaye)} color="red" />
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {([
              { k: "a_valider", l: `À valider (${pendingSlots.length})` },
              { k: "historique", l: `Historique (${summary.hours.length})` },
              { k: "mensuel", l: "Mensuel" },
              { k: "paiements", l: `Versements (${summary.payments.length})` },
            ] as const).map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={cn("rounded-xl border px-4 py-2 text-xs font-bold", tab === t.k ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                {t.l}
              </button>
            ))}
          </div>

          {tab === "a_valider" && (
            pendingSlots.length === 0 ? (
              <Empty icon={<CalendarDays size={40} />} title="Aucune séance en attente" sub="Toutes les séances planifiées de ce formateur ont été validées." />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Jour</th><th className="px-4 py-3">Heures</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Salle</th><th className="px-4 py-3">Apprenants</th><th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSlots.map((s) => {
                      const nH = hoursBetween(s.heureDebut, s.heureFin);
                      const nStu = db.students.filter((x) => x.formation === s.formation && x.modules.includes(s.moduleId)).length;
                      return (
                        <tr key={s.id} className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-3 font-semibold text-slate-200">{s.jour}{s.date ? ` (${s.date})` : ""}</td>
                          <td className="px-4 py-3">{s.heureDebut}–{s.heureFin} <span className="text-xs text-slate-500">({nH} h)</span></td>
                          <td className="px-4 py-3 text-slate-300">{db.modules.find((m) => m.id === s.moduleId)?.titre}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{s.salle || "—"}</td>
                          <td className="px-4 py-3"><Badge color="gray">{nStu}</Badge></td>
                          <td className="px-4 py-3 text-right">
                            {canEdit ? (
                              <Btn variant="green" onClick={() => validate(s)}><CheckCircle2 size={14} /> Valider</Btn>
                            ) : (
                              <Badge color="gold">En attente</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === "historique" && (
            sortedHours.length === 0 ? (
              <Empty icon={<Clock size={40} />} title="Aucune heure validée" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Date</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Créneau</th><th className="px-4 py-3">Heures</th><th className="px-4 py-3">Tarif appliqué</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Validée par</th><th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHours.map((h) => (
                      <tr key={h.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">{h.date}</td>
                        <td className="px-4 py-3 text-slate-300">{db.modules.find((m) => m.id === h.moduleId)?.titre}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{h.heureDebut}–{h.heureFin}</td>
                        <td className="px-4 py-3 font-semibold text-white">{h.heures} h</td>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">{money(h.tarifApplique)}/h</td>
                        <td className="px-4 py-3 font-mono text-amber-300">{money(h.montant)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{h.validePar ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {canEdit && (
                            <button onClick={() => { if (confirm("Retirer cette heure validée ? Cette action est journalisée.")) invalidate(h.id); }} className="text-slate-500 hover:text-red-400"><XCircle size={15} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === "mensuel" && (
            summary.months.length === 0 ? (
              <Empty icon={<CalendarDays size={40} />} title="Aucune donnée mensuelle" />
            ) : (
              <div className="space-y-3">
                {summary.months.map((m) => (
                  <Card key={m.key} className="p-5" glow="cyan">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-display text-base font-bold text-white">{m.label}</h4>
                      <span className="font-mono text-sm text-amber-300">{money(m.montant)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[9px] uppercase text-slate-500">Effectuées</p>
                        <p className="font-display font-black text-white">{m.effectuees} h</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[9px] uppercase text-slate-500">Validées</p>
                        <p className="font-display font-black text-emerald-300">{m.validees} h</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[9px] uppercase text-slate-500">Montant</p>
                        <p className="font-display font-black text-amber-300">{money(m.montant)}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {tab === "paiements" && (
            summary.payments.length === 0 ? (
              <Empty icon={<Wallet size={40} />} title="Aucun versement enregistré" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Réf.</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Date / heure</th><th className="px-4 py-3">Versé par</th><th className="px-4 py-3 text-right">Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">{p.reference ?? p.id}</td>
                        <td className="px-4 py-3 font-mono text-white">{money(p.montant)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.mode}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.date}{p.heure ? ` • ${p.heure}` : ""}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.createdByName ?? "—"}</td>
                        <td className="px-4 py-3 text-right"><button onClick={() => receiptPay(p)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"><ReceiptText size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}
        </>
      )}

      {/* Modal versement */}
      <Modal open={creatingPay} onClose={() => setCreatingPay(false)} title={`Versement — ${teacher?.prenom ?? ""} ${teacher?.nom ?? ""}`}>
        <div className="space-y-4">
          <Field label="Montant (FCFA)"><Input type="number" min={1} value={pay.montant} onChange={(e) => setPay({ ...pay, montant: +e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode">
              <Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
                <option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option>
              </Select>
            </Field>
            <Field label="Observation (facultatif)"><Input value={pay.observation} onChange={(e) => setPay({ ...pay, observation: e.target.value })} /></Field>
          </div>
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs text-slate-300">
            Le versement est lié aux heures validées. Le solde est recalculé automatiquement.
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreatingPay(false)}>Annuler</Btn>
            <Btn onClick={savePay}><Save size={15} /> Enregistrer</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
