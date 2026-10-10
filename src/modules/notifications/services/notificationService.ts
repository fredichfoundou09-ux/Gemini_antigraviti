import { supabase } from "@/lib/supabase/client";

export interface NotificationTemplate {
  id: string;
  code: string;
  title: string;
  channels: string[];
  subject_template: string;
  body_template: string;
  variables: string[];
  mode: "automatic" | "manual" | "hybrid";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutboxItem {
  id: string;
  recipient_id: string;
  recipient_name?: string;
  recipient_contact?: string;
  channel: "push" | "email" | "whatsapp" | "sms";
  template_code?: string;
  subject: string;
  content: string;
  status: "pending" | "sent" | "failed" | "prepared";
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  sent_at?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  enabled_channels: string[];
  quiet_hours_start: string;
  quiet_hours_end: string;
  notify_grades: boolean;
  notify_assignments: boolean;
  notify_payments: boolean;
  notify_absences: boolean;
}

export const notificationService = {
  async getTemplates(): Promise<{ data: NotificationTemplate[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("title");

      if (error) return { data: [], error: error.message };
      return { data: (data as NotificationTemplate[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async updateTemplate(
    code: string,
    updates: Partial<NotificationTemplate>
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from("notification_templates")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("code", code);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async getOutbox(statusFilter?: string): Promise<{ data: OutboxItem[]; error: string | null }> {
    try {
      let query = supabase
        .from("notification_outbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: error.message };
      return { data: (data as OutboxItem[]) || [], error: null };
    } catch (err: unknown) {
      return { data: [], error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async queueNotification(item: {
    recipient_id: string;
    channel: "push" | "email" | "whatsapp" | "sms";
    template_code?: string;
    subject: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; outboxId?: string; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("queue_notification", {
        p_recipient_id: item.recipient_id,
        p_channel: item.channel,
        p_template_code: item.template_code || null,
        p_subject: item.subject,
        p_content: item.content,
        p_metadata: item.metadata || {},
      });

      if (error) return { success: false, error: error.message };
      const res = data as { success?: boolean; outbox_id?: string; error?: string };
      return { success: true, outboxId: res?.outbox_id, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  async markOutboxSent(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc("mark_notification_outbox_sent", {
        p_outbox_id: id,
        p_status: "sent",
        p_error: null,
      });

      if (error) {
        // Repli direct si la RPC n'est pas encore disponible localement
        const { error: updErr } = await supabase
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (updErr) return { success: false, error: updErr.message };
        return { success: true, error: null };
      }

      const res = data as { success?: boolean; error?: string };
      if (res && res.success === false) {
        return { success: false, error: res.error || "Action refusée" };
      }

      return { success: true, error: null };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur inattendue" };
    }
  },

  generateDirectSendLink(item: OutboxItem): string {
    if (item.channel === "whatsapp") {
      const cleanPhone = (item.recipient_contact || "").replace(/[^0-9]/g, "");
      const text = encodeURIComponent(`*${item.subject}*\n\n${item.content}`);
      return cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    }
    if (item.channel === "email") {
      const email = item.recipient_contact || "";
      const subject = encodeURIComponent(item.subject);
      const body = encodeURIComponent(item.content);
      return `mailto:${email}?subject=${subject}&body=${body}`;
    }
    return "#";
  },
};
