import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, MapPin, Clock, MessageCircle, FileText, CheckCircle2, Send, ChevronRight,
  Award, Medal, TrendingUp,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { moduleIcon, money, Btn, Field, Input, Card, SectionTitle, formationLabel } from "@/lib/ui";
import { Formation } from "@/lib/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export { LoginPage } from "./Login";

/* ================= FORMATIONS ================= */
export function FormationsPage() {
  const { db } = useStore();
  const [tab, setTab] = useState<Formation>("informatique");
  const infos = db.settings.infos;
  const modules = db.modules.filter((m) => m.formation === tab);
  const isInfo = tab === "informatique";

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-10 text-center">
        <SectionTitle color="cyan">Catalogue officiel</SectionTitle>
        <h1 className="font-display text-3xl font-black text-white sm:text-4xl">Nos formations & modules</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[#4C91B5]">
          {isInfo ? db.settings.formations.informatique.description : db.settings.formations.industriel.description}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {(["informatique", "industriel"] as Formation[]).map((f) => (
            <button
              key={f}
              onClick={() => setTab(f)}
              className={cn(
                "rounded border px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider transition-all",
                tab === f
                  ? f === "informatique"
                    ? "border-[#FF174F] bg-[#2A0815] text-[#FF174F] shadow-[0_0_20px_rgba(255,23,79,0.4)]"
                    : "border-[#00C8FF] bg-[#071A2B] text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                  : "border-[#006DFF]/25 text-[#4C91B5] hover:bg-[#071A2B]/40 hover:text-white"
              )}
            >
              {formationLabel(f)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <div key={m.id} className={cn(
            "group rounded-lg border bg-[#0B111A]/95 p-6 transition-all hover:-translate-y-1",
            isInfo
              ? "border-[#FF174F]/30 hover:border-[#FF174F] hover:shadow-[0_0_30px_-5px_rgba(255,23,79,0.4)]"
              : "border-[#00C8FF]/30 hover:border-[#00C8FF] hover:shadow-[0_0_30px_-5px_rgba(0,229,255,0.4)]"
          )}>
            <div className="mb-4 flex items-center justify-between">
              <div className={cn("rounded border p-2.5", isInfo ? "border-[#FF174F]/40 bg-[#2A0815] text-[#FF174F]" : "border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF]")}>
                {moduleIcon(m.icon, "h-5 w-5")}
              </div>
              <span className={cn("font-mono text-xs font-bold tracking-[0.2em]", isInfo ? "text-[#FF174F]" : "text-[#00C8FF]")}>
                MODULE {String(m.numero).padStart(2, "0")}
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-white">{m.titre}</h3>
            <ul className="mt-4 space-y-1.5">
              {m.notions.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#B8F3FF]">
                  <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", isInfo ? "bg-[#FF174F]" : "bg-[#00E5FF]")} /> {n}
                </li>
              ))}
            </ul>
            <Link to="/pre-inscription" className={cn(
              "mt-5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-all",
              isInfo ? "text-[#FF174F] hover:underline" : "text-[#00E5FF] hover:underline"
            )}>
              S'inscrire à ce module <ChevronRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-4 rounded-lg border border-[#006DFF]/30 bg-[#0B111A]/90 p-6 sm:grid-cols-4">
        {[
          { icon: <CalendarDays size={18} className="text-cyan-300" />, t: "Début", v: infos.debut },
          { icon: <Clock size={18} className="text-red-400" />, t: "Durée", v: infos.duree },
          { icon: <MapPin size={18} className="text-blue-400" />, t: "Lieu", v: infos.lieu },
          { icon: <MessageCircle size={18} className="text-emerald-300" />, t: "WhatsApp", v: infos.whatsapp.join(" / ") },
        ].map((c, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5">{c.icon}</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.t}</p>
              <p className="text-sm font-bold text-slate-200">{c.v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= TARIFS ================= */
export function TarifsPage() {
  const { db } = useStore();
  const f = db.settings.frais;
  const rows = (arr: { label: string; modules: number; montant: number }[]) =>
    arr.map((r, i) => (
      <tr key={i} className="border-b border-white/5 last:border-0">
        <td className="px-4 py-3 text-sm text-slate-300">{r.label}{r.modules === 12 ? " (12 modules)" : ""}</td>
        <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">{r.modules} modules</td>
        <td className="px-4 py-3 text-right font-display text-sm font-black text-white">{money(r.montant)}</td>
      </tr>
    ));

  return (
    <div className="bg-circuit relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="bg-grid-hex pointer-events-none absolute inset-0" />
      <div className="relative">
        <div className="mb-10 text-center">
          <SectionTitle color="gold">Tarification transparente</SectionTitle>
          <h1 className="font-display text-3xl font-black text-white sm:text-4xl">Frais de formation</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Des formules adaptées à votre projet. L'inscription est de {money(f.inscription)}.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="overflow-hidden" glow="red">
            <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/15 to-transparent px-6 py-4">
              <h3 className="font-display text-lg font-black text-red-400">GÉNIE INFORMATIQUE</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Formule</th><th className="px-4 py-3 text-center">Modules</th><th className="px-4 py-3 text-right">Tarif</th>
                </tr>
              </thead>
              <tbody>{rows(f.informatique)}</tbody>
            </table>
          </Card>

          <Card className="overflow-hidden" glow="cyan">
            <div className="border-b border-cyan-400/30 bg-gradient-to-r from-cyan-500/15 to-transparent px-6 py-4">
              <h3 className="font-display text-lg font-black text-cyan-300">GÉNIE INDUSTRIEL</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">Formule</th><th className="px-4 py-3 text-center">Modules</th><th className="px-4 py-3 text-right">Tarif</th>
                </tr>
              </thead>
              <tbody>{rows(f.industriel)}</tbody>
            </table>
          </Card>
        </div>

        {/* Modalités officielles de règlement en 3 tranches */}
        <div className="mt-8 rounded-lg border border-[#00C8FF]/30 bg-[#0B111A]/95 p-6 shadow-[0_0_30px_rgba(0,109,255,0.25)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#006DFF]/25 pb-4 mb-4">
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#00E5FF]">Modalités & Cycle de règlement officiel</p>
              <h3 className="font-display text-lg font-black text-white mt-0.5">Paiement échelonné en 3 tranches</h3>
            </div>
            <Link to="/pre-inscription">
              <Btn variant="green" className="py-2 text-xs font-bold uppercase tracking-wider">
                S'inscrire en ligne
              </Btn>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-amber-400/30 bg-[#261E05]/60 p-4">
              <span className="inline-block rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">Tranche 1</span>
              <p className="font-display text-sm font-bold text-white mt-1.5">Frais d'inscription ({money(f.inscription)})</p>
              <p className="text-xs text-[#4C91B5] mt-1">À régler dès la confirmation avant le début des cours (ouvre votre accès et délivre votre badge apprenant).</p>
            </div>
            <div className="rounded border border-[#00C8FF]/30 bg-[#071A2B]/70 p-4">
              <span className="inline-block rounded bg-[#00C8FF]/20 px-2 py-0.5 text-[10px] font-bold text-[#00E5FF] uppercase">Tranche 2</span>
              <p className="font-display text-sm font-bold text-[#00E5FF] mt-1.5">50% des cours (À 1 mois)</p>
              <p className="text-xs text-[#4C91B5] mt-1">Exigible un mois après le démarrage de la formation sur la base des modules choisis.</p>
            </div>
            <div className="rounded border border-[#00FF88]/30 bg-[#052619]/60 p-4">
              <span className="inline-block rounded bg-[#00FF88]/20 px-2 py-0.5 text-[10px] font-bold text-[#00FF88] uppercase">Tranche 3</span>
              <p className="font-display text-sm font-bold text-[#00FF88] mt-1.5">Solde restant (Fin de formation)</p>
              <p className="text-xs text-[#4C91B5] mt-1">Dernière tranche à régler avant la fin de la formation pour valider l'examen et obtenir le certificat.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Award size={22} className="text-amber-300" />, t: db.settings.avantages[0], b: "border-amber-400/30" },
            { icon: <Medal size={22} className="text-[#00E5FF]" />, t: db.settings.avantages[1], b: "border-[#00C8FF]/30" },
            { icon: <TrendingUp size={22} className="text-[#00FF88]" />, t: db.settings.avantages[2], b: "border-[#00FF88]/30" },
          ].map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 rounded-lg border bg-[#0B111A]/90 p-5", a.b)}>
              <div className="mt-0.5 shrink-0">{a.icon}</div>
              <p className="text-sm font-semibold text-[#B8F3FF]">{a.t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= PRE-INSCRIPTION ================= */
export function PreInscriptionPage() {
  const { db, update, log, notify, computeAmount, calculatePricingBreakdown } = useStore();
  const s = db.settings;
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", whatsapp: "", email: "", niveau: "",
    formation: "informatique" as Formation, modules: [] as string[],
  });
  const [done, setDone] = useState<{ id: string; nom: string } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const avail = db.modules.filter((m) => m.formation === form.formation);
  const f = s.frais;

  const toggleMod = (id: string) =>
    setForm((p) => ({ ...p, modules: p.modules.includes(id) ? p.modules.filter((x) => x !== id) : [...p.modules, id] }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) return setError("Nom et prénom obligatoires.");
    if (!form.telephone.trim()) return setError("Un numéro de téléphone est requis.");
    if (avail.length > 0 && form.modules.length === 0) return setError("Sélectionnez au moins un module.");
    setError("");
    setSubmitting(true);

    if (isSupabaseConfigured) {
      try {
        const { data, error: rpcErr } = await supabase.rpc("submit_registration", {
          p_nom: form.nom.trim(),
          p_prenom: form.prenom.trim(),
          p_telephone: form.telephone.trim(),
          p_whatsapp: form.whatsapp.trim() || form.telephone.trim(),
          p_email: form.email.trim(),
          p_niveau: form.niveau.trim(),
          p_formation_code: form.formation,
          p_module_ids: form.modules,
        });

        if (rpcErr) {
          throw new Error(rpcErr.message || "Erreur lors de l'enregistrement.");
        }

        const regId = data?.id || `REG-${Date.now().toString(36)}`;
        setDone({ id: regId, nom: `${form.nom} ${form.prenom}` });
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        return;
      } catch (err: any) {
        setError(err?.message || "Une erreur est survenue. Veuillez réessayer.");
        return;
      } finally {
        setSubmitting(false);
      }
    }

    // Mode local (fallback)
    const reg = {
      id: `REG-${Date.now().toString(36)}`, ...form, date: new Date().toISOString().slice(0, 10), statut: "en_attente" as const,
    };
    try {
      update((d) => ({ ...d, registrations: [reg, ...d.registrations] }));
      log(`Nouvelle pré-inscription : ${form.nom} ${form.prenom} (${formationLabel(form.formation)})`);
      notify("all", "Nouvelle pré-inscription", `${form.nom} ${form.prenom} s'est pré-inscrit(e) en ${formationLabel(form.formation)}.`, "inscription");
      setDone({ id: reg.id, nom: `${form.nom} ${form.prenom}` });
      setError("");
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue. Veuillez réessayer.");
    }
  };

  if (s.preInscription && s.preInscription.enabled === false) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10">
          <Clock size={36} className="text-amber-300" />
        </div>
        <h1 className="font-display text-2xl font-black text-white">{s.preInscription.title || "Inscriptions suspendues"}</h1>
        <p className="mt-3 text-slate-300">{s.preInscription.description || "Les pré-inscriptions en ligne sont momentanément fermées. Veuillez contacter le centre pour plus d'informations."}</p>
        <div className="mt-6">
          <Link to="/"><Btn variant="outline">Retour à l'accueil</Btn></Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_40px_-8px_rgba(0,255,136,0.6)]">
          <CheckCircle2 size={38} className="text-emerald-300" />
        </div>
        <h1 className="font-display text-2xl font-black text-white">Pré-inscription enregistrée !</h1>
        <p className="mt-3 text-slate-300">Merci <span className="font-bold text-cyan-300">{done.nom}</span>, votre demande a bien été reçue.</p>
        <p className="mt-2 font-mono text-sm text-slate-400">Référence : <span className="text-emerald-300">{done.id}</span></p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Prochaines étapes</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>1. Présentez-vous au centre avec une pièce d'identité.</li>
            <li>2. Réglez les frais d'inscription de {money(f.inscription)}.</li>
            <li>3. Recevez votre carte d'apprenant avec QR Code.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/"><Btn variant="outline">Retour à l'accueil</Btn></Link>
            {s.infos.whatsapp[0] && (
              <a href={`https://wa.me/242${s.infos.whatsapp[0].replace(/\s/g, "")}`} target="_blank" rel="noreferrer">
                <Btn variant="green"><MessageCircle size={16} /> Contact WhatsApp</Btn>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-8 text-center">
        <SectionTitle color="green">Formulaire en ligne</SectionTitle>
        <h1 className="font-display text-3xl font-black text-white">{s.preInscription.title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">{s.preInscription.description}</p>
      </div>

      <Card className="p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom"><Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Votre nom" /></Field>
            <Field label="Prénom"><Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Votre prénom" /></Field>
            <Field label="Téléphone"><Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="06 XX XX XX XX" /></Field>
            <Field label="WhatsApp"><Input required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="06 XX XX XX XX" /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" /></Field>
            <Field label="Niveau d'étude"><Input required value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} placeholder="Baccalauréat, BEP, Licence..." /></Field>
          </div>

          <Field label="Formation choisie">
            <div className="grid grid-cols-2 gap-3">
              {(["informatique", "industriel"] as Formation[]).map((f2) => (
                <button type="button" key={f2} onClick={() => setForm({ ...form, formation: f2, modules: [] })}
                  className={cn(
                    "rounded border p-4 text-left transition-all",
                    form.formation === f2
                      ? f2 === "informatique"
                        ? "border-[#FF174F] bg-[#2A0815] shadow-[0_0_15px_rgba(255,23,79,0.3)]"
                        : "border-[#00C8FF] bg-[#071A2B] shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                      : "border-[#006DFF]/25 hover:bg-[#0B111A]"
                  )}>
                  <p className={cn("font-display text-sm font-black", f2 === "informatique" ? "text-[#FF174F]" : "text-[#00E5FF]")}>{formationLabel(f2)}</p>
                  <p className="mt-1 text-[11px] text-[#4C91B5]">{f2 === "informatique" ? "7 modules disponibles" : "12 modules disponibles"}</p>
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Modules choisis (${form.modules.length} sélectionné(s))`}>
            {avail.length === 0 ? (
              <div className="rounded border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
                Aucun module n'est encore publié pour cette formation. Vous pouvez tout de même envoyer une pré-inscription — l'administration reviendra vers vous pour valider le parcours.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {avail.map((m) => (
                  <button type="button" key={m.id} onClick={() => toggleMod(m.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded border px-3.5 py-2.5 text-left text-xs transition-all",
                      form.modules.includes(m.id)
                        ? form.formation === "informatique"
                          ? "border-[#FF174F] bg-[#2A0815] text-[#FF174F]"
                          : "border-[#00C8FF] bg-[#071A2B] text-[#00E5FF]"
                        : "border-[#006DFF]/25 text-[#B8F3FF] hover:bg-[#071A2B]/40"
                    )}>
                    <span className="shrink-0">{moduleIcon(m.icon, "h-4 w-4")}</span>
                    <span className="truncate">{String(m.numero).padStart(2, "0")} — {m.titre}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>

          {error && <p className="rounded border border-[#FF174F]/50 bg-[#2A0815] px-3 py-2 text-xs font-semibold text-[#FF174F]">{error}</p>}

          {(() => {
            const pb = calculatePricingBreakdown(form.formation, form.modules.length);
            return (
              <div className="space-y-3">
                <div className="rounded border border-[#00C8FF]/35 bg-[#071A2B]/60 p-4">
                  <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#00E5FF]">💰 Détail certifié des frais</span>
                    <span className="font-display text-xl font-black text-[#00E5FF] font-mono">{money(pb.total)}</span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs text-[#B8F3FF]">
                    <div className="flex justify-between">
                      <span className="text-[#4C91B5]">Frais d'inscription (unique) :</span>
                      <span className="font-bold font-mono text-white">{money(pb.registrationFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4C91B5]">Formation ({form.modules.length} module(s)) :</span>
                      <span className="font-bold font-mono text-white">{money(pb.moduleTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-4 text-xs text-[#B8F3FF]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="font-bold font-mono uppercase tracking-wider text-[#00E5FF]">📅 Échéancier officiel en 3 tranches</p>
                    <span className="text-[10px] text-[#4C91B5]">Modalités flexibles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="rounded border border-amber-400/30 bg-[#261E05]/60 p-2.5">
                      <p className="text-[10px] font-bold text-amber-300 uppercase">Tranche 1 (Inscription)</p>
                      <p className="text-sm font-black text-white mt-0.5 font-mono">{money(pb.tranche1)}</p>
                      <p className="text-[9px] text-[#4C91B5] mt-1">Avant le début des cours (valide votre badge et accès).</p>
                    </div>
                    <div className="rounded border border-[#00C8FF]/30 bg-[#071A2B]/60 p-2.5">
                      <p className="text-[10px] font-bold text-[#00E5FF] uppercase">Tranche 2 (Après 1 mois)</p>
                      <p className="text-sm font-black text-[#00E5FF] mt-0.5 font-mono">{money(pb.tranche2)}</p>
                      <p className="text-[9px] text-[#4C91B5] mt-1">50% des cours, 1 mois après le démarrage.</p>
                    </div>
                    <div className="rounded border border-[#00FF88]/30 bg-[#052619]/60 p-2.5">
                      <p className="text-[10px] font-bold text-[#00FF88] uppercase">Tranche 3 (Fin de session)</p>
                      <p className="text-sm font-black text-[#00FF88] mt-0.5 font-mono">{money(pb.tranche3)}</p>
                      <p className="text-[9px] text-[#4C91B5] mt-1">Solde restant avant validation et certificat.</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <Btn type="submit" variant="green" disabled={submitting} className="w-full py-3.5 text-base">
            <Send size={17} /> {submitting ? "Enregistrement en cours..." : "Envoyer ma pré-inscription"}
          </Btn>
        </form>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: <FileText size={18} className="text-cyan-300" />, t: "Inscription", v: money(f.inscription) },
          { icon: <CalendarDays size={18} className="text-red-400" />, t: "Début", v: s.infos.debut },
          { icon: <MapPin size={18} className="text-blue-400" />, t: "Lieu", v: s.infos.lieu },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            {c.icon}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.t}</p>
              <p className="truncate text-sm font-bold text-slate-200">{c.v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
