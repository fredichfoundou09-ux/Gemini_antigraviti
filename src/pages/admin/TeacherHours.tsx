import { useState, useEffect } from "react";
import {
  Clock, CheckCircle2, XCircle, Timer, BadgeDollarSign, Save, ReceiptText, Wallet,
  CalendarDays, TrendingUp, FileText, PlusCircle, MinusCircle, Printer, ShieldCheck, Pencil, RotateCcw,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Stat, Textarea, uid, today, money, printHTML } from "@/lib/ui";
import { teacherFinanceSummary, hoursBetween, tarifFor, nextTeacherPayRef } from "@/lib/teacher";
import { TEACHER_SESSION_RATE, nextPayslipRef } from "@/lib/finance";
import { fetchTeacherAdvances, recordTeacherAdvance, fetchTeacherPayslips, generateTeacherPayslip } from "@/lib/supabase/finance";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

// Peut valider les heures : superadmin, admin (responsable financier).
const canValidate = (role?: string) => role === "superadmin" || role === "admin";

export function TeacherHoursPage() {
  const { db, user, update, log } = useStore();
  const [teacherId, setTeacherId] = useState("");
  const [creatingPay, setCreatingPay] = useState(false);
  const [creatingAdvance, setCreatingAdvance] = useState(false);
  const [creatingPayslip, setCreatingPayslip] = useState(false);
  const [pay, setPay] = useState({ montant: 0, mode: "Espèces", observation: "" });
  const [advanceForm, setAdvanceForm] = useState({ montant: 0, reason: "", date: today() });
  const [payslipPeriod, setPayslipPeriod] = useState(() => today().slice(0, 7)); // YYYY-MM
  const [tab, setTab] = useState<"a_valider" | "historique" | "avances" | "bulletins" | "mensuel" | "paiements">("a_valider");
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [payslipsList, setPayslipsList] = useState<any[]>([]);

  const [editingStat, setEditingStat] = useState<{
    key: "heuresPrevues" | "heuresEffectueesOverride" | "heuresValideesOverride" | "montantDuOverride" | "montantPayeOverride";
    label: string;
    unit: string;
    currentVal: number;
    isOverride: boolean;
  } | null>(null);
  const [editVal, setEditVal] = useState<number>(0);

  const teacher = db.teachers.find((t) => t.id === teacherId);
  const summary = teacherFinanceSummary(db, teacherId);
  const canEdit = canValidate(user?.role);

  const saveStatEdit = async () => {
    if (!teacher || !editingStat) return;
    const val = Number(editVal);
    if (isNaN(val) || val < 0) {
      toastMsg("Valeur invalide", "Veuillez entrer un nombre positif ou nul.", "error");
      return;
    }

    const { key } = editingStat;
    update((d) => ({
      ...d,
      teachers: d.teachers.map((t) => (t.id === teacher.id ? { ...t, [key]: val } : t)),
    }));

    if (isSupabaseConfigured && key === "heuresPrevues") {
      try {
        await supabase.from("teachers").update({ heures_prevues: val }).eq("id", teacher.id);
      } catch (err) {
        console.warn("Could not sync heures_prevues to Supabase:", err);
      }
    }

    log("update", "TeacherHours", `Modification manuelle de ${editingStat.label} (${val} ${editingStat.unit}) pour l'enseignant ${teacher.prenom} ${teacher.nom}`);
    toastMsg("Statistique modifiée", `${editingStat.label} a été mis à jour avec succès.`, "success");
    setEditingStat(null);
  };

  const resetStatOverride = (key: "heuresEffectueesOverride" | "heuresValideesOverride" | "montantDuOverride" | "montantPayeOverride", label: string) => {
    if (!teacher) return;
    update((d) => ({
      ...d,
      teachers: d.teachers.map((t) => {
        if (t.id !== teacher.id) return t;
        const copy = { ...t };
        delete copy[key];
        return copy;
      }),
    }));
    toastMsg("Calcul automatique restauré", `Le calcul automatique pour ${label} a été rétabli.`, "info");
    setEditingStat(null);
  };

  // Créneaux passés non encore validés : on liste les slots planifiés
  // auxquels cet enseignant est rattaché et qui n'ont pas encore d'heure créée.
  const pendingSlots = db.schedule
    .filter((s) => s.teacherId === teacherId)
    .filter((s) => !db.teacherHours.some((h) => h.scheduleId === s.id));

  useEffect(() => {
    if (!teacherId) return;
    if (isSupabaseConfigured) {
      fetchTeacherAdvances(teacherId).then(setAdvancesList).catch(() => {});
      fetchTeacherPayslips(teacherId).then(setPayslipsList).catch(() => {});
    }
  }, [teacherId]);

  const sortedHours = [...summary.hours].sort((a, b) => b.date.localeCompare(a.date));

  const validate = (slot: any) => {
    if (!teacher) return;
    const d = today();
    const heures = hoursBetween(slot.heureDebut, slot.heureFin) || 2;
    // Rémunération officielle : 2 500 FCFA par séance validée (Section 26)
    const tarif = tarifFor(db, teacherId, slot.moduleId) || TEACHER_SESSION_RATE;
    const montant = tarif;
    const th = {
      id: uid("TH"), scheduleId: slot.id, teacherId: slot.teacherId ?? teacherId,
      moduleId: slot.moduleId, date: slot.date ?? d, heureDebut: slot.heureDebut, heureFin: slot.heureFin,
      heures, tarifApplique: tarif, montant, valide: true, validePar: user?.name, dateValidation: d,
    };
    update((d2) => ({ ...d2, teacherHours: [th, ...d2.teacherHours] }));
    log(`Séance validée : ${teacher.prenom} ${teacher.nom} — ${heures} h · ${money(montant)}`);
  };

  const invalidate = (hId: string) => {
    if (!canEdit) return;
    update((d) => ({ ...d, teacherHours: d.teacherHours.filter((h) => h.id !== hId) }));
    log(`Séance retirée : ${hId}`);
  };

  const saveAdvance = async () => {
    if (!teacher || advanceForm.montant <= 0) {
      toastMsg.error("Montant invalide", "Veuillez saisir un montant positif pour l'avance.");
      return;
    }
    if (isSupabaseConfigured) {
      try {
        await recordTeacherAdvance({
          teacherId,
          amount: +advanceForm.montant,
          reason: advanceForm.reason || "Avance sur honoraires de formation",
          date: advanceForm.date || today(),
        });
        toastMsg.success("Avance enregistrée en base de données ✓");
        fetchTeacherAdvances(teacherId).then(setAdvancesList).catch(() => {});
      } catch (err: any) {
        toastMsg.error("Erreur enregistrement avance", err.message);
      }
    } else {
      toastMsg.success("Avance enregistrée en local ✓");
    }

    const adv = {
      id: uid("ADV"),
      teacherId,
      amount: +advanceForm.montant,
      reason: advanceForm.reason || "Avance sur honoraires",
      date: advanceForm.date || today(),
      status: "APPROUVE",
    };
    setAdvancesList((prev) => [adv, ...prev]);
    log(`Avance accordée à ${teacher.prenom} ${teacher.nom} : ${money(adv.amount)} (${adv.reason})`);
    setAdvanceForm({ montant: 0, reason: "", date: today() });
    setCreatingAdvance(false);
  };

  const generateAndPrintPayslip = async () => {
    if (!teacher) return;
    const periodHours = summary.hours.filter((h) => h.valide && h.date.startsWith(payslipPeriod));
    const totalSessions = periodHours.length;
    const grossAmount = totalSessions * TEACHER_SESSION_RATE;
    const periodAdvances = advancesList.filter((a) => (a.date || "").startsWith(payslipPeriod));
    const totalAdvances = periodAdvances.reduce((acc, a) => acc + (a.amount || 0), 0);
    const netAmount = Math.max(0, grossAmount - totalAdvances);
    const payslipRef = nextPayslipRef(parseInt(payslipPeriod.slice(0, 4), 10), payslipsList.length + 101);

    if (isSupabaseConfigured) {
      try {
        await generateTeacherPayslip(teacherId, payslipPeriod, TEACHER_SESSION_RATE);
        toastMsg.success("Bulletin de paie généré dans le système ✓");
        fetchTeacherPayslips(teacherId).then(setPayslipsList).catch(() => {});
      } catch (err: any) {
        console.warn("generateTeacherPayslip error:", err.message);
      }
    }

    const pSlip = {
      id: uid("SLIP"),
      payslip_number: payslipRef,
      teacher_id: teacherId,
      period_month: payslipPeriod,
      sessions_count: totalSessions,
      gross_amount: grossAmount,
      advances_deducted: totalAdvances,
      net_payable: netAmount,
      created_at: new Date().toISOString(),
    };
    setPayslipsList((prev) => [pSlip, ...prev]);

    printHTML(`Bulletin ${payslipRef}`, `
      <div class="receipt">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h1 class="accent" style="margin:0 0 4px 0">SENTINELLES NUMÉRIQUES</h1>
            <p style="font-size:11px;color:#94a3b8;margin:0">ENIA 2.0 • Centre de Cyberdéfense & Ingénierie</p>
            <p style="font-size:12px;font-weight:bold;color:#38bdf8;margin:3px 0 0 0">BULLETIN OFFICIEL DE PAIE FORMATEUR</p>
          </div>
          <div style="text-align:right">
            <p class="label" style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0">N° Bulletin</p>
            <p class="font-mono" style="font-size:14px;font-weight:bold;color:#38bdf8;margin:2px 0 0 0">${payslipRef}</p>
          </div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><p class="label">Formateur</p><p style="font-weight:700">${teacher.prenom} ${teacher.nom} (${teacherId})</p></div>
          <div><p class="label">Période concernée</p><p style="font-weight:700">${payslipPeriod}</p></div>
          <div><p class="label">Taux unitaire officiel</p><p class="cyan font-bold">${money(TEACHER_SESSION_RATE)} / séance validée</p></div>
          <div><p class="label">Séances validées</p><p class="font-bold">${totalSessions} séance(s)</p></div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <div class="row" style="display:flex;justify-content:space-between;padding:6px 0">
          <span>Rémunération brute (${totalSessions} séances × ${money(TEACHER_SESSION_RATE)})</span>
          <span class="gold" style="font-weight:bold">${money(grossAmount)}</span>
        </div>
        <div class="row" style="display:flex;justify-content:space-between;padding:6px 0;color:#f87171">
          <span>Déductions : Avances sur honoraires</span>
          <span style="font-weight:bold">- ${money(totalAdvances)}</span>
        </div>
        <div class="row" style="margin-top:12px;display:flex;justify-content:space-between;border-top:2px solid #1d2b45;padding-top:12px">
          <span style="font-size:15px;font-weight:bold">NET À PAYER</span>
          <span class="green" style="font-size:22px;font-weight:900;color:#34d399">${money(netAmount)}</span>
        </div>
        <div style="margin-top:30px;display:flex;justify-content:space-between;text-align:center;font-size:11px;color:#64748b">
          <div><p>Émargement Formateur</p><br><br><p>______________________</p></div>
          <div><p>Visa Direction Administrative & Financière</p><br><br><p>______________________</p></div>
        </div>
        <p style="margin-top:24px;text-align:center;font-size:10px;color:#64748b">SENTINELLES NUMÉRIQUES — Rémunération des formateurs</p>
      </div>
    `);

    setCreatingPayslip(false);
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
      <PageHead title="Heures & rémunération des enseignants" subtitle="Validation automatique basée sur l'emploi du temps — 2 500 FCFA / séance validée"
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" className="border-amber-400/30 text-amber-300 hover:bg-amber-400/10" onClick={() => setCreatingAdvance(true)} disabled={!teacherId || !canEdit}>
              <MinusCircle size={15} /> Avance sur honoraires
            </Btn>
            <Btn variant="outline" className="border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/10" onClick={() => setCreatingPayslip(true)} disabled={!teacherId || !canEdit}>
              <FileText size={15} /> Bulletin de paie
            </Btn>
            <Btn onClick={() => setCreatingPay(true)} disabled={!teacherId || !canEdit}>
              <BadgeDollarSign size={15} /> Enregistrer un versement
            </Btn>
          </div>
        } />

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
            <Stat
              icon={<Timer size={20} />}
              label="Prévues"
              value={`${teacher.heuresPrevues ?? 0} h`}
              color="blue"
              action={
                canEdit ? (
                  <button
                    type="button"
                    title="Modifier les heures prévues"
                    onClick={() => {
                      setEditingStat({
                        key: "heuresPrevues",
                        label: "Heures Prévues",
                        unit: "h",
                        currentVal: teacher.heuresPrevues ?? 0,
                        isOverride: false,
                      });
                      setEditVal(teacher.heuresPrevues ?? 0);
                    }}
                    className="rounded p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                  >
                    <Pencil size={13} />
                  </button>
                ) : undefined
              }
            />
            <Stat
              icon={<Clock size={20} />}
              label="Effectuées"
              value={`${summary.heuresEffectuees} h`}
              color="cyan"
              sub={teacher.heuresEffectueesOverride !== undefined ? "Valeur ajustée" : undefined}
              action={
                canEdit ? (
                  <div className="flex items-center gap-1">
                    {teacher.heuresEffectueesOverride !== undefined && (
                      <button
                        type="button"
                        title="Rétablir le calcul automatique"
                        onClick={() => resetStatOverride("heuresEffectueesOverride", "Heures Effectuées")}
                        className="rounded p-1 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Modifier les heures effectuées"
                      onClick={() => {
                        setEditingStat({
                          key: "heuresEffectueesOverride",
                          label: "Heures Effectuées",
                          unit: "h",
                          currentVal: summary.heuresEffectuees,
                          isOverride: teacher.heuresEffectueesOverride !== undefined,
                        });
                        setEditVal(summary.heuresEffectuees);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ) : undefined
              }
            />
            <Stat
              icon={<CheckCircle2 size={20} />}
              label="Validées"
              value={`${summary.heuresValidees} h`}
              color="green"
              sub={teacher.heuresValideesOverride !== undefined ? "Valeur ajustée" : undefined}
              action={
                canEdit ? (
                  <div className="flex items-center gap-1">
                    {teacher.heuresValideesOverride !== undefined && (
                      <button
                        type="button"
                        title="Rétablir le calcul automatique"
                        onClick={() => resetStatOverride("heuresValideesOverride", "Heures Validées")}
                        className="rounded p-1 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Modifier les heures validées"
                      onClick={() => {
                        setEditingStat({
                          key: "heuresValideesOverride",
                          label: "Heures Validées",
                          unit: "h",
                          currentVal: summary.heuresValidees,
                          isOverride: teacher.heuresValideesOverride !== undefined,
                        });
                        setEditVal(summary.heuresValidees);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ) : undefined
              }
            />
            <Stat
              icon={<TrendingUp size={20} />}
              label="Dû"
              value={money(summary.montantDu)}
              color="gold"
              sub={teacher.montantDuOverride !== undefined ? "Valeur ajustée" : undefined}
              action={
                canEdit ? (
                  <div className="flex items-center gap-1">
                    {teacher.montantDuOverride !== undefined && (
                      <button
                        type="button"
                        title="Rétablir le calcul automatique"
                        onClick={() => resetStatOverride("montantDuOverride", "Montant Dû")}
                        className="rounded p-1 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Modifier le montant dû"
                      onClick={() => {
                        setEditingStat({
                          key: "montantDuOverride",
                          label: "Montant Dû",
                          unit: "FCFA",
                          currentVal: summary.montantDu,
                          isOverride: teacher.montantDuOverride !== undefined,
                        });
                        setEditVal(summary.montantDu);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ) : undefined
              }
            />
            <Stat
              icon={<BadgeDollarSign size={20} />}
              label="Payé"
              value={money(summary.montantPaye)}
              color="red"
              sub={teacher.montantPayeOverride !== undefined ? "Valeur ajustée" : undefined}
              action={
                canEdit ? (
                  <div className="flex items-center gap-1">
                    {teacher.montantPayeOverride !== undefined && (
                      <button
                        type="button"
                        title="Rétablir le calcul automatique"
                        onClick={() => resetStatOverride("montantPayeOverride", "Montant Payé")}
                        className="rounded p-1 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Modifier le montant payé"
                      onClick={() => {
                        setEditingStat({
                          key: "montantPayeOverride",
                          label: "Montant Payé",
                          unit: "FCFA",
                          currentVal: summary.montantPaye,
                          isOverride: teacher.montantPayeOverride !== undefined,
                        });
                        setEditVal(summary.montantPaye);
                      }}
                      className="rounded p-1 text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                ) : undefined
              }
            />
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {([
              { k: "a_valider", l: `À valider (${pendingSlots.length})` },
              { k: "historique", l: `Séances validées (${summary.hours.length})` },
              { k: "avances", l: `Avances (${advancesList.length})` },
              { k: "bulletins", l: `Bulletins (${payslipsList.length})` },
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

          {tab === "avances" && (
            advancesList.length === 0 ? (
              <div className="space-y-4">
                <Empty icon={<MinusCircle size={40} />} title="Aucune avance accordée" sub="Les avances sur honoraires déductibles des bulletins apparaîtront ici." />
                <div className="text-center">
                  <Btn onClick={() => setCreatingAdvance(true)}><MinusCircle size={15} /> Enregistrer une première avance</Btn>
                </div>
              </div>
            ) : (
              <Card className="overflow-x-auto">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total avances : <b className="text-amber-300 font-bold">{money(advancesList.reduce((a, x) => a + (x.amount || 0), 0))}</b></span>
                  <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setCreatingAdvance(true)}><MinusCircle size={14} /> Nouvelle avance</Btn>
                </div>
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Motif de l'avance</th>
                      <th className="px-4 py-3">Montant</th>
                      <th className="px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancesList.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-semibold text-white">{a.date}</td>
                        <td className="px-4 py-3 text-slate-300">{a.reason || "Avance sur honoraires"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-300">{money(a.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge color="gold">{a.status || "DÉDUCTIBLE"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === "bulletins" && (
            payslipsList.length === 0 ? (
              <div className="space-y-4">
                <Empty icon={<FileText size={40} />} title="Aucun bulletin généré" sub="Générez un bulletin mensuel normalisé SN-PAIE-YYYY-XXXXXX." />
                <div className="text-center">
                  <Btn onClick={() => setCreatingPayslip(true)}><FileText size={15} /> Générer le bulletin du mois</Btn>
                </div>
              </div>
            ) : (
              <Card className="overflow-x-auto">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Bulletins officiels émis : <b>{payslipsList.length}</b></span>
                  <Btn variant="outline" className="text-xs px-3 py-1.5" onClick={() => setCreatingPayslip(true)}><FileText size={14} /> Nouveau bulletin</Btn>
                </div>
                <table className="w-full min-w-[750px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <th className="px-4 py-3">N° Bulletin</th>
                      <th className="px-4 py-3">Période</th>
                      <th className="px-4 py-3">Séances</th>
                      <th className="px-4 py-3">Brut (2 500 F/s)</th>
                      <th className="px-4 py-3">Avances déduites</th>
                      <th className="px-4 py-3">Net à payer</th>
                      <th className="px-4 py-3 text-right">Imprimer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipsList.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-300">{p.payslip_number || p.id}</td>
                        <td className="px-4 py-3 font-semibold text-white">{p.period_month}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.sessions_count} séance(s)</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{money(p.gross_amount)}</td>
                        <td className="px-4 py-3 font-mono text-red-400">{p.advances_deducted ? `- ${money(p.advances_deducted)}` : "—"}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-300">{money(p.net_payable)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              printHTML(`Bulletin ${p.payslip_number}`, `
                                <div class="receipt">
                                  <div style="display:flex;justify-content:space-between;align-items:center">
                                    <div><h1 class="accent">SENTINELLES NUMÉRIQUES</h1><p>ENIA 2.0 • Bulletin Officiel de Paie</p></div>
                                    <div style="text-align:right"><p class="label">N° Bulletin</p><p class="font-mono">${p.payslip_number}</p></div>
                                  </div>
                                  <hr style="border-color:#1d2b45;margin:16px 0">
                                  <div class="grid">
                                    <div><p class="label">Formateur</p><p style="font-weight:700">${teacher?.prenom} ${teacher?.nom} (${teacherId})</p></div>
                                    <div><p class="label">Période</p><p>${p.period_month}</p></div>
                                    <div><p class="label">Séances validées</p><p>${p.sessions_count} séance(s)</p></div>
                                    <div><p class="label">Taux séance</p><p>2 500 FCFA</p></div>
                                  </div>
                                  <div class="row" style="margin-top:16px"><span>Total brut</span><span class="gold">${money(p.gross_amount)}</span></div>
                                  <div class="row" style="color:#f87171"><span>Avances déduites</span><span>- ${money(p.advances_deducted || 0)}</span></div>
                                  <div class="row" style="border-top:2px solid #1d2b45;padding-top:10px"><span>NET PAYABLE</span><span class="green" style="font-size:20px;font-weight:800">${money(p.net_payable)}</span></div>
                                </div>
                              `);
                            }}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"
                            title="Imprimer le bulletin"
                          >
                            <Printer size={14} />
                          </button>
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

      {/* Modal avance sur honoraires (Section 27) */}
      <Modal open={creatingAdvance} onClose={() => setCreatingAdvance(false)} title={`Avance sur honoraires — ${teacher?.prenom ?? ""} ${teacher?.nom ?? ""}`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-4 text-xs text-amber-200">
            💡 Toute avance accordée sera automatiquement déduite du net payable sur le prochain bulletin de paie du formateur.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant de l'avance (FCFA)">
              <Input
                type="number"
                min={1000}
                step={500}
                value={advanceForm.montant || ""}
                onChange={(e) => setAdvanceForm({ ...advanceForm, montant: +e.target.value })}
                placeholder="ex: 20000"
              />
            </Field>
            <Field label="Date d'octroi">
              <Input
                type="date"
                value={advanceForm.date}
                onChange={(e) => setAdvanceForm({ ...advanceForm, date: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Motif ou justification de l'avance">
            <Textarea
              placeholder="ex: Avance demandée pour frais de mission / mi-parcours..."
              value={advanceForm.reason}
              onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setCreatingAdvance(false)}>Annuler</Btn>
            <Btn className="bg-amber-500 hover:bg-amber-400 text-black font-bold" onClick={saveAdvance}>
              <MinusCircle size={15} /> Enregistrer l'avance
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal génération bulletin de paie (Section 26) */}
      <Modal open={creatingPayslip} onClose={() => setCreatingPayslip(false)} title={`Générer un bulletin de paie — ${teacher?.prenom ?? ""} ${teacher?.nom ?? ""}`}>
        <div className="space-y-4">
          <Field label="Période mensuelle (Mois de paie)">
            <Input
              type="month"
              value={payslipPeriod}
              onChange={(e) => setPayslipPeriod(e.target.value)}
            />
          </Field>
          {(() => {
            const periodHours = summary.hours.filter((h) => h.valide && h.date.startsWith(payslipPeriod));
            const count = periodHours.length;
            const gross = count * TEACHER_SESSION_RATE;
            const adv = advancesList.filter((a) => (a.date || "").startsWith(payslipPeriod)).reduce((acc, a) => acc + (a.amount || 0), 0);
            const net = Math.max(0, gross - adv);
            return (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase text-slate-500">Séances validées</p>
                    <p className="font-display text-lg font-bold text-cyan-300">{count} séance(s)</p>
                    <p className="text-[10px] text-slate-400">à 2 500 F / séance</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase text-slate-500">Rémunération brute</p>
                    <p className="font-display text-lg font-bold text-amber-300">{money(gross)}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase text-slate-500">Avances déduites</p>
                    <p className="font-display text-lg font-bold text-red-400">- {money(adv)}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-4 flex justify-between items-center">
                  <span className="font-semibold text-white">Net à verser au formateur :</span>
                  <span className="font-display text-2xl font-black text-emerald-300">{money(net)}</span>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setCreatingPayslip(false)}>Annuler</Btn>
            <Btn className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold" onClick={generateAndPrintPayslip}>
              <Printer size={15} /> Générer & Imprimer le bulletin
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal d'ajustement direct d'une statistique */}
      <Modal
        open={Boolean(editingStat)}
        onClose={() => setEditingStat(null)}
        title={editingStat ? `Modifier : ${editingStat.label}` : "Modifier"}
      >
        {editingStat && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300 leading-relaxed">
              Vous pouvez ajuster manuellement la valeur pour l'enseignant{" "}
              <strong className="text-cyan-300">
                {teacher?.prenom} {teacher?.nom}
              </strong>
              .
              {editingStat.isOverride && (
                <p className="mt-1 text-amber-400 font-medium">
                  Une valeur manuelle personnalisée est actuellement appliquée. Vous pouvez la mettre à jour ou restaurer le calcul automatique.
                </p>
              )}
            </div>

            <Field label={`Nouvelle valeur (${editingStat.unit})`}>
              <Input
                type="number"
                min={0}
                step={editingStat.unit === "h" ? 0.5 : 500}
                value={editVal}
                onChange={(e) => setEditVal(parseFloat(e.target.value) || 0)}
              />
            </Field>

            <div className="flex justify-between items-center gap-2 pt-3 border-t border-white/10">
              {editingStat.key !== "heuresPrevues" && editingStat.isOverride ? (
                <Btn
                  variant="outline"
                  className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10 text-xs"
                  onClick={() => resetStatOverride(editingStat.key as any, editingStat.label)}
                >
                  <RotateCcw size={13} /> Rétablir automatique
                </Btn>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => setEditingStat(null)}>
                  Annuler
                </Btn>
                <Btn className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold" onClick={saveStatEdit}>
                  <Save size={14} /> Enregistrer
                </Btn>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
