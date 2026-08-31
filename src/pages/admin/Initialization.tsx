import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ShieldAlert, CheckSquare, Square, ArrowLeft, ArrowRight,
  Trash2, ShieldCheck, Database,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, PageHead, Input, Badge } from "@/lib/ui";
import { RESET_CATEGORIES, resetCategories, ResetCategory } from "@/lib/seed";

type Step = "select" | "warn" | "confirm";

export function InitializationPage() {
  const { db, user, update, log } = useStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<ResetCategory>>(new Set());
  const [step, setStep] = useState<Step>("select");
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState(false);

  if (user?.role !== "superadmin") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <ShieldAlert size={40} className="mb-3 text-red-400" />
        <h2 className="font-display text-xl font-black text-white">Accès réservé</h2>
        <p className="mt-2 text-sm text-slate-400">Seul l'Administrateur Supérieur peut initialiser le logiciel.</p>
      </div>
    );
  }

  const isDemo = selected.has("demo");
  const toggle = (k: ResetCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (k === "demo") {
        // "demo" = tout réinitialiser : exclusif
        if (next.has("demo")) next.clear();
        else { next.clear(); next.add("demo"); }
        return next;
      }
      next.delete("demo");
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  // Statistiques de ce qui sera supprimé
  const counts: Record<string, number> = useMemo(() => ({
    modules: db.modules.length, students: db.students.length, teachers: db.teachers.length,
    admins: db.users.filter((u) => u.role === "admin").length, partners: db.partners.length,
    courses: db.courses.length, schedule: db.schedule.length, attendance: db.attendance.length,
    tests: db.tests.length, grades: db.grades.length, payments: db.payments.length,
    certificates: db.certificates.length, scholarships: db.scholarships.length,
    notifications: db.notifications.length + db.messages.length,
    content: db.advantages.length + db.announcements.length,
    formations: db.settings.frais.informatique.length + db.settings.frais.industriel.length,
  }), [db]);

  const execute = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from("audit_logs").insert({
          user_id: user?.id || null,
          action: "DATABASE_RESET",
          entity_type: "system",
          description: `Réinitialisation effectuée par ${user?.name} (${user?.role}) : catégories [${Array.from(selected).join(", ")}]`,
        });
      } catch { /* ignore audit */ }
    }
    update((d) => resetCategories(d, Array.from(selected)));
    log(`Initialisation exécutée par ${user?.name} : ${Array.from(selected).join(", ")}`);
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_40px_-8px_rgba(0,255,136,0.6)]">
          <CheckSquare size={38} className="text-emerald-300" />
        </div>
        <h1 className="font-display text-2xl font-black text-white">Initialisation terminée</h1>
        <p className="mt-3 text-slate-300">
          {isDemo ? "La plateforme repart d'une base propre et vide." : "Les données sélectionnées ont été supprimées définitivement."}
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Database size={16} className="text-cyan-300" /> Prochaines étapes</p>
          <p className="text-sm text-slate-400">Reconstruisez progressivement votre établissement :</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Btn variant="outline" onClick={() => navigate("/app/modules")}>Créer une formation / module</Btn>
            <Btn variant="outline" onClick={() => navigate("/app/utilisateurs")}>Créer un administrateur</Btn>
            <Btn variant="outline" onClick={() => navigate("/app/enseignants")}>Ajouter un formateur</Btn>
            <Btn variant="outline" onClick={() => navigate("/app/etudiants")}>Ajouter un apprenant</Btn>
          </div>
        </div>
        <Btn className="mt-6" onClick={() => navigate("/app/dashboard")}>Retour au tableau de bord</Btn>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="Initialiser le logiciel" subtitle="Choisissez précisément les données à réinitialiser" />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
        {["Sélection", "Avertissement", "Confirmation"].map((s, i) => {
          const active = ["select", "warn", "confirm"][i] === step;
          const passed = ["select", "warn", "confirm"].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                active ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : passed ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-600")}>{i + 1}</span>
              <span className={active ? "text-cyan-300" : "text-slate-500"}>{s}</span>
              {i < 2 && <ArrowRight size={12} className="text-slate-700" />}
            </div>
          );
        })}
      </div>

      {step === "select" && (
        <>
          <Card className="mb-4 p-5" glow="red">
            <label className="flex cursor-pointer items-start gap-3">
              <button onClick={() => toggle("demo")} className="mt-0.5 shrink-0">
                {isDemo ? <CheckSquare size={22} className="text-red-400" /> : <Square size={22} className="text-slate-500" />}
              </button>
              <div>
                <p className="font-bold text-red-400">Réinitialisation totale (base propre)</p>
                <p className="text-sm text-slate-400">Efface TOUTES les données et repart d'une base propre. Le compte Administrateur Supérieur est conservé.</p>
              </div>
            </label>
          </Card>

          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Ou réinitialiser des catégories précises</p>
          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", isDemo && "pointer-events-none opacity-40")}>
            {RESET_CATEGORIES.filter((c) => c.key !== "demo").map((c) => {
              const on = selected.has(c.key);
              const n = counts[c.key];
              return (
                <button key={c.key} onClick={() => toggle(c.key)}
                  className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
                    on ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 hover:bg-white/5")}>
                  {on ? <CheckSquare size={18} className="mt-0.5 shrink-0 text-cyan-300" /> : <Square size={18} className="mt-0.5 shrink-0 text-slate-500" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-200">{c.label}</p>
                      {typeof n === "number" && n > 0 && <Badge color="gray">{n}</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-500">{c.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Btn variant="ghost" onClick={() => navigate("/app/parametres")}><ArrowLeft size={15} /> Annuler</Btn>
            <Btn variant="red" disabled={selected.size === 0} onClick={() => setStep("warn")}>
              Initialiser la sélection ({selected.size}) <ArrowRight size={15} />
            </Btn>
          </div>
        </>
      )}

      {step === "warn" && (
        <Card className="mx-auto max-w-xl p-8 text-center" glow="red">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
          <h2 className="font-display text-xl font-black text-red-400">⚠️ ATTENTION</h2>
          <p className="mt-3 text-slate-300">Cette opération est <b className="text-white">irréversible</b>.</p>
          <p className="mt-1 text-sm text-slate-400">Les données sélectionnées seront <b className="text-red-400">définitivement supprimées</b>. Elles ne pourront pas être récupérées depuis l'application.</p>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Catégories concernées</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).map((k) => (
                <Badge key={k} color="red">{RESET_CATEGORIES.find((c) => c.key === k)?.label}</Badge>
              ))}
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">Êtes-vous certain de vouloir continuer ?</p>
          <div className="mt-5 flex justify-center gap-2">
            <Btn variant="ghost" onClick={() => setStep("select")}><ArrowLeft size={15} /> Annuler</Btn>
            <Btn variant="red" onClick={() => setStep("confirm")}>Continuer <ArrowRight size={15} /></Btn>
          </div>
        </Card>
      )}

      {step === "confirm" && (
        <Card className="mx-auto max-w-xl p-8" glow="red">
          <div className="mb-4 flex items-center gap-3">
            <ShieldAlert size={26} className="text-red-400" />
            <h2 className="font-display text-lg font-black text-white">Confirmation finale</h2>
          </div>
          <p className="text-sm text-slate-400">
            Pour confirmer la suppression définitive, saisissez le mot <span className="font-mono font-bold text-red-400">CONFIRMER</span> ci-dessous.
          </p>
          <Input className="mt-4" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Tapez CONFIRMER" />

          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-slate-300">
            <p className="flex items-center gap-1.5 font-bold text-emerald-300"><ShieldCheck size={13} /> Ce qui est conservé</p>
            <p className="mt-1 text-slate-400">L'application, la structure de données, les rôles RBAC, la sécurité et le compte Administrateur Supérieur restent intacts.</p>
          </div>

          <div className="mt-5 flex justify-between gap-2">
            <Btn variant="ghost" onClick={() => setStep("warn")}><ArrowLeft size={15} /> Retour</Btn>
            <Btn variant="red" disabled={confirmText.trim().toUpperCase() !== "CONFIRMER" && confirmText.trim().toUpperCase() !== "INITIALISER"} onClick={execute}>
              <Trash2 size={15} /> Confirmer la suppression
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
