import React, { useEffect, useState } from "react";
import { Key, Webhook, Plus, ShieldCheck, Copy, Check, Trash2, Globe, Award, Sparkles } from "lucide-react";
import { webhookService, ApiKeyItem, WebhookEndpoint } from "@/modules/api/services/webhookService";
import { gamificationService } from "@/modules/gamification/services/gamificationService";
import { i18nService, SUPPORTED_LOCALES, SupportedLocale } from "@/modules/i18n/services/i18nService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Select } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const IntegrationsAndWebhooksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"api" | "webhooks" | "system">("api");
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [showAddKey, setShowAddKey] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Gamification & Langue
  const [gamificationActive, setGamificationActive] = useState<boolean>(gamificationService.isEnabled());
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(i18nService.getLocale());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [keys, whs] = await Promise.all([
      webhookService.getApiKeys(),
      webhookService.getWebhooks(),
    ]);
    setApiKeys(keys);
    setWebhooks(whs);
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      toastMsg.error("Nom requis", "Veuillez renseigner un nom pour cette clé d'API.");
      return;
    }
    try {
      const res = await webhookService.createApiKey(newKeyName.trim());
      setCreatedKeySecret(res.fullKey);
      loadData();
    } catch (err: any) {
      toastMsg.error("Erreur", err.message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir révoquer cette clé ? Les applications connectées perdront immédiatement l'accès.")) return;
    const res = await webhookService.revokeApiKey(id);
    if (res.success) {
      toastMsg.success("Clé révoquée", "La clé d'API est maintenant invalide.");
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    const res = await webhookService.createWebhook(newWebhookUrl.trim(), ["grade.published", "student.enrolled"]);
    if (res.success) {
      toastMsg.success("Webhook enregistré", "Les événements seront expédiés à cette URL.");
      setShowAddWebhook(false);
      setNewWebhookUrl("");
      loadData();
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleToggleGamification = (enabled: boolean) => {
    gamificationService.setEnabled(enabled);
    setGamificationActive(enabled);
    toastMsg.info(
      enabled ? "Gamification activée" : "Gamification désactivée",
      "Le système de badges et points a été mis à jour."
    );
  };

  const handleChangeLocale = (loc: SupportedLocale) => {
    i18nService.setLocale(loc);
    setCurrentLocale(loc);
    toastMsg.success("Langue modifiée", `Interface configurée en ${SUPPORTED_LOCALES.find(l => l.code === loc)?.name}.`);
  };

  const handleCopySecret = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toastMsg.success("Clé copiée !", "Conservez-la en lieu sûr, elle ne sera plus affichée.");
    setTimeout(() => setCopiedKey(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Intégrations, API Publique & Webhooks (Bêta — Simulation)"
        subtitle="Interconnexions externes, signatures HMAC SHA-256, gestion des jetons (Environnement sandbox / Bêta contrôlé)"
        actions={
          <div className="flex gap-2">
            {activeTab === "api" && (
              <Btn onClick={() => { setShowAddKey(true); setCreatedKeySecret(null); }} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
                <Plus size={14} /> Nouvelle Clé d'API
              </Btn>
            )}
            {activeTab === "webhooks" && (
              <Btn onClick={() => setShowAddWebhook(true)} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
                <Plus size={14} /> Nouveau Webhook
              </Btn>
            )}
          </div>
        }
      />

      {/* Avertissement de sécurité Bêta / Simulation */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-xs flex items-center gap-2">
        <ShieldCheck size={16} className="text-amber-400 shrink-0" />
        <span>
          <strong>Mode Bêta (Simulation sécurisée) :</strong> Les clés d'API sont cryptographiquement générées (32 octets aléatoires CSPRNG, hash SHA-256) et réservées aux superadministrateurs. Les livraisons webhooks sont journalisées en simulation pour préserver la sécurité du réseau avant le déploiement de la passerelle de production.
        </span>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "api" ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          🔑 Clés d'API Publique ({apiKeys.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "webhooks" ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          📡 Webhooks Sortants ({webhooks.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
            activeTab === "system" ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
          }`}
        >
          ⚙️ Options Système (Gamification & Langues)
        </button>
      </div>

      {activeTab === "api" && (
        <Card className="overflow-hidden border border-white/10 bg-black/60">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key size={16} className="text-red-500" />
              Clés d'API Enregistrées
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Accès programmatique sécurisé à l'API de Sentinelles Numériques avec portée granulaire.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white">
              <thead className="bg-[#E60000] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Nom</th>
                  <th className="p-3">Préfixe</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date de création</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {apiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-white/50">
                      Aucune clé d'API active. Créez-en une pour connecter un outil externe.
                    </td>
                  </tr>
                ) : (
                  apiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-semibold text-white">{k.name}</td>
                      <td className="p-3 font-mono text-white/80">{k.key_prefix}</td>
                      <td className="p-3">
                        <Badge color={k.revoked ? "red" : "green"}>
                          {k.revoked ? "RÉVOQUÉE" : "ACTIVE"}
                        </Badge>
                      </td>
                      <td className="p-3 text-white/60 font-mono">{k.created_at.slice(0, 10)}</td>
                      <td className="p-3 text-right">
                        {!k.revoked && (
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(k.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-bold cursor-pointer"
                          >
                            Révoquer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "webhooks" && (
        <Card className="overflow-hidden border border-white/10 bg-black/60">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Webhook size={16} className="text-red-500" />
              Endpoints Webhooks Actifs
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Notifications HTTP POST signées en HMAC SHA-256 lors de la publication de notes ou d'inscriptions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-white">
              <thead className="bg-[#E60000] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">URL du Récepteur</th>
                  <th className="p-3">Événements</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Secret HMAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-white/50">
                      Aucun webhook configuré.
                    </td>
                  </tr>
                ) : (
                  webhooks.map((w) => (
                    <tr key={w.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-mono font-semibold text-white">{w.url}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {w.events.map((e) => (
                            <span key={e} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge color={w.active ? "green" : "red"}>{w.active ? "ACTIF" : "INACTIF"}</Badge>
                      </td>
                      <td className="p-3 font-mono text-white/50 text-[11px]">whsec_••••••••</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === "system" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module N13: Gamification */}
          <Card className="p-5 border border-white/10 bg-black/60 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Award size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm text-white">Gamification & Badges (N13)</h3>
              </div>
              <Badge color={gamificationActive ? "green" : "red"}>
                {gamificationActive ? "ACTIVÉE" : "DÉSACTIVÉE"}
              </Badge>
            </div>

            <p className="text-xs text-white/70">
              Attribue automatiquement des badges de régularité et d'assiduité aux apprenants (100% présence, devoirs à temps, entraide forum).
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-white">Statut global :</span>
              <button
                type="button"
                onClick={() => handleToggleGamification(!gamificationActive)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  gamificationActive
                    ? "bg-red-600 text-white"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {gamificationActive ? "Désactiver la gamification" : "Activer la gamification"}
              </button>
            </div>
          </Card>

          {/* Module N14: Multilingue */}
          <Card className="p-5 border border-white/10 bg-black/60 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-cyan-400" />
                <h3 className="font-bold text-sm text-white">Langue & Dictionnaires (N14)</h3>
              </div>
              <Badge color="blue">{SUPPORTED_LOCALES.find(l => l.code === currentLocale)?.name}</Badge>
            </div>

            <p className="text-xs text-white/70">
              Sentinelles Numériques supporte le Français officiel, le Lingála national et l'Anglais technique sans altérer la logique métier.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc.code}
                  type="button"
                  onClick={() => handleChangeLocale(loc.code)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    currentLocale === loc.code
                      ? "border-red-500 bg-[#E60000] text-white font-bold"
                      : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                  }`}
                >
                  <span className="text-base block">{loc.flag}</span>
                  <span className="text-xs block mt-1">{loc.name}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Modal Créer Clé API */}
      <Modal open={showAddKey} onClose={() => setShowAddKey(false)} title="Générer une clé d'API">
        <div className="space-y-4">
          {!createdKeySecret ? (
            <>
              <Field label="Nom de l'application cliente">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="ex: Script de synchronisation Paie"
                />
              </Field>
              <Btn onClick={handleCreateApiKey} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold">
                Générer la clé
              </Btn>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-amber-300 font-bold">
                ⚠️ Copiez immédiatement cette clé d'API ! Pour des raisons de sécurité, elle ne sera plus jamais affichée.
              </p>
              <div className="flex gap-2">
                <Input value={createdKeySecret} readOnly className="font-mono text-xs text-white" />
                <Btn onClick={() => handleCopySecret(createdKeySecret)} className="bg-[#E60000] text-white">
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                </Btn>
              </div>
              <Btn onClick={() => setShowAddKey(false)} variant="outline" className="w-full">
                J'ai copié ma clé
              </Btn>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Créer Webhook */}
      <Modal open={showAddWebhook} onClose={() => setShowAddWebhook(false)} title="Ajouter un endpoint webhook">
        <div className="space-y-4">
          <Field label="URL cible HTTPS">
            <Input
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://api.monserveur.cg/webhooks/sentinelles"
            />
          </Field>
          <Btn onClick={handleCreateWebhook} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold">
            Enregistrer l'endpoint
          </Btn>
        </div>
      </Modal>
    </div>
  );
};
