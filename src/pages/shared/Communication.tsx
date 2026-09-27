import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Mail, Bell, CheckCheck, Users, UserCircle2, Inbox, ChevronRight, Reply, Trash2, Search, ShieldCheck, X, Sparkles, Bot, Play, Check, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, Textarea, Empty, PageHead, uid, today } from "@/lib/ui";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { fetchMyConversations, startConversation, replyToConversation, subscribeToAllMessages, deleteConversation, deleteMessage, fetchMessagingRecipients, markMessageAsDeleted, markConversationAsDeleted, getDeletedMessageIds, getDeletedConversationIds } from "@/lib/supabase/communication";
import { toastMsg } from "@/lib/toast";
import {
  getAutomatedRules,
  toggleAutomatedRule,
  getAutomatedDrafts,
  approveDraft,
  rejectDraft,
  batchApproveDrafts,
  generateDraftsForRule,
  AutomatedRule,
  AutomatedMessageDraft,
} from "@/lib/ai/automatedMessagesService";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getReadNotificationIds,
  getDeletedNotificationIds,
  deleteNotification,
  deleteAllNotifications,
} from "@/lib/notifications";

const notifColor: Record<string, string> = {
  info: "border-cyan-400/30 text-cyan-300",
  paiement: "border-amber-400/30 text-amber-300",
  test: "border-red-500/30 text-red-400",
  inscription: "border-emerald-400/30 text-emerald-300",
  certif: "border-blue-500/30 text-blue-400",
  bourse: "border-amber-400/30 text-amber-300",
};

export function MessageCenter() {
  const { db, user, update, userName, log } = useStore();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"inbox" | "new" | "ai_automations">("inbox");
  const [to, setTo] = useState(user?.role === "student" ? "" : "all_students");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [remoteConvs, setRemoteConvs] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const [remoteProfiles, setRemoteProfiles] = useState<any[]>([]);
  const [recipientRoleFilter, setRecipientRoleFilter] = useState<"all" | "broadcast" | "admin" | "teacher" | "student">("all");
  const [recipientSearch, setRecipientSearch] = useState("");

  const [inboxFilter, setInboxFilter] = useState<"all" | "unread">("all");
  const [inboxSearch, setInboxSearch] = useState("");

  // Automatisations IA & Validation humaine (Section 35)
  const [automatedRules, setAutomatedRules] = useState<AutomatedRule[]>([]);
  const [automatedDrafts, setAutomatedDrafts] = useState<AutomatedMessageDraft[]>([]);
  const [analyzingRules, setAnalyzingRules] = useState(false);
  const [draftFilter, setDraftFilter] = useState<"pending" | "sent" | "rejected" | "all">("pending");

  const loadAutomatedData = useCallback(() => {
    setAutomatedRules(getAutomatedRules());
    setAutomatedDrafts(getAutomatedDrafts());
  }, []);

  useEffect(() => {
    loadAutomatedData();
  }, [loadAutomatedData]);

  const handleToggleRule = (id: string, active: boolean) => {
    toggleAutomatedRule(id, active);
    loadAutomatedData();
    toastMsg.info(`Règle ${active ? "activée" : "désactivée"}`);
  };

  const handleApproveDraft = (id: string) => {
    const res = approveDraft(id, user?.id || "admin");
    if (res.ok) {
      loadAutomatedData();
      log(`APPROVE_AI_MESSAGE: ${id}`);
      toastMsg.success("Message approuvé et transmis ✓");
    }
  };

  const handleRejectDraft = (id: string) => {
    const reason = prompt("Précisez le motif du rejet (optionnel) :") || "Non pertinent";
    rejectDraft(id, reason);
    loadAutomatedData();
    log(`REJECT_AI_MESSAGE: ${id} - ${reason}`);
    toastMsg.info("Brouillon rejeté");
  };

  const handleBatchApprove = () => {
    const pendingIds = automatedDrafts.filter((d) => d.status === "pending_approval").map((d) => d.id);
    if (pendingIds.length === 0) return;
    const count = batchApproveDrafts(pendingIds, user?.id || "admin");
    loadAutomatedData();
    log(`BATCH_APPROVE_AI_MESSAGES: ${count}`);
    toastMsg.success(`${count} message(s) approuvé(s) et transmis avec succès ✓`);
  };

  const handleTriggerAiAnalysis = () => {
    setAnalyzingRules(true);
    try {
      const rules = getAutomatedRules().filter((r) => r.is_active);
      let totalDraftsCreated = 0;

      for (const rule of rules) {
        if (rule.trigger === "absence_unjustified") {
          const unjustAbsences = (db.attendance || []).filter((a) => a.statut === "absent");
          const studentIds = Array.from(new Set(unjustAbsences.map((a) => a.studentId)));
          const candidates = studentIds.map((sid) => {
            const stu = db.students.find((s) => s.id === sid);
            const userAcc = db.users.find((u) => u.id === sid || u.email === stu?.email);
            return {
              id: String(userAcc?.id || sid),
              name: stu ? `${stu.prenom} ${stu.nom}` : "Apprenant",
              course_name: "Assiduité générale",
            };
          }).filter((c) => c.name !== "Apprenant");

          if (candidates.length > 0) {
            const drafts = generateDraftsForRule(rule, candidates.slice(0, 5));
            totalDraftsCreated += drafts.length;
          }
        } else if (rule.trigger === "grade_excellence") {
          const excellentGrades = (db.grades || []).filter((g) => g.note >= 16);
          const candidates = excellentGrades.map((g) => {
            const stu = db.students.find((s) => s.id === g.studentId);
            const userAcc = db.users.find((u) => u.id === g.studentId || u.email === stu?.email);
            const mod = db.modules.find((m) => m.id === g.moduleId);
            return {
              id: String(userAcc?.id || g.studentId),
              name: stu ? `${stu.prenom} ${stu.nom}` : "Apprenant",
              course_name: mod?.titre || "Module",
              grade: Math.round(g.note),
            };
          }).filter((c) => c.name !== "Apprenant");

          if (candidates.length > 0) {
            const drafts = generateDraftsForRule(rule, candidates.slice(0, 5));
            totalDraftsCreated += drafts.length;
          }
        } else if (rule.trigger === "payment_due") {
          const studentsWithBalance = (db.students || []).filter((stu) => {
            const paid = (db.payments || []).filter((p) => p.studentId === stu.id && p.statut === "paye").reduce((sum, p) => sum + (p.montant || 0), 0);
            return 50000 - paid > 0;
          });
          const candidates = studentsWithBalance.map((stu) => {
            const userAcc = db.users.find((u) => u.id === stu.id || u.email === stu.email);
            const paid = (db.payments || []).filter((p) => p.studentId === stu.id && p.statut === "paye").reduce((sum, p) => sum + (p.montant || 0), 0);
            return {
              id: String(userAcc?.id || stu.id),
              name: `${stu.prenom} ${stu.nom}`,
              balance: 50000 - paid,
            };
          });

          if (candidates.length > 0) {
            const drafts = generateDraftsForRule(rule, candidates.slice(0, 5));
            totalDraftsCreated += drafts.length;
          }
        }
      }

      loadAutomatedData();
      if (totalDraftsCreated > 0) {
        toastMsg.success("Analyse terminée", `${totalDraftsCreated} nouveau(x) brouillon(s) généré(s) en attente de votre approbation.`);
      } else {
        toastMsg.info("Analyse terminée", "Aucune nouvelle situation nécessitant un message n'a été détectée.");
      }
    } catch (e: any) {
      toastMsg.error("Erreur lors de l'analyse automatique: " + (e.message || "Erreur"));
    } finally {
      setAnalyzingRules(false);
    }
  };

  // Charger les profils Supabase réels (annuaire de messagerie)
  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const data = await fetchMessagingRecipients();
      if (Array.isArray(data) && data.length > 0) {
        setRemoteProfiles(data);
      }
    } catch (e) {
      console.warn("loadProfiles fallback:", e);
    }
  }, []);

  // Charger les conversations Supabase
  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured || !user?.id) return;
    try {
      const convs = await fetchMyConversations();
      // Filtrage strict : seules les conversations où l'utilisateur connecté est membre ou participant
      const myConvs = (convs || []).filter((c: any) =>
        c.members?.some((m: any) => m.user_id === user?.id) ||
        c.messages?.some((m: any) => m.sender_id === user?.id)
      );
      setRemoteConvs(myConvs);
    } catch (err: any) {
      console.warn("Impossible de charger les conversations Supabase:", err.message);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
    loadProfiles();

    // Polling silencieux d'arrière-plan toutes les 4 secondes
    const pollInterval = setInterval(() => {
      loadConversations();
    }, 4000);

    if (isSupabaseConfigured) {
      const sub = subscribeToAllMessages(() => {
        loadConversations();
      });
      const refreshHandler = () => {
        loadConversations();
        loadProfiles();
      };
      window.addEventListener("sentinelles:supabase-refresh", refreshHandler);
      return () => {
        clearInterval(pollInterval);
        sub.unsubscribe();
        window.removeEventListener("sentinelles:supabase-refresh", refreshHandler);
      };
    }

    return () => clearInterval(pollInterval);
  }, [loadConversations, loadProfiles]);

  // Support du lien direct avec paramètre ?to=<userId>
  useEffect(() => {
    const toParam = searchParams.get("to");
    if (toParam) {
      setTo(toParam);
      setMode("new");
      const found = remoteProfiles.find((p) => p.id === toParam) || db.users.find((u) => u.id === toParam);
      if (found?.role) {
        if (found.role === "teacher") setRecipientRoleFilter("teacher");
        else if (found.role === "student") setRecipientRoleFilter("student");
        else if (found.role === "admin" || found.role === "superadmin" || found.role === "partner_admin") setRecipientRoleFilter("admin");
      }
    }
  }, [searchParams, remoteProfiles, db.users]);

  // Messages locaux (fallback ou mix) - isolation stricte et respect des suppressions
  const deletedMsgIds = useMemo(() => getDeletedMessageIds(user?.id), [user?.id]);
  const deletedConvIds = useMemo(() => getDeletedConversationIds(user?.id), [user?.id]);

  const localMessages = db.messages
    .filter((m) =>
      !deletedMsgIds.has(m.id) &&
      !deletedConvIds.has(m.id) &&
      (m.toId === user!.id ||
      m.fromId === user!.id ||
      (m.toId === "all_students" && user?.role === "student") ||
      (m.toId === "all_teachers" && user?.role === "teacher"))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Fusionner les conversations distantes et locales
  const displayItems = useMemo(() => {
    if (isSupabaseConfigured && remoteConvs.length > 0) {
      return remoteConvs.map((c) => {
        const msgs = (c.messages || []).sort((a: any, b: any) =>
          (a.created_at || "").localeCompare(b.created_at || "")
        );
        const lastMsg = msgs[msgs.length - 1];
        const isFromMe = lastMsg?.sender_id === user?.id;
        const sender = remoteProfiles.find((p) => p.id === lastMsg?.sender_id) || db.users.find((u) => u.id === lastMsg?.sender_id);
        const isStudentUser = user?.role === "student";
        const isAdminSender = sender?.role === "superadmin" || sender?.role === "admin";
        let lastSenderName = sender?.name || sender?.username || (isFromMe ? "Moi" : "Expéditeur inconnu");
        if (isStudentUser && isAdminSender && !isFromMe) {
          lastSenderName = sender?.role === "superadmin" ? "Super Administrateur" : "Administration";
        }

        const myMember = c.members?.find((m: any) => m.user_id === user?.id);
        const lastRead = myMember?.last_read_at || "1970-01-01T00:00:00Z";
        const isUnread = msgs.some((m: any) => m.sender_id !== user?.id && new Date(m.created_at) > new Date(lastRead));

        return {
          id: c.id,
          isRemote: true,
          subject: c.subject || "Discussion",
          date: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "",
          lastSenderName,
          messages: msgs,
          isFromMe,
          isUnread,
        };
      });
    }
    return localMessages.map((m) => ({
      id: m.id,
      isRemote: false,
      subject: m.subject,
      date: m.date,
      lastSenderName: m.fromName,
      messages: [{ id: m.id, sender_id: m.fromId, body: m.body, created_at: m.date, lu: m.lu }],
      isFromMe: m.fromId === user?.id,
      isUnread: Boolean(!m.lu && m.fromId !== user?.id),
      localMsg: m,
    }));
  }, [remoteConvs, localMessages, isSupabaseConfigured, user?.id, remoteProfiles, db.users]);

  // Nombre de conversations non lues
  const unreadInboxCount = useMemo(() => {
    return displayItems.filter((i) => i.isUnread).length;
  }, [displayItems]);

  // Filtrage côté client des conversations pour la boîte de réception
  const filteredInboxItems = useMemo(() => {
    return displayItems.filter((item) => {
      // 1. Filtre Toutes / Non lues
      if (inboxFilter === "unread" && !item.isUnread) {
        return false;
      }

      // 2. Recherche textuelle (insensible à la casse) sur l'interlocuteur ou le dernier message
      if (inboxSearch.trim()) {
        const q = inboxSearch.toLowerCase().trim();
        const lastMsg = item.messages[item.messages.length - 1];
        const matchSubject = (item.subject || "").toLowerCase().includes(q);
        const matchLastSender = (item.lastSenderName || "").toLowerCase().includes(q);
        const matchLastMsg = (lastMsg?.body || "").toLowerCase().includes(q);
        const matchAnyMsg = item.messages.some((m: any) => (m.body || "").toLowerCase().includes(q));
        const matchParticipant = item.messages.some((m: any) => {
          const senderObj = remoteProfiles.find((p) => p.id === m.sender_id) || db.users.find((u) => u.id === m.sender_id);
          return (
            (senderObj?.name || "").toLowerCase().includes(q) ||
            (senderObj?.username || "").toLowerCase().includes(q)
          );
        });

        if (!matchSubject && !matchLastSender && !matchLastMsg && !matchAnyMsg && !matchParticipant) {
          return false;
        }
      }

      return true;
    });
  }, [displayItems, inboxFilter, inboxSearch, remoteProfiles, db.users]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);

    try {
      if (isSupabaseConfigured) {
        let memberIds: string[] = [];
        if (to === "all_students") {
          const sIds = remoteProfiles.filter((p) => p.role === "student").map((p) => p.id);
          memberIds = sIds.length > 0 ? sIds : db.users.filter((u) => u.role === "student").map((u) => u.id);
        } else if (to === "all_teachers") {
          const tIds = remoteProfiles.filter((p) => p.role === "teacher").map((p) => p.id);
          memberIds = tIds.length > 0 ? tIds : db.users.filter((u) => u.role === "teacher").map((u) => u.id);
        } else {
          let resolvedTo = to;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(to);
          if (!isUuid) {
            const t = db.teachers?.find((x) => x.id === to || x.userId === to);
            const s = db.students?.find((x) => x.id === to || x.userId === to);
            const u = db.users?.find((x) => x.id === to);
            const email = t?.email || s?.email || u?.email;
            if (t?.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.userId)) {
              resolvedTo = t.userId;
            } else if (s?.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.userId)) {
              resolvedTo = s.userId;
            } else if (email) {
              const matched = remoteProfiles.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase());
              if (matched?.id) resolvedTo = matched.id;
            }
          }
          memberIds = [resolvedTo];
        }

        await startConversation(subject.trim(), memberIds, body.trim());
        await loadConversations();
        toastMsg.success("Message transmis avec succès ✓", "Visible immédiatement par le destinataire");
      } else {
        const msg = { id: uid("MSG"), fromId: user!.id, fromName: user!.name, toId: to, subject, body, date: today(), lu: false };
        update((d) => ({ ...d, messages: [msg, ...d.messages] }));
        if (to !== "all_students" && to !== "all_teachers") {
          update((d) => ({ ...d, notifications: [{ id: uid("NTF"), toId: to, title: `Nouveau message : ${subject}`, body, date: today(), lu: false, type: "info" }, ...d.notifications] }));
        }
        toastMsg.success("Message envoyé en local ✓");
      }

      const destName = remoteProfiles.find((p) => p.id === to)?.name || userName(to);
      log(`Message envoyé à ${destName} : ${subject}`);
      setSubject(""); setBody(""); setMode("inbox");
    } catch (err: any) {
      console.error("Erreur envoi message:", err);
      toastMsg.error("Échec d'envoi du message", err.message || "Erreur réseau");
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (convId: string) => {
    if (!replyBody.trim() || !user?.id) return;
    setSendingReply(true);
    try {
      if (isSupabaseConfigured) {
        await replyToConversation(convId, user.id, replyBody.trim());
        try {
          const sb = getSupabase();
          await sb.rpc("mark_conversation_as_read", { p_conversation_id: convId });
        } catch { /* silence */ }
        await loadConversations();
        toastMsg.success("Réponse envoyée ✓");
      } else {
        const msg = { id: uid("MSG"), fromId: user.id, fromName: user.name, toId: "dest", subject: "Re: Message", body: replyBody.trim(), date: today(), lu: false };
        update((d) => ({
          ...d,
          messages: [
            msg,
            ...d.messages.map((m) => (m.id === convId ? { ...m, lu: true } : m)),
          ],
        }));
        toastMsg.success("Réponse ajoutée en local ✓");
      }
      setReplyBody("");
      setReplyingTo(null);
    } catch (err: any) {
      console.error("Erreur réponse message:", err);
      toastMsg.error("Échec de transmission de la réponse", err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkAsRead = async (item: any) => {
    try {
      if (item.isRemote) {
        const sb = getSupabase();
        await sb.rpc("mark_conversation_as_read", { p_conversation_id: item.id });
        await loadConversations();
      } else {
        update((d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.id === item.id || (m.toId === user?.id && m.fromId === item.lastSenderName) ? { ...m, lu: true } : m
          ),
        }));
      }
      toastMsg.success("Discussion marquée comme lue ✓");
    } catch (err: any) {
      console.error("Erreur marquage conversation comme lue:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      if (isSupabaseConfigured && remoteConvs.length > 0) {
        const sb = getSupabase();
        await Promise.all(
          remoteConvs.map(async (c) => {
            try {
              await sb.rpc("mark_conversation_as_read", { p_conversation_id: c.id });
            } catch { /* silence */ }
          })
        );
        await loadConversations();
      }
      update((d) => ({
        ...d,
        messages: (d.messages || []).map((m) =>
          m.toId === user?.id || (m.toId === "all_students" && user?.role === "student") || (m.toId === "all_teachers" && user?.role === "teacher")
            ? { ...m, lu: true }
            : m
        ),
      }));
      toastMsg.success("Toutes les conversations sont marquées comme lues ✓");
    } catch (err: any) {
      console.error("Erreur marquage tout comme lu:", err);
    }
  };

  const handleDeleteConversation = async (item: any) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la discussion "${item.subject}" et tous ses messages ?`)) return;
    try {
      if (item.id) {
        markConversationAsDeleted(item.id, user?.id);
        (item.messages || []).forEach((m: any) => {
          if (m?.id) markMessageAsDeleted(m.id, user?.id);
        });
      }

      // 1. Mise à jour optimiste de remoteConvs
      setRemoteConvs((prev) => prev.filter((c) => c.id !== item.id));

      // 2. Mise à jour optimiste de db.messages
      const removedIds = new Set([item.id, ...(item.messages || []).map((m: any) => m.id)]);
      update((d) => ({
        ...d,
        messages: (d.messages || []).filter((m) => !removedIds.has(m.id)),
      }));

      // 3. Appel serveur
      if (item.isRemote) {
        await deleteConversation(item.id, user?.id);
        await loadConversations();
      }

      toastMsg.success("Conversation supprimée définitivement ✓");
      log(`Conversation supprimée : ${item.subject}`);
    } catch (err: any) {
      console.error("Erreur suppression conversation:", err);
      toastMsg.error("Échec de suppression", err.message || "Erreur réseau");
    }
  };

  const handleDeleteMessage = async (msg: any, parentItem: any) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce message ?")) return;
    try {
      if (msg.id) {
        markMessageAsDeleted(msg.id, user?.id);
      }

      // 1. Mise à jour optimiste de remoteConvs
      setRemoteConvs((prev) =>
        prev
          .map((c) => ({
            ...c,
            messages: (c.messages || []).filter((m: any) => m.id !== msg.id),
          }))
          .filter((c) => c.messages.length > 0)
      );

      // 2. Mise à jour optimiste du store local
      update((d) => ({
        ...d,
        messages: (d.messages || []).filter((m) => m.id !== msg.id),
      }));

      // 3. Appel serveur
      if (parentItem.isRemote && msg.id) {
        await deleteMessage(msg.id, user?.id);
        await loadConversations();
      }

      toastMsg.success("Message supprimé définitivement ✓");
    } catch (err: any) {
      console.error("Erreur suppression message:", err);
      toastMsg.error("Échec de suppression du message", err.message);
    }
  };

  const { targets, targetCounts } = useMemo(() => {
    const opts: { id: string; label: string; icon: React.ReactNode; category: "broadcast" | "admin" | "teacher" | "student" }[] = [];
    const isStudent = user?.role === "student";

    if (!isStudent && ["superadmin", "admin", "teacher"].includes(user!.role)) {
      opts.push({ id: "all_students", label: "📢 Tous les apprenants (Diffusion générale)", icon: <Users size={14} />, category: "broadcast" });
    }
    if (!isStudent && ["superadmin", "admin"].includes(user!.role)) {
      opts.push({ id: "all_teachers", label: "📢 Tous les formateurs (Diffusion générale)", icon: <UserCircle2 size={14} />, category: "broadcast" });
    }

    const seen = new Set<string>();
    if (user?.id) seen.add(user.id);

    // Rassembler tous les profils (distants Supabase, utilisateurs locaux, enseignants et apprenants de la base)
    const candidates: Array<{ id: string; name: string; username?: string; email?: string; role: string }> = [];

    // 1. Profils distants Supabase
    (remoteProfiles || []).forEach((p) => {
      if (p.id) candidates.push({ id: p.id, name: p.name || p.username || "Utilisateur", username: p.username, email: p.email, role: p.role || "student" });
    });

    // 2. Utilisateurs déclarés dans le store
    (db.users || []).forEach((u) => {
      if (u.id) candidates.push({ id: u.id, name: u.name || u.username, username: u.username, email: u.email, role: u.role || "student" });
    });

    // 3. Enseignants déclarés dans le store (avec leur userId ou id)
    (db.teachers || []).forEach((t: any) => {
      const targetId = t.userId || t.id;
      if (targetId) {
        const teacherName = t.nom && t.prenom ? `${t.prenom} ${t.nom}` : t.nom || t.name || t.email || "Formateur";
        candidates.push({
          id: targetId,
          name: teacherName,
          username: t.email,
          email: t.email,
          role: "teacher",
        });
      }
    });

    // 4. Apprenants déclarés dans le store (avec leur userId ou id)
    (db.students || []).forEach((s: any) => {
      const targetId = s.userId || s.id;
      if (targetId) {
        const studentName = s.nom && s.prenom ? `${s.prenom} ${s.nom}` : s.nom || s.name || s.email || "Apprenant";
        candidates.push({
          id: targetId,
          name: studentName,
          username: s.matricule || s.email || s.id,
          email: s.email,
          role: "student",
        });
      }
    });

    // Traitement et catégorisation des profils
    let hasAdmin = false;
    candidates.forEach((p) => {
      if (!p.id || seen.has(p.id)) return;
      seen.add(p.id);

      const r = (p.role || "").toLowerCase();
      const isAdmin = r === "superadmin" || r === "admin" || r === "partner_admin";
      const isTeacher = r === "teacher" || r === "enseignant" || r === "formateur";
      const isStudentRole = r === "student" || r === "apprenant" || (!isAdmin && !isTeacher);

      if (isAdmin) hasAdmin = true;

      if (isStudent) {
        if (isAdmin) {
          opts.push({
            id: p.id,
            label: p.role === "superadmin" ? "🛡️ Direction Générale (Super Admin)" : `🛡️ Administration & Scolarité (${p.name || "Direction"})`,
            icon: <ShieldCheck size={14} className={p.role === "superadmin" ? "text-red-400" : "text-cyan-400"} />,
            category: "admin",
          });
        } else if (isTeacher) {
          opts.push({
            id: p.id,
            label: `👨‍🏫 ${p.name || p.username || "Formateur"} (Formateur)`,
            icon: <UserCircle2 size={14} className="text-emerald-400" />,
            category: "teacher",
          });
        } else if (isStudentRole) {
          opts.push({
            id: p.id,
            label: `🎓 ${p.name || p.username || "Apprenant"} (Apprenant)`,
            icon: <Users size={14} className="text-purple-400" />,
            category: "student",
          });
        }
      } else {
        const cat = isAdmin ? "admin" : isTeacher ? "teacher" : "student";
        const rTag = p.role === "superadmin" ? "Super Admin" : p.role === "admin" ? "Admin" : isTeacher ? "Formateur" : "Apprenant";
        opts.push({
          id: p.id,
          label: `${p.name || p.username} (${rTag})`,
          icon: <UserCircle2 size={14} className={isAdmin ? "text-cyan-400" : isTeacher ? "text-emerald-400" : "text-purple-400"} />,
          category: cat,
        });
      }
    });

    // Filet institutionnel pour apprenants : s'assurer qu'un contact Direction existe toujours
    if (isStudent && !hasAdmin) {
      const adminFallbackId = db.users?.find((u) => u.role === "superadmin" || u.role === "admin")?.id || "direction_admin";
      opts.unshift({
        id: adminFallbackId,
        label: "🛡️ Direction Générale & Scolarité (Administration)",
        icon: <ShieldCheck size={14} className="text-cyan-400" />,
        category: "admin",
      });
    }

    const counts = {
      all: opts.length,
      broadcast: opts.filter((o) => o.category === "broadcast").length,
      admin: opts.filter((o) => o.category === "admin").length,
      teacher: opts.filter((o) => o.category === "teacher").length,
      student: opts.filter((o) => o.category === "student").length,
    };

    const filtered = opts.filter((t) => {
      if (recipientRoleFilter !== "all" && t.category !== recipientRoleFilter) return false;
      if (recipientSearch && !t.label.toLowerCase().includes(recipientSearch.toLowerCase())) return false;
      return true;
    });

    return { targets: filtered, targetCounts: counts };
  }, [remoteProfiles, db.users, db.teachers, db.students, user, recipientRoleFilter, recipientSearch]);

  // Auto-sélection du premier contact pertinent pour les étudiants
  useEffect(() => {
    if (mode === "new" && (!to || to === "all_students") && user?.role === "student" && targets.length > 0) {
      setTo(targets[0].id);
    }
  }, [mode, to, user?.role, targets]);

  return (
    <div>
      <PageHead
        title="Messagerie interne"
        subtitle="Conversations instantanées, annonces et messages automatisés par IA"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user?.role !== "student" && (
              <button
                type="button"
                onClick={() => setMode(mode === "ai_automations" ? "inbox" : "ai_automations")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer",
                  mode === "ai_automations"
                    ? "bg-purple-500/20 text-purple-300 border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                    : "bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/10"
                )}
              >
                <Bot size={14} className="text-purple-400" />
                <span>Automatisations IA</span>
                {automatedDrafts.filter((d) => d.status === "pending_approval").length > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-black animate-pulse">
                    {automatedDrafts.filter((d) => d.status === "pending_approval").length}
                  </span>
                )}
              </button>
            )}
            <Btn onClick={() => setMode(mode === "inbox" ? "new" : "inbox")}>
              {mode === "inbox" ? <><Send size={16} /> Nouveau message</> : <><Inbox size={16} /> Boîte de réception</>}
            </Btn>
          </div>
        }
      />

      {mode === "ai_automations" ? (
        <div className="space-y-6">
          {/* En-tête du panneau automatisations */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/20 via-slate-900/60 to-purple-950/20 p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300 border border-purple-400/30">
                <Bot size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Pilotage des Messages Automatiques par IA
                  <span className="rounded bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-400/30 uppercase">
                    Section 35
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Détection des situations réelles (absences, notes, soldes) • Validation humaine obligatoire avant envoi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerAiAnalysis}
                disabled={analyzingRules}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 transition cursor-pointer disabled:opacity-50"
              >
                {analyzingRules ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                {analyzingRules ? "Analyse en cours..." : "Scanner & Détecter"}
              </button>
              <button
                type="button"
                onClick={() => setMode("inbox")}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white transition cursor-pointer"
                title="Retour à la boîte de réception"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Grille des règles configurables */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles size={14} className="text-purple-400" />
              Règles d'Automatisation Configurables ({automatedRules.length})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {automatedRules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "rounded-xl border p-4 transition flex flex-col justify-between space-y-3",
                    rule.is_active
                      ? "border-purple-500/30 bg-purple-950/10 hover:border-purple-400/50"
                      : "border-white/5 bg-white/[0.01] opacity-60"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-white/10 text-cyan-300">
                        {rule.trigger}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id, !rule.is_active)}
                        className={cn(
                          "px-2.5 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer",
                          rule.is_active
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        )}
                      >
                        {rule.is_active ? "Active" : "Désactivée"}
                      </button>
                    </div>
                    <h5 className="text-sm font-bold text-white">{rule.name}</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">{rule.description}</p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-amber-300">
                      <ShieldCheck size={13} /> Validation humaine requise
                    </span>
                    {rule.last_run_at && (
                      <span className="font-mono text-[10px] text-slate-500">
                        Dernier scan : {new Date(rule.last_run_at).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* File d'attente des brouillons générés */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Mail size={14} className="text-cyan-400" />
                  Brouillons Générés par IA ({automatedDrafts.length})
                </h4>
                {automatedDrafts.filter((d) => d.status === "pending_approval").length > 0 && (
                  <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold">
                    {automatedDrafts.filter((d) => d.status === "pending_approval").length} en attente d'approbation
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Filtres de statut */}
                <div className="flex rounded-lg bg-black/40 border border-white/10 p-0.5 text-[11px]">
                  {(["pending", "sent", "rejected", "all"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDraftFilter(st)}
                      className={cn(
                        "px-2.5 py-1 rounded transition cursor-pointer capitalize font-semibold",
                        draftFilter === st
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      {st === "pending" ? "En attente" : st === "sent" ? "Transmis" : st === "rejected" ? "Rejetés" : "Tous"}
                    </button>
                  ))}
                </div>

                {automatedDrafts.some((d) => d.status === "pending_approval") && (
                  <button
                    type="button"
                    onClick={handleBatchApprove}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
                  >
                    <CheckCheck size={14} /> Tout approuver
                  </button>
                )}
              </div>
            </div>

            {automatedDrafts.filter((d) => draftFilter === "all" || (draftFilter === "pending" && d.status === "pending_approval") || (draftFilter === "sent" && d.status === "sent") || (draftFilter === "rejected" && d.status === "rejected")).length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-8 text-center text-xs text-slate-400 space-y-2">
                <p>Aucun brouillon de message dans cette catégorie.</p>
                <p className="text-[11px] text-slate-500">
                  Cliquez sur « Scanner & Détecter » ci-dessus pour rechercher de nouvelles situations à traiter.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {automatedDrafts
                  .filter((d) => draftFilter === "all" || (draftFilter === "pending" && d.status === "pending_approval") || (draftFilter === "sent" && d.status === "sent") || (draftFilter === "rejected" && d.status === "rejected"))
                  .map((draft) => {
                    const isPending = draft.status === "pending_approval";
                    const isSent = draft.status === "sent";
                    const isRejected = draft.status === "rejected";

                    return (
                      <div
                        key={draft.id}
                        className={cn(
                          "rounded-2xl border p-4 transition space-y-3",
                          isPending
                            ? "border-amber-500/30 bg-amber-950/10"
                            : isSent
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : "border-red-500/20 bg-red-950/10 opacity-70"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{draft.recipient_name}</span>
                            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-white/10">
                              {draft.recipient_role}
                            </span>
                            <span className="text-[11px] text-slate-400">• Règle : « {draft.rule_name} »</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                                isPending
                                  ? "bg-amber-950/60 text-amber-300 border-amber-400/30"
                                  : isSent
                                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-400/30"
                                  : "bg-red-950/60 text-red-300 border-red-500/30"
                              )}
                            >
                              {isPending ? "Attente validation" : isSent ? "Transmis ✓" : "Rejeté"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(draft.generated_at).toLocaleString("fr-FR")}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h6 className="text-xs font-bold text-cyan-200">{draft.subject}</h6>
                          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5">
                            {draft.body}
                          </p>
                        </div>

                        {isPending && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleRejectDraft(draft.id)}
                              className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 transition cursor-pointer"
                            >
                              <X size={13} /> Rejeter
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveDraft(draft.id)}
                              className="flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition shadow-lg cursor-pointer"
                            >
                              <Check size={14} /> Approuver & Envoyer
                            </button>
                          </div>
                        )}

                        {isRejected && draft.rejection_reason && (
                          <div className="text-[11px] text-red-300/80 bg-red-950/30 p-2 rounded-lg border border-red-500/20">
                            Motif du rejet : {draft.rejection_reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : mode === "new" ? (
        <Card className="mx-auto max-w-2xl p-6 relative">
          {/* En-tête de la modale/carte de nouveau message avec bouton de fermeture explicite */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Send size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Nouveau message</h3>
                <p className="text-xs text-slate-400">Rédigez et transmettez un message direct ou une diffusion</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMode("inbox")}
              className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Fermer et retourner à la boîte de réception"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={send} className="space-y-4">
            <Field label="Destinataire">
              {/* Filtres par rôle avec décompte visible */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: `Tous (${targetCounts.all})` },
                  ...(user?.role !== "student" ? [{ id: "broadcast", label: `📢 Diffusions (${targetCounts.broadcast})` }] : []),
                  { id: "admin", label: `🛡️ Direction & Admin (${targetCounts.admin})` },
                  { id: "teacher", label: `👨‍🏫 Formateurs (${targetCounts.teacher})` },
                  { id: "student", label: `🎓 Apprenants (${targetCounts.student})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRecipientRoleFilter(f.id as any)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                      recipientRoleFilter === f.id
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-white/[0.02] text-slate-400 border border-white/5 hover:bg-white/5"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Recherche rapide de destinataire */}
              <div className="relative mb-2">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Rechercher un destinataire par nom..."
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="pl-8 text-xs py-1.5"
                />
              </div>

              {targets.length === 0 ? (
                <div className="rounded-xl border border-white/5 p-4 text-center text-xs text-slate-400">
                  {recipientSearch ? (
                    <span>Aucun contact ne correspond à la recherche « {recipientSearch} ».</span>
                  ) : (
                    <span>Aucun contact trouvé dans cette catégorie.</span>
                  )}
                </div>
              ) : (
                <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {targets.map((t) => (
                    <button type="button" key={t.id} onClick={() => setTo(t.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs sm:text-sm transition-all cursor-pointer",
                        to === t.id ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/30 font-medium" : "border-white/10 text-slate-300 hover:bg-white/5"
                      )}>
                      {t.icon} <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {/* Assistant IA Sentinelle — Préparation intelligente & Modèles automatisés */}
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 via-blue-950/20 to-slate-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
                  <Sparkles size={14} className="text-cyan-400" />
                  Assistant IA Sentinelle — Suggestions de messages & relances
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Pré-remplit les champs • Validation humaine requise avant envoi
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSubject("Rappel assiduité — Régularisation de vos présences en cours");
                    setBody(`Bonjour,\n\nNous constatons une ou plusieurs absences non justifiées lors des dernières séances d'enseignement.\n\nNous vous rappelons que l'assiduité est un critère déterminant pour la validation de vos modules et la délivrance de votre attestation.\n\nMerci de vous rapprocher au plus tôt de l'administration avec vos éventuels justificatifs.\n\nCordialement,\nLa Coordination Pédagogique — Sentinelles Numériques`);
                    toastMsg.info("Modèle d'assiduité appliqué. Vous pouvez modifier le texte avant d'envoyer.");
                  }}
                  className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-2 text-left text-xs hover:bg-cyan-500/10 hover:border-cyan-400/50 transition cursor-pointer text-slate-300"
                >
                  <div className="font-medium text-cyan-200">🔔 Rappel assiduité</div>
                  <div className="text-[11px] text-slate-400 truncate">Absence ou retard constaté</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubject("Notification de scolarité — Échéance de règlement");
                    setBody(`Bonjour,\n\nSauf erreur de notre part, une échéance liée à vos frais de scolarité arrive prochainement à son terme ou présente un solde à régulariser.\n\nNous vous invitons à consulter votre onglet Finances ou à vous présenter au service comptabilité afin de procéder au règlement.\n\nRestant à votre entière disposition pour tout renseignement complémentaire.\n\nBien cordialement,\nService Comptabilité & Finances`);
                    toastMsg.info("Modèle de relance financière appliqué. Vous pouvez modifier le texte avant d'envoyer.");
                  }}
                  className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-2 text-left text-xs hover:bg-amber-500/10 hover:border-amber-400/50 transition cursor-pointer text-slate-300"
                >
                  <div className="font-medium text-amber-200">💳 Relance scolarité</div>
                  <div className="text-[11px] text-slate-400 truncate">Échéance ou solde dû</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubject("Convocation — Évaluation sommative en mode sécurisé");
                    setBody(`Chers apprenants,\n\nUne évaluation importante est programmée pour votre promotion.\n\nConsignes obligatoires pour le déroulement :\n1. Prévoyez une connexion stable et votre matériel opérationnel.\n2. L'évaluation se déroulera en mode sécurisé (verrouillage de navigation et assistant IA désactivé).\n3. Tout départ anticipé non validé sera considéré comme une remise définitive.\n\nBonne préparation à toutes et à tous.\n\nL'Équipe Pédagogique`);
                    toastMsg.info("Modèle de convocation appliqué. Vous pouvez modifier le texte avant d'envoyer.");
                  }}
                  className="rounded-lg border border-purple-500/30 bg-purple-950/30 p-2 text-left text-xs hover:bg-purple-500/10 hover:border-purple-400/50 transition cursor-pointer text-slate-300"
                >
                  <div className="font-medium text-purple-200">📝 Convocation examen</div>
                  <div className="text-[11px] text-slate-400 truncate">Consignes mode sécurisé</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubject("Information importante — Organisation des sessions de formation");
                    setBody(`Chers apprenants, chers enseignants,\n\nNous vous informons d'une mise à jour importante concernant le calendrier et l'organisation des prochains cours.\n\nMerci de consulter votre Emploi du temps ainsi que vos espaces de cours pour prendre connaissance des nouveaux supports déposés.\n\nRestant à votre écoute pour toute question.\n\nLa Direction — Sentinelles Numériques`);
                    toastMsg.info("Modèle d'information générale appliqué. Vous pouvez modifier le texte avant d'envoyer.");
                  }}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-2 text-left text-xs hover:bg-emerald-500/10 hover:border-emerald-400/50 transition cursor-pointer text-slate-300"
                >
                  <div className="font-medium text-emerald-200">📢 Information générale</div>
                  <div className="text-[11px] text-slate-400 truncate">Organisation des cours</div>
                </button>
              </div>
            </div>

            <Field label="Objet"><Input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de la discussion" /></Field>
            <Field label="Message"><Textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Rédigez votre message..." /></Field>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMode("inbox")}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                Annuler
              </button>
              <Btn type="submit" disabled={sending} className="flex-1 py-3">
                <Send size={16} /> {sending ? "Envoi en cours..." : "Envoyer le message"}
              </Btn>
            </div>
          </form>
        </Card>
      ) : displayItems.length === 0 ? (
        <Empty icon={<Mail size={40} />} title="Aucun message" sub="Vos conversations apparaîtront ici." />
      ) : (
        <div className="space-y-4">
          {/* Barre d'outils boîte de réception : Filtres Toutes/Non lues + Recherche */}
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Filtre Toutes / Non lues */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setInboxFilter("all")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    inboxFilter === "all"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Toutes ({displayItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setInboxFilter("unread")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
                    inboxFilter === "unread"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  Non lues
                  {unreadInboxCount > 0 && (
                    <span className="rounded-full bg-cyan-400/25 px-1.5 py-0.2 text-[10px] font-bold text-cyan-300">
                      {unreadInboxCount}
                    </span>
                  )}
                </button>
              </div>

              {unreadInboxCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200 transition"
                  title="Marquer toutes les discussions comme lues"
                >
                  <CheckCheck size={14} className="text-cyan-400" /> Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Champ de recherche texte insensible à la casse */}
            <div className="relative w-full sm:w-80">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Rechercher par nom ou message..."
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                className="pl-8 pr-7 text-xs py-1.5"
              />
              {inboxSearch && (
                <button
                  type="button"
                  onClick={() => setInboxSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredInboxItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.01] p-8 text-center">
              <Mail size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                {inboxFilter === "unread" ? "Aucune discussion non lue" : "Aucune conversation trouvée"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {inboxFilter === "unread"
                  ? "Toutes vos conversations sont à jour."
                  : "Aucune discussion ne correspond à votre critère de recherche."}
              </p>
              {inboxSearch && (
                <button
                  type="button"
                  onClick={() => setInboxSearch("")}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1 text-xs text-cyan-300 hover:bg-white/5 transition"
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          ) : (
            filteredInboxItems.map((item) => {
              const incoming = !item.isFromMe;
              return (
                <Card
                  key={item.id}
                  className={cn("p-5 transition", item.isUnread && "ring-1 ring-cyan-400/40 bg-cyan-950/[0.06]")}
                  glow={incoming ? "cyan" : "green"}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2.5">
                      {incoming ? <Mail size={16} className="text-cyan-300" /> : <Send size={16} className="text-emerald-300" />}
                      <p className="text-sm font-bold text-white">{item.subject}</p>
                      {item.isUnread && (
                        <span className="rounded-md border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300 shadow-sm">
                          Non lu
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">{item.date}</span>
                      {item.isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(item)}
                          title="Marquer cette discussion comme lue"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition"
                        >
                          <CheckCheck size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteConversation(item)}
                        title="Supprimer cette conversation"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Fil des échanges */}
                  <div className="my-3 space-y-2">
                    {item.messages.map((m: any, idx: number) => {
                      const fromMe = m.sender_id === user?.id;
                      const senderObj = remoteProfiles.find((p) => p.id === m.sender_id) || db.users.find((u) => u.id === m.sender_id);
                      const isStudentUser = user?.role === "student";
                      const isAdminSender = senderObj?.role === "superadmin" || senderObj?.role === "admin";
                      let authorName = senderObj?.name || (fromMe ? "Moi" : "Correspondant");
                      if (isStudentUser && isAdminSender && !fromMe) {
                        authorName = senderObj?.role === "superadmin" ? "Super Administrateur" : "Administration";
                      }
                      const role = senderObj?.role || (fromMe ? user?.role : "admin");
                      const roleBadge =
                        role === "superadmin" || role === "admin"
                          ? { label: "🛡️ Direction", cls: "bg-red-500/20 text-red-300 border-red-500/40" }
                          : role === "teacher"
                          ? { label: "👨‍🏫 Formateur", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" }
                          : role === "partner" || role === "partner_admin"
                          ? { label: "🤝 Partenaire", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" }
                          : { label: "🎓 Apprenant", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };

                      const bubbleBorder =
                        fromMe
                          ? "border-white/10 bg-white/[0.04] ml-6"
                          : role === "superadmin" || role === "admin"
                          ? "border-red-500/30 bg-red-950/20 mr-6 shadow-[0_0_12px_rgba(239,68,68,0.08)]"
                          : role === "teacher"
                          ? "border-emerald-500/30 bg-emerald-950/20 mr-6 shadow-[0_0_12px_rgba(16,185,129,0.08)]"
                          : role === "partner" || role === "partner_admin"
                          ? "border-amber-500/30 bg-amber-950/20 mr-6 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                          : "border-cyan-400/30 bg-cyan-950/20 mr-6 shadow-[0_0_12px_rgba(6,182,212,0.08)]";

                      const canDelete = fromMe || user?.role === "superadmin" || user?.role === "admin";

                      return (
                        <div key={m.id || idx} className={cn("group relative rounded-xl border p-3.5 text-sm transition", bubbleBorder)}>
                          <div className="flex justify-between items-center mb-1.5 text-[11px] text-slate-400">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold", fromMe ? "text-slate-200" : "text-white")}>{authorName}</span>
                              <span className={cn("rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border", roleBadge.cls)}>
                                {roleBadge.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {m.created_at && <span className="font-mono text-[10px] text-slate-500">{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteMessage(m, item)}
                                  title="Supprimer ce message"
                                  className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{m.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action répondre */}
                  {replyingTo === item.id ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex gap-2">
                        <Input
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Écrivez votre réponse..."
                          className="flex-1"
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(item.id); } }}
                        />
                        <Btn className="px-3 py-1.5 text-xs" onClick={() => handleReply(item.id)} disabled={sendingReply || !replyBody.trim()}>
                          <Send size={14} /> {sendingReply ? "..." : "Envoyer"}
                        </Btn>
                        <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => { setReplyingTo(null); setReplyBody(""); }}>Annuler</Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setReplyingTo(item.id);
                          setReplyBody("");
                          if (item.isUnread) handleMarkAsRead(item);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 hover:underline"
                      >
                        <Reply size={14} /> Répondre
                      </button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function getNotificationCategory(n: any): string {
  const t = (n.type || "").toLowerCase();
  const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();

  if (t === "presence" || text.includes("présence") || text.includes("absence") || text.includes("retard") || text.includes("émargement")) return "presence";
  if (text.includes("planning") || text.includes("emploi du temps") || text.includes("séance") || text.includes("cours annulé")) return "emploi_du_temps";
  if (t === "paiement" || t === "bourse" || text.includes("scolarité") || text.includes("solde") || text.includes("tranche") || text.includes("fcfa")) return "paiements";
  if (t === "test" || text.includes("évaluation") || text.includes("devoir") || text.includes("note")) return "evaluations";
  if (text.includes("examen") || text.includes("sécurisé") || text.includes("anti-triche")) return "examens";
  if (text.includes("enseignant") || text.includes("formateur") || text.includes("heure validée")) return "enseignants";
  if (text.includes("sentinel") || text.includes("ia") || text.includes("intelligence")) return "ia";
  if (text.includes("message") || text.includes("discussion") || text.includes("conversation")) return "messagerie";
  if (text.includes("admin") || text.includes("inscription") || text.includes("compte") || text.includes("utilisateur")) return "administration";
  return "systeme";
}

function getNotificationPriority(n: any): "haute" | "normale" {
  const text = `${n.title || ""} ${n.body || ""}`.toLowerCase();
  if (
    text.includes("urgent") ||
    text.includes("sécurité") ||
    text.includes("alerte") ||
    text.includes("absence") ||
    text.includes("impayé") ||
    text.includes("fraude")
  ) {
    return "haute";
  }
  return "normale";
}

export function NotificationsPage() {
  const { db, user, update } = useStore();
  const [filterType, setFilterType] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "haute" | "normale">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTicker, setRefreshTicker] = useState(0);

  useEffect(() => {
    const onNotifChanged = () => setRefreshTicker((t) => t + 1);
    window.addEventListener("sn:notifications-changed", onNotifChanged);
    return () => window.removeEventListener("sn:notifications-changed", onNotifChanged);
  }, []);

  const deletedSet = useMemo(() => getDeletedNotificationIds(user?.id), [user?.id, refreshTicker]);
  const readSet = useMemo(() => getReadNotificationIds(user?.id), [user?.id, refreshTicker]);

  const mine = useMemo(() => {
    return db.notifications
      .filter((n) => (n.toId === user!.id || n.toId === "all") && !deletedSet.has(n.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.notifications, user, deletedSet]);

  const filtered = useMemo(() => {
    return mine.filter((n) => {
      const read = Boolean(n.lu || readSet.has(n.id));
      if (filterType === "unread" && read) return false;
      if (filterType !== "all" && filterType !== "unread") {
        const cat = getNotificationCategory(n);
        if (cat !== filterType) return false;
      }

      if (priorityFilter !== "all") {
        const p = getNotificationPriority(n);
        if (p !== priorityFilter) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [mine, filterType, priorityFilter, searchTerm, readSet]);

  const handleMarkOne = async (n: any) => {
    if (!user?.id) return;
    await markNotificationAsRead(n.id, user.id);
    update((d) => ({
      ...d,
      notifications: d.notifications.map((x) => x.id === n.id ? { ...x, lu: true } : x),
    }));
    setRefreshTicker((t) => t + 1);
    toastMsg.success("Notification marquée comme lue ✓");
  };

  const handleMarkAll = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(mine, user.id);
    update((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.toId === user.id || n.toId === "all") ? { ...n, lu: true } : n),
    }));
    setRefreshTicker((t) => t + 1);
    toastMsg.success("Toutes les notifications sont marquées comme lues ✓");
  };

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const handleDeleteOne = async (n: any) => {
    if (!user?.id) return;
    await deleteNotification(n.id, user.id);
    update((d) => ({
      ...d,
      notifications: d.notifications.filter((x) => x.id !== n.id),
    }));
    setRefreshTicker((t) => t + 1);
    toastMsg.success("Notification supprimée");
  };

  const handleDeleteAll = async () => {
    if (!user?.id || mine.length === 0) return;
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      setTimeout(() => setConfirmDeleteAll(false), 4000);
      return;
    }
    setConfirmDeleteAll(false);
    await deleteAllNotifications(mine, user.id);
    const mineIds = new Set(mine.map((x) => x.id));
    update((d) => ({
      ...d,
      notifications: d.notifications.filter((x) => !mineIds.has(x.id)),
    }));
    setRefreshTicker((t) => t + 1);
    toastMsg.success("Toutes les notifications ont été supprimées");
  };

  const unreadCount = mine.filter((n) => !n.lu && !readSet.has(n.id)).length;

  return (
    <div className="space-y-4">
      <PageHead
        title="Notifications & Alertes"
        subtitle="Suivi en temps réel de votre dossier, alertes académiques, pédagogiques et administratives"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <Btn variant="outline" onClick={handleMarkAll} className="rounded-md">
                <CheckCheck size={16} /> Tout marquer comme lu
              </Btn>
            )}
            {mine.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAll}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold transition cursor-pointer",
                  confirmDeleteAll
                    ? "border-red-500 bg-red-600 text-white animate-pulse shadow-[0_0_12px_#FF174F]"
                    : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                )}
              >
                <Trash2 size={14} /> {confirmDeleteAll ? "Confirmer la suppression ?" : "Tout supprimer"}
              </button>
            )}
          </div>
        }
      />

      {/* Barre de recherche et filtres de priorité */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Rechercher une notification par mot-clé..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs py-1.5"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Priorité :</span>
          {(["all", "haute", "normale"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer border",
                priorityFilter === p
                  ? p === "haute"
                    ? "border-red-500/50 bg-red-500/20 text-red-300"
                    : "border-cyan-400/40 bg-cyan-500/20 text-cyan-300"
                  : "border-white/5 text-slate-400 hover:bg-white/5"
              )}
            >
              {p === "all" ? "Toutes" : p === "haute" ? "⚡ Urgentes" : "Standard"}
            </button>
          ))}
        </div>
      </div>

      {/* 10 Catégories officielles (Point 24) */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "all", label: `Toutes (${mine.length})` },
          { id: "unread", label: `Non lues (${unreadCount})` },
          { id: "systeme", label: "⚙️ Système" },
          { id: "presence", label: "🛡️ Présence" },
          { id: "emploi_du_temps", label: "📅 Emploi du temps" },
          { id: "enseignants", label: "👨‍🏫 Enseignants" },
          { id: "paiements", label: "💳 Paiements" },
          { id: "evaluations", label: "📝 Évaluations" },
          { id: "examens", label: "🔒 Examens" },
          { id: "ia", label: "🤖 Sentinel AI" },
          { id: "messagerie", label: "💬 Messagerie" },
          { id: "administration", label: "🏛️ Administration" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterType(f.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer",
              filterType === f.id
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<Bell size={40} />} title="Aucune notification" sub="Toutes vos alertes sont à jour." />
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const isRead = Boolean(n.lu || readSet.has(n.id));
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 transition-all duration-150",
                  isRead ? "bg-[#070D1A]/60 border-white/10 opacity-85" : "bg-[#0A1628] border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]",
                  notifColor[n.type] ?? ""
                )}
              >
                <div className={cn("mt-0.5 rounded-md border p-2 shrink-0", notifColor[n.type] ?? "border-white/10")}>
                  <Bell size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-sm font-bold", isRead ? "text-slate-300" : "text-white")}>{n.title}</p>
                      {getNotificationPriority(n) === "haute" && (
                        <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-[9px] font-bold text-red-300 border border-red-500/40">
                          ⚡ Prioritaire
                        </span>
                      )}
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 border border-white/10 uppercase font-mono">
                        {getNotificationCategory(n).replace("_", " ")}
                      </span>
                      {!isRead && (
                        <span className="inline-block h-2 w-2 rounded-sm bg-red-500 shadow-[0_0_6px_#FF174F] animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">{n.date}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(n)}
                        className="rounded-md p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition"
                        title="Supprimer cette notification"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">{n.body}</p>
                  {!isRead && (
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleMarkOne(n)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-400 transition"
                      >
                        <CheckCheck size={13} /> Marquer comme lu
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RecentMessages({ limit = 3 }: { limit?: number }) {
  const { db, user } = useStore();
  const [remoteList, setRemoteList] = useState<any[]>([]);

  useEffect(() => {
    if (isSupabaseConfigured && user?.id) {
      fetchMyConversations().then((convs) => {
        const items = convs.map((c: any) => {
          const msgs = (c.messages || []).sort((a: any, b: any) => (a.created_at || "").localeCompare(b.created_at || ""));
          const lastMsg = msgs[msgs.length - 1];
          const sender = db.users.find((u) => u.id === lastMsg?.sender_id);
          return {
            id: c.id,
            subject: c.subject || "Discussion",
            fromName: sender?.name || "Correspondant",
            date: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleDateString("fr-FR") : "",
            lu: true,
          };
        });
        setRemoteList(items);
      }).catch((err: any) => console.error("Erreur chargement aperçu conversations:", err));
    }
  }, [user?.id, db.users]);

  const list = isSupabaseConfigured && remoteList.length > 0
    ? remoteList.slice(0, limit)
    : db.messages.filter((m) => m.toId === user!.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);

  if (list.length === 0) return <p className="text-sm text-slate-500">Aucun message reçu.</p>;
  return (
    <div className="space-y-2.5">
      {list.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <Mail size={15} className="mt-0.5 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-200">{m.subject} {!m.lu && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}</p>
            <p className="truncate text-xs text-slate-500">De {m.fromName} • {m.date}</p>
          </div>
          <ChevronRight size={15} className="mt-1 shrink-0 text-slate-600" />
        </div>
      ))}
    </div>
  );
}
