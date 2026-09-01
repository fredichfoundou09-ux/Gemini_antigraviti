import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  PlusCircle, Trash2, Pencil, CalendarDays, Clock, MapPin, ClipboardCheck, FileText, TestTube2,
  PenLine, Wallet, Award, BadgeDollarSign, Printer, CheckCircle2, XCircle, Timer, BookOpen,
  GraduationCap, Eye, Save, ShieldCheck, ReceiptText, Upload, ImageOff, Users, Search, Download, Ban, AlertTriangle,
  LayoutGrid, Table2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { toastMsg } from "@/lib/toast";
import { cn } from "@/utils/cn";
import {
  Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Textarea, uid, today,
  money, formationLabel, moduleIcon, printHTML, readImage,
} from "@/lib/ui";
import { Formation, AttendanceStatus } from "@/lib/types";
import { ingestFile, fileKind, humanSize, downloadFile } from "@/lib/files";
import { studentsOfCourse, studentsOfSchedule } from "@/lib/access";
import { financialSummary, nextReceiptRef, statusLabel } from "@/lib/finance";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { resolveFormationId } from "@/lib/supabase/formations";
import { formatSupabaseError } from "@/lib/supabase/errors";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/* ================= MODULES ================= */
const ICONS = ["code", "network", "server", "terminal", "shield", "sigma", "lock", "cog", "zap", "cpu", "plug", "factory", "waves", "git", "ruler", "binary", "audio", "calc", "wrench"];

const blankModule = (formation: Formation) => ({
  titre: "", icon: "code", formation, notions: "", description: "", objectifs: "", programme: "",
  duree: "", supports: "", infosSupp: "", image: "", chapitres: [] as { id: string; titre: string; contenu: string }[],
});

export function ModulesPage() {
  const { db, user, update, log } = useStore();
  const [tab, setTab] = useState<Formation>("informatique");
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState<any>(blankModule("informatique"));

  const isTeacher = user?.role === "teacher";
  const myTeacher = isTeacher ? db.teachers.find((t) => t.userId === user!.id) : null;
  const list = db.modules
    .filter((m) => m.formation === tab)
    .filter((m) => (myTeacher ? myTeacher.modules.includes(m.id) : true))
    .sort((a, b) => a.numero - b.numero);

  const openEdit = (m: any) => {
    setForm({
      titre: m.titre, icon: m.icon, formation: m.formation, notions: m.notions.join("\n"),
      description: m.description ?? "", objectifs: (m.objectifs ?? []).join("\n"), programme: m.programme ?? "",
      duree: m.duree ?? "", supports: m.supports ?? "", infosSupp: m.infosSupp ?? "", image: m.image ?? "",
      chapitres: m.chapitres ?? [],
    });
    setEditing(m); setCreating(true);
  };

  const save = async () => {
    if (!form.titre.trim()) return;
    const notions = form.notions.split("\n").map((s: string) => s.trim()).filter(Boolean);
    const objectifs = form.objectifs.split("\n").map((s: string) => s.trim()).filter(Boolean);
    const payload = {
      titre: form.titre.trim(), icon: form.icon, notions, description: form.description, objectifs,
      programme: form.programme, duree: form.duree, supports: form.supports, infosSupp: form.infosSupp,
      image: form.image, chapitres: form.chapitres,
    };

    if (isSupabaseConfigured) {
      try {
        const formationId = await resolveFormationId(tab);
        if (editing) {
          const { error: updErr } = await supabase.from("modules").update({
            formation_id: formationId,
            titre: form.titre.trim(),
            icon: form.icon || "code",
            description: form.description || "",
            duree: form.duree || "",
            supports: form.supports || "",
            infos_supp: form.infosSupp || "",
            image_url: form.image || "",
            active: true
          }).eq("id", editing.id);
          if (updErr) throw updErr;

          await supabase.from("chapters").delete().eq("module_id", editing.id);
          if (form.chapitres?.length) {
            await supabase.from("chapters").insert(form.chapitres.map((c: any, idx: number) => ({
              module_id: editing.id,
              titre: c.titre,
              contenu: c.contenu || "",
              ordre: idx + 1
            })));
          }
          toastMsg.success("Module mis à jour côté serveur ✓");
        } else {
          const numero = db.modules.filter((m) => m.formation === tab).length + 1;
          const { data: newMod, error: insErr } = await supabase.from("modules").insert({
            formation_id: formationId,
            numero,
            titre: form.titre.trim(),
            icon: form.icon || "code",
            description: form.description || "",
            duree: form.duree || "",
            supports: form.supports || "",
            infos_supp: form.infosSupp || "",
            image_url: form.image || "",
            active: true
          }).select("id").single();
          if (insErr) throw insErr;

          if (form.chapitres?.length && newMod?.id) {
            await supabase.from("chapters").insert(form.chapitres.map((c: any, idx: number) => ({
              module_id: newMod.id,
              titre: c.titre,
              contenu: c.contenu || "",
              ordre: idx + 1
            })));
          }
          toastMsg.success("Nouveau module créé côté serveur ✓");
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur enregistrement module", err.message);
      }
    }

    if (editing) {
      update((d) => ({ ...d, modules: d.modules.map((m) => (m.id === editing.id ? { ...m, ...payload } : m)) }));
      log(`Module modifié : ${form.titre}`);
    } else {
      const numero = db.modules.filter((m) => m.formation === tab).length + 1;
      const id = `mod-${tab === "informatique" ? "inf" : "ind"}-${Date.now().toString(36)}`;
      update((d) => ({ ...d, modules: [...d.modules, { id, formation: tab, numero, ...payload }] }));
      log(`Module ajouté : ${form.titre}`);
    }
    setCreating(false); setEditing(null);
  };

  const deleteModule = async (m: any) => {
    if (!confirm(`Supprimer le module « ${m.titre} » ?`)) return;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("modules").delete().eq("id", m.id);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.info("Module supprimé du serveur");
      } catch (err: any) {
        toastMsg.error("Erreur suppression module", err.message);
      }
    }
    update((d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }));
  };

  const addChapter = () => setForm((f: any) => ({ ...f, chapitres: [...f.chapitres, { id: uid("CH"), titre: `Chapitre ${f.chapitres.length + 1}`, contenu: "" }] }));
  const updChapter = (id: string, k: string, v: string) => setForm((f: any) => ({ ...f, chapitres: f.chapitres.map((c: any) => (c.id === id ? { ...c, [k]: v } : c)) }));
  const delChapter = (id: string) => setForm((f: any) => ({ ...f, chapitres: f.chapitres.filter((c: any) => c.id !== id) }));

  const onImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `modules/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("public-media").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("public-media").getPublicUrl(path);
          setForm((p: any) => ({ ...p, image: pub.publicUrl }));
          toastMsg.success("Image téléversée sur le serveur ✓");
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    const img = await readImage(f, 700);
    setForm((p: any) => ({ ...p, image: img }));
  };

  return (
    <div>
      <PageHead title="Formations & Modules" subtitle={isTeacher ? "Modifiez le contenu de vos modules : programme, chapitres, objectifs..." : "Fiches détaillées dynamiques — description, objectifs, programme, chapitres, image"}
        actions={!isTeacher ? <Btn onClick={() => { setForm(blankModule(tab)); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Ajouter un module</Btn> : undefined} />
      <div className="mb-5 flex gap-2">
        {(["informatique", "industriel"] as Formation[]).map((f) => (
          <button key={f} onClick={() => setTab(f)}
            className={cn("rounded-xl border px-5 py-2.5 text-sm font-bold transition-all",
              tab === f ? (f === "informatique" ? "border-red-500/60 bg-red-500/10 text-red-400" : "border-cyan-400/60 bg-cyan-400/10 text-cyan-300") : "border-white/10 text-slate-400 hover:bg-white/5")}>
            {formationLabel(f)} ({db.modules.filter((m) => m.formation === f).length})
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => (
          <Card key={m.id} className="overflow-hidden" glow={tab === "informatique" ? "red" : "cyan"}>
            {m.image && <img src={m.image} alt="" className="h-28 w-full object-cover" />}
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-xl border p-2.5", tab === "informatique" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300")}>
                    {moduleIcon(m.icon, "h-5 w-5")}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-slate-500">MODULE {String(m.numero).padStart(2, "0")}</p>
                    <h4 className="font-display text-sm font-bold text-white">{m.titre}</h4>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setViewing(m)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"><Eye size={14} /></button>
                  <button onClick={() => openEdit(m)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"><Pencil size={14} /></button>
                  {!isTeacher && <button onClick={() => deleteModule(m)}
                    className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              </div>
              {m.description && <p className="mt-3 line-clamp-2 text-xs text-slate-400">{m.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.chapitres && m.chapitres.length > 0 && <Badge color="gray">{m.chapitres.length} chapitre(s)</Badge>}
                {m.duree && <Badge color="cyan">{m.duree}</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* view fiche */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Fiche — ${viewing.titre}` : ""} wide>
        {viewing && (
          <div className="space-y-4">
            {viewing.image && <img src={viewing.image} alt="" className="h-44 w-full rounded-xl object-cover" />}
            <div className="flex flex-wrap gap-2">
              <Badge color={viewing.formation === "informatique" ? "red" : "cyan"}>{formationLabel(viewing.formation)}</Badge>
              <Badge color="gray">Module {viewing.numero}</Badge>
              {viewing.duree && <Badge color="cyan">{viewing.duree}</Badge>}
            </div>
            {viewing.description && <Section title="Description">{viewing.description}</Section>}
            {viewing.objectifs?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">Objectifs</p>
                <ul className="space-y-1">{viewing.objectifs.map((o: string, i: number) => <li key={i} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />{o}</li>)}</ul>
              </div>
            )}
            {viewing.chapitres?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">Programme & chapitres</p>
                <div className="space-y-2">
                  {viewing.chapitres.map((c: any, i: number) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-sm font-bold text-slate-200">{i + 1}. {c.titre}</p>
                      {c.contenu && <p className="mt-1 text-xs text-slate-400">{c.contenu}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {viewing.supports && <Section title="Supports">{viewing.supports}</Section>}
            {viewing.infosSupp && <Section title="Informations supplémentaires">{viewing.infosSupp}</Section>}
          </div>
        )}
      </Modal>

      {/* edit fiche */}
      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Modifier — ${editing.titre}` : "Nouveau module"} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {form.image ? <img src={form.image} alt="" className="h-24 w-40 rounded-xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-24 w-40 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-500">{moduleIcon(form.icon, "h-7 w-7")}</div>}
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={14} /> {form.image ? "Remplacer l'image" : "Image du module"}</span>
                <input type="file" accept="image/*" onChange={onImg} className="hidden" />
              </label>
              {form.image && <Btn variant="ghost" onClick={() => setForm({ ...form, image: "" })}><ImageOff size={14} /></Btn>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre du module"><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Field>
            <Field label="Durée"><Input value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value })} placeholder="ex: 2 à 3 semaines" /></Field>
          </div>
          <Field label="Icône">
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setForm({ ...form, icon: ic })}
                  className={cn("flex items-center justify-center rounded-lg border p-2", form.icon === ic ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                  {moduleIcon(ic, "h-4 w-4")}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Objectifs" hint="Un objectif par ligne"><Textarea value={form.objectifs} onChange={(e) => setForm({ ...form, objectifs: e.target.value })} /></Field>
          <Field label="Notions clés (affichées sur le site)" hint="Une notion par ligne"><Textarea value={form.notions} onChange={(e) => setForm({ ...form, notions: e.target.value })} /></Field>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Programme — Chapitres ({form.chapitres.length})</p>
              <Btn variant="outline" onClick={addChapter}><PlusCircle size={13} /> Ajouter un chapitre</Btn>
            </div>
            <div className="space-y-2">
              {form.chapitres.map((c: any, i: number) => (
                <div key={c.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{i + 1}.</span>
                    <Input value={c.titre} onChange={(e) => updChapter(c.id, "titre", e.target.value)} placeholder="Titre du chapitre" />
                    <button onClick={() => delChapter(c.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                  <Textarea value={c.contenu} onChange={(e) => updChapter(c.id, "contenu", e.target.value)} placeholder="Contenu du chapitre..." className="min-h-[60px]" />
                </div>
              ))}
              {form.chapitres.length === 0 && <p className="text-xs text-slate-500">Aucun chapitre. Ajoutez-en pour construire le programme pédagogique.</p>}
            </div>
          </div>

          <Field label="Supports pédagogiques"><Textarea value={form.supports} onChange={(e) => setForm({ ...form, supports: e.target.value })} placeholder="PDF, vidéos, exercices..." /></Field>
          <Field label="Informations supplémentaires"><Textarea value={form.infosSupp} onChange={(e) => setForm({ ...form, infosSupp: e.target.value })} placeholder="Prérequis, modalités d'évaluation..." /></Field>

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={save}><Save size={15} /> {editing ? "Enregistrer" : "Ajouter"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">{title}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-300">{children}</p>
    </div>
  );
}

/* ================= EMPLOI DU TEMPS ================= */
export function SchedulePage() {
  const { db, user, update, log } = useStore();
  const [creating, setCreating] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);
  const blankSlot = () => ({ jour: "Lundi", heureDebut: "08:00", heureFin: "10:00", date: "", moduleId: "", teacherId: "", salle: "", formation: "informatique" as Formation, cibleType: "module" as "module" | "groupe" | "apprenants", groupe: "", studentIds: [] as string[] });
  const [form, setForm] = useState<any>(blankSlot());

  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const [formationFilter, setFormationFilter] = useState<Formation | "all">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const items = db.schedule
    .filter((s) => (teacher ? teacher!.modules.includes(s.moduleId) : true))
    .filter((s) => formationFilter === "all" ? true : s.formation === formationFilter);

  const targetStudents = db.students.filter((s) => (!form.formation || s.formation === form.formation) && (!form.moduleId || s.modules.includes(form.moduleId)));

  const [savingSlot, setSavingSlot] = useState(false);

  const save = async () => {
    // 1. Validations frontend obligatoires
    if (!form.formation) {
      toastMsg.error("Formation requise", "Veuillez sélectionner une formation.");
      return;
    }
    if (!form.moduleId) {
      toastMsg.error("Module requis", "Veuillez sélectionner un module d'enseignement.");
      return;
    }
    if (!form.teacherId) {
      toastMsg.error("Enseignant requis", "Veuillez obligatoirement sélectionner un enseignant.");
      return;
    }
    if (!form.jour) {
      toastMsg.error("Jour requis", "Veuillez sélectionner un jour de cours.");
      return;
    }
    if (!form.heureDebut || !form.heureFin || form.heureDebut >= form.heureFin) {
      toastMsg.error("Horaires invalides", "L'heure de début doit être strictement antérieure à l'heure de fin.");
      return;
    }

    // 2. Détection des conflits pour l'enseignant
    const teacherConflict = db.schedule.find((s) =>
      s.jour === form.jour &&
      s.teacherId === form.teacherId &&
      ((!form.date && !s.date) || (form.date && s.date === form.date)) &&
      form.heureDebut < s.heureFin &&
      form.heureFin > s.heureDebut
    );
    if (teacherConflict) {
      toastMsg.error("Conflit d'emploi du temps", "Cet enseignant a déjà un cours programmé sur cette plage horaire.");
      return;
    }

    // 3. Détection des conflits de salle (si spécifiée)
    if (form.salle && form.salle.trim()) {
      const roomConflict = db.schedule.find((s) =>
        s.jour === form.jour &&
        s.salle && s.salle.trim().toLowerCase() === form.salle.trim().toLowerCase() &&
        ((!form.date && !s.date) || (form.date && s.date === form.date)) &&
        form.heureDebut < s.heureFin &&
        form.heureFin > s.heureDebut
      );
      if (roomConflict) {
        toastMsg.error("Salle occupée", `La salle "${form.salle.trim()}" est déjà occupée sur ce créneau horaire.`);
        return;
      }
    }

    const capitalizeDay = (d: string) => {
      if (!d) return "Lundi";
      const c = d.trim().toLowerCase();
      return c.charAt(0).toUpperCase() + c.slice(1);
    };
    const cleanJour = capitalizeDay(form.jour);

    const payload: any = {
      jour: cleanJour,
      heureDebut: form.heureDebut,
      heureFin: form.heureFin,
      moduleId: form.moduleId,
      teacherId: form.teacherId,
      salle: form.salle || "",
      formation: form.formation,
    };
    if (form.date) payload.date = form.date;
    if (form.cibleType === "groupe" && form.groupe) payload.groupe = form.groupe;
    if (form.cibleType === "apprenants" && form.studentIds.length) payload.studentIds = form.studentIds;

    let slotId = uid("SCH");
    const immediateSlot = { id: slotId, ...payload };

    // 1. Affichage et persistance immédiate garantie
    update((d) => ({
      ...d,
      schedule: [...d.schedule.filter((x) => x.id !== slotId), immediateSlot]
    }));

    toastMsg.success("Créneau planifié avec succès ✓", `${cleanJour} ${form.heureDebut} - ${form.heureFin}`);
    log(`Créneau ajouté : ${cleanJour} ${form.heureDebut}-${form.heureFin} — ${db.modules.find((m) => m.id === form.moduleId)?.titre ?? ""}`);
    setForm(blankSlot());
    setCreating(false);

    // 2. Synchronisation Supabase en arrière-plan avec consolidation d'identifiant
    if (isSupabaseConfigured) {
      setSavingSlot(true);
      (async () => {
        try {
          let formationId = await resolveFormationId(form.formation);
          let isFormationUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formationId);
          if (!isFormationUuid) {
            const { data: fRow } = await supabase.from("formations").select("id").eq("code", form.formation).maybeSingle();
            if (fRow?.id) {
              formationId = fRow.id;
              isFormationUuid = true;
            }
          }

          let realModuleId: string | null = null;
          const isModuleUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.moduleId);
          if (isModuleUuid) {
            realModuleId = form.moduleId;
          } else {
            const modObj = db.modules.find((m) => m.id === form.moduleId);
            const { data: modCheck } = await supabase.from("modules").select("id").or(`code.eq.${form.moduleId},titre.eq.${modObj?.titre || form.moduleId}`).maybeSingle();
            if (modCheck?.id) {
              realModuleId = modCheck.id;
            } else if (isFormationUuid) {
              const { data: newMod } = await supabase.from("modules").insert({
                formation_id: formationId,
                numero: modObj?.numero || 1,
                code: form.moduleId,
                titre: modObj?.titre || "Module " + form.moduleId,
                icon: modObj?.icon || "code",
                active: true
              }).select("id").single();
              if (newMod?.id) realModuleId = newMod.id;
            }
          }

          let teacherId = form.teacherId;
          const { data: tCheck } = await supabase.from("teachers").select("id").eq("id", form.teacherId).maybeSingle();
          if (!tCheck) {
            const tObj = db.teachers.find((t) => t.id === form.teacherId);
            const { data: upT } = await supabase.from("teachers").upsert({
              id: form.teacherId,
              nom: tObj?.nom || "Formateur",
              prenom: tObj?.prenom || "Sentinelle",
              email: tObj?.email || `teacher_${form.teacherId}@sentinelles.cg`,
              phone: tObj?.phone || "060000000",
              specialite: tObj?.specialite || "Pédagogie",
              actif: true
            }).select("id").maybeSingle();
            if (upT?.id) teacherId = upT.id;
          }

          if (isFormationUuid && realModuleId) {
            const { data: insData } = await supabase.from("schedule").insert({
              formation_id: formationId,
              module_id: realModuleId,
              teacher_id: teacherId,
              jour: cleanJour,
              heure_debut: form.heureDebut,
              heure_fin: form.heureFin,
              salle: form.salle?.trim() || "",
              date: form.date || null,
            }).select().single();

            if (insData?.id) {
              update((d) => ({
                ...d,
                schedule: d.schedule.map((s) => s.id === slotId ? { ...s, id: insData.id } : s)
              }));
            }
          }
        } catch (err: any) {
          console.warn("Notice synchronisation Supabase planning:", err);
        } finally {
          setSavingSlot(false);
        }
      })();
    }
  };

  const deleteSchedule = async (slotId: string) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from("schedule").delete().eq("id", slotId);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.info("Créneau supprimé du serveur");
      } catch (err: any) {
        console.warn("Suppression serveur créneau:", err);
      }
    }
    update((d) => ({ ...d, schedule: d.schedule.filter((x) => x.id !== slotId) }));
    toastMsg.success("Créneau retiré du planning");
  };

  const modName = (id: string) => db.modules.find((m) => m.id === id || m.code === id || m.titre === id)?.titre ?? "Module de cours";
  const modCode = (id: string) => db.modules.find((m) => m.id === id || m.code === id || m.titre === id)?.code ?? "";
  const tName = (id: string) => {
    const t = db.teachers.find((x) => x.id === id || x.userId === id);
    return t ? `${t.prenom} ${t.nom}` : "Formateur assigné";
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Emploi du temps"
        subtitle="Planning hebdomadaire et gestion des créneaux de formation"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bascule Grille / Grand Tableau */}
            <div className="flex items-center rounded-xl border border-white/10 bg-[#081024] p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  viewMode === "cards"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <LayoutGrid size={14} /> Vue Grille
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  viewMode === "table"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Table2 size={14} /> Grand Tableau
              </button>
            </div>

            {user?.role !== "teacher" && (
              <Btn onClick={() => setCreating(true)} className="shadow-[0_0_20px_-4px_rgba(0,229,255,0.7)]">
                <PlusCircle size={16} /> Nouveau créneau
              </Btn>
            )}
          </div>
        }
      />

      {/* Barre de Filtres & Métriques Rapides */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0A1329]/80 p-3.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Filière :</span>
          <button
            type="button"
            onClick={() => setFormationFilter("all")}
            className={cn(
              "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition",
              formationFilter === "all"
                ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            Toutes ({db.schedule.length})
          </button>
          <button
            type="button"
            onClick={() => setFormationFilter("informatique")}
            className={cn(
              "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition",
              formationFilter === "informatique"
                ? "border-red-500/60 bg-red-500/15 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            Génie Informatique ({db.schedule.filter((s) => s.formation === "informatique").length})
          </button>
          <button
            type="button"
            onClick={() => setFormationFilter("industriel")}
            className={cn(
              "rounded-xl border px-3.5 py-1.5 text-xs font-bold transition",
              formationFilter === "industriel"
                ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            Génie Industriel ({db.schedule.filter((s) => s.formation === "industriel").length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays size={15} className="text-cyan-400" />
          <span>Créneaux affichés : <strong className="text-white font-mono">{items.length}</strong></span>
        </div>
      </div>

      {/* VUE 1 : VUE GRILLE PAR JOUR (Modernisée & Agrandie) */}
      {viewMode === "cards" && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((day) => {
            const dayItems = items.filter((i) => (i.jour || "").trim().toLowerCase() === day.trim().toLowerCase()).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));
            return (
              <Card key={day} className="p-5 border-white/10 bg-[#081024]/90 backdrop-blur-md shadow-xl hover:border-cyan-400/30 transition">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                      <CalendarDays size={16} />
                    </div>
                    <h4 className="font-display text-base font-bold text-white tracking-wide">{day}</h4>
                  </div>
                  <Badge color={dayItems.length > 0 ? "cyan" : "gray"}>
                    {dayItems.length} {dayItems.length > 1 ? "créneaux" : "créneau"}
                  </Badge>
                </div>

                {dayItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <p>Aucun créneau planifié ce jour</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayItems.map((i) => {
                      const isInfo = i.formation === "informatique";
                      const nbStudents = studentsOfSchedule(db, i).length;
                      return (
                        <div
                          key={i.id}
                          className={cn(
                            "rounded-2xl border p-4 transition-all duration-200 shadow-md",
                            isInfo
                              ? "border-red-500/30 bg-gradient-to-br from-red-950/20 to-[#070E20] hover:border-red-500/50"
                              : "border-cyan-400/30 bg-gradient-to-br from-cyan-950/20 to-[#070E20] hover:border-cyan-400/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1 font-mono text-xs font-bold text-cyan-200">
                              <Clock size={12} className="text-cyan-400" />
                              {i.heureDebut} — {i.heureFin}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setViewingItem(i)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-cyan-300 transition"
                                title="Voir les détails et apprenants"
                              >
                                <Eye size={15} />
                              </button>
                              {user?.role !== "teacher" && (
                                <button
                                  type="button"
                                  onClick={() => deleteSchedule(i.id)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition"
                                  title="Supprimer ce créneau"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="mt-2.5">
                            <div className="flex items-center gap-2">
                              {modCode(i.moduleId) && (
                                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                                  {modCode(i.moduleId)}
                                </span>
                              )}
                              <p className="text-sm font-black text-white leading-snug">{modName(i.moduleId)}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 border-t border-white/5 pt-2.5">
                            <span className="flex items-center gap-1.5 text-slate-200">
                              <GraduationCap size={13} className="text-cyan-400" />
                              <strong>{tName(i.teacherId)}</strong>
                            </span>
                            {i.salle && (
                              <span className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-amber-300">
                                <MapPin size={11} /> {i.salle}
                              </span>
                            )}
                            <span className={cn("font-semibold", isInfo ? "text-red-400" : "text-cyan-300")}>
                              {formationLabel(i.formation)}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Users size={12} /> {nbStudents} inscrit(s)
                            </span>
                          </div>

                          {i.groupe && (
                            <p className="mt-2 text-[11px] font-semibold text-cyan-300">
                              Groupe : {i.groupe}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* VUE 2 : GRAND TABLEAU DE PLANNING (Agrandie & Ultra-Lisible) */}
      {viewMode === "table" && (
        <Card className="overflow-hidden border-white/10 bg-[#081024]/90 p-0 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <th className="px-5 py-4">Jour & Horaires</th>
                  <th className="px-5 py-4">Module d'Enseignement</th>
                  <th className="px-5 py-4">Enseignant</th>
                  <th className="px-5 py-4">Salle</th>
                  <th className="px-5 py-4">Filière</th>
                  <th className="px-5 py-4">Cible / Effectif</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Aucun créneau d'emploi du temps trouvé pour les filtres sélectionnés.
                    </td>
                  </tr>
                ) : (
                  items
                    .sort((a, b) => {
                      const dayOrder: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6 };
                      const dComp = (dayOrder[a.jour] || 99) - (dayOrder[b.jour] || 99);
                      return dComp !== 0 ? dComp : a.heureDebut.localeCompare(b.heureDebut);
                    })
                    .map((item) => {
                      const isInfo = item.formation === "informatique";
                      const nbStudents = studentsOfSchedule(db, item).length;
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.03] transition">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-white text-sm">{item.jour}</span>
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-cyan-300">
                                <Clock size={12} /> {item.heureDebut} - {item.heureFin}
                              </span>
                              {item.date && <span className="text-[10px] text-slate-400">{item.date}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="max-w-xs">
                              <p className="font-black text-white text-sm leading-tight">{modName(item.moduleId)}</p>
                              {modCode(item.moduleId) && (
                                <span className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                  {modCode(item.moduleId)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 font-bold text-xs border border-cyan-400/20">
                                {tName(item.teacherId).charAt(0)}
                              </div>
                              <span className="font-bold text-white">{tName(item.teacherId)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {item.salle ? (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                                <MapPin size={12} /> {item.salle}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <Badge color={isInfo ? "red" : "cyan"}>
                              {formationLabel(item.formation)}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-300">
                                <Users size={13} className="text-cyan-400" /> {nbStudents} apprenant(s)
                              </span>
                              {item.groupe && (
                                <span className="text-[11px] text-cyan-300 font-medium">Groupe : {item.groupe}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingItem(item)}
                                className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300 transition"
                                title="Voir les apprenants"
                              >
                                <Eye size={15} />
                              </button>
                              {user?.role !== "teacher" && (
                                <button
                                  type="button"
                                  onClick={() => deleteSchedule(item.id)}
                                  className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/20 transition"
                                  title="Supprimer ce créneau"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {user?.role !== "teacher" && (
        <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau créneau" wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Jour">
                <Select value={form.jour} onChange={(e) => setForm({ ...form, jour: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</Select>
              </Field>
              <Field label="Date (optionnelle)"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Heure début"><Input type="time" value={form.heureDebut} onChange={(e) => setForm({ ...form, heureDebut: e.target.value })} /></Field>
              <Field label="Heure fin"><Input type="time" value={form.heureFin} onChange={(e) => setForm({ ...form, heureFin: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Formation">
                <Select value={form.formation} onChange={(e) => setForm({ ...form, formation: e.target.value, moduleId: "" })}>
                  <option value="informatique">Génie Informatique</option><option value="industriel">Génie Industriel</option>
                </Select>
              </Field>
              <Field label="Salle"><Input value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} placeholder="ex: Salle 01" /></Field>
            </div>
            <Field label="Module">
              <Select value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}>
                <option value="">— Choisir —</option>
                {db.modules.filter((m) => m.formation === form.formation).map((m) => <option key={m.id} value={m.id}>{m.numero}. {m.titre}</option>)}
              </Select>
            </Field>
            <Field label="Enseignant">
              <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">— Choisir —</option>
                {db.teachers.filter((t) => !form.moduleId || t.modules.includes(form.moduleId)).map((t) => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
              </Select>
            </Field>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Apprenants concernés ({targetStudents.length} par défaut)</p>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {([
                  { k: "module", l: "Tous ceux du module" },
                  { k: "groupe", l: "Un groupe précis" },
                  { k: "apprenants", l: "Ciblage précis" },
                ] as const).map((o) => (
                  <button type="button" key={o.k} onClick={() => setForm({ ...form, cibleType: o.k })}
                    className={cn("rounded-xl border px-3 py-2 text-xs font-bold",
                      form.cibleType === o.k ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                    {o.l}
                  </button>
                ))}
              </div>
              {form.cibleType === "groupe" && (
                <Field label="Nom du groupe"><Input value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} placeholder="ex: Groupe A" /></Field>
              )}
              {form.cibleType === "apprenants" && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/5 p-2">
                  {targetStudents.length === 0 && <p className="p-2 text-xs text-slate-500">Aucun apprenant inscrit à ce module.</p>}
                  {targetStudents.map((s) => {
                    const on = form.studentIds.includes(s.id);
                    return (
                      <button type="button" key={s.id}
                        onClick={() => setForm({ ...form, studentIds: on ? form.studentIds.filter((x: string) => x !== s.id) : [...form.studentIds, s.id] })}
                        className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs",
                          on ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                        <input type="checkbox" readOnly checked={on} className="pointer-events-none" />
                        <span className="font-mono text-[10px] text-slate-500">{s.id}</span> {s.prenom} {s.nom}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setCreating(false)} disabled={savingSlot}>Annuler</Btn>
              <Btn onClick={save} disabled={savingSlot}>{savingSlot ? "Enregistrement en cours..." : "Ajouter le créneau"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={!!viewingItem} onClose={() => setViewingItem(null)} title={viewingItem ? `Créneau — ${modName(viewingItem.moduleId)}` : ""}>
        {viewingItem && (() => {
          const targets = studentsOfSchedule(db, viewingItem);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Jour / heures" value={`${viewingItem.jour}${viewingItem.date ? ` (${viewingItem.date})` : ""} • ${viewingItem.heureDebut}–${viewingItem.heureFin}`} />
                <Info label="Formateur" value={(() => { const t = db.teachers.find((x) => x.id === viewingItem.teacherId); return t ? `${t.prenom} ${t.nom}` : "—"; })()} />
                <Info label="Salle" value={viewingItem.salle || "—"} />
                <Info label="Formation" value={formationLabel(viewingItem.formation)} />
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Apprenants concernés ({targets.length})</p>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {targets.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs">
                      <span className="font-semibold text-slate-200">{s.prenom} {s.nom}</span>
                      <span className="font-mono text-[10px] text-cyan-300/70">{s.id}</span>
                    </div>
                  ))}
                  {targets.length === 0 && <p className="text-xs text-slate-500">Personne n'est concerné par ce créneau.</p>}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-bold text-slate-200">{value}</p>
    </div>
  );
}

/* ================= PRÉSENCES ================= */
export function AttendancePage() {
  const { db, user, update, log } = useStore();
  const [date, setDate] = useState(today());
  const [moduleId, setModuleId] = useState("");
  const [salle, setSalle] = useState("Salle 01");
  const [status, setStatus] = useState<Record<string, AttendanceStatus>>({});

  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const allowedModules = db.modules.filter((m) => (teacher ? teacher.modules.includes(m.id) : true));
  const mod = db.modules.find((m) => m.id === moduleId);
  const students = db.students.filter((s) => (mod ? s.modules.includes(mod.id) : true) && s.statut === "actif");

  const existing = db.attendance.filter((a) => a.date === date && a.moduleId === moduleId);

  const saveAll = () => {
    const recs = students.map((s) => ({
      id: uid("ATT"), studentId: s.id, date, moduleId, statut: status[s.id] ?? "present",
      heure: new Date().toTimeString().slice(0, 5), salle, teacherId: teacher?.id ?? user!.id,
    }));
    update((d) => ({
      ...d,
      attendance: [...d.attendance.filter((a) => !(a.date === date && a.moduleId === moduleId)), ...recs],
    }));
    log(`Présences enregistrées : ${recs.filter((r) => r.statut === "present").length} présents sur ${recs.length}`);
  };

  return (
    <div>
      <PageHead title="Gestion des présences" subtitle="QR Code ou validation manuelle par l'enseignant" />
      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Module">
            <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="">Tous les modules</option>
              {allowedModules.map((m) => <option key={m.id} value={m.id}>{formationLabel(m.formation)} — {m.numero}. {m.titre}</option>)}
            </Select>
          </Field>
          <Field label="Salle"><Input value={salle} onChange={(e) => setSalle(e.target.value)} /></Field>
          <div className="flex items-end"><Btn onClick={saveAll} className="w-full"><Save size={16} /> Enregistrer {existing.length ? `(${existing.length} déjà)` : ""}</Btn></div>
        </div>
      </Card>

      {students.length === 0 ? (
        <Empty icon={<ClipboardCheck size={40} />} title="Aucun apprenant pour cette sélection" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Formation</th>
                <th className="px-4 py-3">Statut enregistré</th>
                <th className="px-4 py-3 text-right">Définir le statut</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const rec = existing.find((a) => a.studentId === s.id);
                const cur = status[s.id] ?? rec?.statut ?? "present";
                return (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                      <p className="font-mono text-[10px] text-slate-500">{s.id}</p>
                    </td>
                    <td className="px-4 py-3"><Badge color={s.formation === "informatique" ? "red" : "cyan"}>{formationLabel(s.formation)}</Badge></td>
                    <td className="px-4 py-3">
                      {rec ? (
                        <Badge color={rec.statut === "present" ? "green" : rec.statut === "retard" ? "gold" : "red"}>{rec.statut}</Badge>
                      ) : <span className="text-xs text-slate-600">Non enregistré</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {(["present", "retard", "absent"] as AttendanceStatus[]).map((st) => (
                          <button key={st} onClick={() => setStatus({ ...status, [s.id]: st })}
                            className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase transition-all",
                              cur === st
                                ? st === "present" ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                                : st === "retard" ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                                : "border-red-500/60 bg-red-500/10 text-red-400"
                                : "border-white/10 text-slate-500 hover:bg-white/5")}>
                            {st === "present" ? <CheckCircle2 size={13} className="inline" /> : st === "retard" ? <Timer size={13} className="inline" /> : <XCircle size={13} className="inline" />} {st}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ================= COURS ================= */
export function CoursesPage() {
  const { db, user, update, log, notify } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [filter, setFilter] = useState("");

  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const allowedModules = db.modules.filter((m) => (teacher ? teacher.modules.includes(m.id) : true));
  const courses = db.courses
    .filter((c) => (teacher ? allowedModules.some((m) => m.id === c.moduleId) : true))
    .filter((c) => !filter || c.moduleId === filter);

  const blankForm = () => ({
    titre: "", description: "", moduleId: "", type: "cours", content: "",
    formation: "" as any, audience: "module" as "module" | "groupe" | "apprenants",
    groupe: "", studentIds: [] as string[], files: [] as any[], publie: true,
  });
  const [form, setForm] = useState<any>(blankForm());

  const modulesOfForm = form.formation
    ? allowedModules.filter((m) => m.formation === form.formation)
    : allowedModules;
  const targetableStudents = db.students.filter(
    (s) => (!form.formation || s.formation === form.formation) && (!form.moduleId || s.modules.includes(form.moduleId))
  );

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    for (const f of list) {
      try {
        const cf = await ingestFile(f);
        setForm((prev: any) => ({ ...prev, files: [...prev.files, cf] }));
      } catch (err: any) {
        toastMsg.error(`Fichier refusé : ${f.name}`, err.message || "Fichier invalide");
      }
    }
    // reset input
    e.target.value = "";
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      titre: c.titre, description: c.description, moduleId: c.moduleId, type: c.type, content: c.content,
      formation: c.formation ?? db.modules.find((m) => m.id === c.moduleId)?.formation ?? "",
      audience: c.audience ?? "module", groupe: c.groupe ?? "", studentIds: c.studentIds ?? [],
      files: c.files ?? [], publie: c.publie ?? true,
    });
    setCreating(true);
  };

  const save = async () => {
    if (!form.titre || !form.moduleId) return;
    const t = teacher ?? db.teachers.find((x) => x.modules.includes(form.moduleId)) ?? db.teachers[0];
    const module = db.modules.find((m) => m.id === form.moduleId);
    const payload = {
      titre: form.titre.trim(), description: form.description, moduleId: form.moduleId, type: form.type, content: form.content,
      formation: module?.formation, audience: form.audience,
      groupe: form.audience === "groupe" ? form.groupe : undefined,
      studentIds: form.audience === "apprenants" ? form.studentIds : undefined,
      files: form.files, publie: form.publie,
    };

    if (isSupabaseConfigured) {
      try {
        const isModUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.moduleId);
        const { data: modData } = isModUuid ? await supabase.from("modules").select("id").eq("id", form.moduleId).maybeSingle() : { data: null };
        const realModuleId = modData?.id || null;

        if (editing) {
          await supabase.from("courses").update({
            titre: form.titre.trim(),
            description: form.description || "",
            module_id: realModuleId,
            teacher_id: t?.id || null,
            type: form.type || "cours",
            content: form.content || "",
            audience: form.audience || "module",
            publie: form.publie ?? true,
          }).eq("id", editing.id);

          if (form.files?.length) {
            await supabase.from("course_files").delete().eq("course_id", editing.id);
            await supabase.from("course_files").insert(form.files.map((f: any) => ({
              course_id: editing.id,
              nom: f.name || f.originalName,
              taille: f.size,
              type: f.mime,
              url: f.dataUrl,
            })));
          }
          toastMsg.success("Support mis à jour côté serveur ✓");
        } else {
          const { data: newCourse, error: cErr } = await supabase.from("courses").insert({
            titre: form.titre.trim(),
            description: form.description || "",
            module_id: realModuleId,
            teacher_id: t?.id || null,
            type: form.type || "cours",
            content: form.content || "",
            audience: form.audience || "module",
            publie: form.publie ?? true,
          }).select("id").single();
          if (cErr) throw cErr;

          if (form.files?.length && newCourse?.id) {
            await supabase.from("course_files").insert(form.files.map((f: any) => ({
              course_id: newCourse.id,
              nom: f.name || f.originalName,
              taille: f.size,
              type: f.mime,
              url: f.dataUrl,
            })));
          }
          toastMsg.success("Nouveau support publié côté serveur ✓");
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur enregistrement support", err.message);
      }
    }

    if (editing) {
      update((d) => ({ ...d, courses: d.courses.map((x) => (x.id === editing.id ? { ...x, ...payload } : x)) }));
      log(`Cours modifié : ${form.titre}`);
    } else {
      const id = uid("CRS");
      update((d) => ({ ...d, courses: [{ id, ...payload, teacherId: t?.id ?? "", date: today() } as any, ...d.courses] }));
      log(`Cours publié : ${form.titre}${form.files.length ? ` (${form.files.length} fichier(s))` : ""}`);
      if (form.publie) notifyTargets(payload.audience, module?.id, payload.groupe, payload.studentIds, form.titre);
    }
    setCreating(false); setEditing(null); setForm(blankForm());
  };

  const deleteCourse = async (courseId: string, courseTitle: string) => {
    if (!confirm(`Supprimer « ${courseTitle} » ?`)) return;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("courses").delete().eq("id", courseId);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.info("Support supprimé du serveur");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== courseId) }));
    log(`Cours supprimé : ${courseTitle}`);
  };

  const notifyTargets = (audience: string, modId?: string, groupe?: string, studentIds?: string[], title = "") => {
    const targets = db.students.filter((s) => {
      if (audience === "apprenants") return studentIds?.includes(s.id);
      if (audience === "groupe") return s.groupe === groupe;
      return modId ? s.modules.includes(modId) : false;
    });
    targets.forEach((s) => {
      if (s.userId) notify(s.userId, "Nouveau cours publié", title, "info");
    });
  };

  const togglePublish = async (c: any) => {
    const newStatus = !(c.publie ?? true);
    if (isSupabaseConfigured) {
      try {
        await supabase.from("courses").update({ publie: newStatus }).eq("id", c.id);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch {}
    }
    update((d) => ({ ...d, courses: d.courses.map((x) => (x.id === c.id ? { ...x, publie: newStatus } : x)) }));
    log(`${newStatus ? "Publication" : "Dépublication"} : ${c.titre}`);
  };

  return (
    <div>
      <PageHead title="Cours & Supports" subtitle="Bibliothèque pédagogique avec téléversement de fichiers et ciblage précis"
        actions={<Btn onClick={() => { setForm(blankForm()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Publier un cours</Btn>} />

      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setFilter("")} className={cn("rounded-xl border px-4 py-2 text-xs font-bold", !filter ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400")}>Tous</button>
        {allowedModules.map((m) => (
          <button key={m.id} onClick={() => setFilter(m.id)} className={cn("rounded-xl border px-4 py-2 text-xs font-bold", filter === m.id ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400")}>
            {m.numero}. {m.titre}
          </button>
        ))}
      </div>

      {courses.length === 0 ? (
        <Empty icon={<FileText size={40} />} title="Aucun cours publié" sub="Cliquez sur « Publier un cours » pour commencer." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => {
            const mod = db.modules.find((m) => m.id === c.moduleId);
            const targets = studentsOfCourse(db, c as any);
            const files = c.files ?? [];
            return (
              <Card key={c.id} className="p-5" glow="cyan">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge color={c.type === "cours" ? "cyan" : c.type === "devoir" ? "gold" : "green"}>{c.type}</Badge>
                    {c.publie === false && <Badge color="red">Brouillon</Badge>}
                  </div>
                  <span className="text-[10px] text-slate-500">{c.date}</span>
                </div>
                <h4 className="font-display text-base font-bold text-white">{c.titre}</h4>
                {c.description && <p className="mt-1 text-sm text-slate-400">{c.description}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <BookOpen size={13} className="text-cyan-300" />
                  <span className="text-xs font-semibold text-slate-300">{mod ? `${mod.numero}. ${mod.titre}` : "—"}</span>
                </div>
                {files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {files.map((f: any) => (
                      <span key={f.id} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300">
                        <FileText size={10} /> {fileKind(f.mime, f.originalName)} · {humanSize(f.size)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <Users size={11} /> {targets.length} destinataire(s)
                  {(c as any).audience === "groupe" && (c as any).groupe && <span className="text-cyan-400">• Groupe : {(c as any).groupe}</span>}
                  {(c as any).audience === "apprenants" && <span className="text-cyan-400">• Ciblage précis</span>}
                </div>
                <div className="mt-3 flex justify-between border-t border-white/5 pt-3">
                  <span className="text-[11px] text-slate-500">{db.teachers.find((t) => t.id === c.teacherId)?.prenom} {db.teachers.find((t) => t.id === c.teacherId)?.nom}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setViewing(c)} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Voir"><Eye size={13} /></button>
                    <button onClick={() => togglePublish(c)} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-amber-400/40 hover:text-amber-300" title={c.publie === false ? "Publier" : "Dépublier"}>{c.publie === false ? <BookOpen size={13} /> : <FileText size={13} />}</button>
                    <button onClick={() => openEdit(c)} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Modifier"><Pencil size={13} /></button>
                    <button onClick={() => deleteCourse(c.id, c.titre)} className="text-slate-500 hover:text-red-400" title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal éditer / créer */}
      <Modal open={creating} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? `Modifier — ${editing.titre}` : "Publier un cours / document"} wide>
        <div className="space-y-4">
          <Field label="Titre"><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Formation">
              <Select value={form.formation} onChange={(e) => setForm({ ...form, formation: e.target.value, moduleId: "" })}>
                <option value="">Toutes</option>
                <option value="informatique">Génie Informatique</option>
                <option value="industriel">Génie Industriel</option>
              </Select>
            </Field>
            <Field label="Module">
              <Select value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}>
                <option value="">— Choisir —</option>
                {modulesOfForm.map((m) => <option key={m.id} value={m.id}>{formationLabel(m.formation)} — {m.numero}. {m.titre}</option>)}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="cours">Cours</option><option value="document">Document</option><option value="devoir">Devoir</option>
              </Select>
            </Field>
          </div>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Contenu / Consignes"><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>

          {/* Fichiers */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Fichiers joints ({form.files.length})</p>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"><Upload size={13} /> Ajouter des fichiers</span>
                <input type="file" multiple onChange={onFiles} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv" />
              </label>
            </div>
            {form.files.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun fichier. Formats acceptés : PDF, Word, Excel, PowerPoint, images. Taille max : 8 Mo par fichier.</p>
            ) : (
              <div className="space-y-1.5">
                {form.files.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-300">
                      <FileText size={13} className="text-cyan-300" />
                      <span className="font-semibold">{f.originalName}</span>
                      <span className="text-slate-500">· {fileKind(f.mime, f.originalName)} · {humanSize(f.size)}</span>
                    </span>
                    <button onClick={() => setForm({ ...form, files: form.files.filter((x: any) => x.id !== f.id) })} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ciblage */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Destinataires</p>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {([
                { k: "module", l: "Tous les apprenants du module" },
                { k: "groupe", l: "Un groupe précis" },
                { k: "apprenants", l: "Apprenants spécifiques" },
              ] as const).map((o) => (
                <button key={o.k} type="button" onClick={() => setForm({ ...form, audience: o.k })}
                  className={cn("rounded-xl border px-3 py-2.5 text-left text-xs font-bold",
                    form.audience === o.k ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                  {o.l}
                </button>
              ))}
            </div>
            {form.audience === "groupe" && (
              <Field label="Nom du groupe"><Input value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} placeholder="ex: Groupe A" /></Field>
            )}
            {form.audience === "apprenants" && (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/5 p-2">
                {targetableStudents.length === 0 && <p className="p-2 text-xs text-slate-500">Aucun apprenant compatible avec la formation/module choisis.</p>}
                {targetableStudents.map((s) => {
                  const on = form.studentIds.includes(s.id);
                  return (
                    <button type="button" key={s.id}
                      onClick={() => setForm({ ...form, studentIds: on ? form.studentIds.filter((x: string) => x !== s.id) : [...form.studentIds, s.id] })}
                      className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs",
                        on ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                      <input type="checkbox" readOnly checked={on} className="pointer-events-none" />
                      <span className="font-mono text-[10px] text-slate-500">{s.id}</span> {s.prenom} {s.nom}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.publie} onChange={(e) => setForm({ ...form, publie: e.target.checked })} />
            Publier immédiatement (sinon enregistré en brouillon)
          </label>

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>Annuler</Btn>
            <Btn onClick={save}>{editing ? "Enregistrer" : "Publier"}</Btn>
          </div>
        </div>
      </Modal>

      {/* Voir + destinataires */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.titre ?? ""} wide>
        {viewing && (() => {
          const targets = studentsOfCourse(db, viewing);
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge color={viewing.type === "cours" ? "cyan" : viewing.type === "devoir" ? "gold" : "green"}>{viewing.type}</Badge>
                {viewing.publie === false && <Badge color="red">Brouillon</Badge>}
                <Badge color="gray">{db.modules.find((m) => m.id === viewing.moduleId)?.titre ?? "—"}</Badge>
              </div>
              {viewing.description && <p className="text-sm text-slate-300">{viewing.description}</p>}
              {viewing.content && <p className="whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-3 font-mono text-[11px] text-slate-400">{viewing.content}</p>}
              {(viewing.files ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Fichiers ({viewing.files.length})</p>
                  <div className="space-y-1.5">
                    {viewing.files.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                        <span className="flex items-center gap-2 text-slate-300">
                          <FileText size={14} className="text-cyan-300" />
                          <span className="font-semibold">{f.originalName}</span>
                          <span className="text-slate-500">· {fileKind(f.mime, f.originalName)} · {humanSize(f.size)}</span>
                        </span>
                        <div className="flex gap-1.5">
                          {f.mime?.startsWith("image/") && <a href={f.dataUrl} target="_blank" rel="noreferrer" className="rounded border border-white/10 px-2 py-1 text-cyan-300 hover:bg-white/5">Aperçu</a>}
                          <button onClick={() => downloadFile(f)} className="rounded border border-cyan-400/40 px-2 py-1 text-cyan-300 hover:bg-cyan-400/10">Télécharger</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Destinataires ({targets.length})</p>
                {targets.length === 0 ? <p className="text-xs text-slate-500">Aucun apprenant destinataire.</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {targets.map((s) => <span key={s.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300">{s.prenom} {s.nom}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

/* ================= TESTS ================= */
export function TestsPage() {
  const { db, user, update, log } = useStore();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [resultsFor, setResultsFor] = useState<any>(null);
  const blankTest = () => ({ titre: "", moduleId: "", chapitreId: "", duree: 45, bareme: 20, difficulte: "moyen", tentatives: 1, afficherCorrections: true, validationRequise: false, dateDebut: today(), dateFin: "", questions: [] as any[] });
  const [form, setForm] = useState<any>(blankTest());
  const [q, setQ] = useState<any>({ question: "", type: "qcm", options: ["", ""], bonneReponse: "", points: 4, explication: "" });

  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const allowedModules = db.modules.filter((m) => (teacher ? teacher.modules.includes(m.id) : true));
  const tests = db.tests.filter((t) => (teacher ? allowedModules.some((m) => m.id === t.moduleId) : true));
  const selectedModule = db.modules.find((m) => m.id === form.moduleId);

  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "—";

  const addQuestion = () => {
    if (!q.question) return;
    setForm({ ...form, questions: [...form.questions, { id: uid("Q"), ...q, options: q.type === "qcm" ? q.options : q.type === "vf" ? ["Vrai", "Faux"] : [] }] });
    setQ({ question: "", type: "qcm", options: ["", ""], bonneReponse: "", points: 4, explication: "" });
  };

  const saveTest = () => {
    if (!form.titre || form.questions.length === 0) return;
    const t = teacher ?? db.teachers[0];
    update((d) => ({ ...d, tests: [{ id: uid("TST"), ...form, teacherId: t?.id ?? "", date: today() }, ...d.tests] }));
    update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: "all", title: `Test disponible : ${form.titre}`, body: "Un nouveau test d'évaluation est en ligne.", date: today(), lu: false, type: "test" }, ...d.notifications] }));
    log(`Test créé : ${form.titre} (${form.questions.length} questions)`);
    setCreating(false); setForm(blankTest());
  };

  const totalPoints = (test: any) => test.questions.reduce((a: number, x: any) => a + (x.points || 0), 0);

  return (
    <div>
      <PageHead title="Tests & Évaluations" subtitle="QCM, vrai/faux et questions courtes"
        actions={<Btn onClick={() => { setForm(blankTest()); setCreating(true); }}><PlusCircle size={16} /> Créer un test</Btn>} />
      {tests.length === 0 ? (
        <Empty icon={<TestTube2 size={40} />} title="Aucun test créé" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((t) => (
            <Card key={t.id} className="p-5" glow="red">
              <div className="flex items-center justify-between">
                <Badge color="red">Test</Badge>
                <span className="text-[10px] text-slate-500">{t.date}</span>
              </div>
              <h4 className="font-display mt-2 text-base font-bold text-white">{t.titre}</h4>
              <p className="mt-1 text-xs text-slate-400">{modName(t.moduleId)}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><FileText size={12} /> {t.questions.length} questions</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {t.duree} min</span>
                <span className="flex items-center gap-1"><PenLine size={12} /> /{totalPoints(t)} pts</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Btn variant="outline" className="flex-1" onClick={() => setViewing(t)}><Eye size={14} /> Voir</Btn>
                <Btn variant="ghost" onClick={() => setResultsFor(t)}><CheckCircle2 size={14} /></Btn>
                <Btn variant="ghost" onClick={() => update((d) => ({ ...d, tests: d.tests.filter((x) => x.id !== t.id) }))}><Trash2 size={14} /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Créer un test" wide>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Titre" ><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Field>
            <Field label="Module">
              <Select value={form.moduleId} onChange={(e) => setForm({ ...form, moduleId: e.target.value })}>
                <option value="">— Choisir —</option>
                {allowedModules.map((m) => <option key={m.id} value={m.id}>{m.numero}. {m.titre}</option>)}
              </Select>
            </Field>
            <Field label="Durée (min)"><Input type="number" value={form.duree} onChange={(e) => setForm({ ...form, duree: +e.target.value })} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chapitre concerné">
              <Select value={form.chapitreId} onChange={(e) => setForm({ ...form, chapitreId: e.target.value })}>
                <option value="">Tout le module</option>
                {(selectedModule?.chapitres ?? []).map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </Select>
            </Field>
            <Field label="Barème (note max)"><Input type="number" value={form.bareme} onChange={(e) => setForm({ ...form, bareme: +e.target.value })} /></Field>
            <Field label="Difficulté">
              <Select value={form.difficulte} onChange={(e) => setForm({ ...form, difficulte: e.target.value })}>
                <option value="facile">Facile</option><option value="moyen">Moyen</option><option value="difficile">Difficile</option>
              </Select>
            </Field>
            <Field label="Date de début"><Input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} /></Field>
            <Field label="Date de fin"><Input type="date" value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} /></Field>
            <Field label="Tentatives autorisées"><Input type="number" value={form.tentatives} onChange={(e) => setForm({ ...form, tentatives: +e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.afficherCorrections} onChange={(e) => setForm({ ...form, afficherCorrections: e.target.checked })} /> Afficher les corrections aux apprenants
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.validationRequise} onChange={(e) => setForm({ ...form, validationRequise: e.target.checked })} /> Résultat visible seulement après validation du formateur
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Ajouter une question</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Question"><Input value={q.question} onChange={(e) => setQ({ ...q, question: e.target.value })} /></Field>
              <Field label="Type">
                <Select value={q.type} onChange={(e) => setQ({ ...q, type: e.target.value, options: e.target.value === "qcm" ? ["", ""] : e.target.value === "vf" ? ["Vrai", "Faux"] : [] })}>
                  <option value="qcm">QCM</option><option value="vf">Vrai / Faux</option><option value="courte">Réponse courte</option>
                </Select>
              </Field>
              {q.type === "qcm" && (
                <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Input key={i} placeholder={`Option ${i + 1}`} value={q.options[i] ?? ""}
                      onChange={(e) => setQ({ ...q, options: q.options.map((o: string, j: number) => (j === i ? e.target.value : o)) })} />
                  ))}
                </div>
              )}
              <Field label="Bonne réponse">
                {q.type === "qcm" || q.type === "vf" ? (
                  <Select value={q.bonneReponse} onChange={(e) => setQ({ ...q, bonneReponse: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {(q.type === "vf" ? ["Vrai", "Faux"] : q.options.filter(Boolean)).map((o: string) => <option key={o}>{o}</option>)}
                  </Select>
                ) : (
                  <Input value={q.bonneReponse} onChange={(e) => setQ({ ...q, bonneReponse: e.target.value })} placeholder="Réponse attendue" />
                )}
              </Field>
              <Field label="Points"><Input type="number" value={q.points} onChange={(e) => setQ({ ...q, points: +e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Explication (affichée dans la correction)"><Input value={q.explication} onChange={(e) => setQ({ ...q, explication: e.target.value })} placeholder="Pourquoi cette réponse est correcte..." /></Field>
              </div>
            </div>
            <Btn variant="outline" className="mt-3" onClick={addQuestion}><PlusCircle size={14} /> Ajouter la question</Btn>
          </div>

          {form.questions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-300">{form.questions.length} question(s) ajoutée(s)</p>
              <div className="space-y-1.5">
                {form.questions.map((x: any, i: number) => (
                  <div key={x.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="text-slate-300">{i + 1}. {x.question}</span>
                    <div className="flex items-center gap-2">
                      <Badge color="gray">{x.type}</Badge>
                      <span className="text-xs text-slate-500">{x.points} pts</span>
                      <button onClick={() => setForm({ ...form, questions: form.questions.filter((y: any) => y.id !== x.id) })} className="text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={saveTest} disabled={form.questions.length === 0}><Save size={15} /> Enregistrer le test</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.titre} wide>
        {viewing && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">{modName(viewing.moduleId)} • {viewing.questions.length} questions • {viewing.duree} min</p>
            {viewing.questions.map((x: any, i: number) => (
              <div key={x.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm font-bold text-white">{i + 1}. {x.question} <span className="ml-1 text-xs font-normal text-slate-500">({x.points} pts)</span></p>
                {x.options && x.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {x.options.map((o: string) => (
                      <span key={o} className={cn("rounded-lg border px-2.5 py-1 text-xs", o === x.bonneReponse ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-400")}>{o}</span>
                    ))}
                  </div>
                )}
                {x.type === "courte" && <p className="mt-2 text-xs text-slate-500">Réponse attendue : <span className="font-mono text-emerald-300">{x.bonneReponse}</span></p>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Résultats & validation */}
      <Modal open={!!resultsFor} onClose={() => setResultsFor(null)} title={resultsFor ? `Résultats — ${resultsFor.titre}` : ""} wide>
        {resultsFor && (() => {
          const results = db.results.filter((r) => r.testId === resultsFor.id);
          const bareme = resultsFor.bareme ?? 20;
          const seuil = bareme / 2;
          if (results.length === 0) return <Empty icon={<TestTube2 size={36} />} title="Aucun apprenant n'a encore passé ce test" />;
          return (
            <div className="space-y-2">
              <p className="mb-2 text-xs text-slate-500">{results.length} résultat(s) • Barème /{bareme} • {resultsFor.validationRequise ? "Validation requise avant affichage aux apprenants" : "Corrections visibles automatiquement"}</p>
              {results.map((r) => {
                const s = db.students.find((x) => x.id === r.studentId);
                const reussi = r.note >= seuil;
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                    <div>
                      <p className="text-sm font-bold text-white">{s ? `${s.prenom} ${s.nom}` : r.studentId}</p>
                      <p className="text-[11px] text-slate-500">{r.date}{r.heure ? ` à ${r.heure}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={reussi ? "green" : "red"}>{r.note}/{bareme}</Badge>
                      <Badge color="cyan">{r.pourcentage}%</Badge>
                      <Badge color={reussi ? "green" : "red"}>{reussi ? "Réussi" : "Échoué"}</Badge>
                      {r.valide ? <Badge color="green">Validé</Badge> : (
                        <Btn variant="outline" onClick={() => { update((d) => ({ ...d, results: d.results.map((x) => x.id === r.id ? { ...x, valide: true } : x) })); log(`Résultat validé : ${s?.prenom} ${s?.nom} — ${r.note}/${bareme}`); }}>
                          <CheckCircle2 size={13} /> Valider
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

/* ================= NOTES ================= */
export function GradesPage() {
  const { db, user, update, log } = useStore();
  const [moduleId, setModuleId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [appr, setAppr] = useState<Record<string, string>>({});

  const teacher = user?.role === "teacher" ? db.teachers.find((t) => t.userId === user.id) : null;
  const allowedModules = db.modules.filter((m) => (teacher ? teacher.modules.includes(m.id) : true));
  const mod = db.modules.find((m) => m.id === moduleId);
  const students = db.students.filter((s) => (mod ? s.modules.includes(mod.id) : true));
  const existing = db.grades.filter((g) => g.moduleId === moduleId);

  const save = () => {
    const recs = students
      .filter((s) => notes[s.id] !== undefined && notes[s.id] !== "")
      .map((s) => ({ id: uid("GRD"), studentId: s.id, moduleId, note: Math.min(20, Math.max(0, +notes[s.id])), appreciation: appr[s.id] || "—", date: today() }));
    update((d) => ({ ...d, grades: [...d.grades.filter((g) => !(g.moduleId === moduleId && recs.some((r) => r.studentId === g.studentId))), ...recs] }));
    log(`Notes enregistrées pour ${recs.length} apprenant(s)`);
  };

  return (
    <div>
      <PageHead title="Saisie des notes" subtitle="Notation sur 20 par module"
        actions={<Btn onClick={save}><Save size={16} /> Enregistrer les notes</Btn>} />
      <div className="mb-5 max-w-md">
        <Field label="Module">
          <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">— Choisir un module —</option>
            {allowedModules.map((m) => <option key={m.id} value={m.id}>{formationLabel(m.formation)} — {m.numero}. {m.titre}</option>)}
          </Select>
        </Field>
      </div>

      {!moduleId ? (
        <Empty icon={<PenLine size={40} />} title="Sélectionnez un module" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">Apprenant</th><th className="px-4 py-3">Note actuelle</th><th className="px-4 py-3">Note /20</th><th className="px-4 py-3">Appréciation</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const g = existing.find((x) => x.studentId === s.id);
                return (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                      <p className="font-mono text-[10px] text-slate-500">{s.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      {g ? <Badge color={g.note >= 10 ? "green" : "red"}>{g.note}/20</Badge> : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Input type="number" min={0} max={20} step={0.5} className="w-24" placeholder={g ? String(g.note) : "—"}
                        value={notes[s.id] ?? ""} onChange={(e) => setNotes({ ...notes, [s.id]: e.target.value })} />
                    </td>
                    <td className="px-4 py-3">
                      <Input className="w-40" placeholder={g?.appreciation || "Appréciation"} value={appr[s.id] ?? ""} onChange={(e) => setAppr({ ...appr, [s.id]: e.target.value })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ================= PAIEMENTS ================= */
export function PaymentsPage() {
  const { db, user, update, log } = useStore();
  const [studentId, setStudentId] = useState("");
  const [creatingPay, setCreatingPay] = useState(false);
  const [creatingInv, setCreatingInv] = useState(false);
  const [editingPay, setEditingPay] = useState<any>(null);
  const [deletingPay, setDeletingPay] = useState<any>(null);
  const [editingInv, setEditingInv] = useState<any>(null);
  const [deletingInv, setDeletingInv] = useState<any>(null);

  const [qPay, setQPay] = useState("");
  const [fMode, setFMode] = useState("");
  const [fDate, setFDate] = useState("");
  const [cancellingPay, setCancellingPay] = useState<any>(null);

  const blankPay = () => ({ invoiceId: "", type: "formation" as "inscription" | "formation", libelle: "", montant: 0, mode: "Espèces", observation: "" });
  const blankInv = () => ({ type: "formation" as "inscription" | "formation", libelle: "", montant: 0, dueDate: "" });
  const [payForm, setPayForm] = useState<any>(blankPay());
  const [invForm, setInvForm] = useState<any>(blankInv());

  const student = db.students.find((s) => s.id === studentId);
  const summary = studentId ? financialSummary(db, studentId) : null;
  const payments = summary ? [...summary.payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? ""))) : [];
  const invoices = summary?.invoices ?? [];

  const allPayments = useMemo(() => {
    return [...db.payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? "")));
  }, [db.payments]);

  const activePayments = useMemo(() => {
    return allPayments.filter((p) => !p.observation?.includes("[ANNULÉ]"));
  }, [allPayments]);

  const globalEncaisse = useMemo(() => {
    return activePayments.reduce((a, p) => a + p.montant, 0);
  }, [activePayments]);

  const allStudentSummaries = useMemo(() => {
    return db.students.map((s) => financialSummary(db, s.id));
  }, [db]);

  const globalDu = useMemo(() => {
    return allStudentSummaries.reduce((a, s) => a + s.totalDu, 0);
  }, [allStudentSummaries]);

  const globalSolde = useMemo(() => {
    return allStudentSummaries.reduce((a, s) => a + s.solde, 0);
  }, [allStudentSummaries]);

  const globalRetards = useMemo(() => {
    return allStudentSummaries.filter((s) => s.statut === "retard" || s.statut === "impaye").length;
  }, [allStudentSummaries]);

  const filteredGlobalPayments = useMemo(() => {
    return allPayments.filter((p) => {
      const s = db.students.find((x) => x.id === p.studentId);
      const str = `${p.reference || ""} ${p.libelle} ${p.studentId} ${s?.nom || ""} ${s?.prenom || ""}`.toLowerCase();
      if (qPay && !str.includes(qPay.toLowerCase())) return false;
      if (fMode && p.mode !== fMode) return false;
      if (fDate && p.date !== fDate) return false;
      return true;
    });
  }, [allPayments, db.students, qPay, fMode, fDate]);

  const confirmCancelPayment = async () => {
    if (!cancellingPay) return;
    const p = cancellingPay;
    const obs = `[ANNULÉ le ${today()} par ${user?.name || "Admin"}] ${p.observation || ""}`.trim();
    if (isSupabaseConfigured) {
      try {
        await supabase.from("payments").update({ observation: obs }).eq("id", p.id);
        await supabase.from("audit_logs").insert({
          user_id: user?.id || null,
          action: "CANCEL_PAYMENT",
          entity_type: "payments",
          entity_id: p.id,
          description: `Annulation du paiement ${p.reference || p.id} de ${money(p.montant)}`,
        });
        toastMsg.success("Paiement neutralisé et annulé avec succès ✓");
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
      } catch (err: any) {
        toastMsg.error("Erreur d'annulation", err.message);
        return;
      }
    } else {
      toastMsg.success("Paiement annulé en local ✓");
    }

    update((d) => ({
      ...d,
      payments: d.payments.map((x) => (x.id === p.id ? { ...x, observation: obs } : x)),
    }));
    log(`Paiement annulé : ${p.reference || p.id} (${money(p.montant)})`);
    setCancellingPay(null);
  };

  const exportTreasuryCSV = () => {
    const headers = ["Référence", "Apprenant ID", "Apprenant Nom", "Libellé", "Montant", "Mode", "Date", "Heure", "Encaissé par", "Statut / Observation"];
    const rows = filteredGlobalPayments.map((p) => {
      const s = db.students.find((x) => x.id === p.studentId);
      const isCancelled = p.observation?.includes("[ANNULÉ]");
      return [
        p.reference || p.id,
        p.studentId,
        s ? `${s.prenom} ${s.nom}` : "Inconnu",
        p.libelle,
        p.montant,
        p.mode,
        p.date,
        p.heure || "",
        p.createdByName || "",
        isCancelled ? "ANNULÉ" : "VALIDE",
      ];
    });
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tresorerie_sentinelles_${today()}.csv`;
    a.click();
    toastMsg.success("Export trésorerie CSV téléchargé ✓");
  };

  const savePayment = async () => {
    if (!studentId || !payForm.montant || payForm.montant <= 0) {
      toastMsg.error("Montant invalide", "Veuillez saisir un montant supérieur à 0.");
      return;
    }
    const now = new Date();
    const inv = payForm.invoiceId ? invoices.find((i) => i.id === payForm.invoiceId) : undefined;
    const libelle = payForm.libelle || (inv ? inv.libelle : payForm.type === "inscription" ? "Frais d'inscription" : "Paiement formation");
    const ref = nextReceiptRef(db);
    let newPaymentId = uid("PAY");

    if (isSupabaseConfigured) {
      try {
        const isUuidInvoice = inv?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv.id);
        const { data, error } = await supabase.from("payments").insert({
          student_id: studentId,
          invoice_id: isUuidInvoice ? inv.id : null,
          type: (inv?.type ?? payForm.type),
          libelle,
          montant: +payForm.montant,
          date: today(),
          heure: now.toTimeString().slice(0, 5),
          mode: payForm.mode,
          reference: ref,
          observation: payForm.observation || null,
          created_by: user?.id || null,
          created_by_name: user?.name || null,
        }).select("id").single();

        if (error) throw error;
        if (data?.id) newPaymentId = data.id;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "CREATE",
            entity_type: "payments",
            entity_id: newPaymentId,
            description: `Paiement enregistré ${ref} : ${student?.prenom} ${student?.nom} — ${money(+payForm.montant)} (${payForm.mode})`,
          });
        } catch { /* ignore audit failure */ }

        toastMsg.success("Paiement enregistré en base de données ✓");
      } catch (err: any) {
        console.error("Erreur enregistrement paiement:", err);
        toastMsg.error("Erreur enregistrement paiement", err.message || "Échec d'enregistrement");
        return;
      }
    } else {
      toastMsg.success("Paiement enregistré en local ✓");
    }

    const p = {
      id: newPaymentId, studentId, invoiceId: inv?.id, type: (inv?.type ?? payForm.type),
      libelle, montant: +payForm.montant, date: today(), heure: now.toTimeString().slice(0, 5),
      mode: payForm.mode, reference: ref, observation: payForm.observation || undefined,
      createdBy: user?.id, createdByName: user?.name,
    };
    update((d) => ({ ...d, payments: [p, ...d.payments.filter((x) => x.id !== p.id)] }));
    const newSummary = financialSummary({ ...db, payments: [p, ...db.payments] }, studentId);
    update((d) => ({ ...d, students: d.students.map((s) => (s.id === studentId ? { ...s, statutPaiement: (newSummary.statut === "retard" ? "partiel" : newSummary.statut) as any } : s)) }));
    if (student?.userId) update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: student.userId!, title: "Paiement enregistré", body: `${money(p.montant)} • ${p.mode} • Réf. ${ref}. Solde : ${money(newSummary.solde)}.`, date: today(), lu: false, type: "paiement" }, ...d.notifications] }));
    log(`Paiement enregistré ${ref} : ${student?.prenom} ${student?.nom} — ${money(p.montant)} (${p.mode})`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setPayForm(blankPay()); setCreatingPay(false);
  };

  const updatePayment = async () => {
    if (!editingPay || !editingPay.montant || editingPay.montant <= 0) {
      toastMsg.error("Montant invalide");
      return;
    }
    const p = editingPay;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("payments").update({
          libelle: p.libelle,
          montant: +p.montant,
          mode: p.mode,
          observation: p.observation || null,
        }).eq("id", p.id);
        if (error) throw error;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "UPDATE",
            entity_type: "payments",
            entity_id: p.id,
            description: `Modification paiement Réf. ${p.reference ?? p.id} : nouveau montant ${money(+p.montant)} (${p.mode})`,
          });
        } catch { /* ignore audit */ }
        toastMsg.success("Paiement mis à jour ✓");
      } catch (err: any) {
        console.error("Erreur modification paiement:", err);
        toastMsg.error("Erreur de modification", err.message);
        return;
      }
    } else {
      toastMsg.success("Paiement mis à jour en local ✓");
    }

    const updatedPayments = db.payments.map((x) => (x.id === p.id ? { ...x, ...p, montant: +p.montant } : x));
    update((d) => ({ ...d, payments: updatedPayments }));
    const newSummary = financialSummary({ ...db, payments: updatedPayments }, studentId);
    update((d) => ({ ...d, students: d.students.map((s) => (s.id === studentId ? { ...s, statutPaiement: (newSummary.statut === "retard" ? "partiel" : newSummary.statut) as any } : s)) }));
    log(`Paiement modifié ${p.reference ?? p.id} : ${money(+p.montant)}`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setEditingPay(null);
  };

  const confirmDeletePayment = async () => {
    if (!deletingPay) return;
    const p = deletingPay;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("payments").delete().eq("id", p.id);
        if (error) throw error;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "DELETE",
            entity_type: "payments",
            entity_id: p.id,
            description: `Suppression paiement Réf. ${p.reference ?? p.id} : ${student?.prenom} ${student?.nom} — ${money(p.montant)}`,
          });
        } catch { /* ignore audit */ }
        toastMsg.success("Paiement supprimé ✓");
      } catch (err: any) {
        console.error("Erreur suppression paiement:", err);
        toastMsg.error("Erreur de suppression", err.message);
        return;
      }
    } else {
      toastMsg.success("Paiement supprimé en local ✓");
    }

    const updatedPayments = db.payments.filter((x) => x.id !== p.id);
    update((d) => ({ ...d, payments: updatedPayments }));
    const newSummary = financialSummary({ ...db, payments: updatedPayments }, studentId);
    update((d) => ({ ...d, students: d.students.map((s) => (s.id === studentId ? { ...s, statutPaiement: (newSummary.statut === "retard" ? "partiel" : newSummary.statut) as any } : s)) }));
    log(`Paiement supprimé ${p.reference ?? p.id} : ${student?.prenom} ${student?.nom} — ${money(p.montant)}`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setDeletingPay(null);
  };

  const saveInvoice = async () => {
    if (!studentId || !invForm.libelle || !invForm.montant || +invForm.montant <= 0) {
      toastMsg.error("Facture invalide", "Veuillez indiquer un libellé et un montant positif.");
      return;
    }
    let newInvoiceId = uid("INV");

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from("invoices").insert({
          student_id: studentId,
          type: invForm.type,
          libelle: invForm.libelle,
          montant: +invForm.montant,
          date: today(),
          due_date: invForm.dueDate || null,
          created_by: user?.id || null,
        }).select("id").single();

        if (error) throw error;
        if (data?.id) newInvoiceId = data.id;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "CREATE",
            entity_type: "invoices",
            entity_id: newInvoiceId,
            description: `Facture ajoutée pour ${student?.prenom} ${student?.nom} — ${money(+invForm.montant)} (${invForm.libelle})`,
          });
        } catch { /* ignore audit */ }

        toastMsg.success("Facture ajoutée en base de données ✓");
      } catch (err: any) {
        console.error("Erreur enregistrement facture:", err);
        toastMsg.error("Erreur ajout facture", err.message || "Échec d'enregistrement");
        return;
      }
    } else {
      toastMsg.success("Facture ajoutée en local ✓");
    }

    const inv = { id: newInvoiceId, studentId, type: invForm.type, libelle: invForm.libelle, montant: +invForm.montant, date: today(), dueDate: invForm.dueDate || undefined, createdBy: user?.id };
    update((d) => ({ ...d, invoices: [inv, ...d.invoices.filter((x) => x.id !== inv.id)] }));
    log(`Facture ajoutée : ${student?.prenom} ${student?.nom} — ${money(inv.montant)} (${inv.libelle})`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setInvForm(blankInv()); setCreatingInv(false);
  };

  const updateInvoice = async () => {
    if (!editingInv || !editingInv.montant || editingInv.montant <= 0 || !editingInv.libelle) {
      toastMsg.error("Facture invalide");
      return;
    }
    const i = editingInv;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("invoices").update({
          libelle: i.libelle,
          montant: +i.montant,
          due_date: i.dueDate || null,
        }).eq("id", i.id);
        if (error) throw error;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "UPDATE",
            entity_type: "invoices",
            entity_id: i.id,
            description: `Modification facture ${i.id} : ${i.libelle} — ${money(+i.montant)}`,
          });
        } catch { /* ignore audit */ }
        toastMsg.success("Facture mise à jour ✓");
      } catch (err: any) {
        console.error("Erreur modification facture:", err);
        toastMsg.error("Erreur de modification", err.message);
        return;
      }
    } else {
      toastMsg.success("Facture mise à jour en local ✓");
    }

    const updatedInvoices = db.invoices.map((x) => (x.id === i.id ? { ...x, ...i, montant: +i.montant } : x));
    update((d) => ({ ...d, invoices: updatedInvoices }));
    log(`Facture modifiée : ${i.libelle}`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setEditingInv(null);
  };

  const confirmDeleteInvoice = async () => {
    if (!deletingInv) return;
    const i = deletingInv;
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("invoices").delete().eq("id", i.id);
        if (error) throw error;

        try {
          await supabase.from("audit_logs").insert({
            user_id: user?.id || null,
            action: "DELETE",
            entity_type: "invoices",
            entity_id: i.id,
            description: `Suppression facture ${i.libelle} : ${student?.prenom} ${student?.nom} — ${money(i.montant)}`,
          });
        } catch { /* ignore audit */ }
        toastMsg.success("Facture supprimée ✓");
      } catch (err: any) {
        console.error("Erreur suppression facture:", err);
        toastMsg.error("Erreur de suppression", err.message);
        return;
      }
    } else {
      toastMsg.success("Facture supprimée en local ✓");
    }

    const updatedInvoices = db.invoices.filter((x) => x.id !== i.id);
    update((d) => ({ ...d, invoices: updatedInvoices }));
    log(`Facture supprimée ${i.id} : ${i.libelle}`);
    window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
    setDeletingInv(null);
  };

  const receipt = (p: any) => {
    printHTML(`Reçu ${p.reference ?? p.id}`, `
      <div class="receipt">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><h1 class="accent">SENTINELLES NUMÉRIQUES</h1><p>Centre de Formation — Génie Info & Industriel</p></div>
          <div style="text-align:right"><p class="label">Reçu N°</p><p class="font-mono">${p.reference ?? p.id}</p></div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <div class="grid">
          <div><p class="label">Apprenant</p><p style="font-weight:700">${student?.prenom} ${student?.nom} (${studentId})</p></div>
          <div><p class="label">Date</p><p>${p.date}${p.heure ? " à " + p.heure : ""}</p></div>
          <div><p class="label">Libellé</p><p>${p.libelle}</p></div>
          <div><p class="label">Mode de paiement</p><p>${p.mode}</p></div>
          ${p.createdByName ? `<div><p class="label">Encaissé par</p><p>${p.createdByName}</p></div>` : ""}
          ${p.observation ? `<div><p class="label">Observation</p><p>${p.observation}</p></div>` : ""}
        </div>
        <div class="row" style="margin-top:16px"><span>Montant encaissé</span><span class="gold" style="font-size:20px;font-weight:800">${money(p.montant)}</span></div>
        <div class="row"><span>Total payé (compte)</span><span class="green">${money(summary?.totalPaye ?? 0)}</span></div>
        <div class="row"><span>Solde restant</span><span>${money(summary?.solde ?? 0)}</span></div>
        <p style="margin-top:24px;text-align:center" class="label">Merci de votre confiance — SENTINELLES NUMÉRIQUES</p>
      </div>`);
  };

  return (
    <div>
      <PageHead
        title="Finances & Paiements"
        subtitle="Factures, encaissements, trésorerie et suivi automatique"
        actions={
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" onClick={exportTreasuryCSV}><Download size={15} /> Exporter trésorerie CSV</Btn>
            <Btn variant="outline" onClick={() => setCreatingInv(true)} disabled={!studentId}><FileText size={15} /> Ajouter une facture</Btn>
            <Btn onClick={() => setCreatingPay(true)} disabled={!studentId}><PlusCircle size={16} /> Enregistrer un paiement</Btn>
          </div>
        }
      />

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[280px]">
            <Field label="Sélectionner un apprenant spécifique (ou laisser vide pour la trésorerie globale)">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">— Tous les apprenants (Vue Trésorerie Globale) —</option>
                {db.students.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.prenom} {s.nom}</option>)}
              </Select>
            </Field>
          </div>
          {studentId && (
            <div className="flex items-end">
              <button onClick={() => setStudentId("")} className="text-xs font-bold text-cyan-300 hover:underline">
                ← Retour à la vue globale
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* VUE TRÉSORERIE GLOBALE (SI AUCUN APPRENANT SÉLECTIONNÉ) */}
      {!student && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-950/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Total encaissé net</p>
              <p className="font-display text-2xl font-black text-emerald-300">{money(globalEncaisse)}</p>
            </div>
            <div className="rounded-xl border border-amber-400/25 bg-amber-950/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Total restant à recouvrer</p>
              <p className="font-display text-2xl font-black text-amber-300">{money(globalSolde)}</p>
            </div>
            <div className="rounded-xl border border-red-500/25 bg-red-950/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Apprenants en retard</p>
              <p className="font-display text-2xl font-black text-red-400">{globalRetards}</p>
            </div>
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-950/20 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Règlements enregistrés</p>
              <p className="font-display text-2xl font-black text-cyan-300">{activePayments.length}</p>
            </div>
          </div>

          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Rechercher par apprenant, référence, libellé..."
                  value={qPay}
                  onChange={(e) => setQPay(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={fMode} onChange={(e) => setFMode(e.target.value)}>
                <option value="">Tous les modes</option>
                <option>Espèces</option>
                <option>Mobile Money</option>
                <option>Virement</option>
                <option>Chèque</option>
              </Select>
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} placeholder="Filtrer par date" />
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Journal global des transactions ({filteredGlobalPayments.length})</h3>
          </div>

          {filteredGlobalPayments.length === 0 ? (
            <Empty icon={<Wallet size={40} />} title="Aucune transaction trouvée" sub="Aucun paiement ne correspond aux filtres de recherche." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-4 py-3">Réf.</th>
                    <th className="px-4 py-3">Apprenant</th>
                    <th className="px-4 py-3">Libellé</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGlobalPayments.map((p) => {
                    const st = db.students.find((s) => s.id === p.studentId);
                    const isCancelled = p.observation?.includes("[ANNULÉ]");
                    return (
                      <tr key={p.id} className={cn("border-b border-white/5 last:border-0 hover:bg-white/[0.02]", isCancelled && "opacity-50")}>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">{p.reference ?? p.id}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setStudentId(p.studentId)}
                            className="font-bold text-white hover:text-cyan-300 hover:underline text-left block"
                          >
                            {st ? `${st.prenom} ${st.nom}` : p.studentId}
                          </button>
                          <span className="font-mono text-[10px] text-slate-500">{p.studentId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-200">{p.libelle}</p>
                          {p.observation && <p className="text-[11px] text-slate-500">{p.observation}</p>}
                        </td>
                        <td className={cn("px-4 py-3 font-mono", isCancelled ? "line-through text-slate-500" : "text-white")}>{money(p.montant)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.mode}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.date}{p.heure ? ` • ${p.heure}` : ""}</td>
                        <td className="px-4 py-3">
                          {isCancelled ? (
                            <Badge color="red">Annulé</Badge>
                          ) : (
                            <Badge color="green">Encaissé</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => receipt(p)} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Imprimer le reçu"><ReceiptText size={14} /></button>
                            {!isCancelled && (
                              <button onClick={() => setCancellingPay(p)} className="rounded-lg border border-white/10 p-1.5 text-amber-400 hover:border-amber-400/40 hover:bg-amber-500/10" title="Annulation contrôlée"><Ban size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* VUE SPÉCIFIQUE À L'APPRENANT */}
      {student && summary && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Montant à payer</p>
              <p className="font-display text-xl font-black text-white">{money(summary.totalDu)}</p>
            </div>
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Total payé (auto)</p>
              <p className="font-display text-xl font-black text-emerald-300">{money(summary.totalPaye)}</p>
            </div>
            <div className={cn("rounded-xl border p-4", summary.solde === 0 ? "border-emerald-400/25 bg-emerald-400/5" : "border-amber-400/25 bg-amber-400/5")}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Solde restant</p>
              <p className={cn("font-display text-xl font-black", summary.solde === 0 ? "text-emerald-300" : "text-amber-300")}>{money(summary.solde)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Statut</p>
              <p className="mt-1"><Badge color={summary.statut === "paye" ? "green" : summary.statut === "partiel" ? "gold" : summary.statut === "retard" ? "red" : "red"}>{statusLabel(summary.statut)}</Badge></p>
            </div>
          </div>

          {/* Échéancier en 2 tranches */}
          {summary.schedules && summary.schedules.length > 0 && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <span>📅 Échéancier officiel en 2 tranches</span>
                </h3>
                <span className="text-xs text-slate-400">Formation 3 mois</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.schedules.map((sch) => {
                  const isPaid = sch.status === "paye" || sch.paidAmount >= sch.amount;
                  const isLate = sch.status === "retard" || (!isPaid && sch.dueDate < today());
                  const remaining = Math.max(0, sch.amount - sch.paidAmount);
                  return (
                    <div
                      key={sch.id}
                      className={cn(
                        "rounded-xl border p-3.5 transition-all",
                        isPaid
                          ? "border-emerald-400/30 bg-emerald-950/20"
                          : isLate
                          ? "border-red-400/30 bg-red-950/20"
                          : "border-cyan-400/20 bg-cyan-950/10"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-sm text-white">{sch.label}</p>
                          <p className="text-[11px] text-slate-400">Échéance : <span className={cn(isLate && !isPaid ? "text-red-400 font-bold" : "text-slate-300")}>{sch.dueDate}</span></p>
                        </div>
                        <Badge color={isPaid ? "green" : isLate ? "red" : "cyan"}>
                          {isPaid ? "Soldé" : isLate ? "En retard" : "À régler"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex justify-between items-baseline border-t border-white/5 pt-2 text-xs">
                        <span className="text-slate-400">Montant dû : <b className="text-white">{money(sch.amount)}</b></span>
                        <span className={cn("font-bold", isPaid ? "text-emerald-300" : "text-amber-300")}>
                          {isPaid ? "Totalement réglé ✓" : `Reste : ${money(remaining)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Factures */}
          {invoices.length > 0 && (
            <Card className="mb-5 overflow-x-auto">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-display text-sm font-bold text-white">Factures associées ({invoices.length})</h3>
                <Btn size="sm" variant="outline" onClick={() => setCreatingInv(true)}><FileText size={14} /> Nouvelle facture</Btn>
              </div>
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-4 py-3">Réf.</th>
                    <th className="px-4 py-3">Libellé</th>
                    <th className="px-4 py-3">Montant</th>
                    <th className="px-4 py-3">Payé</th>
                    <th className="px-4 py-3">Reste</th>
                    <th className="px-4 py-3">Échéance</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => {
                    const paid = db.payments.filter((p) => p.invoiceId === i.id && !p.observation?.includes("[ANNULÉ]")).reduce((a, p) => a + p.montant, 0);
                    const rest = Math.max(0, i.montant - paid);
                    return (
                      <tr key={i.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{i.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-200">{i.libelle}</td>
                        <td className="px-4 py-3 font-mono text-white">{money(i.montant)}</td>
                        <td className="px-4 py-3 font-mono text-emerald-300">{money(paid)}</td>
                        <td className="px-4 py-3 font-mono">{rest === 0 ? <Badge color="green">Soldé</Badge> : <span className="text-amber-300 font-bold">{money(rest)}</span>}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{i.dueDate ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => setEditingInv({ ...i })} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Modifier la facture"><Pencil size={14} /></button>
                            <button onClick={() => setDeletingInv(i)} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-400" title="Supprimer la facture"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {/* Historique paiements apprenant */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-white">Historique des paiements de l'apprenant ({payments.length})</h3>
            <Btn size="sm" onClick={() => setCreatingPay(true)}><PlusCircle size={14} /> Nouveau paiement</Btn>
          </div>
          {payments.length === 0 ? (
            <Empty icon={<Wallet size={40} />} title="Aucun paiement enregistré" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <th className="px-4 py-3">Réf.</th><th className="px-4 py-3">Libellé</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Date / heure</th><th className="px-4 py-3">Encaissé par</th><th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const isCancelled = p.observation?.includes("[ANNULÉ]");
                    return (
                      <tr key={p.id} className={cn("border-b border-white/5 last:border-0 hover:bg-white/[0.02]", isCancelled && "opacity-50")}>
                        <td className="px-4 py-3 font-mono text-xs text-cyan-300">{p.reference ?? p.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-200">{p.libelle}</p>
                          {p.observation && <p className="text-[11px] text-slate-500">{p.observation}</p>}
                        </td>
                        <td className={cn("px-4 py-3 font-mono", isCancelled ? "line-through text-slate-500" : "text-white")}>{money(p.montant)}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.mode}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.date}{p.heure ? ` • ${p.heure}` : ""}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{p.createdByName ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => receipt(p)} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Imprimer le reçu"><ReceiptText size={14} /></button>
                            {!isCancelled && (
                              <button onClick={() => setCancellingPay(p)} className="rounded-lg border border-white/10 p-1.5 text-amber-400 hover:border-amber-400/40 hover:bg-amber-500/10" title="Annulation contrôlée"><Ban size={14} /></button>
                            )}
                            <button onClick={() => setEditingPay({ ...p })} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Modifier le paiement"><Pencil size={14} /></button>
                            <button onClick={() => setDeletingPay(p)} className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-400" title="Supprimer le paiement"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          <p className="mt-3 text-[11px] text-slate-500">Chaque transaction est traçable et persistée. Les modifications et suppressions sont automatiquement journalisées dans l'audit financier.</p>
        </>
      )}

      {/* Modal paiement */}
      <Modal open={creatingPay} onClose={() => setCreatingPay(false)} title={`Nouveau paiement — ${student?.prenom ?? ""} ${student?.nom ?? ""}`}>
        <div className="space-y-4">
          <Field label="Rattacher à une facture (facultatif)">
            <Select value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })}>
              <option value="">— Aucune (paiement libre) —</option>
              {invoices.map((i) => {
                const paid = db.payments.filter((p) => p.invoiceId === i.id).reduce((a, p) => a + p.montant, 0);
                const rest = Math.max(0, i.montant - paid);
                return <option key={i.id} value={i.id}>{i.libelle} — reste {money(rest)}</option>;
              })}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={payForm.type} onChange={(e) => setPayForm({ ...payForm, type: e.target.value })}>
                <option value="inscription">Inscription</option><option value="formation">Formation</option>
              </Select>
            </Field>
            <Field label="Mode">
              <Select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option>
              </Select>
            </Field>
          </div>
          <Field label="Libellé (optionnel)"><Input value={payForm.libelle} onChange={(e) => setPayForm({ ...payForm, libelle: e.target.value })} placeholder="Sera repris depuis la facture si vide" /></Field>
          <Field label="Montant encaissé (FCFA)"><Input type="number" min={1} value={payForm.montant} onChange={(e) => setPayForm({ ...payForm, montant: +e.target.value })} /></Field>
          <Field label="Observation (facultatif)"><Textarea value={payForm.observation} onChange={(e) => setPayForm({ ...payForm, observation: e.target.value })} placeholder="Précisions éventuelles..." /></Field>
          <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs text-slate-300">
            La référence de reçu et le solde sont générés automatiquement. Le paiement sera immédiatement enregistré en base Supabase et visible par l'apprenant.
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreatingPay(false)}>Annuler</Btn>
            <Btn onClick={savePayment}><Wallet size={15} /> Enregistrer le paiement</Btn>
          </div>
        </div>
      </Modal>

      {/* Modal modification paiement */}
      <Modal open={!!editingPay} onClose={() => setEditingPay(null)} title={`Modifier le paiement — ${editingPay?.reference ?? ""}`}>
        {editingPay && (
          <div className="space-y-4">
            <Field label="Libellé"><Input value={editingPay.libelle} onChange={(e) => setEditingPay({ ...editingPay, libelle: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant (FCFA)"><Input type="number" min={1} value={editingPay.montant} onChange={(e) => setEditingPay({ ...editingPay, montant: +e.target.value })} /></Field>
              <Field label="Mode">
                <Select value={editingPay.mode} onChange={(e) => setEditingPay({ ...editingPay, mode: e.target.value })}>
                  <option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option>
                </Select>
              </Field>
            </div>
            <Field label="Observation"><Textarea value={editingPay.observation || ""} onChange={(e) => setEditingPay({ ...editingPay, observation: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setEditingPay(null)}>Annuler</Btn>
              <Btn onClick={updatePayment}><Save size={15} /> Mettre à jour</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal suppression paiement */}
      <Modal open={!!deletingPay} onClose={() => setDeletingPay(null)} title="Confirmer la suppression du paiement">
        {deletingPay && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Êtes-vous sûr de vouloir supprimer le paiement <strong className="text-cyan-300">{deletingPay.reference ?? deletingPay.id}</strong> d'un montant de <strong className="text-emerald-300">{money(deletingPay.montant)}</strong> ?
            </p>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-300">
              ⚠️ Cette action recalculera le solde dû de l'apprenant et sera inscrite dans le journal d'audit administratif.
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setDeletingPay(null)}>Annuler</Btn>
              <Btn variant="danger" onClick={confirmDeletePayment}><Trash2 size={15} /> Confirmer la suppression</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal facture */}
      <Modal open={creatingInv} onClose={() => setCreatingInv(false)} title={`Nouvelle facture — ${student?.prenom ?? ""} ${student?.nom ?? ""}`}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={invForm.type} onChange={(e) => setInvForm({ ...invForm, type: e.target.value, libelle: e.target.value === "inscription" ? "Frais d'inscription" : invForm.libelle })}>
                <option value="inscription">Inscription</option><option value="formation">Formation</option>
              </Select>
            </Field>
            <Field label="Échéance (facultative)"><Input type="date" value={invForm.dueDate} onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Libellé"><Input value={invForm.libelle} onChange={(e) => setInvForm({ ...invForm, libelle: e.target.value })} placeholder="ex: Formation — 4 modules" /></Field>
          <Field label="Montant total (FCFA)"><Input type="number" min={1} value={invForm.montant} onChange={(e) => setInvForm({ ...invForm, montant: +e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreatingInv(false)}>Annuler</Btn>
            <Btn onClick={saveInvoice}><FileText size={15} /> Ajouter la facture</Btn>
          </div>
        </div>
      </Modal>

      {/* Modal modification facture */}
      <Modal open={!!editingInv} onClose={() => setEditingInv(null)} title={`Modifier la facture`}>
        {editingInv && (
          <div className="space-y-4">
            <Field label="Libellé"><Input value={editingInv.libelle} onChange={(e) => setEditingInv({ ...editingInv, libelle: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant (FCFA)"><Input type="number" min={1} value={editingInv.montant} onChange={(e) => setEditingInv({ ...editingInv, montant: +e.target.value })} /></Field>
              <Field label="Échéance"><Input type="date" value={editingInv.dueDate || ""} onChange={(e) => setEditingInv({ ...editingInv, dueDate: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setEditingInv(null)}>Annuler</Btn>
              <Btn onClick={updateInvoice}><Save size={15} /> Mettre à jour</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal suppression facture */}
      <Modal open={!!deletingInv} onClose={() => setDeletingInv(null)} title="Confirmer la suppression de la facture">
        {deletingInv && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Êtes-vous sûr de vouloir supprimer la facture <strong className="text-cyan-300">{deletingInv.libelle}</strong> d'un montant de <strong className="text-amber-300">{money(deletingInv.montant)}</strong> ?
            </p>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-300">
              ⚠️ La suppression de cette facture réduira le montant total dû par l'apprenant.
            </div>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setDeletingInv(null)}>Annuler</Btn>
              <Btn variant="danger" onClick={confirmDeleteInvoice}><Trash2 size={15} /> Confirmer la suppression</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= CERTIFICATS ================= */
export function CertificatesPage() {
  const { db, update, log, nextCertNumber } = useStore();
  const [studentId, setStudentId] = useState("");
  const [period, setPeriod] = useState("Août — Octobre 2026");
  const [resultat, setResultat] = useState("Admis");
  const [note, setNote] = useState(14);
  const [viewing, setViewing] = useState<any>(null);

  const sName = (id: string) => {
    const s = db.students.find((x) => x.id === id);
    return s ? `${s.prenom} ${s.nom}` : "—";
  };

  const generate = () => {
    if (!studentId) return;
    const s = db.students.find((x) => x.id === studentId)!;
    const numero = nextCertNumber();
    const cert = { id: uid("CERT"), studentId, numero, formation: s.formation, modules: s.modules, periode: period, resultat, note, date: today() };
    update((d) => ({ ...d, certificates: [cert, ...d.certificates] }));
    if (s.userId) update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: s.userId!, title: "Certificat disponible", body: `Votre certificat ${numero} a été émis.`, date: today(), lu: false, type: "certif" }, ...d.notifications] }));
    log(`Certificat généré : ${numero} pour ${sName(studentId)}`);
    setViewing(cert);
  };

  const printCert = (c: any) => {
    const s = db.students.find((x) => x.id === c.studentId)!;
    const mods = db.modules.filter((m) => c.modules.includes(m.id)).map((m) => m.titre).join(" • ");
    printHTML(`Certificat ${c.numero}`, `
      <div class="receipt" style="text-align:center">
        <p class="accent" style="letter-spacing:4px;font-size:12px">SENTINELLES NUMÉRIQUES</p>
        <p class="label">Centre de Formation en Génie Informatique & Génie Industriel</p>
        <div style="margin:24px 0"><h1 style="font-size:40px;letter-spacing:6px">CERTIFICAT</h1><p class="label">de formation professionnelle</p></div>
        <p class="label">Décerné à</p>
        <h2 style="font-size:28px;color:#FFB300;margin:8px 0">${s.prenom} ${s.nom}</h2>
        <p class="label">N° ${s.id} • ${formationLabel(c.formation)}</p>
        <p style="margin:20px auto;max-width:520px">pour avoir suivi avec succès la formation de <b>${formationLabel(c.formation)}</b> du ${c.periode}.</p>
        <div class="row" style="max-width:420px;margin:0 auto"><span>Modules couverts</span><span style="text-align:right;max-width:220px">${mods}</span></div>
        <div class="row" style="max-width:420px;margin:0 auto"><span>Résultat</span><span class="green">${c.resultat} — ${c.note}/20</span></div>
        <div style="margin-top:32px;display:flex;justify-content:space-between;align-items:end">
          <div style="text-align:center"><p style="border-top:1px solid #00E5FF;padding-top:6px;font-size:11px">Coach Fredich FOUNDOU<br>Responsable du Centre</p></div>
          <div style="text-align:center"><p class="font-mono" style="font-size:12px">${c.numero}</p><p class="label">Certificat vérifiable</p></div>
        </div>
      </div>`);
  };

  return (
    <div>
      <PageHead title="Certificats" subtitle="Certification des délibérés par ENIA 2.0" />
      <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Apprenant">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— Choisir —</option>
              {db.students.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.prenom} {s.nom}</option>)}
            </Select>
          </Field>
          <Field label="Période"><Input value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
          <Field label="Résultat">
            <Select value={resultat} onChange={(e) => setResultat(e.target.value)}>
              <option>Admis</option><option>Admis avec mention</option><option>Non admis</option>
            </Select>
          </Field>
          <Field label="Note /20"><Input type="number" value={note} onChange={(e) => setNote(+e.target.value)} /></Field>
          <div className="flex items-end"><Btn onClick={generate} className="w-full"><Award size={16} /> Générer</Btn></div>
        </div>
      </Card>

      {db.certificates.length === 0 ? (
        <Empty icon={<Award size={40} />} title="Aucun certificat émis" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {db.certificates.map((c) => (
            <Card key={c.id} className="p-5" glow="gold">
              <div className="flex items-center justify-between">
                <Award size={22} className="text-amber-300" />
                <Badge color="gold">{c.resultat}</Badge>
              </div>
              <h4 className="font-display mt-2 text-lg font-black text-white">{sName(c.studentId)}</h4>
              <p className="font-mono text-[11px] text-amber-300/80">{c.numero}</p>
              <p className="mt-1 text-xs text-slate-400">{formationLabel(c.formation)} • {c.periode}</p>
              <div className="mt-4 flex gap-2">
                <Btn variant="outline" className="flex-1" onClick={() => setViewing(c)}><Eye size={14} /> Aperçu</Btn>
                <Btn variant="ghost" onClick={() => printCert(c)}><Printer size={14} /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Aperçu du certificat" wide>
        {viewing && <CertificatePreview cert={viewing} onPrint={() => printCert(viewing)} />}
      </Modal>
    </div>
  );
}

function CertificatePreview({ cert, onPrint }: { cert: any; onPrint: () => void }) {
  const { db } = useStore();
  const s = db.students.find((x) => x.id === cert.studentId)!;
  const mods = db.modules.filter((m) => cert.modules.includes(m.id));
  return (
    <div>
      <div id="print-area" className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-[#0A1224] to-[#120d1f] p-8 text-center">
        <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10">
            <ShieldCheck size={22} className="text-cyan-300" />
          </div>
          <p className="font-display text-sm font-black tracking-[0.3em] text-cyan-300">SENTINELLES NUMÉRIQUES</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Centre de Formation en Génie Informatique & Génie Industriel</p>
          <h2 className="font-display mt-6 text-4xl font-black tracking-[0.2em] text-white">CERTIFICAT</h2>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">de formation professionnelle</p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-slate-500">Décerné à</p>
          <p className="font-display mt-1 text-3xl font-black text-amber-300 drop-shadow-[0_0_16px_rgba(255,179,0,0.4)]">{s.prenom} {s.nom}</p>
          <p className="mt-1 font-mono text-xs text-cyan-300/70">N° {s.id} • {formationLabel(cert.formation)}</p>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-300">
            pour avoir suivi avec succès la formation de <b className="text-white">{formationLabel(cert.formation)}</b> du {cert.periode}.
          </p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
            {mods.map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-300">{m.numero}. {m.titre}</span>)}
          </div>
          <div className="mx-auto mt-5 flex max-w-md items-center justify-between border-t border-amber-400/20 pt-4">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Résultat</p>
              <p className="font-bold text-emerald-300">{cert.resultat} — {cert.note}/20</p>
            </div>
            <div className="rounded-lg bg-white p-1">
              <QRCodeSVG value={`CERT|${cert.numero}|${s.id}`} size={64} />
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">N° certificat</p>
              <p className="font-mono text-[11px] text-cyan-300">{cert.numero}</p>
            </div>
          </div>
          <p className="mt-5 text-[11px] text-slate-500">Signature : Coach Fredich FOUNDOU — Responsable du Centre</p>
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2">
        <Btn onClick={onPrint}><Printer size={15} /> Imprimer</Btn>
      </div>
    </div>
  );
}

/* ================= BOURSES ================= */
const BOURSE_STATUS: { k: any; l: string; c: "gray" | "gold" | "cyan" | "green" | "red" }[] = [
  { k: "en_attente", l: "En attente", c: "gray" },
  { k: "test_programme", l: "Test programmé", c: "gold" },
  { k: "test_effectue", l: "Test effectué", c: "cyan" },
  { k: "admis", l: "Admis", c: "green" },
  { k: "non_admis", l: "Non admis", c: "red" },
  { k: "bourse_attribuee", l: "Bourse attribuée", c: "green" },
];

export function ScholarshipsPage() {
  const { db, update, log } = useStore();
  const eligible = db.students.filter((s) => s.statut === "actif");
  const get = (id: string) => db.scholarships.find((x) => x.studentId === id);

  const setStatus = (id: string, statut: any) => {
    const existing = get(id);
    update((d) => ({
      ...d,
      scholarships: existing
        ? d.scholarships.map((x) => (x.studentId === id ? { ...x, statut } : x))
        : [...d.scholarships, { id: uid("SCHL"), studentId: id, statut, date: today() }],
    }));
    const s = db.students.find((x) => x.id === id);
    if (s?.userId) update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: s.userId!, title: "Mise à jour bourse", body: `Votre statut bourse est désormais : ${statut.replace("_", " ")}`, date: today(), lu: false, type: "bourse" }, ...d.notifications] }));
    log(`Bourse mise à jour : ${s?.prenom} ${s?.nom} → ${statut}`);
  };

  return (
    <div>
      <PageHead title="BOURSE MON AVENIR" subtitle="3 ans d'études 100% gratuites à ENIA 2.0 pour les lauréats du test final" />
      <Card className="mb-6 flex items-center gap-4 border-amber-400/30 bg-gradient-to-r from-amber-400/10 via-transparent to-transparent p-5">
        <BadgeDollarSign size={28} className="shrink-0 text-amber-300" />
        <p className="text-sm text-slate-300">
          Les apprenants qui réussissent le test final de fin de formation bénéficient d'une <b className="text-amber-300">bourse d'études de 3 ans à ENIA 2.0</b>.
        </p>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <th className="px-4 py-3">Apprenant</th><th className="px-4 py-3">Formation</th><th className="px-4 py-3">Moyenne</th><th className="px-4 py-3">Statut actuel</th><th className="px-4 py-3 text-right">Mettre à jour</th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((s) => {
              const grades = db.grades.filter((g) => g.studentId === s.id);
              const avg = grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(1) : "—";
              const b = get(s.id);
              return (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                    <p className="font-mono text-[10px] text-slate-500">{s.id}</p>
                  </td>
                  <td className="px-4 py-3"><Badge color={s.formation === "informatique" ? "red" : "cyan"}>{formationLabel(s.formation)}</Badge></td>
                  <td className="px-4 py-3 font-display text-sm font-bold text-white">{avg}</td>
                  <td className="px-4 py-3">
                    {b ? <Badge color={BOURSE_STATUS.find((x) => x.k === b.statut)?.c ?? "gray"}>{BOURSE_STATUS.find((x) => x.k === b.statut)?.l}</Badge> : <Badge color="gray">Non suivi</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Select value={b?.statut ?? "en_attente"} onChange={(e) => setStatus(s.id, e.target.value)} className="w-44 text-xs">
                      {BOURSE_STATUS.map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
