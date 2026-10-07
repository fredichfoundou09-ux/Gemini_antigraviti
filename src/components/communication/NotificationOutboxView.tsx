import { useState, useEffect } from "react";
import {
  Inbox,
  RefreshCw,
  Share2,
  Mail,
  Bell,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
} from "lucide-react";
import { Card, Btn, Badge } from "@/lib/ui";
import {
  notificationService,
  OutboxItem,
} from "@/modules/notifications/services/notificationService";

export function NotificationOutboxView() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOutbox = async () => {
    setLoading(true);
    const res = await notificationService.getOutbox(statusFilter);
    setItems(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadOutbox();
  }, [statusFilter]);

  const handleMarkSent = async (id: string) => {
    setActionLoading(id);
    const res = await notificationService.markOutboxSent(id);
    if (res.success) {
      setNotice("Notification marquée comme expédiée ✓");
      setTimeout(() => setNotice(null), 3000);
      loadOutbox();
    }
    setActionLoading(null);
  };

  const handleOpenDirect = (item: OutboxItem) => {
    const link = notificationService.generateDirectSendLink(item);
    if (link && link !== "#") {
      window.open(link, "_blank");
      handleMarkSent(item.id);
    }
  };

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case "whatsapp":
        return <Badge color="green">WhatsApp</Badge>;
      case "email":
        return <Badge color="blue">E-mail</Badge>;
      case "push":
        return <Badge color="red">Push</Badge>;
      case "sms":
        return <Badge color="gold">SMS</Badge>;
      default:
        return <Badge color="gray">{ch}</Badge>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Envoyé
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sn-red)]">
            <AlertTriangle className="h-3 w-3" /> Échec
          </span>
        );
      case "prepared":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
            <ExternalLink className="h-3 w-3" /> Préparé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white/70">
            <Clock className="h-3 w-3" /> En attente
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--sn-line)] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Send className="h-4 w-4 text-[var(--sn-red)]" />
            Journal d'Envoi & File Multicanal (Outbox)
          </h3>
          <p className="text-xs text-white/60">
            Suivi des relances et des alertes émises via WhatsApp, E-mail, Push et SMS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrer par statut d'envoi"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-[var(--sn-line)] bg-[var(--sn-black)] px-2.5 py-1 text-xs text-white"
          >
            <option value="all">Tous les états</option>
            <option value="pending">En attente</option>
            <option value="sent">Envoyés</option>
            <option value="failed">Échecs</option>
            <option value="prepared">Préparés</option>
          </select>

          <Btn variant="ghost" onClick={loadOutbox} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Btn>
        </div>
      </div>

      {notice && (
        <div className="rounded border border-[var(--sn-line)] bg-white/[0.03] p-3 text-xs text-white">
          {notice}
        </div>
      )}

      <Card className="overflow-hidden p-0 border-[var(--sn-line)] bg-[var(--sn-black)]">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/50">
            Chargement de la file d'envoi...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-white/50">
            Aucun message dans le journal d'envoi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] border-b border-[var(--sn-line)] text-[10px] font-bold uppercase text-white/60">
                <tr>
                  <th className="px-3 py-2.5">Canal</th>
                  <th className="px-3 py-2.5">Destinataire</th>
                  <th className="px-3 py-2.5">Objet / Contenu</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sn-line)]">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {getChannelBadge(item.channel)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-white">
                        {item.recipient_name || "Utilisateur"}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {item.recipient_contact || item.recipient_id}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-xs">
                      <div className="font-medium text-white truncate">{item.subject}</div>
                      <div className="text-[10px] text-white/50 truncate">{item.content}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-white/60">
                      {new Date(item.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {item.channel === "whatsapp" || item.channel === "email" ? (
                        <Btn
                          variant="ghost"
                          onClick={() => handleOpenDirect(item)}
                          className="px-2 py-1 text-[11px]"
                          title="Ouvrir directement l'application pré-remplie"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ouvrir ({item.channel === "whatsapp" ? "WA" : "Mail"})
                        </Btn>
                      ) : item.status !== "sent" ? (
                        <Btn
                          variant="ghost"
                          onClick={() => handleMarkSent(item.id)}
                          disabled={actionLoading === item.id}
                          className="px-2 py-1 text-[11px]"
                        >
                          Marquer envoyé
                        </Btn>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
