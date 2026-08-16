import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Info, UserCircle2, BookOpen, Wallet, Medal, FileText, PlusCircle, Trash2, Save, ExternalLink,
  Upload, ImageOff, MessageCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, Textarea, PageHead, readImage, uid } from "@/lib/ui";
import responsableImg from "@/assets/responsable.jpg";

const TABS = [
  { k: "infos", l: "Informations", icon: <Info size={15} /> },
  { k: "responsable", l: "Responsable", icon: <UserCircle2 size={15} /> },
  { k: "formations", l: "Nos formations", icon: <BookOpen size={15} /> },
  { k: "frais", l: "Frais de formation", icon: <Wallet size={15} /> },
  { k: "avantages", l: "Avantages", icon: <Medal size={15} /> },
  { k: "preinscription", l: "Pré-inscription", icon: <FileText size={15} /> },
];

export function ContentEditor() {
  const { db, update, log } = useStore();
  const s = db.settings;
  const [tab, setTab] = useState("infos");

  const [branding, setBranding] = useState({ ...s.branding });
  const [infos, setInfos] = useState({ ...s.infos, whatsapp: [...s.infos.whatsapp] });
  const [partenaires, setPartenaires] = useState<string[]>(s.partenaires);
  const [hero, setHero] = useState({ ...s.hero });
  const [formations, setFormations] = useState({ ...s.formations });
  const [frais, setFrais] = useState({
    inscription: s.frais.inscription,
    informatique: s.frais.informatique.map((f) => ({ ...f })),
    industriel: s.frais.industriel.map((f) => ({ ...f })),
  });
  const [avantages, setAvantages] = useState<string[]>(s.avantages);
  const [pre, setPre] = useState({ ...s.preInscription });
  const [saved, setSaved] = useState(false);

  const persist = () => {
    update((d) => ({
      ...d,
      settings: {
        ...d.settings,
        branding, infos, partenaires, hero,
        formations,
        frais: {
          inscription: frais.inscription,
          informatique: frais.informatique.map((f) => ({ id: f.id || uid("FR"), label: f.label, modules: +f.modules || 0, montant: +f.montant || 0 })),
          industriel: frais.industriel.map((f) => ({ id: f.id || uid("FR"), label: f.label, modules: +f.modules || 0, montant: +f.montant || 0 })),
        },
        avantages,
        preInscription: pre,
      },
    }));
    log("Contenu du site public mis à jour");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setHero({ ...hero, responsibleImage: await readImage(f, 600) });
  };

  return (
    <div>
      <PageHead
        title="Éditeur du site public"
        subtitle="Modifiez les informations affichées sur la page d'accueil — les changements sont visibles immédiatement"
        actions={
          <>
            <Link to="/" target="_blank"><Btn variant="outline"><ExternalLink size={15} /> Voir le site</Btn></Link>
            <Btn onClick={persist} variant={saved ? "green" : "primary"}><Save size={15} /> {saved ? "Enregistré ✓" : "Enregistrer"}</Btn>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all",
              tab === t.k ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_-8px_rgba(0,229,255,0.6)]" : "border-white/10 text-slate-400 hover:bg-white/5")}>
            {t.icon} {t.l}
          </button>
        ))}
      </div>

      {/* ============ INFORMATIONS ============ */}
      {tab === "infos" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Identité du centre</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du centre"><Input value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })} /></Field>
              <Field label="Badge / slogan"><Input value={branding.badge} onChange={(e) => setBranding({ ...branding, badge: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Sous-titre"><Input value={branding.subtitle} onChange={(e) => setBranding({ ...branding, subtitle: e.target.value })} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Phrase de présentation"><Textarea value={branding.tagline} onChange={(e) => setBranding({ ...branding, tagline: e.target.value })} /></Field>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Informations pratiques</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Début de la formation"><Input value={infos.debut} onChange={(e) => setInfos({ ...infos, debut: e.target.value })} /></Field>
              <Field label="Durée"><Input value={infos.duree} onChange={(e) => setInfos({ ...infos, duree: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Lieu"><Input value={infos.lieu} onChange={(e) => setInfos({ ...infos, lieu: e.target.value })} /></Field>
              </div>
              <Field label="Texte d'inscription"><Input value={infos.inscription} onChange={(e) => setInfos({ ...infos, inscription: e.target.value })} /></Field>
              <Field label="WhatsApp (un par ligne)">
                <Textarea value={infos.whatsapp.join("\n")} onChange={(e) => setInfos({ ...infos, whatsapp: e.target.value.split("\n").filter(Boolean) })} />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Partenaires institutionnels</h3>
            <div className="space-y-2">
              {partenaires.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={p} onChange={(e) => setPartenaires(partenaires.map((x, j) => (j === i ? e.target.value : x)))} />
                  <Btn variant="ghost" onClick={() => setPartenaires(partenaires.filter((_, j) => j !== i))}><Trash2 size={15} /></Btn>
                </div>
              ))}
              <Btn variant="outline" onClick={() => setPartenaires([...partenaires, ""])}><PlusCircle size={14} /> Ajouter un partenaire</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ============ RESPONSABLE ============ */}
      {tab === "responsable" && (
        <Card className="max-w-2xl p-6">
          <h3 className="font-display mb-4 text-sm font-bold text-white">Responsable du centre</h3>
          <div className="mb-5 flex flex-wrap items-center gap-5">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-2xl border-2 border-amber-400/50">
                <img src={hero.responsibleImage || responsableImg} alt="Responsable" className="h-full w-full object-cover" />
              </div>
              <button
                onClick={() => setHero({ ...hero, responsibleImage: "" })}
                className="absolute -bottom-2 -right-2 rounded-lg border border-white/10 bg-[#05070D] p-2 text-slate-400 hover:text-red-400"
                title="Réinitialiser l'image"
              >
                <ImageOff size={14} />
              </button>
            </div>
            <div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2.5 text-sm font-bold text-cyan-300 hover:bg-cyan-400/10">
                  <Upload size={15} /> Téléverser une photo
                </span>
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
              <p className="mt-2 text-[11px] text-slate-500">Photo du responsable (portrait professionnel). Image réduite automatiquement.</p>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="Nom du responsable"><Input value={hero.responsibleName} onChange={(e) => setHero({ ...hero, responsibleName: e.target.value })} /></Field>
            <Field label="Fonction"><Input value={hero.responsibleTitle} onChange={(e) => setHero({ ...hero, responsibleTitle: e.target.value })} /></Field>
            <Field label="Étiquette"><Input value={hero.highlight} onChange={(e) => setHero({ ...hero, highlight: e.target.value })} /></Field>
          </div>
        </Card>
      )}

      {/* ============ FORMATIONS ============ */}
      {tab === "formations" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-red-400">GÉNIE INFORMATIQUE</h3>
            <div className="space-y-4">
              <Field label="Titre"><Input value={formations.informatique.titre} onChange={(e) => setFormations({ ...formations, informatique: { ...formations.informatique, titre: e.target.value } })} /></Field>
              <Field label="Description"><Textarea value={formations.informatique.description} onChange={(e) => setFormations({ ...formations, informatique: { ...formations.informatique, description: e.target.value } })} /></Field>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-cyan-300">GÉNIE INDUSTRIEL</h3>
            <div className="space-y-4">
              <Field label="Titre"><Input value={formations.industriel.titre} onChange={(e) => setFormations({ ...formations, industriel: { ...formations.industriel, titre: e.target.value } })} /></Field>
              <Field label="Description"><Textarea value={formations.industriel.description} onChange={(e) => setFormations({ ...formations, industriel: { ...formations.industriel, description: e.target.value } })} /></Field>
            </div>
          </Card>
          <Card className="flex items-center justify-between p-5" glow="none">
            <div>
              <p className="text-sm font-bold text-white">Gérer les modules en détail</p>
              <p className="text-xs text-slate-500">Ajoutez, modifiez ou supprimez les modules et leurs notions.</p>
            </div>
            <Link to="/app/modules"><Btn variant="outline"><BookOpen size={15} /> Gérer les modules</Btn></Link>
          </Card>
        </div>
      )}

      {/* ============ FRAIS ============ */}
      {tab === "frais" && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Frais d'inscription</h3>
            <div className="max-w-xs">
              <Field label="Montant (FCFA)"><Input type="number" value={frais.inscription} onChange={(e) => setFrais({ ...frais, inscription: +e.target.value })} /></Field>
              <p className="mt-1 text-[11px] text-slate-500">Affiché sur le site et utilisé lors des pré-inscriptions.</p>
            </div>
          </Card>

          {([["informatique", "GÉNIE INFORMATIQUE", "red"], ["industriel", "GÉNIE INDUSTRIEL", "cyan"]] as const).map(([key, label, color]) => (
            <Card key={key} className="p-6">
              <h3 className={cn("font-display mb-4 text-sm font-bold", color === "red" ? "text-red-400" : "text-cyan-300")}>{label}</h3>
              <div className="space-y-2">
                {frais[key].map((f, i) => (
                  <div key={f.id || i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input placeholder="Libellé (ex: 2 modules)" value={f.label} onChange={(e) => setFrais({ ...frais, [key]: frais[key].map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <Input type="number" placeholder="Nb modules" value={f.modules} onChange={(e) => setFrais({ ...frais, [key]: frais[key].map((x, j) => (j === i ? { ...x, modules: +e.target.value } : x)) })} />
                    <Input type="number" placeholder="Montant FCFA" value={f.montant} onChange={(e) => setFrais({ ...frais, [key]: frais[key].map((x, j) => (j === i ? { ...x, montant: +e.target.value } : x)) })} />
                    <Btn variant="ghost" onClick={() => setFrais({ ...frais, [key]: frais[key].filter((_, j) => j !== i) })}><Trash2 size={15} /></Btn>
                  </div>
                ))}
                <Btn variant="outline" onClick={() => setFrais({ ...frais, [key]: [...frais[key], { id: uid("FR"), label: "", modules: 0, montant: 0 }] })}>
                  <PlusCircle size={14} /> Ajouter une formule
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ============ AVANTAGES ============ */}
      {tab === "avantages" && (
        <Card className="max-w-2xl p-6">
          <h3 className="font-display mb-4 text-sm font-bold text-white">Avantages de la formation</h3>
          <div className="space-y-2">
            {avantages.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Input value={a} onChange={(e) => setAvantages(avantages.map((x, j) => (j === i ? e.target.value : x)))} />
                <Btn variant="ghost" onClick={() => setAvantages(avantages.filter((_, j) => j !== i))}><Trash2 size={15} /></Btn>
              </div>
            ))}
            <Btn variant="outline" onClick={() => setAvantages([...avantages, ""])}><PlusCircle size={14} /> Ajouter un avantage</Btn>
          </div>
        </Card>
      )}

      {/* ============ PRÉ-INSCRIPTION ============ */}
      {tab === "preinscription" && (
        <Card className="max-w-2xl p-6">
          <h3 className="font-display mb-4 text-sm font-bold text-white">Bloc Pré-inscription</h3>
          <div className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div>
              <p className="text-sm font-bold text-slate-200">Formulaire de pré-inscription actif</p>
              <p className="text-[11px] text-slate-500">Désactivez pour masquer le formulaire public.</p>
            </div>
            <button
              onClick={() => setPre({ ...pre, enabled: !pre.enabled })}
              className={cn("relative h-7 w-14 rounded-full transition-all", pre.enabled ? "bg-emerald-500/70" : "bg-white/10")}
            >
              <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", pre.enabled ? "left-8" : "left-1")} />
            </button>
          </div>
          <div className="space-y-4">
            <Field label="Titre"><Input value={pre.title} onChange={(e) => setPre({ ...pre, title: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={pre.description} onChange={(e) => setPre({ ...pre, description: e.target.value })} /></Field>
          </div>
          {!pre.enabled && <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">⚠️ Le formulaire est actuellement masqué sur le site public.</div>}
        </Card>
      )}

      {/* sticky save bar */}
      <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-cyan-400/30 bg-[#081021]/95 px-5 py-3.5 shadow-[0_0_30px_-10px_rgba(0,229,255,0.6)] backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <MessageCircle size={15} className="text-cyan-300" />
          Les modifications s'appliquent immédiatement à la page publique.
        </div>
        <div className="flex gap-2">
          <Link to="/"><Btn variant="ghost">Aperçu</Btn></Link>
          <Btn onClick={persist} variant={saved ? "green" : "primary"}><Save size={15} /> {saved ? "Enregistré ✓" : "Enregistrer les modifications"}</Btn>
        </div>
      </div>
    </div>
  );
}
