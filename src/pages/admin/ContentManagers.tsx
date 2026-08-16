import { useState } from "react";
import {
  Medal, PlusCircle, Trash2, Pencil, ArrowUp, ArrowDown, Upload, ImageOff, Handshake, Eye,
  EyeOff, Megaphone, Save, Award, TrendingUp,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Badge, Card, Empty, Field, Input, Textarea, Modal, PageHead, readImage, uid, today } from "@/lib/ui";
import { Advantage, Partner, Announcement } from "@/lib/types";

/* ================= AVANTAGES ================= */
export function AdvantagesManager() {
  const { db, update, log } = useStore();
  const advs = [...db.advantages].sort((a, b) => a.ordre - b.ordre);
  const [editing, setEditing] = useState<Advantage | null>(null);
  const [creating, setCreating] = useState(false);
  const [headerImg, setHeaderImg] = useState(db.settings.advantageImage ?? "");
  const empty = (): Advantage => ({ id: uid("ADV"), titre: "", description: "", explication: "", infosSupp: "", image: "", icon: "award", ordre: advs.length + 1 });
  const [form, setForm] = useState<Advantage>(empty());

  const saveHeader = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = await readImage(f, 1200);
    update((d) => ({ ...d, settings: { ...d.settings, advantageImage: img } }));
    setHeaderImg(img);
    log("Image d'en-tête des avantages remplacée");
  };

  const save = () => {
    if (!form.titre) return;
    if (editing) {
      update((d) => ({ ...d, advantages: d.advantages.map((a) => (a.id === editing.id ? form : a)) }));
      log(`Avantage modifié : ${form.titre}`);
    } else {
      update((d) => ({ ...d, advantages: [...d.advantages, form] }));
      log(`Avantage ajouté : ${form.titre}`);
    }
    setCreating(false); setEditing(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    const arr = [...advs];
    const i = arr.findIndex((a) => a.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i].ordre, arr[j].ordre] = [arr[j].ordre, arr[i].ordre];
    update((d) => ({ ...d, advantages: d.advantages.map((a) => arr.find((x) => x.id === a.id) ?? a) }));
  };

  const onImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setForm({ ...form, image: await readImage(f, 700) });
  };

  const iconEl = (k?: string) => k === "medal" ? <Medal size={20} /> : k === "trend" ? <TrendingUp size={20} /> : <Award size={20} />;

  return (
    <div>
      <PageHead title="Gestion des avantages" subtitle="Dynamique : titre, description, explication, image et ordre — affiché sur le site public"
        actions={<Btn onClick={() => { setForm(empty()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Ajouter un avantage</Btn>} />

      {/* Image d'en-tête */}
      <Card className="mb-5 p-5" glow="none">
        <div className="flex flex-wrap items-center gap-4">
          {headerImg ? (
            <img src={headerImg} alt="En-tête des avantages" className="h-24 w-40 rounded-xl border border-white/10 object-cover" />
          ) : (
            <div className="flex h-24 w-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-slate-500">Pas d'image d'en-tête</div>
          )}
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Image d'en-tête de la section Avantages</p>
            <p className="mt-1 text-xs text-slate-500">Cette image est affichée en bas du bloc Avantages sur la page d'accueil publique. Vous pouvez la remplacer ou la supprimer à tout moment.</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={14} /> {headerImg ? "Remplacer l'image" : "Charger une image"}</span>
              <input type="file" accept="image/*" onChange={saveHeader} className="hidden" />
            </label>
            {headerImg && (
              <Btn variant="ghost" onClick={() => { update((d) => ({ ...d, settings: { ...d.settings, advantageImage: "" } })); setHeaderImg(""); log("Image d'en-tête des avantages supprimée"); }}>
                <ImageOff size={14} />
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {advs.length === 0 ? (
        <Empty icon={<Medal size={40} />} title="Aucun avantage" />
      ) : (
        <div className="space-y-4">
          {advs.map((a, i) => (
            <Card key={a.id} className="overflow-hidden" glow="gold">
              <div className="flex flex-col gap-4 p-5 sm:flex-row">
                <div className="sm:w-48 shrink-0">
                  {a.image ? (
                    <img src={a.image} alt="" className="h-32 w-full rounded-xl object-cover sm:h-full" />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-amber-300 sm:h-full">{iconEl(a.icon)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avantage {i + 1}</p>
                      <h4 className="font-display text-lg font-bold text-amber-300">{a.titre}</h4>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => move(a.id, -1)} disabled={i === 0} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => move(a.id, 1)} disabled={i === advs.length - 1} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button onClick={() => { setForm(a); setEditing(a); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("Supprimer cet avantage ?")) { update((d) => ({ ...d, advantages: d.advantages.filter((x) => x.id !== a.id) })); log(`Avantage supprimé : ${a.titre}`); } }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{a.description}</p>
                  <p className="mt-1.5 text-sm text-slate-400">{a.explication}</p>
                  {a.infosSupp && <p className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-400">{a.infosSupp}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? "Modifier l'avantage" : "Nouvel avantage"} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {form.image ? <img src={form.image} alt="" className="h-24 w-32 rounded-xl border border-amber-400/40 object-cover" />
              : <div className="flex h-24 w-32 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-amber-300">{iconEl(form.icon)}</div>}
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={14} /> {form.image ? "Remplacer l'image" : "Ajouter une image"}</span>
                <input type="file" accept="image/*" onChange={onImg} className="hidden" />
              </label>
              {form.image && <Btn variant="ghost" onClick={() => setForm({ ...form, image: "" })}><ImageOff size={14} /></Btn>}
            </div>
          </div>
          <Field label="Titre"><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Field>
          <Field label="Description (courte)"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Explication (détaillée)"><Textarea value={form.explication} onChange={(e) => setForm({ ...form, explication: e.target.value })} /></Field>
          <Field label="Informations supplémentaires"><Input value={form.infosSupp} onChange={(e) => setForm({ ...form, infosSupp: e.target.value })} /></Field>
          <Field label="Icône (si pas d'image)">
            <div className="flex gap-2">
              {[["award", <Award size={16} />], ["medal", <Medal size={16} />], ["trend", <TrendingUp size={16} />]].map(([k, el]) => (
                <button key={k as string} type="button" onClick={() => setForm({ ...form, icon: k as string })}
                  className={cn("rounded-lg border p-2.5", form.icon === k ? "border-amber-400/60 bg-amber-400/10 text-amber-300" : "border-white/10 text-slate-400")}>{el as any}</button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={save}>{editing ? "Enregistrer" : "Ajouter"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= PARTENAIRES ================= */
export function PartnersManager() {
  const { db, update, log } = useStore();
  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);
  const empty = (): Partner => ({ id: uid("PRT"), nom: "", description: "", contact: "", logo: "", actif: true });
  const [form, setForm] = useState<Partner>(empty());

  const save = () => {
    if (!form.nom) return;
    if (editing) update((d) => ({ ...d, partners: d.partners.map((p) => (p.id === editing.id ? form : p)) }));
    else update((d) => ({ ...d, partners: [...d.partners, form] }));
    log(`Partenaire ${editing ? "modifié" : "ajouté"} : ${form.nom}`);
    setCreating(false); setEditing(null);
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setForm({ ...form, logo: await readImage(f, 300) });
  };

  return (
    <div>
      <PageHead title="Gestion des partenaires" subtitle="Ajouter, modifier, activer/désactiver et supprimer les partenaires institutionnels"
        actions={<Btn onClick={() => { setForm(empty()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Ajouter un partenaire</Btn>} />
      {db.partners.length === 0 ? (
        <Empty icon={<Handshake size={40} />} title="Aucun partenaire" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {db.partners.map((p) => (
            <Card key={p.id} className={cn("p-5", !p.actif && "opacity-60")} glow="cyan">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {p.logo ? <img src={p.logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30"><Handshake size={20} className="text-cyan-300" /></div>}
                  <div>
                    <p className="font-display text-sm font-bold text-white">{p.nom}</p>
                    <Badge color={p.actif ? "green" : "gray"}>{p.actif ? "Actif" : "Désactivé"}</Badge>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => update((d) => ({ ...d, partners: d.partners.map((x) => x.id === p.id ? { ...x, actif: !x.actif } : x) }))}
                    className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5" title={p.actif ? "Désactiver" : "Activer"}>{p.actif ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button onClick={() => { setForm(p); setEditing(p); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm(`Supprimer définitivement le partenaire « ${p.nom} » ?`)) { update((d) => ({ ...d, partners: d.partners.filter((x) => x.id !== p.id) })); log(`Partenaire supprimé : ${p.nom}`); } }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              {p.description && <p className="mt-3 text-sm text-slate-400">{p.description}</p>}
              {p.contact && <p className="mt-2 text-xs text-slate-500">{p.contact}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? "Modifier le partenaire" : "Nouveau partenaire"}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {form.logo ? <img src={form.logo} alt="" className="h-16 w-16 rounded-xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"><Handshake size={24} className="text-slate-500" /></div>}
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={14} /> Logo</span>
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
          </div>
          <Field label="Nom du partenaire"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Contact"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} /> Partenaire actif
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={save}>{editing ? "Enregistrer" : "Ajouter"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= ANNONCES ================= */
export function AnnouncementsManager() {
  const { db, update, log, notify } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const empty = (): Announcement => ({ id: uid("ANN"), titre: "", contenu: "", date: today(), actif: true, couleur: "cyan" });
  const [form, setForm] = useState<Announcement>(empty());

  const save = () => {
    if (!form.titre) return;
    if (editing) update((d) => ({ ...d, announcements: d.announcements.map((a) => (a.id === editing.id ? form : a)) }));
    else {
      update((d) => ({ ...d, announcements: [form, ...d.announcements] }));
      notify("all", `📢 ${form.titre}`, form.contenu, "info");
    }
    log(`Annonce ${editing ? "modifiée" : "publiée"} : ${form.titre}`);
    setCreating(false); setEditing(null);
  };

  return (
    <div>
      <PageHead title="Annonces" subtitle="Publiez des annonces affichées sur le site public et envoyées en notification"
        actions={<Btn onClick={() => { setForm(empty()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Nouvelle annonce</Btn>} />
      {db.announcements.length === 0 ? (
        <Empty icon={<Megaphone size={40} />} title="Aucune annonce" />
      ) : (
        <div className="space-y-3">
          {db.announcements.map((a) => (
            <Card key={a.id} className={cn("p-5", !a.actif && "opacity-60")} glow={a.couleur ?? "cyan"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-cyan-300" />
                    <h4 className="font-display text-base font-bold text-white">{a.titre}</h4>
                    <Badge color={a.actif ? "green" : "gray"}>{a.actif ? "Publiée" : "Masquée"}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-400">{a.contenu}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{a.date}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => update((d) => ({ ...d, announcements: d.announcements.map((x) => x.id === a.id ? { ...x, actif: !x.actif } : x) }))} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5">{a.actif ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button onClick={() => { setForm(a); setEditing(a); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm("Supprimer cette annonce ?")) update((d) => ({ ...d, announcements: d.announcements.filter((x) => x.id !== a.id) })); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? "Modifier l'annonce" : "Nouvelle annonce"}>
        <div className="space-y-4">
          <Field label="Titre"><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Field>
          <Field label="Contenu"><Textarea value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} /></Field>
          <Field label="Couleur">
            <div className="flex gap-2">
              {(["cyan", "red", "green", "gold"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, couleur: c })}
                  className={cn("h-9 w-9 rounded-lg border-2", form.couleur === c ? "border-white" : "border-transparent",
                    c === "cyan" ? "bg-cyan-400" : c === "red" ? "bg-red-500" : c === "green" ? "bg-emerald-400" : "bg-amber-400")} />
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} /> Publier sur le site public
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={save}><Save size={15} /> {editing ? "Enregistrer" : "Publier"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
