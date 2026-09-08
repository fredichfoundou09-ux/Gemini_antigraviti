import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Info, UserCircle2, BookOpen, Wallet, Medal, FileText, PlusCircle, Trash2, Save, ExternalLink,
  Upload, ImageOff, MessageCircle, Handshake, Building2, Globe, Eye, EyeOff, Megaphone, Pencil,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Badge, Card, Field, Input, Textarea, Modal, PageHead, readImage, uid, today } from "@/lib/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { sanitizeJsonPayload } from "@/lib/validation/jsonPayload";
import type { Partner, Announcement } from "@/lib/types";

const TABS = [
  { k: "infos", l: "Informations", icon: <Info size={15} /> },
  { k: "responsable", l: "Responsable", icon: <UserCircle2 size={15} /> },
  { k: "formations", l: "Nos formations", icon: <BookOpen size={15} /> },
  { k: "frais", l: "Frais de formation", icon: <Wallet size={15} /> },
  { k: "avantages", l: "Avantages", icon: <Medal size={15} /> },
  { k: "partenaires", l: "Partenaires", icon: <Handshake size={15} /> },
  { k: "annonces", l: "Annonces", icon: <Megaphone size={15} /> },
  { k: "preinscription", l: "Pré-inscription", icon: <FileText size={15} /> },
];

export function ContentEditor() {
  const { db, update, log } = useStore();
  const s = db.settings || {};
  const [tab, setTab] = useState("infos");

  const [branding, setBranding] = useState({
    name: s.branding?.name || "SENTINELLES NUMÉRIQUES",
    badge: s.branding?.badge || "SENTINELLES • ACADEMY",
    subtitle: s.branding?.subtitle || "",
    tagline: s.branding?.tagline || "",
  });

  const [infos, setInfos] = useState({
    debut: s.infos?.debut || "",
    duree: s.infos?.duree || "",
    lieu: s.infos?.lieu || "",
    inscription: s.infos?.inscription || "",
    whatsapp: Array.isArray(s.infos?.whatsapp) ? [...s.infos.whatsapp] : [],
  });

  const [partners, setPartners] = useState<Partner[]>(() => {
    if (Array.isArray(db.partners) && db.partners.length > 0) {
      return db.partners.map((p) => ({ ...p }));
    }
    if (Array.isArray(s.partenaires) && s.partenaires.length > 0) {
      return s.partenaires.map((nom: any, idx: number) => ({
        id: typeof nom === "object" && nom.id ? nom.id : `p-${idx + 1}`,
        nom: typeof nom === "string" ? nom : nom?.nom || "",
        description: typeof nom === "object" ? nom?.description || "" : "",
        contact: typeof nom === "object" ? nom?.contact || "" : "",
        logo: typeof nom === "object" ? (nom?.logo || nom?.logoUrl || nom?.image || "") : "",
        url: typeof nom === "object" ? nom?.url || "" : "",
        actif: typeof nom === "object" ? nom?.actif !== false : true,
      }));
    }
    return [];
  });

  const [hero, setHero] = useState({
    responsibleName: s.hero?.responsibleName || "",
    responsibleTitle: s.hero?.responsibleTitle || "",
    responsibleImage: s.hero?.responsibleImage || "",
    highlight: s.hero?.highlight || "RESPONSABLE DU CENTRE",
  });

  const [formations, setFormations] = useState({
    informatique: {
      titre: s.formations?.informatique?.titre || "GÉNIE INFORMATIQUE",
      description: s.formations?.informatique?.description || "",
    },
    industriel: {
      titre: s.formations?.industriel?.titre || "GÉNIE INDUSTRIEL",
      description: s.formations?.industriel?.description || "",
    },
  });

  const [frais, setFrais] = useState({
    inscription: s.frais?.inscription || 0,
    informatique: Array.isArray(s.frais?.informatique) ? s.frais.informatique.map((f) => ({ ...f })) : [],
    industriel: Array.isArray(s.frais?.industriel) ? s.frais.industriel.map((f) => ({ ...f })) : [],
  });

  const [avantages, setAvantages] = useState<string[]>(Array.isArray(s.avantages) ? [...s.avantages] : []);
  const [advantageImage, setAdvantageImage] = useState(s.advantageImage || "");

  const [pre, setPre] = useState({
    enabled: s.preInscription?.enabled !== false,
    title: s.preInscription?.title || "Pré-inscription en ligne",
    description: s.preInscription?.description || "",
  });

  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    Array.isArray(db.announcements) ? [...db.announcements] : []
  );
  const [creatingAnn, setCreatingAnn] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const emptyAnn = (): Announcement => ({
    id: uid("ANN"),
    titre: "",
    contenu: "",
    date: today(),
    actif: true,
    couleur: "cyan",
  });
  const [formAnn, setFormAnn] = useState<Announcement>(emptyAnn());

  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [whatsappRaw, setWhatsappRaw] = useState(() => (s.infos?.whatsapp || []).join("\n"));
  const initializedRef = useRef(false);

  // Synchronisation initiale dès que les paramètres sont disponibles
  useEffect(() => {
    if (!db.settings || initializedRef.current) return;
    initializedRef.current = true;
    const cur = db.settings;
    if (cur.branding) setBranding({ ...cur.branding });
    if (cur.infos) {
      setInfos({ ...cur.infos, whatsapp: Array.isArray(cur.infos.whatsapp) ? [...cur.infos.whatsapp] : [] });
      setWhatsappRaw((cur.infos.whatsapp || []).join("\n"));
    }
    if (Array.isArray(db.partners) && db.partners.length > 0) {
      setPartners(db.partners.map((p) => ({ ...p })));
    } else if (Array.isArray(cur.partenaires) && cur.partenaires.length > 0) {
      setPartners(
        cur.partenaires.map((nom: any, idx: number) => ({
          id: typeof nom === "object" && nom.id ? nom.id : `p-${idx + 1}`,
          nom: typeof nom === "string" ? nom : nom?.nom || "",
          description: typeof nom === "object" ? nom?.description || "" : "",
          contact: typeof nom === "object" ? nom?.contact || "" : "",
          logo: typeof nom === "object" ? (nom?.logo || nom?.logoUrl || nom?.image || "") : "",
          url: typeof nom === "object" ? nom?.url || "" : "",
          actif: typeof nom === "object" ? nom?.actif !== false : true,
        }))
      );
    }
    if (cur.hero) setHero({ ...cur.hero });
    if (cur.formations) {
      setFormations({
        informatique: {
          titre: cur.formations.informatique?.titre || "GÉNIE INFORMATIQUE",
          description: cur.formations.informatique?.description || "",
        },
        industriel: {
          titre: cur.formations.industriel?.titre || "GÉNIE INDUSTRIEL",
          description: cur.formations.industriel?.description || "",
        },
      });
    }
    if (cur.frais) {
      setFrais({
        inscription: cur.frais.inscription || 0,
        informatique: Array.isArray(cur.frais.informatique) ? cur.frais.informatique.map((f) => ({ ...f })) : [],
        industriel: Array.isArray(cur.frais.industriel) ? cur.frais.industriel.map((f) => ({ ...f })) : [],
      });
    }
    if (Array.isArray(cur.avantages)) setAvantages([...cur.avantages]);
    if (cur.advantageImage !== undefined) setAdvantageImage(cur.advantageImage || "");
    if (cur.preInscription) setPre({ ...cur.preInscription });
    if (Array.isArray(db.announcements) && db.announcements.length > 0) {
      setAnnouncements([...db.announcements]);
    }
  }, [db.settings, db.partners, db.announcements]);

  const saveAnnouncement = () => {
    if (!formAnn.titre.trim()) return;
    let nextAnn: Announcement[];
    if (editingAnn) {
      nextAnn = announcements.map((a) => (a.id === editingAnn.id ? formAnn : a));
    } else {
      nextAnn = [formAnn, ...announcements];
    }
    setAnnouncements(nextAnn);
    setCreatingAnn(false);
    setEditingAnn(null);
    persist(undefined, undefined, undefined, nextAnn);
  };

  const toggleAnnouncement = (id: string) => {
    const nextAnn = announcements.map((a) => (a.id === id ? { ...a, actif: !a.actif } : a));
    setAnnouncements(nextAnn);
    persist(undefined, undefined, undefined, nextAnn);
  };

  const deleteAnnouncement = (id: string) => {
    if (!confirm("Supprimer cette annonce ?")) return;
    const nextAnn = announcements.filter((a) => a.id !== id);
    setAnnouncements(nextAnn);
    persist(undefined, undefined, undefined, nextAnn);
  };

  const onPartnerLogo = async (e: React.ChangeEvent<HTMLInputElement>, partnerId: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const b64 = await readImage(f, 500);
      let logoUrl = b64;
      if (isSupabaseConfigured) {
        try {
          const ext = (f.name || "png").split(".").pop() || "png";
          const path = `partners/partner-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("public-media").upload(path, f, { upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("public-media").getPublicUrl(path);
            if (pub?.publicUrl) {
              logoUrl = pub.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn("Stockage Supabase non dispo, fallback base64 local", storageErr);
        }
      }
      const updated = partners.map((p) => (p.id === partnerId ? { ...p, logo: logoUrl } : p));
      setPartners(updated);
      toastMsg.success("Logo du partenaire chargé ✓", "Affiché immédiatement");
    } catch (err: any) {
      toastMsg.error("Erreur lors du traitement de l'image", err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onRemovePartnerLogo = (partnerId: string) => {
    setPartners((prev) => prev.map((p) => (p.id === partnerId ? { ...p, logo: "" } : p)));
    toastMsg.info("Logo retiré");
  };

  const addPartner = () => {
    const newP: Partner = {
      id: uid("PRT"),
      nom: "",
      description: "",
      contact: "",
      logo: "",
      url: "",
      actif: true,
    };
    setPartners((prev) => [...prev, newP]);
  };

  const removePartner = (id: string) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePartnerField = (id: string, field: keyof Partner, value: any) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const [saving, setSaving] = useState(false);

  const persist = async (customHero?: any, customAdvantageImg?: string, customPartners?: Partner[], customAnnouncements?: Announcement[]) => {
    // Éviter qu'un événement React de type SyntheticEvent/MouseEvent soit pris pour customHero
    const isEvent = customHero && (typeof customHero !== "object" || "nativeEvent" in customHero || "target" in customHero || "__reactFiber$" in customHero);
    const activeHero = (customHero && !isEvent) ? customHero : hero;
    const activeAdvantageImg = customAdvantageImg !== undefined ? customAdvantageImg : advantageImage;
    const activePartners = (customPartners !== undefined ? customPartners : partners).filter((p) => p.nom.trim().length > 0);
    const activeAnnouncements = customAnnouncements !== undefined ? customAnnouncements : announcements;
    const finalWhatsapp = whatsappRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    const activeInfos = { ...infos, whatsapp: finalWhatsapp };

    const rawSettings = {
      ...db.settings,
      branding,
      infos: activeInfos,
      partenaires: activePartners.map((p) => p.nom),
      hero: activeHero,
      formations,
      frais: {
        inscription: Math.max(0, +frais.inscription || 0),
        informatique: frais.informatique
          .filter((f) => f.label.trim() || f.montant > 0)
          .map((f) => ({ id: f.id || uid("FR"), label: f.label.trim() || `${f.modules} module(s)`, modules: Math.max(1, +f.modules || 1), montant: Math.max(0, +f.montant || 0) })),
        industriel: frais.industriel
          .filter((f) => f.label.trim() || f.montant > 0)
          .map((f) => ({ id: f.id || uid("FR"), label: f.label.trim() || `${f.modules} module(s)`, modules: Math.max(1, +f.modules || 1), montant: Math.max(0, +f.montant || 0) })),
      },
      avantages: avantages.filter((a) => typeof a === "string" && a.trim().length > 0),
      advantageImage: activeAdvantageImg,
      preInscription: pre,
    };

    const updatedSettings = sanitizeJsonPayload(rawSettings);
    setSaving(true);

    // 1. Mise à jour immédiate du Store (réactivité synchrone UI + localStorage)
    update((d) => ({
      ...d,
      settings: updatedSettings,
      partners: activePartners,
      announcements: activeAnnouncements,
    }));
    log("Contenu du site public, partenaires et annonces mis à jour");

    // 2. Persistance distante Supabase (si configuré)
    if (isSupabaseConfigured) {
      try {
        const payload = sanitizeJsonPayload({
          settings: updatedSettings,
          advantages: db.advantages || [],
          partners: activePartners,
          announcements: activeAnnouncements,
          enia: db.enia || null,
        });

        const { error } = await supabase.from("site_settings").upsert({
          id: "default",
          data: payload,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("Supabase site_settings sync error:", error.message);
          toastMsg.error("Échec de l'enregistrement en base de données", error.message);
        } else {
          toastMsg.success("Contenu du site enregistré avec succès ✓", "Modifications visibles immédiatement");
        }
      } catch (err: any) {
        console.error("Sync error:", err);
        toastMsg.error("Erreur de sauvegarde", err.message || "Erreur de connexion");
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(false);
      toastMsg.success("Modifications enregistrées ✓", "Visibles immédiatement sur la page d'accueil");
    }

    // Émettre l'événement de rafraîchissement global
    try {
      window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      window.dispatchEvent(new Event("storage"));
    } catch { /* ignore */ }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);

    try {
      // 1. Génération locale haute définition immédiate
      const b64 = await readImage(f, 800);
      let photoUrl = b64;

      // 2. Téléversement optionnel vers le bucket Supabase
      if (isSupabaseConfigured) {
        try {
          const ext = (f.name || "jpg").split(".").pop() || "jpg";
          const path = `hero/responsable-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("public-media").upload(path, f, { upsert: true });
          if (!upErr) {
            const { data: pub } = supabase.storage.from("public-media").getPublicUrl(path);
            if (pub?.publicUrl) {
              photoUrl = pub.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn("Stockage cloud non disponible, conservation du visuel local optimisé.", storageErr);
        }
      }

      const updatedHero = { ...hero, responsibleImage: photoUrl };
      setHero(updatedHero);
      await persist(updatedHero);
      toastMsg.success("Photo du responsable enregistrée ✓", "Affichée sur le site public");
    } catch (err: any) {
      toastMsg.error("Erreur lors du traitement de l'image", err.message);
    } finally {
      setUploading(false);
      // Réinitialiser le champ file pour permettre de re-sélectionner le même fichier si besoin
      e.target.value = "";
    }
  };

  const onRemovePhoto = async () => {
    const updatedHero = { ...hero, responsibleImage: "" };
    setHero(updatedHero);
    await persist(updatedHero);
    toastMsg.info("Photo réinitialisée ✓");
  };

  const onAdvantagePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const b64 = await readImage(f, 1000);
      setAdvantageImage(b64);
      await persist(hero, b64);
      toastMsg.success("Image d'illustration mise à jour ✓");
    } catch (err: any) {
      toastMsg.error("Erreur chargement image", err.message);
    } finally {
      e.target.value = "";
    }
  };

  const onRemoveAdvantagePhoto = async () => {
    setAdvantageImage("");
    await persist(hero, "");
    toastMsg.info("Image d'illustration réinitialisée ✓");
  };

  return (
    <div>
      <PageHead
        title="Éditeur du site public"
        subtitle="Modifiez les informations affichées sur la page d'accueil — les changements sont visibles immédiatement"
        actions={
          <>
            <Link to="/" target="_blank"><Btn variant="outline"><ExternalLink size={15} /> Voir le site</Btn></Link>
            <Btn onClick={() => persist()} variant={saved ? "green" : "primary"}><Save size={15} /> {saved ? "Enregistré ✓" : "Enregistrer"}</Btn>
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
                <Textarea
                  value={whatsappRaw}
                  onChange={(e) => {
                    setWhatsappRaw(e.target.value);
                    setInfos({ ...infos, whatsapp: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) });
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Handshake size={16} className="text-cyan-400" />
                  Partenaires institutionnels & Alliances
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {partners.filter((p) => p.nom.trim().length > 0).length} partenaire(s) configuré(s). Gérez les photos et informations dans l'onglet Partenaires.
                </p>
              </div>
              <Btn variant="outline" onClick={() => setTab("partenaires")}>
                <Handshake size={14} /> Gérer les partenaires & logos →
              </Btn>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {partners.filter((p) => p.nom.trim().length > 0).map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-[#071A2B] px-3 py-1.5 text-xs text-cyan-200">
                  {p.logo ? (
                    <img src={p.logo} alt="" className="h-4 w-4 object-contain rounded bg-white/5" />
                  ) : (
                    <Handshake size={12} className="text-cyan-400" />
                  )}
                  <span>{p.nom}</span>
                </div>
              ))}
              {partners.filter((p) => p.nom.trim().length > 0).length === 0 && (
                <span className="text-xs text-slate-500 italic">Aucun partenaire configuré.</span>
              )}
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
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-[#0A1224]">
                {hero.responsibleImage ? (
                  <img src={hero.responsibleImage} alt="Responsable" className="h-full w-full object-cover" />
                ) : (
                  <UserCircle2 size={64} className="text-slate-600" />
                )}
              </div>
              {hero.responsibleImage ? (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="absolute -bottom-2 -right-2 rounded-lg border border-white/10 bg-[#05070D] p-2 text-slate-400 transition-colors hover:text-red-400"
                  title="Supprimer la photo"
                >
                  <ImageOff size={14} />
                </button>
              ) : null}
            </div>
            <div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2.5 text-sm font-bold text-cyan-300 transition-all hover:bg-cyan-400/10">
                  <Upload size={15} /> {uploading ? "Téléversement en cours..." : "Téléverser une photo"}
                </span>
                <input type="file" accept="image/*" onChange={onPhoto} disabled={uploading} className="hidden" />
              </label>
              <p className="mt-2 text-[11px] text-slate-500">Photo du responsable (portrait professionnel). L'image est enregistrée et visible immédiatement.</p>
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
        <div className="space-y-4 max-w-3xl">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Image d'illustration de la section</h3>
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative h-32 w-52 overflow-hidden rounded-2xl border-2 border-cyan-400/40 bg-[#0A1224] flex items-center justify-center">
                {advantageImage ? (
                  <img src={advantageImage} alt="Illustration avantages" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-xs text-slate-500">Aucune image personnalisée</div>
                )}
              </div>
              <div className="space-y-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-400/10">
                    <Upload size={15} /> Modifier l'illustration
                  </span>
                  <input type="file" accept="image/*" onChange={onAdvantagePhoto} className="hidden" />
                </label>
                {advantageImage ? (
                  <div>
                    <button
                      type="button"
                      onClick={onRemoveAdvantagePhoto}
                      className="text-xs text-red-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Trash2 size={13} /> Retirer l'image
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-display mb-4 text-sm font-bold text-white">Liste des points forts & avantages</h3>
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
        </div>
      )}

      {/* ============ PARTENAIRES ============ */}
      {tab === "partenaires" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Handshake size={20} className="text-cyan-400" />
                  <h3 className="font-display text-base font-bold text-white">
                    Partenaires institutionnels & Alliances
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Les logos et informations enregistrés ici sont directement liés et affichés sur la vitrine publique (page d'accueil et pied de page).
                </p>
              </div>
              <Btn onClick={addPartner} variant="primary">
                <PlusCircle size={15} /> Ajouter un partenaire
              </Btn>
            </div>

            {partners.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-white/15 bg-white/[0.01]">
                <Handshake size={44} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Aucun partenaire configuré</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Ajoutez vos partenaires officiels avec leur logo pour les afficher sur la page publique.
                </p>
                <Btn onClick={addPartner} variant="outline" className="mt-4">
                  <PlusCircle size={14} /> Créer le premier partenaire
                </Btn>
              </div>
            ) : (
              <div className="grid gap-5">
                {partners.map((p, idx) => (
                  <div
                    key={p.id}
                    className={cn(
                      "relative rounded-xl border p-5 transition-all",
                      p.actif
                        ? "border-cyan-500/30 bg-[#071322]/80 shadow-[0_0_20px_rgba(0,217,255,0.06)]"
                        : "border-white/10 bg-white/[0.02] opacity-75"
                    )}
                  >
                    {/* Header de la carte partenaire */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300 font-mono text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          {p.nom || "Nouveau partenaire"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.actif}
                            onChange={(e) => updatePartnerField(p.id, "actif", e.target.checked)}
                            className="rounded border-white/20 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>{p.actif ? "Visible sur le site" : "Masqué"}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removePartner(p.id)}
                          className="rounded-lg border border-white/10 p-2 text-slate-400 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Supprimer ce partenaire"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Contenu : Logo à gauche, Champs à droite */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      {/* Section Logo / Image */}
                      <div className="md:col-span-4 flex flex-col items-center sm:items-start gap-3">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                          Logo / Photo du partenaire
                        </span>
                        <div className="relative group">
                          <div className="h-28 w-28 rounded-2xl border-2 border-cyan-400/40 bg-[#0A1224] flex items-center justify-center overflow-hidden p-2 shadow-inner">
                            {p.logo ? (
                              <img
                                src={p.logo}
                                alt={p.nom || "Logo"}
                                className="h-full w-full object-contain filter drop-shadow"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-600">
                                <Handshake size={32} />
                                <span className="text-[10px] uppercase font-mono">Sans logo</span>
                              </div>
                            )}
                          </div>
                          {p.logo && (
                            <button
                              type="button"
                              onClick={() => onRemovePartnerLogo(p.id)}
                              className="absolute -top-2 -right-2 rounded-full border border-red-500/40 bg-[#05070D] p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition shadow"
                              title="Retirer le logo"
                            >
                              <ImageOff size={13} />
                            </button>
                          )}
                        </div>
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10 transition">
                            <Upload size={13} /> {uploading ? "Chargement..." : p.logo ? "Changer le logo" : "Téléverser logo"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => onPartnerLogo(e, p.id)}
                            disabled={uploading}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-slate-500">
                          Format JPG/PNG/WebP. Enregistré immédiatement sur la partie publique.
                        </p>
                      </div>

                      {/* Champs textuels */}
                      <div className="md:col-span-8 space-y-3">
                        <Field label="Nom officiel du partenaire *">
                          <Input
                            value={p.nom}
                            placeholder="Ex: ENIA 2.0, FSH Company, Société Générale..."
                            onChange={(e) => updatePartnerField(p.id, "nom", e.target.value)}
                          />
                        </Field>
                        <Field label="Description / Rôle (affiché sur la page d'accueil)">
                          <Input
                            value={p.description || ""}
                            placeholder="Ex: École du Numérique et de l’IA, Entreprise Partenaire..."
                            onChange={(e) => updatePartnerField(p.id, "description", e.target.value)}
                          />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Site Web officiel (URL)">
                            <Input
                              value={p.url || ""}
                              placeholder="https://..."
                              onChange={(e) => updatePartnerField(p.id, "url", e.target.value)}
                            />
                          </Field>
                          <Field label="Contact / Téléphone">
                            <Input
                              value={p.contact || ""}
                              placeholder="Ex: 06 63 28 87 4"
                              onChange={(e) => updatePartnerField(p.id, "contact", e.target.value)}
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex justify-start">
                  <Btn onClick={addPartner} variant="outline">
                    <PlusCircle size={15} /> Ajouter un autre partenaire
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ============ ANNONCES ============ */}
      {tab === "annonces" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-white">Annonces & Actualités</h3>
              <p className="text-xs text-slate-400">
                Publiez des annonces d'urgence, dates clés ou alertes visibles immédiatement sur le site public.
              </p>
            </div>
            <Btn
              onClick={() => {
                setFormAnn(emptyAnn());
                setEditingAnn(null);
                setCreatingAnn(true);
              }}
            >
              <PlusCircle size={16} /> Nouvelle annonce
            </Btn>
          </div>

          {announcements.length === 0 ? (
            <Card className="p-8 text-center" glow="none">
              <Megaphone size={40} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Aucune annonce publiée</p>
              <p className="mt-1 text-xs text-slate-500">Cliquez sur « Nouvelle annonce » pour créer un communiqué.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <Card key={a.id} className={cn("p-5", !a.actif && "opacity-60")} glow={a.couleur ?? "cyan"}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Megaphone size={16} className="text-cyan-300" />
                        <h4 className="font-display text-base font-bold text-white">{a.titre}</h4>
                        <Badge color={a.actif ? "green" : "gray"}>{a.actif ? "Publiée" : "Masquée"}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-300">{a.contenu}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{a.date}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleAnnouncement(a.id)}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
                        title={a.actif ? "Masquer" : "Afficher"}
                      >
                        {a.actif ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          setFormAnn(a);
                          setEditingAnn(a);
                          setCreatingAnn(true);
                        }}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"
                        title="Modifier"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(a.id)}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Modal open={creatingAnn} onClose={() => setCreatingAnn(false)} title={editingAnn ? "Modifier l'annonce" : "Nouvelle annonce"}>
            <div className="space-y-4">
              <Field label="Titre de l'annonce">
                <Input value={formAnn.titre} onChange={(e) => setFormAnn({ ...formAnn, titre: e.target.value })} placeholder="Ex: Rentrée solennelle 2026-2027" />
              </Field>
              <Field label="Contenu / Détails">
                <Textarea value={formAnn.contenu} onChange={(e) => setFormAnn({ ...formAnn, contenu: e.target.value })} placeholder="Message complet à destination des apprenants..." rows={4} />
              </Field>
              <Field label="Couleur de mise en avant">
                <div className="flex gap-2">
                  {(["cyan", "red", "green", "gold"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormAnn({ ...formAnn, couleur: c })}
                      className={cn(
                        "h-9 w-9 rounded-lg border-2 transition-all",
                        formAnn.couleur === c ? "border-white scale-110 shadow-lg" : "border-transparent opacity-75 hover:opacity-100",
                        c === "cyan" ? "bg-cyan-400" : c === "red" ? "bg-red-500" : c === "green" ? "bg-emerald-400" : "bg-amber-400"
                      )}
                    />
                  ))}
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formAnn.actif}
                  onChange={(e) => setFormAnn({ ...formAnn, actif: e.target.checked })}
                  className="rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-0"
                />
                Publier immédiatement sur le site public
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Btn variant="ghost" onClick={() => setCreatingAnn(false)}>Annuler</Btn>
                <Btn onClick={saveAnnouncement}><Save size={15} /> {editingAnn ? "Enregistrer" : "Publier"}</Btn>
              </div>
            </div>
          </Modal>
        </div>
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
          <Btn onClick={() => persist()} disabled={saving} variant={saved ? "green" : "primary"}>
            <Save size={15} /> {saving ? "Enregistrement en cours..." : saved ? "Enregistré ✓" : "Enregistrer les modifications"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
