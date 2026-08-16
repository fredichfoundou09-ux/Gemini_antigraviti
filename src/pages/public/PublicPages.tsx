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

// LoginPage vit désormais dans ./Login.tsx (porte d'entrée sécurisée de production).
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
        <SectionTitle color="cyan">Catalogue complet</SectionTitle>
        <h1 className="font-display text-3xl font-black text-white sm:text-4xl">Nos formations & modules</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          {isInfo ? db.settings.formations.informatique.description : db.settings.formations.industriel.description}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {(["informatique", "industriel"] as Formation[]).map((f) => (
            <button
              key={f}
              onClick={() => setTab(f)}
              className={cn(
                "rounded-xl border px-6 py-3 font-display text-sm font-bold transition-all",
                tab === f
                  ? f === "informatique"
                    ? "border-red-500/60 bg-red-500/10 text-red-400 shadow-[0_0_25px_-8px_rgba(255,23,68,0.7)]"
                    : "border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-[0_0_25px_-8px_rgba(0,229,255,0.7)]"
                  : "border-white/10 text-slate-400 hover:bg-white/5"
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
            "group rounded-2xl border bg-[#0A1224]/80 p-6 transition-all hover:-translate-y-1",
            isInfo
              ? "border-red-500/20 hover:border-red-500/50 hover:shadow-[0_0_35px_-10px_rgba(255,23,68,0.5)]"
              : "border-cyan-400/20 hover:border-cyan-400/50 hover:shadow-[0_0_35px_-10px_rgba(0,229,255,0.5)]"
          )}>
            <div className="mb-4 flex items-center justify-between">
              <div className={cn("rounded-xl border p-3", isInfo ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}>
                {moduleIcon(m.icon, "h-6 w-6")}
              </div>
              <span className={cn("font-mono text-xs font-bold tracking-[0.2em]", isInfo ? "text-red-400/70" : "text-cyan-400/70")}>
                MODULE {String(m.numero).padStart(2, "0")}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-white">{m.titre}</h3>
            <ul className="mt-4 space-y-1.5">
              {m.notions.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", isInfo ? "bg-red-400" : "bg-cyan-400")} /> {n}
                </li>
              ))}
            </ul>
            <Link to="/pre-inscription" className={cn(
              "mt-5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-all",
              isInfo ? "text-red-400 hover:text-red-300" : "text-cyan-300 hover:text-cyan-200"
            )}>
              S'inscrire à ce module <ChevronRight size={14} />
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:grid-cols-4">
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

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Award size={22} className="text-amber-300" />, t: db.settings.avantages[0], b: "border-amber-400/30" },
            { icon: <Medal size={22} className="text-cyan-300" />, t: db.settings.avantages[1], b: "border-cyan-400/30" },
            { icon: <TrendingUp size={22} className="text-emerald-300" />, t: db.settings.avantages[2], b: "border-emerald-400/30" },
          ].map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 rounded-2xl border bg-white/[0.03] p-5", a.b)}>
              <div className="mt-0.5 shrink-0">{a.icon}</div>
              <p className="text-sm font-semibold text-slate-200">{a.t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= PRE-INSCRIPTION ================= */
export function PreInscriptionPage() {
  const { db, update, log, notify, computeAmount } = useStore();
  const s = db.settings;
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", whatsapp: "", email: "", niveau: "",
    formation: "informatique" as Formation, modules: [] as string[],
  });
  const [done, setDone] = useState<{ id: string; nom: string } | null>(null);
  const [error, setError] = useState("");

  const avail = db.modules.filter((m) => m.formation === form.formation);
  const f = s.frais;

  const toggleMod = (id: string) =>
    setForm((p) => ({ ...p, modules: p.modules.includes(id) ? p.modules.filter((x) => x !== id) : [...p.modules, id] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) return setError("Nom et prénom obligatoires.");
    if (!form.telephone.trim()) return setError("Un numéro de téléphone est requis.");
    // Les modules restent facultatifs si aucun n'est encore publié
    if (avail.length > 0 && form.modules.length === 0) return setError("Sélectionnez au moins un module.");
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
                    "rounded-xl border p-4 text-left transition-all",
                    form.formation === f2
                      ? f2 === "informatique"
                        ? "border-red-500/60 bg-red-500/10"
                        : "border-cyan-400/60 bg-cyan-400/10"
                      : "border-white/10 hover:bg-white/5"
                  )}>
                  <p className={cn("font-display text-sm font-black", f2 === "informatique" ? "text-red-400" : "text-cyan-300")}>{formationLabel(f2)}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{f2 === "informatique" ? "7 modules disponibles" : "12 modules disponibles"}</p>
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Modules choisis (${form.modules.length} sélectionné(s))`}>
            {avail.length === 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
                Aucun module n'est encore publié pour cette formation. Vous pouvez tout de même envoyer une pré-inscription — l'administration reviendra vers vous pour valider le parcours.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {avail.map((m) => (
                  <button type="button" key={m.id} onClick={() => toggleMod(m.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all",
                      form.modules.includes(m.id)
                        ? form.formation === "informatique"
                          ? "border-red-500/50 bg-red-500/10 text-red-300"
                          : "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border-white/10 text-slate-300 hover:bg-white/5"
                    )}>
                    <span className="shrink-0">{moduleIcon(m.icon, "h-4 w-4")}</span>
                    <span className="truncate">{String(m.numero).padStart(2, "0")} — {m.titre}</span>
                  </button>
                ))}
              </div>
            )}
          </Field>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">{error}</p>}

          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">💰 Calcul automatique du montant</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
              <span>Formation : <b className="text-white">{formationLabel(form.formation)}</b> — {form.modules.length} module(s) sélectionné(s)</span>
              <span className="font-display text-xl font-black text-cyan-300">{money(computeAmount(form.formation, form.modules.length))}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Le montant est calculé automatiquement selon la formule tarifaire correspondant à vos modules.</p>
          </div>
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-slate-300">
            💡 Frais d'inscription : <span className="font-black text-amber-300">{money(f.inscription)}</span> — à régler lors de la confirmation au centre.
            {s.infos.whatsapp.length > 0 && (
              <> Contact WhatsApp : <span className="font-bold text-emerald-300">{s.infos.whatsapp.join(" / ")}</span></>
            )}
          </div>

          <Btn type="submit" variant="green" className="w-full py-3.5 text-base"><Send size={17} /> Envoyer ma pré-inscription</Btn>
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
