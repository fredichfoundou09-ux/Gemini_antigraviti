import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, ExternalLink, Download, Maximize2, X, Gift, FileText, Wallet,
  CheckCircle2, Building2, Image as ImageIcon, Handshake, Eye, EyeOff, PlusCircle, Trash2, Pencil, Save, Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import {
  Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Textarea, uid, readImage,
} from "@/lib/ui";
import { EniaContent, EniaPartner } from "@/lib/types";
import eniaAfficheDefault from "@/assets/enia-affiche.jpg";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";

/* ================= CONSULTATION (tous rôles) ================= */
export function EniaPage() {
  const { db, user } = useStore();
  const enia = db.enia;
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const [lightbox, setLightbox] = useState(false);

  if (!enia?.visible && !isAdmin) {
    return (
      <div>
        <PageHead title="ENIA 2.0" subtitle="Module temporairement indisponible" />
        <Empty icon={<GraduationCap size={40} />} title="Contenu non publié" sub="L'administration n'a pas encore publié le module ENIA 2.0." />
      </div>
    );
  }

  const affiche = enia.affiche || eniaAfficheDefault;
  const partners = [...(enia.partenaires || [])].filter((p) => p.actif).sort((a, b) => a.ordre - b.ordre);
  const fees = [...(enia.fraisScolaires || [])].sort((a, b) => a.ordre - b.ordre);
  const pieces = [...(enia.pieces || [])].sort((a, b) => a.ordre - b.ordre);
  const avantages = [...(enia.bourseAvantages || [])].sort((a, b) => a.ordre - b.ordre);

  return (
    <div>
      <PageHead
        title={enia.titre || "ENIA 2.0"}
        subtitle={enia.sousTitre || "École du Numérique et de l'Intelligence Artificielle"}
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link to="/app/enia-admin">
                <Btn variant="outline"><Pencil size={15} /> Gérer ENIA 2.0</Btn>
              </Link>
            )}
            {enia.lien?.actif && enia.lien.url && (
              <a href={enia.lien.url} target="_blank" rel="noreferrer">
                <Btn><ExternalLink size={15} /> Visiter ENIA 2.0</Btn>
              </a>
            )}
            <Link to="/pre-inscription">
              <Btn variant="red">Pré-inscription</Btn>
            </Link>
          </div>
        }
      />

      {!enia.visible && isAdmin && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          ⚠ Module actuellement masqué pour les formateurs et apprenants. Publiez-le depuis l'administration.
        </div>
      )}

      {/* Hero card */}
      <Card className="mb-6 overflow-hidden p-0" glow="cyan">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-8">
            <Badge color="cyan">ENIA 2.0</Badge>
            <h2 className="font-display mt-3 text-2xl font-black text-white sm:text-3xl">
              {enia.titre} — {enia.sousTitre}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{enia.presentation}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(enia.bourseHighlights || []).map((h, i) => (
                <span key={i} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                  {i + 1}. {h}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#enia-bourse"><Btn variant="outline">Découvrir la bourse</Btn></a>
              {enia.lien?.actif && enia.lien.url && (
                <a href={enia.lien.url} target="_blank" rel="noreferrer">
                  <Btn><ExternalLink size={15} /> Site ENIA</Btn>
                </a>
              )}
            </div>
          </div>
          <div className="relative min-h-[260px] border-t border-white/5 bg-black/30 lg:border-l lg:border-t-0">
            <img src={affiche} alt="Affiche ENIA 2.0" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-4">
              <Btn variant="outline" onClick={() => setLightbox(true)}><Maximize2 size={14} /> Agrandir</Btn>
              {enia.allowDownloadAffiche && (
                <a href={affiche} download="affiche-enia-2.0.jpg">
                  <Btn variant="ghost"><Download size={14} /> Télécharger</Btn>
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Bourse 100% */}
      <section id="enia-bourse" className="mb-6">
        <Card className="p-6" glow="gold">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Gift size={18} className="text-amber-300" />
                <h3 className="font-display text-lg font-black text-white">{enia.bourseTitre || "Bourse ENIA 2.0"}</h3>
              </div>
              <p className="max-w-3xl text-sm text-slate-300">{enia.bourseIntro}</p>
            </div>
            <Badge color="gold">BOURSE 100 % GRATUITE</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {(enia.bourseHighlights || []).map((h, i) => (
              <div key={i} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <p className="font-mono text-xs text-amber-300">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-display text-sm font-bold text-white">{h}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {avantages.map((a) => (
              <div key={a.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">{a.titre}</p>
                  {a.description && <p className="mt-0.5 text-xs text-slate-400">{a.description}</p>}
                </div>
              </div>
            ))}
          </div>
          {enia.bourseConcretement && (
            <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">Concrètement</p>
              <p className="text-sm text-slate-300">{enia.bourseConcretement}</p>
            </div>
          )}
        </Card>
      </section>

      {/* Frais scolaires */}
      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Wallet size={18} className="text-cyan-300" />
            <h3 className="font-display text-lg font-black text-white">Frais scolaires</h3>
          </div>
          {fees.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune information tarifaire pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-2 py-2">Élément</th>
                    <th className="px-2 py-2 text-right">Information</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-2.5 text-slate-300">{f.label}</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-cyan-200">{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6" glow="red">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={18} className="text-red-300" />
            <h3 className="font-display text-lg font-black text-white">Pièces à fournir</h3>
          </div>
          <div className="space-y-4">
            {pieces.map((g) => (
              <div key={g.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <p className="text-sm font-bold text-white">{g.titre}</p>
                <ul className="mt-2 space-y-1">
                  {(g.pieces || []).map((p, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-300">
                      <span className="text-cyan-400">•</span> {p}
                    </li>
                  ))}
                </ul>
                {g.fraisDepot && (
                  <p className="mt-2 text-xs font-semibold text-amber-300">Frais de dépôt de dossier : {g.fraisDepot}</p>
                )}
              </div>
            ))}
          </div>
          {enia.noteInscription && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
              {enia.noteInscription}
            </p>
          )}
        </Card>
      </section>

      {/* Lien + partenaires */}
      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <ExternalLink size={18} className="text-cyan-300" />
            <h3 className="font-display text-lg font-black text-white">Lien ENIA 2.0</h3>
          </div>
          {enia.lien?.actif && enia.lien.url ? (
            <>
              <p className="text-sm font-bold text-white">{enia.lien.nom || "Site ENIA 2.0"}</p>
              <p className="mt-1 text-xs text-slate-400">{enia.lien.description}</p>
              <a href={enia.lien.url} target="_blank" rel="noreferrer" className="mt-4 inline-block">
                <Btn><ExternalLink size={15} /> Visiter ENIA 2.0</Btn>
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-500">Aucun lien externe publié pour le moment.</p>
          )}
          <div className="mt-5 border-t border-white/5 pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Continuer votre parcours</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/pre-inscription"><Btn variant="outline">Pré-inscription SENTINELLES</Btn></Link>
              <Link to="/app/ma-bourse"><Btn variant="ghost">Ma bourse</Btn></Link>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <Handshake size={18} className="text-emerald-300" />
            <h3 className="font-display text-lg font-black text-white">Partenaires</h3>
          </div>
          {partners.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun partenaire affiché pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {partners.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt={p.nom} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                      <Building2 size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{p.nom}</p>
                    {p.description && <p className="line-clamp-2 text-xs text-slate-400">{p.description}</p>}
                  </div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      <Btn variant="outline"><ExternalLink size={13} /> Visiter</Btn>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Lightbox affiche */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(false)}>
          <button className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/50 p-2 text-white" onClick={() => setLightbox(false)}>
            <X size={18} />
          </button>
          <img
            src={affiche}
            alt="Affiche ENIA 2.0 — plein écran"
            className="max-h-[92vh] max-w-[96vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ================= ADMINISTRATION ================= */
export function EniaAdminPage() {
  const { db, update, log } = useStore();
  const [enia, setEnia] = useState<EniaContent>(() => structuredClone(db.enia));
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"general" | "bourse" | "frais" | "pieces" | "affiche" | "lien" | "partenaires">("general");
  const [partnerEdit, setPartnerEdit] = useState<EniaPartner | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!db.enia || initializedRef.current) return;
    initializedRef.current = true;
    setEnia(structuredClone(db.enia));
  }, [db.enia]);

  const persist = async (customEnia?: EniaContent) => {
    const dataToSave = customEnia ? structuredClone(customEnia) : structuredClone(enia);
    update((d) => ({ ...d, enia: dataToSave }));

    if (isSupabaseConfigured) {
      try {
        const { data: existingData } = await supabase.from("site_settings").select("data").eq("id", "default").maybeSingle();
        const currentData = existingData?.data || {};
        await supabase.from("site_settings").upsert({
          id: "default",
          data: { ...currentData, enia: dataToSave },
          updated_at: new Date().toISOString(),
        });
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Module ENIA 2.0 enregistré côté serveur ✓", "Modifications visibles immédiatement");
      } catch (err: any) {
        console.warn("Sync enia err:", err);
        toastMsg.info("Modifications appliquées localement ✓");
      }
    } else {
      toastMsg.success("Modifications ENIA enregistrées ✓");
    }

    log("Module ENIA 2.0 mis à jour");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const onAffiche = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      let photoUrl = await readImage(f, 1600);
      if (isSupabaseConfigured) {
        try {
          const ext = (f.name || "jpg").split(".").pop() || "jpg";
          const path = `public-media/enia-affiche-${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("public-media").upload(path, f, { upsert: true });
          if (!error) {
            const { data: pub } = supabase.storage.from("public-media").getPublicUrl(path);
            if (pub?.publicUrl) photoUrl = pub.publicUrl;
          }
        } catch { /* fallback */ }
      }
      const updated = { ...enia, affiche: photoUrl };
      setEnia(updated);
      await persist(updated);
      toastMsg.success("Affiche ENIA 2.0 mise à jour ✓");
    } catch (err: any) {
      toastMsg.error("Erreur chargement affiche", err.message);
    } finally {
      e.target.value = "";
    }
  };

  const addFee = () => setEnia({
    ...enia,
    fraisScolaires: [...enia.fraisScolaires, { id: uid("ef"), label: "Nouvel élément", value: "", ordre: enia.fraisScolaires.length + 1 }],
  });
  const addPieceGroup = () => setEnia({
    ...enia,
    pieces: [...enia.pieces, { id: uid("ep"), titre: "Nouveau groupe", pieces: [""], ordre: enia.pieces.length + 1 }],
  });
  const addAdvantage = () => setEnia({
    ...enia,
    bourseAvantages: [...enia.bourseAvantages, { id: uid("ea"), titre: "Nouvel avantage", description: "", ordre: enia.bourseAvantages.length + 1 }],
  });

  const savePartner = async (p: EniaPartner) => {
    const exists = enia.partenaires.some((x) => x.id === p.id);
    const updated = {
      ...enia,
      partenaires: exists
        ? enia.partenaires.map((x) => (x.id === p.id ? p : x))
        : [...enia.partenaires, p],
    };
    setEnia(updated);
    await persist(updated);
    setPartnerEdit(null);
  };

  const tabs = [
    { k: "general", l: "Informations" },
    { k: "bourse", l: "Bourse" },
    { k: "frais", l: "Frais scolaires" },
    { k: "pieces", l: "Pièces à fournir" },
    { k: "affiche", l: "Affiche" },
    { k: "lien", l: "Lien ENIA" },
    { k: "partenaires", l: "Partenaires" },
  ] as const;

  return (
    <div>
      <PageHead
        title="Administration — ENIA 2.0"
        subtitle="Toutes les informations sont dynamiques et modifiables sans toucher au code"
        actions={
          <div className="flex gap-2">
            <Link to="/app/enia"><Btn variant="outline"><Eye size={14} /> Aperçu</Btn></Link>
            <Btn onClick={persist}><Save size={14} /> {saved ? "Enregistré ✓" : "Enregistrer"}</Btn>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-bold",
              tab === t.k ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5"
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <Card className="space-y-4 p-6">
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <span className="text-sm font-semibold text-white">Module visible pour Formateurs & Apprenants</span>
            <button
              type="button"
              onClick={() => setEnia({ ...enia, visible: !enia.visible })}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold", enia.visible ? "border-emerald-400/40 text-emerald-300" : "border-red-400/40 text-red-300")}
            >
              {enia.visible ? <><Eye size={13} /> Publié</> : <><EyeOff size={13} /> Masqué</>}
            </button>
          </label>
          <Field label="Titre"><Input value={enia.titre} onChange={(e) => setEnia({ ...enia, titre: e.target.value })} /></Field>
          <Field label="Sous-titre"><Input value={enia.sousTitre} onChange={(e) => setEnia({ ...enia, sousTitre: e.target.value })} /></Field>
          <Field label="Présentation (C'est quoi ENIA 2.0 ?)">
            <Textarea value={enia.presentation} onChange={(e) => setEnia({ ...enia, presentation: e.target.value })} className="min-h-[120px]" />
          </Field>
          <Field label="Points forts (un par ligne)">
            <Textarea
              value={(enia.bourseHighlights || []).join("\n")}
              onChange={(e) => setEnia({ ...enia, bourseHighlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
        </Card>
      )}

      {tab === "bourse" && (
        <div className="space-y-4">
          <Card className="space-y-4 p-6">
            <Field label="Titre de la section bourse"><Input value={enia.bourseTitre} onChange={(e) => setEnia({ ...enia, bourseTitre: e.target.value })} /></Field>
            <Field label="Introduction"><Textarea value={enia.bourseIntro} onChange={(e) => setEnia({ ...enia, bourseIntro: e.target.value })} /></Field>
            <Field label="Bloc « Concrètement »"><Textarea value={enia.bourseConcretement} onChange={(e) => setEnia({ ...enia, bourseConcretement: e.target.value })} /></Field>
          </Card>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Avantages de la bourse</h3>
            <Btn variant="outline" onClick={addAdvantage}><PlusCircle size={14} /> Ajouter</Btn>
          </div>
          {enia.bourseAvantages.map((a, idx) => (
            <Card key={a.id} className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Titre"><Input value={a.titre} onChange={(e) => {
                  const list = [...enia.bourseAvantages];
                  list[idx] = { ...a, titre: e.target.value };
                  setEnia({ ...enia, bourseAvantages: list });
                }} /></Field>
                <button onClick={() => setEnia({ ...enia, bourseAvantages: enia.bourseAvantages.filter((x) => x.id !== a.id) })} className="mt-6 text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
              </div>
              <Field label="Description"><Input value={a.description} onChange={(e) => {
                const list = [...enia.bourseAvantages];
                list[idx] = { ...a, description: e.target.value };
                setEnia({ ...enia, bourseAvantages: list });
              }} /></Field>
            </Card>
          ))}
        </div>
      )}

      {tab === "frais" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Grille des frais scolaires</h3>
            <Btn variant="outline" onClick={addFee}><PlusCircle size={14} /> Ajouter une ligne</Btn>
          </div>
          {enia.fraisScolaires.map((f, idx) => (
            <Card key={f.id} className="grid gap-3 p-4 sm:grid-cols-[1.2fr_1fr_auto]">
              <Field label="Élément"><Input value={f.label} onChange={(e) => {
                const list = [...enia.fraisScolaires];
                list[idx] = { ...f, label: e.target.value };
                setEnia({ ...enia, fraisScolaires: list });
              }} /></Field>
              <Field label="Information"><Input value={f.value} onChange={(e) => {
                const list = [...enia.fraisScolaires];
                list[idx] = { ...f, value: e.target.value };
                setEnia({ ...enia, fraisScolaires: list });
              }} /></Field>
              <button onClick={() => setEnia({ ...enia, fraisScolaires: enia.fraisScolaires.filter((x) => x.id !== f.id) })} className="mt-6 text-red-400"><Trash2 size={16} /></button>
            </Card>
          ))}
        </div>
      )}

      {tab === "pieces" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Pièces à fournir</h3>
            <Btn variant="outline" onClick={addPieceGroup}><PlusCircle size={14} /> Ajouter un groupe</Btn>
          </div>
          <Field label="Note d'inscription">
            <Input value={enia.noteInscription} onChange={(e) => setEnia({ ...enia, noteInscription: e.target.value })} />
          </Field>
          {enia.pieces.map((g, idx) => (
            <Card key={g.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <Field label="Titre du groupe"><Input value={g.titre} onChange={(e) => {
                  const list = [...enia.pieces];
                  list[idx] = { ...g, titre: e.target.value };
                  setEnia({ ...enia, pieces: list });
                }} /></Field>
                <button onClick={() => setEnia({ ...enia, pieces: enia.pieces.filter((x) => x.id !== g.id) })} className="mt-6 text-red-400"><Trash2 size={16} /></button>
              </div>
              <Field label="Pièces (une par ligne)">
                <Textarea
                  value={(g.pieces || []).join("\n")}
                  onChange={(e) => {
                    const list = [...enia.pieces];
                    list[idx] = { ...g, pieces: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) };
                    setEnia({ ...enia, pieces: list });
                  }}
                />
              </Field>
              <Field label="Frais de dépôt (optionnel)">
                <Input value={g.fraisDepot || ""} onChange={(e) => {
                  const list = [...enia.pieces];
                  list[idx] = { ...g, fraisDepot: e.target.value };
                  setEnia({ ...enia, pieces: list });
                }} />
              </Field>
            </Card>
          ))}
        </div>
      )}

      {tab === "affiche" && (
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-64 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <img src={enia.affiche || eniaAfficheDefault} alt="Affiche ENIA" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-300">Chargez ou remplacez l'affiche ENIA 2.0. Elle sera visible dans le module pour tous les profils autorisés.</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">
                <Upload size={14} /> {enia.affiche ? "Remplacer l'affiche" : "Charger une affiche"}
                <input type="file" accept="image/*" className="hidden" onChange={onAffiche} />
              </label>
              {enia.affiche && (
                <Btn variant="ghost" onClick={() => setEnia({ ...enia, affiche: "" })}><Trash2 size={14} /> Supprimer l'affiche personnalisée</Btn>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={enia.allowDownloadAffiche} onChange={(e) => setEnia({ ...enia, allowDownloadAffiche: e.target.checked })} />
                Autoriser le téléchargement de l'affiche
              </label>
            </div>
          </div>
        </Card>
      )}

      {tab === "lien" && (
        <Card className="space-y-4 p-6">
          <Field label="Nom du site"><Input value={enia.lien.nom} onChange={(e) => setEnia({ ...enia, lien: { ...enia.lien, nom: e.target.value } })} /></Field>
          <Field label="URL"><Input value={enia.lien.url} onChange={(e) => setEnia({ ...enia, lien: { ...enia.lien, url: e.target.value } })} placeholder="https://..." /></Field>
          <Field label="Description"><Textarea value={enia.lien.description} onChange={(e) => setEnia({ ...enia, lien: { ...enia.lien, description: e.target.value } })} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={enia.lien.actif} onChange={(e) => setEnia({ ...enia, lien: { ...enia.lien, actif: e.target.checked } })} />
            Lien actif
          </label>
        </Card>
      )}

      {tab === "partenaires" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Partenaires ENIA</h3>
            <Btn variant="outline" onClick={() => setPartnerEdit({
              id: uid("enp"), nom: "", description: "", logoUrl: "", url: "", telephone: "", email: "", actif: true, ordre: enia.partenaires.length + 1,
            })}><PlusCircle size={14} /> Ajouter un partenaire</Btn>
          </div>
          {enia.partenaires.length === 0 ? (
            <Empty icon={<Handshake size={36} />} title="Aucun partenaire" />
          ) : (
            enia.partenaires.sort((a, b) => a.ordre - b.ordre).map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5"><Building2 size={18} className="text-slate-400" /></div>}
                  <div>
                    <p className="font-bold text-white">{p.nom || "Sans nom"} {!p.actif && <Badge color="red">Inactif</Badge>}</p>
                    <p className="text-xs text-slate-400">{p.url || "Pas d'URL"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={() => setPartnerEdit(p)}><Pencil size={13} /></Btn>
                  <Btn variant="ghost" onClick={() => setEnia({ ...enia, partenaires: enia.partenaires.filter((x) => x.id !== p.id) })}><Trash2 size={13} /></Btn>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Link to="/app/enia"><Btn variant="outline">Voir le module</Btn></Link>
        <Btn onClick={persist}><Save size={14} /> {saved ? "Enregistré ✓" : "Enregistrer les modifications"}</Btn>
      </div>

      <Modal open={!!partnerEdit} onClose={() => setPartnerEdit(null)} title={partnerEdit?.nom ? `Modifier ${partnerEdit.nom}` : "Nouveau partenaire"} wide>
        {partnerEdit && (
          <PartnerForm
            value={partnerEdit}
            onChange={setPartnerEdit}
            onSave={() => savePartner(partnerEdit)}
            onCancel={() => setPartnerEdit(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function PartnerForm({
  value, onChange, onSave, onCancel,
}: {
  value: EniaPartner;
  onChange: (p: EniaPartner) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      let photoUrl = await readImage(f, 400);
      if (isSupabaseConfigured) {
        try {
          const ext = (f.name || "jpg").split(".").pop() || "jpg";
          const path = `public-media/enia-partner-${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("public-media").upload(path, f, { upsert: true });
          if (!error) {
            const { data: pub } = supabase.storage.from("public-media").getPublicUrl(path);
            if (pub?.publicUrl) photoUrl = pub.publicUrl;
          }
        } catch { /* fallback */ }
      }
      onChange({ ...value, logoUrl: photoUrl });
      toastMsg.success("Logo partenaire chargé ✓");
    } catch (err: any) {
      toastMsg.error("Erreur chargement logo", err.message);
    } finally {
      e.target.value = "";
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {value.logoUrl ? <img src={value.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/5"><ImageIcon size={20} className="text-slate-500" /></div>}
        <label className="cursor-pointer rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">
          <Upload size={13} className="mr-1 inline" /> Logo
          <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom"><Input value={value.nom} onChange={(e) => onChange({ ...value, nom: e.target.value })} /></Field>
        <Field label="Site web / URL"><Input value={value.url || ""} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Téléphone"><Input value={value.telephone || ""} onChange={(e) => onChange({ ...value, telephone: e.target.value })} /></Field>
        <Field label="Email"><Input value={value.email || ""} onChange={(e) => onChange({ ...value, email: e.target.value })} /></Field>
      </div>
      <Field label="Description"><Textarea value={value.description || ""} onChange={(e) => onChange({ ...value, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ordre d'affichage"><Input type="number" value={value.ordre} onChange={(e) => onChange({ ...value, ordre: Number(e.target.value) || 0 })} /></Field>
        <label className="mt-6 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={value.actif} onChange={(e) => onChange({ ...value, actif: e.target.checked })} /> Actif
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
        <Btn onClick={onSave} disabled={!value.nom.trim()}><Save size={14} /> Enregistrer</Btn>
      </div>
    </div>
  );
}
