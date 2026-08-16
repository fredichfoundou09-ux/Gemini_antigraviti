import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, BookOpen, GraduationCap, Award, ExternalLink, ShieldCheck, Eye, Search,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Card, PageHead, Badge, Stat, Input, Modal, moduleIcon, formationLabel } from "@/lib/ui";
import { Formation } from "@/lib/types";

export function PartnerPortal() {
  const { db, user } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Formation | "tous">("tous");
  const [viewingMod, setViewingMod] = useState<any>(null);

  const isPartnerAdmin = user?.role === "partner_admin";

  const allModules = db.modules.filter((m) => {
    const matchQ = `${m.titre} ${m.description || ""}`.toLowerCase().includes(q.toLowerCase());
    const matchT = tab === "tous" || m.formation === tab;
    return matchQ && matchT;
  });

  const publishedCourses = db.courses.filter((c) => c.publie !== false);
  const activeTeachers = db.teachers.filter((t) => t.actif !== false);

  return (
    <div className="space-y-6">
      <PageHead
        title="Portail Partenaire Institutionnel"
        subtitle={isPartnerAdmin ? "Espace de consultation administration partenaire — accès en lecture seule" : "Espace d'information et vitrine institutionnelle"}
      />

      {/* Résumé analytique en lecture seule */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<BookOpen size={20} />} label="Formations & Modules" value={db.modules.length} color="cyan" />
        <Stat icon={<GraduationCap size={20} />} label="Formateurs actifs" value={activeTeachers.length} color="blue" />
        <Stat icon={<BookOpen size={20} />} label="Cours publiés" value={publishedCourses.length} color="green" />
        <Stat icon={<Award size={20} />} label="Certificats délivrés" value={db.certificates.length} color="gold" />
      </div>

      {/* Recherche & Vitrine des Formations */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-white">Catalogue des Modules & Programmes</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un module..."
                className="pl-9 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {(["tous", "informatique", "industriel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTab(f)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-bold transition-all",
                    tab === f
                      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-slate-400 hover:bg-white/5"
                  )}
                >
                  {f === "tous" ? "Tous" : formationLabel(f)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allModules.map((m) => (
            <Card key={m.id} className="p-5" glow={m.formation === "informatique" ? "red" : "cyan"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-xl border p-2.5", m.formation === "informatique" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}>
                    {moduleIcon(m.icon, "h-5 w-5")}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-slate-500">MODULE {String(m.numero).padStart(2, "0")}</p>
                    <h4 className="font-display text-base font-bold text-white">{m.titre}</h4>
                  </div>
                </div>
                <button
                  onClick={() => setViewingMod(m)}
                  className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"
                  title="Consulter le programme"
                >
                  <Eye size={15} />
                </button>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-slate-400">{m.description || "Consultez la fiche pédagogique pour en savoir plus."}</p>
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <Badge color={m.formation === "informatique" ? "red" : "cyan"}>{formationLabel(m.formation)}</Badge>
                {m.duree && <span className="text-[11px] text-slate-500">{m.duree}</span>}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Partenaires & Module ENIA */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">École ENIA 2.0</h3>
            <Link to="/app/enia" className="text-xs font-bold text-cyan-300 hover:underline">Découvrir le module →</Link>
          </div>
          <p className="text-xs text-slate-300">
            {db.enia?.presentation || "École supérieure spécialisée en numérique et intelligence artificielle."}
          </p>
          {db.enia?.lien?.url && (
            <a href={db.enia.lien.url} target="_blank" rel="noreferrer" className="mt-4 inline-block">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20">
                <ExternalLink size={14} /> Site officiel ENIA 2.0
              </span>
            </a>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display mb-3 text-sm font-bold text-white">Partenaires du réseau</h3>
          <div className="space-y-2">
            {db.partners.filter((p) => p.actif).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">{p.nom}</p>
                  <p className="truncate text-[10px] text-slate-500">{p.description || "Partenaire institutionnel"}</p>
                </div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-cyan-300">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Modal aperçu programme module */}
      <Modal open={!!viewingMod} onClose={() => setViewingMod(null)} title={viewingMod ? `Module ${viewingMod.numero} — ${viewingMod.titre}` : ""} wide>
        {viewingMod && (
          <div className="space-y-4 text-slate-300 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Badge color={viewingMod.formation === "informatique" ? "red" : "cyan"}>{formationLabel(viewingMod.formation)}</Badge>
              {viewingMod.duree && <span className="text-slate-500">Durée : {viewingMod.duree}</span>}
            </div>
            {viewingMod.description && (
              <div>
                <p className="mb-1 font-bold text-cyan-300 uppercase text-[10px] tracking-wider">Description</p>
                <p className="whitespace-pre-wrap leading-relaxed">{viewingMod.description}</p>
              </div>
            )}
            {viewingMod.notions?.length > 0 && (
              <div>
                <p className="mb-1.5 font-bold text-cyan-300 uppercase text-[10px] tracking-wider">Notions clés</p>
                <ul className="space-y-1">
                  {viewingMod.notions.map((n: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-emerald-300" /> {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewingMod.chapitres?.length > 0 && (
              <div>
                <p className="mb-1.5 font-bold text-cyan-300 uppercase text-[10px] tracking-wider">Chapitres du programme</p>
                <div className="space-y-1.5">
                  {viewingMod.chapitres.map((c: any, i: number) => (
                    <div key={c.id || i} className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                      <p className="font-bold text-slate-200">{i + 1}. {c.titre}</p>
                      {c.contenu && <p className="mt-0.5 text-slate-400 text-xs">{c.contenu}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
