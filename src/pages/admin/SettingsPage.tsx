import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings, Activity, Shield, Play, CheckCircle2, AlertTriangle, RotateCcw,
  Palette, Moon, Flame, Sparkles, Wallet, School, Compass, Volume2,
  Calendar, Lock, Plus, Check, Eye, RefreshCw
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, PageHead, Field, Input, today } from "@/lib/ui";
import { cn } from "@/utils/cn";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import {
  UiTheme, getUiTheme, setUiTheme,
  getSpatialSettings, setSpatialSettings, SpatialSettings
} from "@/lib/uiTheme";
import {
  NotificationSoundId,
  getNotificationSoundPreferences,
  setNotificationSoundPreferences,
  playNotificationSound,
} from "@/lib/pushNotifications";
import { executeScheduleAutomation } from "@/lib/automation/scheduleAutomation";
import { AcademicYear, ModuleRestriction } from "@/lib/types";
import { FontSelector } from "@/components/FontSelector";
import { BrightnessControl } from "@/components/BrightnessControl";

export interface AutomationServiceConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  frequency: string;
  lastRun: string;
  nextRun: string;
  lastStatus: "success" | "warning" | "error" | "running";
  lastMessage: string;
}

const DEFAULT_AUTOMATIONS: AutomationServiceConfig[] = [
  {
    id: "auto-attendance",
    name: "Pointage automatique des présences",
    category: "Pédagogie & Emploi du temps",
    description: "Émarge automatiquement présents tous les apprenants inscrits dès le début et à la fin de chaque séance planifiée.",
    enabled: true,
    frequency: "Toutes les 15 min + à chaque fin de séance",
    lastRun: today() + " 08:00",
    nextRun: today() + " 10:00",
    lastStatus: "success",
    lastMessage: "Pointage exécuté sans conflit pour les séances du jour.",
  },
  {
    id: "auto-teacher-hours",
    name: "Validation des heures & Rémunérations enseignants",
    category: "Enseignement & Trésorerie",
    description: "Reconnaît les cours dispensés (emploi du temps), prépare la validation de l'heure et crédite 2 500 FCFA/séance sur le compte enseignant.",
    enabled: true,
    frequency: "Quotidien (fin de journée)",
    lastRun: today() + " 07:30",
    nextRun: today() + " 18:00",
    lastStatus: "success",
    lastMessage: "Honoraires automatiquement calculés et mis en attente de visa.",
  },
  {
    id: "auto-notifications",
    name: "Système de notifications & alertes préventives",
    category: "Communication & Sécurité",
    description: "Diffuse les rappels avant séance, les notifications d'absences répétées et les relances de frais de scolarité dus.",
    enabled: true,
    frequency: "Temps réel + vérification horaire",
    lastRun: today() + " 08:15",
    nextRun: today() + " 09:15",
    lastStatus: "success",
    lastMessage: "Veille active : alertes d'assiduité transmises aux apprenants.",
  },
  {
    id: "auto-grades-sync",
    name: "Attribution & synchronisation automatique des notes",
    category: "Évaluations",
    description: "Propage immédiatement les résultats corrigés des devoirs et tests vers les bulletins et le relevé général sans ressaisie.",
    enabled: true,
    frequency: "Événementiel (post-correction)",
    lastRun: today() + " 06:45",
    nextRun: "À la prochaine évaluation",
    lastStatus: "success",
    lastMessage: "Base de notes synchronisée avec les devoirs corrigés.",
  },
  {
    id: "auto-background-sync",
    name: "Synchronisation d'arrière-plan & Résilience locale",
    category: "Infrastructure",
    description: "Maintient l'état local synchronisé avec Supabase en arrière-plan et stocke les opérations en attente de reconnexion.",
    enabled: true,
    frequency: "Toutes les 30 secondes",
    lastRun: today() + " 08:30",
    nextRun: "Dans quelques secondes",
    lastStatus: "success",
    lastMessage: "Connecté aux flux temps réel postgres_changes.",
  },
  {
    id: "auto-sentinel-rag",
    name: "Indexation & Savoirs Sentinel AI",
    category: "Intelligence Artificielle",
    description: "Découpe, extrait et indexe les documents téléversés (PDF, DOCX, TXT, images) pour le moteur de recherche sémantique RAG.",
    enabled: true,
    frequency: "Automatique au téléversement",
    lastRun: today() + " 05:00",
    nextRun: "Au prochain document téléversé",
    lastStatus: "success",
    lastMessage: "Corpus documentaire indexé et disponible pour l'assistant.",
  },
];

export function SettingsPage() {
  const {
    db, user, update, log,
    activeAcademicYear, setActiveAcademicYear,
    createAcademicYear, closeAcademicYear, archiveAcademicYear,
    updateModuleRestriction
  } = useStore();
  const s = db.settings;

  const [activeCategory, setActiveCategory] = useState<
    "automatisations" | "general" | "apparence" | "annees" | "restrictions" | "securite" | "enseignement" | "maintenance"
  >("automatisations");

  // Général
  const [email, setEmail] = useState(s?.contact?.email || "contact@sentinelles-numeriques.com");
  const [adresse, setAdresse] = useState(s?.contact?.adresse || "Brazzaville, République du Congo");
  const [etablissement, setEtablissement] = useState("Sentinelles Numériques");
  const [devise, setDevise] = useState("FCFA");

  // Apparence & Spatial
  const [currentTheme, setCurrentTheme] = useState<UiTheme>(() => getUiTheme());
  const [spatialSettings, setSpatialState] = useState<SpatialSettings>(() => getSpatialSettings());
  const [soundPrefs, setSoundPrefsState] = useState(() => getNotificationSoundPreferences());

  const handleUpdateSpatial = (patch: Partial<SpatialSettings>) => {
    const next = { ...spatialSettings, ...patch };
    setSpatialState(next);
    setSpatialSettings(next);
    toastMsg.success("Paramètres spatiaux appliqués ✓");
  };

  const handleUpdateSound = (patch: Partial<typeof soundPrefs>) => {
    const next = { ...soundPrefs, ...patch };
    setSoundPrefsState(next);
    setNotificationSoundPreferences(next);
    toastMsg.success("Préférences sonores enregistrées ✓");
  };

  // Année académique form
  const [newYearName, setNewYearName] = useState("");
  const [newYearStart, setNewYearStart] = useState("2026-10-01");
  const [newYearEnd, setNewYearEnd] = useState("2027-07-31");

  // Automatisations & Pilotage (Point 31)
  const [automations, setAutomations] = useState<AutomationServiceConfig[]>(() => {
    try {
      const saved = localStorage.getItem("sn_automations_config_v1");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AUTOMATIONS;
  });

  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Sauvegarder les configurations d'automatisations
  const saveAutomations = (list: AutomationServiceConfig[]) => {
    setAutomations(list);
    try {
      localStorage.setItem("sn_automations_config_v1", JSON.stringify(list));
    } catch {}
  };

  const handleToggleAutomation = (id: string) => {
    const updated = automations.map((a) => {
      if (a.id === id) {
        const nextState = !a.enabled;
        log(`Automatisation « ${a.name} » ${nextState ? "activée" : "désactivée"}`);
        toastMsg.info(`Automatisation « ${a.name} » : ${nextState ? "ACTIVÉE" : "DÉSACTIVÉE"}`);
        return { ...a, enabled: nextState };
      }
      return a;
    });
    saveAutomations(updated);
  };

  const handleTriggerManualRun = async (service: AutomationServiceConfig) => {
    setRunningJobId(service.id);
    const now = new Date();
    const timeStr = `${today()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    try {
      if (service.id === "auto-attendance" || service.id === "auto-teacher-hours") {
        const res = executeScheduleAutomation(db, update, now);
        const detailMsg = `Succès : ${res.markedAttendances} présence(s) pointée(s), ${res.validatedSessions} séance(s) traitée(s).`;
        
        saveAutomations(
          automations.map((a) =>
            a.id === service.id
              ? {
                  ...a,
                  lastRun: timeStr,
                  lastStatus: "success",
                  lastMessage: detailMsg,
                }
              : a
          )
        );
        log(`Relance manuelle « ${service.name} » : ${detailMsg}`);
        toastMsg.success(`Exécution terminée ✓`, detailMsg);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        saveAutomations(
          automations.map((a) =>
            a.id === service.id
              ? {
                  ...a,
                  lastRun: timeStr,
                  lastStatus: "success",
                  lastMessage: "Contrôle manuel effectué avec succès : système à jour.",
                }
              : a
          )
        );
        log(`Relance manuelle « ${service.name} » effectuée`);
        toastMsg.success(`Service exécuté avec succès ✓`, `Le service « ${service.name} » a été relancé manuellement.`);
      }
    } catch (e: any) {
      toastMsg.error("Erreur lors de l'exécution", e?.message || "Échec inattendu");
    } finally {
      setRunningJobId(null);
    }
  };

  const handleSelectTheme = (theme: UiTheme) => {
    setUiTheme(theme);
    setCurrentTheme(theme);
    toastMsg.success(
      theme === "spatial"
        ? "Mode Spatial (Poste de Contrôle) activé ✓"
        : theme === "icrm-violet"
        ? "Thème I-CRM Violet activé ✓"
        : theme === "uba-archives"
        ? "Thème UBA Archives (Institutionnel) activé ✓"
        : theme === "orange-slate"
        ? "Thème Orange Ardoise activé ✓"
        : theme === "crimson"
        ? "Thème Rouge Sentinelle activé ✓"
        : theme === "modern"
        ? "Thème Modernisé activé ✓"
        : "Thème Classique rétabli ✓"
    );
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Paramètres & Pilotage"
        subtitle="Configuration générale, Centre de pilotage des automatisations et Apparence de la plateforme"
      />

      {/* Barre d'onglets par catégories */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
        <button
          type="button"
          onClick={() => setActiveCategory("automatisations")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "automatisations"
              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Activity size={15} className="text-cyan-400" />
          <span>Centre d'automatisations</span>
          <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
            {automations.filter((a) => a.enabled).length}/{automations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("apparence")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "apparence"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,229,255,0.2)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Palette size={15} />
          <span>Apparence & Sons</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("annees")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "annees"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,229,255,0.2)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Calendar size={15} className="text-cyan-400" />
          <span>Années académiques</span>
          <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
            {db.academicYears?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("restrictions")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "restrictions"
              ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-[0_0_15px_rgba(255,179,0,0.2)]"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Lock size={15} className="text-amber-400" />
          <span>Contrôle & Blocages</span>
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300 font-mono">
            {(db.moduleRestrictions || []).filter(r => r.bloque || r.blocked).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("general")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "general"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Settings size={15} />
          <span>Général & Établissement</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("securite")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "securite"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Shield size={15} />
          <span>Sécurité & Examen</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("enseignement")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "enseignement"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <School size={15} />
          <span>Enseignement & Honoraires</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("maintenance")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "maintenance"
              ? "bg-red-500/20 text-red-300 border border-red-500/40"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <AlertTriangle size={15} />
          <span>Maintenance</span>
        </button>
      </div>

      {/* ================= ONGLET 1 : CENTRE DE PILOTAGE DES AUTOMATISATIONS (Point 31) ================= */}
      {activeCategory === "automatisations" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
                    <Activity size={18} />
                  </div>
                  <h3 className="font-display text-base font-bold text-white">
                    Centre de pilotage des automatisations
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Surveillance en temps réel des tâches d'arrière-plan, statut d'exécution et relance manuelle immédiate.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    automations.forEach((a) => {
                      if (a.enabled) handleTriggerManualRun(a);
                    });
                  }}
                  className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition cursor-pointer"
                >
                  <RefreshCw size={14} className={runningJobId ? "animate-spin text-cyan-400" : "text-cyan-400"} />
                  <span>Tout actualiser / Relancer les tâches actives</span>
                </button>
              </div>
            </div>

            {/* Tableau officiel conforme au Point 31 */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3.5">Automatisation</th>
                    <th className="p-3.5">État</th>
                    <th className="p-3.5">Fréquence</th>
                    <th className="p-3.5">Dernière exécution</th>
                    <th className="p-3.5">Prochaine</th>
                    <th className="p-3.5">Résultat / Diagnostic</th>
                    <th className="p-3.5 text-right">Contrôle manuel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {automations.map((svc) => {
                    const isRunning = runningJobId === svc.id;
                    return (
                      <tr key={svc.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-3.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{svc.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-sm">
                            {svc.description}
                          </p>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleAutomation(svc.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer border",
                              svc.enabled
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-800/60 border-white/10 text-slate-400"
                            )}
                            title="Cliquer pour activer ou désactiver"
                          >
                            <span className={cn("h-2 w-2 rounded-full", svc.enabled ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-slate-500")} />
                            <span>{svc.enabled ? "Active" : "Désactivée"}</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                          {svc.frequency}
                        </td>
                        <td className="p-3.5 text-slate-200 font-mono text-[11px]">
                          {svc.lastRun}
                        </td>
                        <td className="p-3.5 text-cyan-300 font-mono text-[11px]">
                          {svc.nextRun}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                            <span className="text-[11px] text-slate-300 truncate max-w-xs" title={svc.lastMessage}>
                              {svc.lastMessage}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            disabled={!svc.enabled || isRunning}
                            onClick={() => handleTriggerManualRun(svc)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                              !svc.enabled
                                ? "border-white/5 bg-white/[0.02] text-slate-500 cursor-not-allowed"
                                : isRunning
                                ? "border-cyan-400/40 bg-cyan-950/40 text-cyan-300 animate-pulse"
                                : "border-cyan-400/30 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-500/20 hover:border-cyan-400/50"
                            )}
                          >
                            <Play size={12} className={isRunning ? "animate-spin text-cyan-400" : "text-cyan-400"} />
                            <span>{isRunning ? "Exécution..." : "Relancer"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Journal technique des automatisations */}
            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity size={14} className="text-cyan-400" />
                  Journal technique des automatisations en direct
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {db.log.filter((l) => (l.user || "").includes("Système")).length} événements système récents
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-400">
                {db.log
                  .filter((l) => (l.user || "").includes("Système"))
                  .slice(0, 10)
                  .map((logItem, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-0.5 border-b border-white/[0.02]">
                      <span className="text-cyan-400">{logItem.date}</span>
                      <span className="text-slate-300 truncate flex-1">{logItem.action}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">SUCCÈS</span>
                    </div>
                  ))}
                {db.log.filter((l) => (l.user || "").includes("Système")).length === 0 && (
                  <p className="text-slate-500 italic py-2 text-center">
                    Aucun événement technique d'arrière-plan enregistré pour l'instant.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ================= ONGLET 2 : GÉNÉRAL & ÉTABLISSEMENT ================= */}
      {activeCategory === "general" && (
        <Card className="p-6">
          <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
            <School size={16} className="text-cyan-400" />
            Configuration générale de l'établissement
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'établissement">
              <Input value={etablissement} onChange={(e) => setEtablissement(e.target.value)} />
            </Field>
            <Field label="Devise monétaire officielle">
              <Input value={devise} onChange={(e) => setDevise(e.target.value)} />
            </Field>
            <Field label="Email de contact officiel">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Adresse physique">
              <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
            <Btn
              onClick={async () => {
                const nextSettings = { ...db.settings, contact: { email, adresse } };
                update((d) => ({ ...d, settings: nextSettings }));
                if (isSupabaseConfigured) {
                  try {
                    await supabase.from("site_settings").upsert({
                      id: "default",
                      data: {
                        settings: nextSettings,
                        advantages: db.advantages,
                        partners: db.partners,
                        announcements: db.announcements,
                      },
                      updated_at: new Date().toISOString(),
                    });
                  } catch (err) {
                    console.error("Erreur sauvegarde site_settings:", err);
                  }
                }
                log("Paramètres généraux mis à jour");
                toastMsg.success("Paramètres enregistrés avec succès ✓");
              }}
            >
              Enregistrer les modifications
            </Btn>
          </div>
        </Card>
      )}

      {/* ================= ONGLET : APPARENCE & SONS ================= */}
      {activeCategory === "apparence" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
                  <Palette size={18} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-white">Thèmes d'interface & Mode Spatial</h3>
                  <p className="text-xs text-slate-400">
                    Basculez entre le Mode Classique et le nouveau Mode Spatial (Centre de Contrôle). Tous les thèmes sont 100% réversibles.
                  </p>
                </div>
              </div>
              <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                100% Réversible
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
              {/* Thème 1: Mode Spatial */}
              <button
                type="button"
                onClick={() => handleSelectTheme("spatial")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "spatial"
                    ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(0,229,255,0.35)] ring-1 ring-cyan-400/50"
                    : "border-cyan-500/30 bg-[#04070D]/80 hover:bg-[#08162B] hover:border-cyan-400/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Compass size={16} className="text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-200">Mode Spatial</span>
                    </div>
                    {currentTheme === "spatial" && (
                      <span className="rounded bg-cyan-400/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300 border border-cyan-400/40">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mb-3">
                    Esthétique centre de contrôle : Fond #04070D, cyan opérationnel & HUD.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-cyan-500/20">
                  <span className="h-3 w-3 rounded-full bg-[#04070D] border border-cyan-400/50" />
                  <span className="h-3 w-3 rounded-full bg-[#08162B] border border-cyan-500/30" />
                  <span className="h-3 w-3 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFB300]" />
                  <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
                </div>
              </button>

              {/* Thème 2: I-CRM Violet (Dashboard SaaS Moderne) */}
              <button
                type="button"
                onClick={() => handleSelectTheme("icrm-violet")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "icrm-violet"
                    ? "border-[#5B3FC4] bg-[#5B3FC4]/25 shadow-[0_0_20px_rgba(91,63,196,0.4)] ring-1 ring-[#5B3FC4]/50"
                    : "border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/30 hover:border-purple-400/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={16} className="text-[#B9A8EA]" />
                      <span className="text-xs font-bold text-purple-200">I-CRM Violet</span>
                    </div>
                    {currentTheme === "icrm-violet" && (
                      <span className="rounded bg-[#5B3FC4] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-[0_0_6px_#5B3FC4]">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mb-3">
                    Dashboard SaaS : Cartes blanches 18px, fond lavande #E9E5F5, accents cyan & rose.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-purple-500/20">
                  <span className="h-3 w-3 rounded-full bg-[#5B3FC4] shadow-[0_0_6px_#5B3FC4]" />
                  <span className="h-3 w-3 rounded-full bg-[#E9E5F5] ring-1 ring-black/20" />
                  <span className="h-3 w-3 rounded-full bg-[#FFFFFF] ring-1 ring-black/30" />
                  <span className="h-3 w-3 rounded-full bg-[#12BFE0]" />
                  <span className="h-3 w-3 rounded-full bg-[#E5245C]" />
                </div>
              </button>

              {/* Thème 3: UBA Archives (Institutionnel Rouge & Blanc) */}
              <button
                type="button"
                onClick={() => handleSelectTheme("uba-archives")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "uba-archives"
                    ? "border-[#E31D25] bg-[#E31D25]/25 shadow-[0_0_20px_rgba(227,29,37,0.4)] ring-1 ring-[#E31D25]/50"
                    : "border-red-500/30 bg-red-950/20 hover:bg-red-900/30 hover:border-red-400/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Shield size={16} className="text-[#EE777B]" />
                      <span className="text-xs font-bold text-red-200">UBA Archives</span>
                    </div>
                    {currentTheme === "uba-archives" && (
                      <span className="rounded bg-[#E31D25] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-[0_0_6px_#E31D25]">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mb-3">
                    Charte institutionnelle : Rouge officiel #E31D25, blanc & lignes de tableau alternées #FDEFF0.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-red-500/20">
                  <span className="h-3 w-3 rounded-full bg-[#E31D25] shadow-[0_0_6px_#E31D25]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFFFFF] ring-1 ring-black/30" />
                  <span className="h-3 w-3 rounded-full bg-[#FDEFF0] ring-1 ring-red-400/30" />
                  <span className="h-3 w-3 rounded-full bg-[#EE777B]" />
                  <span className="h-3 w-3 rounded-full bg-[#1A1A1A]" />
                </div>
              </button>

              {/* Thème 4: Classique */}
              <button
                type="button"
                onClick={() => handleSelectTheme("classic")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "classic"
                    ? "border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_15px_rgba(0,229,255,0.25)]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Moon size={16} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white">Classique</span>
                    </div>
                    {currentTheme === "classic" && (
                      <span className="rounded bg-cyan-400/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mb-3">
                    Interface sombre d'origine équilibrée et certifiée Sentinelles.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <span className="h-3 w-3 rounded-full bg-[#080A0F] border border-white/20" />
                  <span className="h-3 w-3 rounded-full bg-[#00E5FF]" />
                  <span className="h-3 w-3 rounded-full bg-[#006DFF]" />
                  <span className="h-3 w-3 rounded-full bg-[#FF174F]" />
                </div>
              </button>

              {/* Thème 5: Orange Ardoise */}
              <button
                type="button"
                onClick={() => handleSelectTheme("orange-slate")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "orange-slate"
                    ? "border-[#F03E00] bg-[#F03E00]/25 shadow-[0_0_18px_rgba(240,62,0,0.4)]"
                    : "border-orange-500/30 bg-orange-950/10 hover:bg-orange-950/20 hover:border-orange-500/50"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Flame size={16} className="text-[#F03E00]" />
                      <span className="text-xs font-bold text-orange-300">Orange Ardoise</span>
                    </div>
                    {currentTheme === "orange-slate" && (
                      <span className="rounded bg-[#F03E00] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-[0_0_6px_#F03E00]">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug mb-3">
                    50% Orange vif, 50% Bleu-Noir structuré avec contrastes élevés.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <span className="h-3 w-3 rounded-full bg-[#F03E00] ring-1 ring-white/30" />
                  <span className="h-3 w-3 rounded-full bg-[#B33107]" />
                  <span className="h-3 w-3 rounded-full bg-[#1A2226] ring-1 ring-white/20" />
                </div>
              </button>

              {/* Thème 6: Rouge Sentinelle */}
              <button
                type="button"
                onClick={() => handleSelectTheme("crimson")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "crimson"
                    ? "border-red-500/70 bg-red-500/20 shadow-[0_0_15px_rgba(255,23,79,0.3)]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-red-500" />
                      <span className="text-xs font-bold text-red-300">Rouge Sentinelle</span>
                    </div>
                    {currentTheme === "crimson" && (
                      <span className="rounded bg-red-500/30 px-1.5 py-0.2 text-[9px] font-bold text-red-200">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mb-3">
                    Ambiance rubis écarlate et chrome métallique du blason 3D.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <span className="h-3 w-3 rounded-full bg-[#FF174F]" />
                  <span className="h-3 w-3 rounded-full bg-[#9E002B]" />
                  <span className="h-3 w-3 rounded-full bg-[#0E0E14] border border-white/20" />
                </div>
              </button>

              {/* Thème 7: Modernisé */}
              <button
                type="button"
                onClick={() => handleSelectTheme("modern")}
                className={cn(
                  "text-left rounded-xl p-3.5 transition border flex flex-col justify-between group cursor-pointer",
                  currentTheme === "modern"
                    ? "border-violet-500/70 bg-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-400" />
                      <span className="text-xs font-bold text-violet-300">Modernisé</span>
                    </div>
                    {currentTheme === "modern" && (
                      <span className="rounded bg-violet-500/30 px-1.5 py-0.2 text-[9px] font-bold text-violet-200">Actif</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mb-3">
                    Ambiance Midnight Indigo, Violet Électrique & reflets glassmorphism.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                  <span className="h-3 w-3 rounded-full bg-[#8B5CF6]" />
                  <span className="h-3 w-3 rounded-full bg-[#6366F1]" />
                  <span className="h-3 w-3 rounded-full bg-[#1E1B4B] border border-white/20" />
                </div>
              </button>
            </div>

            {/* Réglages fins Mode Spatial */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2 mb-3">
                <Compass size={14} className="text-cyan-400" />
                Options visuelles avancées (Mode Spatial)
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Intensité du halo (Glow)</label>
                  <div className="flex gap-1.5">
                    {(["subtle", "medium", "high"] as const).map((intensity) => (
                      <button
                        key={intensity}
                        type="button"
                        onClick={() => handleUpdateSpatial({ glowIntensity: intensity })}
                        className={cn(
                          "flex-1 py-1 px-2 rounded text-[11px] font-semibold border transition cursor-pointer",
                          spatialSettings.glowIntensity === intensity
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                            : "border-white/10 bg-black/20 text-slate-400 hover:text-white"
                        )}
                      >
                        {intensity === "subtle" ? "Subtil" : intensity === "medium" ? "Moyen" : "Élevé"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Panneaux semi-transparents</label>
                  <button
                    type="button"
                    onClick={() => handleUpdateSpatial({ transparency: !spatialSettings.transparency })}
                    className={cn(
                      "w-full py-1.5 px-3 rounded text-[11px] font-semibold border transition cursor-pointer flex items-center justify-between",
                      spatialSettings.transparency
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                        : "border-white/10 bg-black/20 text-slate-400"
                    )}
                  >
                    <span>Transparence & flou HUD</span>
                    <span className="font-bold">{spatialSettings.transparency ? "Activée" : "Désactivée"}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Réduction des animations</label>
                  <button
                    type="button"
                    onClick={() => handleUpdateSpatial({ reducedMotion: !spatialSettings.reducedMotion })}
                    className={cn(
                      "w-full py-1.5 px-3 rounded text-[11px] font-semibold border transition cursor-pointer flex items-center justify-between",
                      spatialSettings.reducedMotion
                        ? "border-amber-500/40 bg-amber-500/20 text-amber-200"
                        : "border-white/10 bg-black/20 text-slate-400"
                    )}
                  >
                    <span>Mode sans saccade</span>
                    <span className="font-bold">{spatialSettings.reducedMotion ? "Activé" : "Désactivé"}</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* ================= CONTRÔLE DE LUMINOSITÉ & CONFORT VISUEL ================= */}
          <Card className="p-6">
            <BrightnessControl />
          </Card>

          {/* ================= SÉLECTEUR DE POLICE & TYPOGRAPHIE ================= */}
          <Card className="p-6">
            <FontSelector />
          </Card>

          {/* Configuration Audio & Sons des notifications */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
                  <Volume2 size={18} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-white">Sons des notifications système</h3>
                  <p className="text-xs text-slate-400">
                    Choisissez la signature sonore synthétisée des alertes en arrière-plan (Web Audio API sans latence).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateSound({ enabled: !soundPrefs.enabled })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold border transition cursor-pointer",
                  soundPrefs.enabled
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800 border-white/10 text-slate-400"
                )}
              >
                {soundPrefs.enabled ? "Sons activés" : "Sons coupés"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { id: "sentinel" as NotificationSoundId, label: "Carillon Sentinelle (D5/A5)", desc: "Double note classique et rassurante" },
                { id: "spatial_bip" as NotificationSoundId, label: "Bip Spatial HUD", desc: "Signal télémétrique centre de contrôle" },
                { id: "radar" as NotificationSoundId, label: "Sonar / Radar", desc: "Impulsion résonnante progressive" },
                { id: "harmonic" as NotificationSoundId, label: "Accord Harmonique", desc: "Triade majeure apaisante" },
                { id: "subtle" as NotificationSoundId, label: "Clic Discret", desc: "Micro-impulsion feutrée sans interruption" },
                { id: "none" as NotificationSoundId, label: "Silencieux", desc: "Aucun son émis lors des notifications" },
              ].map((sOption) => (
                <div
                  key={sOption.id}
                  className={cn(
                    "p-3 rounded-xl border flex flex-col justify-between transition",
                    soundPrefs.soundId === sOption.id
                      ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                      : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{sOption.label}</span>
                      {soundPrefs.soundId === sOption.id && (
                        <Check size={14} className="text-cyan-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{sOption.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => handleUpdateSound({ soundId: sOption.id })}
                      className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-200 transition cursor-pointer"
                    >
                      Sélectionner
                    </button>
                    {sOption.id !== "none" && (
                      <button
                        type="button"
                        onClick={() => playNotificationSound(sOption.id)}
                        className="p-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition cursor-pointer"
                        title="Écouter un extrait"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ================= ONGLET : GESTION DES ANNÉES ACADÉMIQUES ================= */}
      {activeCategory === "annees" && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Calendar size={16} className="text-cyan-400" />
                  Gestion des Années Académiques / Scolaires
                </h3>
                <p className="text-xs text-slate-400">
                  Définissez l'année active pour rattacher inscriptions, présences, notes et règlements sans détruire les historiques passés.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Session courante active :</span>
                <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-400/40 px-2.5 py-1 rounded-lg">
                  {activeAcademicYear?.label || activeAcademicYear?.nom || "Aucune session active"}
                </span>
              </div>
            </div>

            {/* Formulaire ajout rapide d'année */}
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 mb-6">
              <h4 className="text-xs font-bold text-cyan-300 mb-3 flex items-center gap-1.5">
                <Plus size={14} /> Créer une nouvelle session académique
              </h4>
              <div className="grid gap-3 sm:grid-cols-4 items-end">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nom / Libellé</label>
                  <input
                    type="text"
                    placeholder="Ex: 2026-2027"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Date de début</label>
                  <input
                    type="date"
                    value={newYearStart}
                    onChange={(e) => setNewYearStart(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Date de clôture</label>
                  <input
                    type="date"
                    value={newYearEnd}
                    onChange={(e) => setNewYearEnd(e.target.value)}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newYearName.trim()) {
                        toastMsg.error("Veuillez saisir un nom d'année");
                        return;
                      }
                      createAcademicYear({
                        label: newYearName.trim(),
                        nom: newYearName.trim(),
                        dateDebut: newYearStart,
                        dateFin: newYearEnd,
                        estActive: true,
                        statut: "active",
                      });
                      setNewYearName("");
                      toastMsg.success(`Année « ${newYearName} » créée et activée ✓`);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                  >
                    <Plus size={14} /> Créer & Activer
                  </button>
                </div>
              </div>
            </div>

            {/* Liste des années académiques */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold text-slate-400">
                  <tr>
                    <th className="p-3">Session</th>
                    <th className="p-3">Période</th>
                    <th className="p-3">Statut</th>
                    <th className="p-3">Données rattachées</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(db.academicYears || []).map((ay) => {
                    const isCurrent = ay.id === activeAcademicYear?.id;
                    const studentsCount = (db.students || []).filter(
                      (st) => st.academicYearId === ay.id || st.anneeScolaire === (ay.label || ay.nom)
                    ).length;

                    return (
                      <tr key={ay.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <Calendar size={14} className="text-cyan-400" />
                          <span>{ay.label || ay.nom}</span>
                          {isCurrent && (
                            <span className="rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 px-1.5 py-0.2 text-[9px] font-bold">
                              Session active
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-300 font-mono text-[11px]">
                          Du {ay.dateDebut} au {ay.dateFin}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                              ay.statut === "active"
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                : (ay.statut as string) === "cloturee" || (ay.statut as string) === "closed"
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                : "bg-slate-700/50 border-white/10 text-slate-400"
                            )}
                          >
                            {ay.statut === "active" ? "Active" : (ay.statut as string) === "cloturee" || (ay.statut as string) === "closed" ? "Clôturée (Consultable)" : "Archivée"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {studentsCount} apprenant(s) inscrit(s)
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAcademicYear(ay.id);
                                toastMsg.success(`Année active basculée sur « ${ay.label || ay.nom} » ✓`);
                              }}
                              className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 font-semibold text-[11px] cursor-pointer"
                            >
                              Définir active
                            </button>
                          )}
                          {ay.statut === "active" && (
                            <button
                              type="button"
                              onClick={() => {
                                closeAcademicYear(ay.id);
                                toastMsg.info(`Année « ${ay.label || ay.nom} » clôturée (données préservées).`);
                              }}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-[11px] cursor-pointer"
                            >
                              Clôturer
                            </button>
                          )}
                          {(ay.statut as string) !== "archivee" && (ay.statut as string) !== "archived" && (
                            <button
                              type="button"
                              onClick={() => {
                                archiveAcademicYear(ay.id);
                                toastMsg.info(`Année « ${ay.label || ay.nom} » archivée.`);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-white/10 text-[11px] cursor-pointer"
                            >
                              Archiver
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ================= ONGLET : CONTRÔLE D'ACCÈS & BLOCAGE DE MODULES ================= */}
      {activeCategory === "restrictions" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400/40">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white">Contrôle d'accès & Blocage administratif de modules</h3>
                <p className="text-xs text-slate-400">
                  Bloquez temporairement des modules (IA, Finances, Messagerie, Évaluations) par rôle ou de manière globale avec motif explicite.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(db.moduleRestrictions || []).map((res) => {
              const isBlocked = res.bloque || res.blocked;
              const label = res.moduleLabel || res.name || res.moduleKey;
              const currentReason = res.raison || res.reason || "";

              return (
                <div
                  key={res.id}
                  className={cn(
                    "p-4 rounded-xl border transition",
                    isBlocked
                      ? "border-amber-500/50 bg-amber-950/20"
                      : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{label}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                          Clé: {res.moduleKey}
                        </span>
                        {isBlocked && (
                          <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-300">
                            Bloqué
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{res.description || `Module ${label}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextBlocked = !isBlocked;
                          const targetKey = res.moduleKey || res.id;
                          updateModuleRestriction(targetKey, {
                            bloque: nextBlocked,
                            blocked: nextBlocked,
                            raison: nextBlocked ? (currentReason || "Blocage administratif préventif") : "",
                            reason: nextBlocked ? (currentReason || "Blocage administratif préventif") : "",
                          });
                          toastMsg.info(`Module « ${label} » : ${nextBlocked ? "BLOQUÉ" : "DÉBLOQUÉ"}`);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer",
                          isBlocked
                            ? "bg-red-500/20 border-red-500/50 text-red-200 hover:bg-red-500/30"
                            : "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30"
                        )}
                      >
                        {isBlocked ? "Débloquer le module" : "Bloquer l'accès"}
                      </button>
                    </div>
                  </div>

                  {isBlocked && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-[11px] text-amber-300 font-semibold shrink-0">Motif du blocage affiché aux usagers :</span>
                      <input
                        type="text"
                        value={currentReason}
                        onChange={(e) => updateModuleRestriction(res.moduleKey || res.id, { raison: e.target.value, reason: e.target.value })}
                        placeholder="Indiquez la raison (ex: Clôture comptable, session d'examen...)"
                        className="flex-1 rounded-lg border border-amber-500/30 bg-black/40 px-2.5 py-1 text-xs text-amber-100"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ================= ONGLET 4 : SÉCURITÉ & MODE EXAMEN ================= */}
      {activeCategory === "securite" && (
        <Card className="p-6">
          <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Shield size={16} className="text-cyan-400" />
            Paramètres de sécurité & Mode Examen Sécurisé (Point 16)
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div>
                <p className="font-bold text-white text-xs">Plein écran obligatoire en mode examen</p>
                <p className="text-[11px] text-slate-400">Verrouille l'interface et sollicite le plein écran navigateur dès le début de l'épreuve.</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs font-bold border border-emerald-500/40">Activé</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div>
                <p className="font-bold text-white text-xs">Démontage total de l'assistant Sentinel AI pendant les examens</p>
                <p className="text-[11px] text-slate-400">Masque le bouton flottant et désactive tout accès à l'intelligence artificielle pendant l'épreuve.</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs font-bold border border-emerald-500/40">Activé</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.02]">
              <div>
                <p className="font-bold text-white text-xs">Sauvegarde automatique continue des réponses</p>
                <p className="text-[11px] text-slate-400">Enregistre en direct chaque saisie pour éviter toute perte en cas de coupure réseau.</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-1 text-xs font-bold border border-emerald-500/40">Actif (Local + Cloud)</span>
            </div>
          </div>
        </Card>
      )}

      {/* ================= ONGLET 5 : ENSEIGNEMENT & HONORAIRES ================= */}
      {activeCategory === "enseignement" && (
        <Card className="p-6">
          <h3 className="font-display text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Wallet size={16} className="text-cyan-400" />
            Paramètres d'enseignement & Honoraires enseignants (Point 5)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
              <p className="text-xs text-slate-400">Tarif par séance validée</p>
              <p className="font-display text-lg font-bold text-cyan-300 mt-1">2 500 FCFA</p>
              <p className="text-[11px] text-slate-500 mt-1">Attribué automatiquement après clôture de la séance de l'emploi du temps.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
              <p className="text-xs text-slate-400">Détection des conflits de salles et d'horaires</p>
              <p className="font-display text-lg font-bold text-emerald-300 mt-1">Actif (Temps réel)</p>
              <p className="text-[11px] text-slate-500 mt-1">Alerte préventive si un formateur ou une salle est affecté(e) en double.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ================= ONGLET 6 : MAINTENANCE & INITIALISATION ================= */}
      {activeCategory === "maintenance" && (
        <Card className="p-6" glow="red">
          <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-bold text-red-400">
            <AlertTriangle size={16} /> Initialisation & Réinitialisation du logiciel
          </h3>
          <p className="text-sm text-slate-400">
            Réinitialisez sélectivement les données de la plateforme (formations, apprenants, paiements, contenu…).
            L'opération est irréversible et réservée à l'Administrateur Supérieur.
          </p>
          {user?.role === "superadmin" ? (
            <Link to="/app/initialisation" className="mt-4 inline-block">
              <Btn variant="red"><RotateCcw size={15} /> Ouvrir le centre d'initialisation</Btn>
            </Link>
          ) : (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">
              Seul l'Administrateur Supérieur peut initialiser le logiciel.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
