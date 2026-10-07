import { useState, useEffect } from "react";
import {
  Bell,
  RefreshCw,
  Save,
  MessageSquare,
  Mail,
  Smartphone,
  Share2,
} from "lucide-react";
import { Card, Btn, Badge, Modal } from "@/lib/ui";
import {
  notificationService,
  NotificationTemplate,
} from "@/modules/notifications/services/notificationService";

export function NotificationTemplatesView() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editMode, setEditMode] = useState<NotificationTemplate["mode"]>("hybrid");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const res = await notificationService.getTemplates();
    setTemplates(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEdit = (tpl: NotificationTemplate) => {
    setEditingTemplate(tpl);
    setEditSubject(tpl.subject_template);
    setEditBody(tpl.body_template);
    setEditMode(tpl.mode);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    const res = await notificationService.updateTemplate(editingTemplate.code, {
      subject_template: editSubject,
      body_template: editBody,
      mode: editMode,
    });

    if (res.success) {
      setNotice(`Modèle « ${editingTemplate.title} » mis à jour avec succès.`);
      setTimeout(() => setNotice(null), 4000);
      setEditingTemplate(null);
      loadTemplates();
    } else {
      setNotice(`Erreur : ${res.error}`);
    }
    setSaving(false);
  };

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "whatsapp":
        return <Share2 className="h-3 w-3 text-emerald-400" />;
      case "email":
        return <Mail className="h-3 w-3 text-sky-400" />;
      case "push":
        return <Bell className="h-3 w-3 text-[var(--sn-red)]" />;
      case "sms":
        return <Smartphone className="h-3 w-3 text-amber-400" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--sn-line)] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-[var(--sn-red)]" />
            Modèles de Notifications Multicanal (Module N2)
          </h3>
          <p className="text-xs text-white/60">
            Paramétrez les relances, alertes et notifications automatiques ou assistées.
          </p>
        </div>

        <Btn variant="ghost" onClick={loadTemplates} disabled={loading} className="text-xs">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Btn>
      </div>

      {notice && (
        <div className="rounded border border-[var(--sn-line)] bg-white/[0.03] p-3 text-xs text-white">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-white/50">
          Chargement des modèles...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="p-4 border-[var(--sn-line)] bg-[var(--sn-black)] flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-xs">{tpl.title}</h4>
                    <span className="font-mono text-[10px] text-white/50">code: {tpl.code}</span>
                  </div>
                  <Badge color={tpl.mode === "automatic" ? "green" : tpl.mode === "hybrid" ? "gold" : "gray"}>
                    {tpl.mode === "automatic" ? "Automatique" : tpl.mode === "hybrid" ? "Hybride" : "Manuel"}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-white/40">Canaux :</span>
                  <div className="flex items-center gap-1.5">
                    {tpl.channels.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/80"
                      >
                        {getChannelIcon(c)} {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 rounded border border-[var(--sn-line)] bg-white/[0.02] p-2.5 text-xs">
                  <div>
                    <strong className="text-white/60 text-[10px] uppercase block">Objet :</strong>
                    <span className="text-white font-medium">{tpl.subject_template}</span>
                  </div>
                  <div>
                    <strong className="text-white/60 text-[10px] uppercase block">Corps :</strong>
                    <p className="text-white/80 whitespace-pre-wrap">{tpl.body_template}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {tpl.variables.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/60"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Btn variant="ghost" onClick={() => handleEdit(tpl)} className="text-xs px-3 py-1">
                  Modifier le modèle
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODALE D'ÉDITION */}
      <Modal
        open={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={`Modifier le modèle : ${editingTemplate?.title}`}
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold uppercase text-white/70 mb-1">
              Mode de déclenchement
            </label>
            <select
              aria-label="Mode de déclenchement"
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as any)}
              className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
            >
              <option value="automatic">Automatique (Envoi immédiat dès l'événement)</option>
              <option value="hybrid">Hybride (Validation ou préparation préalable requise)</option>
              <option value="manual">Manuel (Génération du lien WhatsApp / E-mail uniquement)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase text-white/70 mb-1">
              Modèle d'objet
            </label>
            <input
              aria-label="Modèle d'objet"
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-white/70 mb-1">
              Modèle de message
            </label>
            <textarea
              aria-label="Modèle de message"
              rows={4}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full rounded border border-[var(--sn-line)] bg-[var(--sn-black)] p-2 text-white focus:border-[var(--sn-red)]"
            />
            <div className="mt-1 text-[10px] text-white/40">
              Variables reconnues : {editingTemplate?.variables.map((v) => `{{${v}}}`).join(", ")}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setEditingTemplate(null)}>
              Annuler
            </Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>
              <Save className="h-3 w-3 mr-1" />
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
