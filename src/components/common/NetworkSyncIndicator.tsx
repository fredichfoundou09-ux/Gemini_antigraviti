import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, Zap, ZapOff, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getOfflineQueue,
  syncOfflineQueue,
  isDataSaverEnabled,
  setDataSaverEnabled,
  QueuedOperation,
} from "@/lib/offlineQueue";
import { toastMsg } from "@/lib/toast";

export const NetworkSyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [dataSaver, setDataSaver] = useState<boolean>(isDataSaverEnabled());
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const [recentSyncMsg, setRecentSyncMsg] = useState<string | null>(null);

  const refreshCount = async () => {
    const q = await getOfflineQueue();
    setQueueCount(q.length);
  };

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      toastMsg.info("Connexion rétablie", "Synchronisation des opérations en attente...");
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toastMsg.warning("Mode hors-ligne activé", "Vos pointages et brouillons seront conservés localement.");
    };

    const handleQueueUpdated = (e: any) => {
      if (typeof e?.detail?.count === "number") {
        setQueueCount(e.detail.count);
      } else {
        refreshCount();
      }
    };

    const handleDataSaverChanged = (e: any) => {
      setDataSaver(e.detail?.enabled ?? isDataSaverEnabled());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("sentinelles:queue-updated", handleQueueUpdated);
    window.addEventListener("sentinelles:data-saver-changed", handleDataSaverChanged);

    const interval = setInterval(refreshCount, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("sentinelles:queue-updated", handleQueueUpdated);
      window.removeEventListener("sentinelles:data-saver-changed", handleDataSaverChanged);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) {
      toastMsg.warning("Réseau indisponible", "Impossible de synchroniser sans connexion.");
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      await refreshCount();
      if (res.synced > 0 || res.conflicts > 0 || res.failed > 0) {
        setRecentSyncMsg(`${res.synced} synchronisé(s), ${res.conflicts} conflits, ${res.failed} échecs`);
        toastMsg.success("Synchronisation terminée", `${res.synced} élément(s) synchronisé(s).`);
      } else {
        setRecentSyncMsg("File locale à jour");
      }
    } catch (err: any) {
      toastMsg.error("Erreur de synchronisation", err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleDataSaver = () => {
    const next = !dataSaver;
    setDataSaverEnabled(next);
    setDataSaver(next);
    if (next) {
      toastMsg.info("Mode Économie de données activé", "Compression d'images automatique (~300 Ko) et vidéos bloquées.");
    } else {
      toastMsg.info("Mode Économie de données désactivé", "Résolution maximale rétablie.");
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
          !isOnline
            ? "border-red-500/60 bg-red-950/40 text-red-200 shadow-[0_0_10px_rgba(255,0,0,0.3)]"
            : queueCount > 0
            ? "border-amber-500/60 bg-amber-950/30 text-amber-200"
            : "border-white/15 bg-white/[0.04] text-white hover:border-red-500/40 hover:bg-white/[0.08]"
        }`}
        title={isOnline ? "Connexion active" : "Hors ligne (file active)"}
        aria-label="Statut réseau et synchronisation"
      >
        {isOnline ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        ) : (
          <WifiOff size={14} className="text-red-400 animate-pulse" />
        )}

        <span className="hidden md:inline font-mono text-[11px]">
          {isOnline ? "En ligne" : "Hors ligne"}
        </span>

        {queueCount > 0 && (
          <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-black text-white">
            {queueCount}
          </span>
        )}

        {dataSaver && (
          <span title="Économie de données active" className="inline-flex">
            <Zap size={11} className="text-amber-400 ml-0.5" />
          </span>
        )}
      </button>

      {/* Popover de détail synchronisation et économie de données */}
      {showPopover && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/20 bg-black/95 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl z-50 text-white space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi size={16} className="text-emerald-400" />
              ) : (
                <WifiOff size={16} className="text-red-400" />
              )}
              <span className="font-bold text-xs">
                {isOnline ? "Connexion Internet Active" : "Mode Hors-ligne"}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isOnline ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30" : "bg-red-950 text-red-300 border border-red-500/30"
              }`}
            >
              {isOnline ? "CONNECTÉ" : "OFFLINE"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-white/80">
            <div className="flex justify-between items-center">
              <span>Opérations locales en attente :</span>
              <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                {queueCount}
              </span>
            </div>
            {recentSyncMsg && (
              <p className="text-[10px] text-white/60 italic">{recentSyncMsg}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1 border-t border-white/10">
            <button
              type="button"
              disabled={isSyncing || !isOnline || queueCount === 0}
              onClick={handleSync}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/60 bg-[#E60000] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#FF2A2A] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sync..." : "Synchroniser"}
            </button>

            <button
              type="button"
              onClick={toggleDataSaver}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                dataSaver
                  ? "border-amber-400 bg-amber-950/60 text-amber-200"
                  : "border-white/15 bg-white/5 text-white/70 hover:text-white"
              }`}
              title="Mode économique (compression images ~300 Ko, vidéos bloquées)"
            >
              {dataSaver ? <Zap size={14} className="text-amber-400" /> : <ZapOff size={14} />}
              <span className="text-[11px]">{dataSaver ? "Éco actif" : "Mode éco"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
