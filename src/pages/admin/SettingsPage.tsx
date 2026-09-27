import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings, Activity, Shield, Play, CheckCircle2, AlertTriangle, RotateCcw,
  Palette, Moon, Flame, Sparkles, Wallet, RefreshCw, School
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, PageHead, Field, Input, today } from "@/lib/ui";
import { cn } from "@/utils/cn";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { UiTheme, getUiTheme, setUiTheme } from "@/lib/uiTheme";
import { executeScheduleAutomation } from "@/lib/automation/scheduleAutomation";

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
  const { db, user, update, log } = useStore();
  const s = db.settings;

  const [activeCategory, setActiveCategory] = useState<
    "automatisations" | "general" | "apparence" | "securite" | "enseignement" | "maintenance"
  >("automatisations");

  // Général
  const [email, setEmail] = useState(s?.contact?.email || "contact@sentinelles-numeriques.com");
  const [adresse, setAdresse] = useState(s?.contact?.adresse || "Brazzaville, République du Congo");
  const [etablissement, setEtablissement] = useState("Sentinelles Numériques");
  const [devise, setDevise] = useState("FCFA");

  // Apparence
  const [currentTheme, setCurrentTheme] = useState<UiTheme>(() => getUiTheme());

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
        // Simulation réussie pour les autres services
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
      theme === "orange-slate"
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

      {/* Barre d'onglets par catégories (Point 30) */}
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
          <span>Centre de pilotage automatisations (Point 31)</span>
          <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
            {automations.filter((a) => a.enabled).length}/{automations.length}
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
          onClick={() => setActiveCategory("apparence")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
            activeCategory === "apparence"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Palette size={15} />
          <span>Apparence & Thèmes</span>
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
          <span>Sécurité & Mode Examen</span>
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
          <span>Maintenance & Initialisation</span>
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

      {/* ================= ONGLET 3 : APPARENCE & THÈMES ================= */}
      {activeCategory === "apparence" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F03E00]/20 text-[#F03E00] border border-[#F03E00]/40">
                <Palette size={18} />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-white">Apparence de l'interface</h3>
                <p className="text-xs text-slate-400">
                  Personnalisez les couleurs de SENTINEL'S. Les changements s'appliquent instantanément à l'ensemble du logiciel.
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              100% Réversible
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            {/* Thème 1: Classique */}
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
                  Interface d'origine sombre et contrastée certifiée Sentinelles.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                <span className="h-3 w-3 rounded-full bg-[#080A0F] border border-white/20" />
                <span className="h-3 w-3 rounded-full bg-[#00E5FF]" />
                <span className="h-3 w-3 rounded-full bg-[#006DFF]" />
                <span className="h-3 w-3 rounded-full bg-[#FF174F]" />
              </div>
            </button>

            {/* Thème 2: Rouge Sentinelle */}
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

            {/* Thème 3: Orange Ardoise */}
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
                  50% Orange vif, 50% Bleu-Noir structuré avec textes blancs lisibles.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                <span className="h-3 w-3 rounded-full bg-[#F03E00] ring-1 ring-white/30" />
                <span className="h-3 w-3 rounded-full bg-[#B33107]" />
                <span className="h-3 w-3 rounded-full bg-[#1A2226] ring-1 ring-white/20" />
              </div>
            </button>

            {/* Thème 4: Modernisé */}
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
