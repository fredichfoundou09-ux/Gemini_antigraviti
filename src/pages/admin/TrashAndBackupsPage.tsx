import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  RefreshCw,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Eye,
  Clock,
  User,
  Layers,
  XCircle,
  Printer,
} from "lucide-react";
import { Card, Btn, Badge, Modal, PageHead, Empty, printHTML } from "@/lib/ui";
import {
  trashService,
  TrashItem,
  SystemBackup,
  SimulationResult,
} from "@/modules/admin/services/trashService";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin, isAdmin } from "@/lib/supabase/permissions";

export default function TrashAndBackupsPage() {
  const { profile } = useAuth();
  const isStaffUser = isSuperAdmin(profile) || isAdmin(profile);

  const [activeTab, setActiveTab] = useState<"trash" | "backups">("trash");

  // État Corbeille
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modales Corbeille
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeDays, setPurgeDays] = useState<number>(30);
  const [confirmPurgeImmediate, setConfirmPurgeImmediate] = useState(false);

  // État Sauvegardes
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupTitle, setBackupTitle] = useState("");
  const [createBackupModalOpen, setCreateBackupModalOpen] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Modale Simulation
  const [simulationModalOpen, setSimulationModalOpen] = useState(false);
  const [simulatingBackupId, setSimulatingBackupId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Notifications locales
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showNotice = (type: "success" | "error", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 5000);
  };

  const loadTrash = useCallback(async () => {
    setLoadingTrash(true);
    const { data, error } = await trashService.getTrashItems(
      typeFilter === "all" ? undefined : typeFilter
    );
    if (error) {
      showNotice("error", `Erreur corbeille: ${error}`);
    } else {
      setTrashItems(data);
    }
    setLoadingTrash(false);
  }, [typeFilter]);

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    const { data, error } = await trashService.getSystemBackups();
    if (error) {
      showNotice("error", `Erreur sauvegardes: ${error}`);
    } else {
      setBackups(data);
    }
    setLoadingBackups(false);
  }, []);

  useEffect(() => {
    if (activeTab === "trash") {
      loadTrash();
    } else {
      loadBackups();
    }
  }, [activeTab, loadTrash, loadBackups]);

  // Actions Corbeille
  const handleRestore = async (item: TrashItem) => {
    setActionLoading(item.id);
    const { success, error } = await trashService.restoreItem(item.entity_type, item.id);
    if (!success) {
      showNotice("error", `Échec de restauration: ${error}`);
    } else {
      showNotice("success", `« ${item.label} » a été restauré avec succès.`);
      loadTrash();
    }
    setActionLoading(null);
  };

  const handlePurge = async () => {
    setActionLoading("purge");
    const days = confirmPurgeImmediate ? 0 : purgeDays;
    const { success, purgedCount, error } = await trashService.purgeDeletedItems("all", days);
    if (!success) {
      showNotice("error", `Échec de la purge: ${error}`);
    } else {
      showNotice(
        "success",
        `Purge définitive effectuée: ${purgedCount} élément(s) supprimé(s).`
      );
      setPurgeModalOpen(false);
      setConfirmPurgeImmediate(false);
      loadTrash();
    }
    setActionLoading(null);
  };

  // Actions Sauvegardes
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    const title = backupTitle.trim() || `Sauvegarde manuelle du ${new Date().toLocaleDateString("fr-FR")}`;
    const { success, error } = await trashService.createSystemBackup(title);
    if (!success) {
      showNotice("error", `Erreur création sauvegarde: ${error}`);
    } else {
      showNotice("success", "Instantané de sauvegarde créé avec succès.");
      setCreateBackupModalOpen(false);
      setBackupTitle("");
      loadBackups();
    }
    setCreatingBackup(false);
  };

  const handleSimulateRestore = async (b: SystemBackup) => {
    setSimulatingBackupId(b.id);
    const { success, simulation, error } = await trashService.simulateRestoreBackup(b.id);
    if (!success || !simulation) {
      showNotice("error", `Erreur simulation: ${error}`);
    } else {
      setSimulationResult(simulation);
      setSimulationModalOpen(true);
    }
    setSimulatingBackupId(null);
  };

  const handleDownloadBackup = (b: SystemBackup) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(b, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sentinel-backup-${b.title.replace(/\s+/g, "_")}-${b.id.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice("success", "Export de la sauvegarde téléchargé au format JSON.");
  };

  const handleDeleteBackup = async (b: SystemBackup) => {
    if (!window.confirm(`Supprimer définitivement la sauvegarde « ${b.title} » ?`)) return;
    const { success, error } = await trashService.deleteSystemBackup(b.id);
    if (!success) {
      showNotice("error", `Échec de suppression: ${error}`);
    } else {
      showNotice("success", "Sauvegarde supprimée avec succès.");
      loadBackups();
    }
  };

  const handlePrintAudit = () => {
    const rowsHtml =
      activeTab === "trash"
        ? trashItems
            .map(
              (i) => `
          <tr>
            <td><strong>${i.label}</strong></td>
            <td><span class="badge-official">${i.entity_type}</span></td>
            <td>${i.deleted_by_name || 'Système'}</td>
            <td>${new Date(i.deleted_at).toLocaleString('fr-FR')}</td>
          </tr>
        `
            )
            .join("")
        : backups
            .map(
              (b) => `
          <tr>
            <td><strong>${b.title}</strong></td>
            <td>${b.tables_included.join(', ')}</td>
            <td>${b.record_counts ? JSON.stringify(b.record_counts) : '—'}</td>
            <td>${new Date(b.created_at).toLocaleString('fr-FR')}</td>
          </tr>
        `
            )
            .join("");

    printHTML(
      activeTab === "trash" ? "Rapport d'Audit — Corbeille Système" : "Rapport d'Audit — Sauvegardes Système",
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px">
          <span class="badge-official">RÉSILIENCE N1 · SÉCURITÉ & AUDIT</span>
          <h1 style="margin:8px 0 4px 0;font-size:18px;color:#0c4a6e">
            ${activeTab === "trash" ? "État de la Corbeille (Éléments en rétention)" : "Catalogue des Sauvegardes Système"}
          </h1>
          <p style="margin:0;font-size:11px;color:#64748b">Émis le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} · Opérateur : ${profile?.name || 'Administrateur'}</p>
        </div>

        <table>
          <thead>
            <tr>
              ${
                activeTab === "trash"
                  ? '<th>Élément</th><th>Type</th><th>Supprimé par</th><th>Date de suppression</th>'
                  : '<th>Intitulé</th><th>Tables incluses</th><th>Enregistrements</th><th>Date de création</th>'
              }
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="4" style="text-align:center;color:#64748b">Aucun élément à signaler.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
    );
  };

  const filteredTrash = trashItems.filter((i) => {
    if (!searchFilter.trim()) return true;
    return (
      i.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      i.entity_type.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (i.deleted_by_name && i.deleted_by_name.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  });

  const getEntityBadge = (type: string) => {
    switch (type) {
      case "tests":
        return <Badge color="red">Examen</Badge>;
      case "test_results":
        return <Badge color="gold">Résultat</Badge>;
      case "assignments":
        return <Badge color="cyan">Devoir</Badge>;
      case "assignment_submissions":
        return <Badge color="blue">Remise</Badge>;
      case "students":
        return <Badge color="red">Apprenant</Badge>;
      case "invoices":
        return <Badge color="green">Facture</Badge>;
      case "messages":
        return <Badge color="gray">Message</Badge>;
      default:
        return <Badge color="gray">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Corbeille & Sauvegardes du Système"
        subtitle="Restauration en 1 clic des données supprimées, purge administrative et gestion des sauvegardes sécurisées"
        actions={
          <div className="flex items-center gap-2">
            <Btn onClick={handlePrintAudit} variant="outline" className="border-cyan-500/30 text-cyan-200">
              <Printer size={14} /> Imprimer / PDF
            </Btn>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sn-red)]/40 bg-[var(--sn-black)] px-3 py-1 text-xs font-semibold text-[var(--sn-white)]">
              <Archive className="h-3.5 w-3.5 text-[var(--sn-red)]" />
              Module Résilience N1
            </span>
          </div>
        }
      />

      {/* Notifications locales */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium ${
            notice.type === "success"
              ? "border-emerald-500/40 bg-[var(--sn-black)] text-emerald-400"
              : "border-[var(--sn-red)] bg-[var(--sn-black)] text-[var(--sn-red)]"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--sn-red)]" />
            )}
            <span>{notice.msg}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation par Onglets */}
      <div className="flex border-b border-[var(--sn-line)]">
        <button
          onClick={() => setActiveTab("trash")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "trash"
              ? "border-[var(--sn-red)] text-white"
              : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          <Trash2 className="h-4 w-4 text-[var(--sn-red)]" />
          Corbeille des éléments ({trashItems.length})
        </button>
        <button
          onClick={() => setActiveTab("backups")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "backups"
              ? "border-[var(--sn-red)] text-white"
              : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          <Database className="h-4 w-4 text-[var(--sn-red)]" />
          Sauvegardes Système ({backups.length})
        </button>
      </div>

      {/* VUE 1 : CORBEILLE */}
      {activeTab === "trash" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrer par type de document"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-md border border-[var(--sn-line)] bg-[var(--sn-black)] px-3 py-2 text-xs font-medium text-white focus:border-[var(--sn-red)] focus:outline-none"
              >
                <option value="all">Tous les types</option>
                <option value="tests">Examens</option>
                <option value="test_results">Résultats d'examens</option>
                <option value="assignments">Devoirs</option>
                <option value="assignment_submissions">Remises de devoirs</option>
                <option value="students">Apprenants</option>
                <option value="invoices">Factures</option>
                <option value="messages">Messages</option>
              </select>

              <input
                type="text"
                placeholder="Rechercher par libellé..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="rounded-md border border-[var(--sn-line)] bg-[var(--sn-black)] px-3 py-2 text-xs text-white placeholder-white/40 focus:border-[var(--sn-red)] focus:outline-none"
              />

              <Btn
                variant="ghost"
                onClick={loadTrash}
                disabled={loadingTrash}
                className="text-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingTrash ? "animate-spin" : ""}`}
                />
                Actualiser
              </Btn>
            </div>

            {isStaffUser && (
              <Btn
                variant="red"
                onClick={() => setPurgeModalOpen(true)}
                className="text-xs"
              >
                <XCircle className="h-3.5 w-3.5" />
                Purger définitivement
              </Btn>
            )}
          </div>

          <Card className="overflow-hidden p-0">
            {loadingTrash ? (
              <div className="flex items-center justify-center py-12 text-white/60">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[var(--sn-red)]" />
                Chargement des éléments en corbeille...
              </div>
            ) : filteredTrash.length === 0 ? (
              <Empty
                icon={<Trash2 className="h-10 w-10 text-[var(--sn-red)]/50" />}
                title="La corbeille est vide"
                sub="Aucun élément supprimé n'est actuellement en attente de purge."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--sn-red-fill)] text-xs font-bold uppercase text-white">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Élément / Titre</th>
                      <th className="px-4 py-3">Supprimé le</th>
                      <th className="px-4 py-3">Par</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--sn-line)] bg-[var(--sn-black)]">
                    {filteredTrash.map((item) => (
                      <tr
                        key={`${item.entity_type}-${item.id}`}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getEntityBadge(item.entity_type)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{item.label}</div>
                          <div className="text-xs text-white/50">ID: {item.id}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-white/70">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-white/40" />
                            {new Date(item.deleted_at).toLocaleString("fr-FR")}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-white/70">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-white/40" />
                            {item.deleted_by_name || "Système"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Btn
                            variant="primary"
                            onClick={() => handleRestore(item)}
                            disabled={actionLoading === item.id}
                            className="px-3 py-1.5 text-xs"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${
                                actionLoading === item.id ? "animate-spin" : ""
                              }`}
                            />
                            Restaurer
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* VUE 2 : SAUVEGARDES SYSTÈME */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/70">
              Instantanés de la base de données. Prise en charge de la simulation avant restauration.
            </div>

            {isStaffUser && (
              <div className="flex items-center gap-2">
                <Btn
                  variant="ghost"
                  onClick={loadBackups}
                  disabled={loadingBackups}
                  className="text-xs"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loadingBackups ? "animate-spin" : ""}`}
                  />
                  Actualiser
                </Btn>
                <Btn
                  variant="primary"
                  onClick={() => setCreateBackupModalOpen(true)}
                  className="text-xs"
                >
                  <Database className="h-3.5 w-3.5" />
                  Sauvegarder maintenant
                </Btn>
              </div>
            )}
          </div>

          <Card className="overflow-hidden p-0">
            {loadingBackups ? (
              <div className="flex items-center justify-center py-12 text-white/60">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[var(--sn-red)]" />
                Chargement des instantanés...
              </div>
            ) : backups.length === 0 ? (
              <Empty
                icon={<Database className="h-10 w-10 text-[var(--sn-red)]/50" />}
                title="Aucune sauvegarde enregistrée"
                sub="Créez votre première sauvegarde pour archiver l'état du système."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--sn-red-fill)] text-xs font-bold uppercase text-white">
                    <tr>
                      <th className="px-4 py-3">Intitulé</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Tables incluses</th>
                      <th className="px-4 py-3">Statistiques</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--sn-line)] bg-[var(--sn-black)]">
                    {backups.map((b) => (
                      <tr
                        key={b.id}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{b.title}</div>
                          <div className="text-xs text-white/50">ID: {b.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-white/70">
                          {new Date(b.created_at).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {b.tables_included.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/80"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/80 font-mono">
                          {b.record_counts && (
                            <span>
                              {b.record_counts.students ?? 0} élèves · {b.record_counts.invoices ?? 0} factures · {b.record_counts.tests ?? 0} examens
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color="green">Complète</Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Btn
                              variant="ghost"
                              onClick={() => handleSimulateRestore(b)}
                              disabled={simulatingBackupId === b.id}
                              className="px-2.5 py-1 text-xs"
                              title="Simuler la restauration sans modifier les données"
                            >
                              <Eye className="h-3.5 w-3.5 text-white/70" />
                              Simuler
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() => handleDownloadBackup(b)}
                              className="px-2.5 py-1 text-xs"
                              title="Télécharger l'archive JSON"
                            >
                              <Download className="h-3.5 w-3.5 text-white/70" />
                              Export
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() => handleDeleteBackup(b)}
                              className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40"
                              title="Supprimer cette sauvegarde"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODALE DE PURGE DÉFINITIVE */}
      <Modal
        open={purgeModalOpen}
        onClose={() => setPurgeModalOpen(false)}
        title="Purge Définitive de la Corbeille"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-[var(--sn-red)]/50 bg-[var(--sn-black)] p-3 text-xs text-[var(--sn-red)]">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <strong>Attention :</strong> Cette action détruit définitivement les
              enregistrements sans possibilité de récupération ultérieure.
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="radio"
                name="purgeType"
                checked={!confirmPurgeImmediate}
                onChange={() => setConfirmPurgeImmediate(false)}
                className="accent-[var(--sn-red)]"
              />
              <span>Purger les éléments anciens de plus de :</span>
            </label>

            {!confirmPurgeImmediate && (
              <div className="ml-6 flex items-center gap-2">
                <input
                  aria-label="Nombre de jours d'ancienneté"
                  type="number"
                  min="1"
                  max="365"
                  value={purgeDays}
                  onChange={(e) => setPurgeDays(Number(e.target.value))}
                  className="w-20 rounded-md border border-[var(--sn-line)] bg-[var(--sn-black)] px-3 py-1.5 text-sm text-white focus:border-[var(--sn-red)] focus:outline-none"
                />
                <span className="text-xs text-white/70">jours</span>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="radio"
                name="purgeType"
                checked={confirmPurgeImmediate}
                onChange={() => setConfirmPurgeImmediate(true)}
                className="accent-[var(--sn-red)]"
              />
              <span className="text-[var(--sn-red)] font-semibold">
                Purger immédiatement l'ensemble de la corbeille (délai 0 jour)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Btn variant="ghost" onClick={() => setPurgeModalOpen(false)}>
              Annuler
            </Btn>
            <Btn
              variant="red"
              onClick={handlePurge}
              disabled={actionLoading === "purge"}
            >
              {actionLoading === "purge" ? "Purge en cours..." : "Confirmer la purge"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* MODALE CRÉATION SAUVEGARDE */}
      <Modal
        open={createBackupModalOpen}
        onClose={() => setCreateBackupModalOpen(false)}
        title="Créer une sauvegarde du système"
      >
        <div className="space-y-4">
          <p className="text-xs text-white/70">
            Un instantané de la configuration, des formations, des apprenants et des métriques sera archivé dans la table des sauvegardes.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-white/70 mb-1">
              Libellé de la sauvegarde
            </label>
            <input
              type="text"
              placeholder={`Ex: Sauvegarde avant clôture du ${new Date().toLocaleDateString("fr-FR")}`}
              value={backupTitle}
              onChange={(e) => setBackupTitle(e.target.value)}
              className="w-full rounded-md border border-[var(--sn-line)] bg-[var(--sn-black)] px-3.5 py-2 text-sm text-white focus:border-[var(--sn-red)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setCreateBackupModalOpen(false)}>
              Annuler
            </Btn>
            <Btn
              variant="primary"
              onClick={handleCreateBackup}
              disabled={creatingBackup}
            >
              {creatingBackup ? "Création..." : "Enregistrer la sauvegarde"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* MODALE DE SIMULATION DE RESTAURATION */}
      <Modal
        open={simulationModalOpen}
        onClose={() => setSimulationModalOpen(false)}
        title="Aperçu & Simulation de Restauration"
      >
        {simulationResult && (
          <div className="space-y-4 text-xs">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-950/20 p-3 text-emerald-300">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Vérification de cohérence réussie
              </div>
              <p className="mt-1">
                {simulationResult.differences.recommendation}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-3">
                <div className="font-semibold text-white/60 uppercase">Données dans la sauvegarde</div>
                <div className="mt-2 space-y-1 font-mono text-white/90">
                  {Object.entries(simulationResult.checks.backup_record_counts).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}:</span>
                      <span className="font-bold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-3">
                <div className="font-semibold text-white/60 uppercase">Données actuelles en base</div>
                <div className="mt-2 space-y-1 font-mono text-white/90">
                  {Object.entries(simulationResult.current_record_counts).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}:</span>
                      <span className="font-bold">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/70">Conflits d'intégrité détectés :</span>
                <span className="font-mono font-bold text-emerald-400">
                  {simulationResult.differences.conflicts_detected}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Politiques RLS actives :</span>
                <span className="font-mono font-bold text-emerald-400">
                  {simulationResult.checks.rls_intact ? "Conformes" : "Erreur"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Impact destructif :</span>
                <span className="font-mono font-bold text-emerald-400">
                  {simulationResult.is_destructive ? "Oui" : "Non (Simulation transparente)"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Btn variant="primary" onClick={() => setSimulationModalOpen(false)}>
                Fermer l'aperçu
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
