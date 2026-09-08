import { useEffect, useMemo, useState } from "react";
import { Send, Mail, Bell, CheckCheck, Users, UserCircle2, Inbox, ChevronRight, MessageSquare, Reply, CornerDownRight, Trash2, Search, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, Textarea, Empty, PageHead, Badge, uid, today } from "@/lib/ui";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { fetchMyConversations, startConversation, replyToConversation, subscribeToAllMessages, deleteConversation, deleteMessage } from "@/lib/supabase/communication";
import { toastMsg } from "@/lib/toast";
import {
  isNotificationRead,
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
  const [mode, setMode] = useState<"inbox" | "new">("inbox");
  const [to, setTo] = useState("all_students");
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

  // Charger les profils Supabase réels
  const loadProfiles = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const sb = getSupabase();
      const { data } = await sb.from("profiles").select("id, name, username, email, role").order("name");
      if (data && data.length > 0) setRemoteProfiles(data);
    } catch { /* fallback */ }
  };

  // Charger les conversations Supabase et marquer comme lues
  const loadConversations = async () => {
    if (!isSupabaseConfigured || !user?.id) return;
    try {
      const convs = await fetchMyConversations();
      // Filtrage strict : seules les conversations où l'utilisateur connecté est membre ou participant
      const myConvs = (convs || []).filter((c: any) =>
        c.members?.some((m: any) => m.user_id === user?.id) ||
        c.messages?.some((m: any) => m.sender_id === user?.id)
      );
      setRemoteConvs(myConvs);

      // Marquer automatiquement les conversations actives comme lues côté Supabase
      if (myConvs && myConvs.length > 0) {
        const sb = getSupabase();
        myConvs.forEach((c: any) => {
          sb.rpc("mark_conversation_as_read", { p_conversation_id: c.id }).then().catch(() => {});
        });
      }

      // Marquer les messages locaux comme lus
      update((d) => ({
        ...d,
        messages: (d.messages || []).map((m) =>
          m.toId === user?.id || (m.toId === "all_students" && user?.role === "student") || (m.toId === "all_teachers" && user?.role === "teacher") ? { ...m, lu: true } : m
        ),
      }));
    } catch (err: any) {
      console.warn("Impossible de charger les conversations Supabase:", err.message);
    }
  };

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
  }, [user?.id]);

  // Messages locaux (fallback ou mix) - isolation stricte
  const localMessages = db.messages
    .filter((m) =>
      m.toId === user!.id ||
      m.fromId === user!.id ||
      (m.toId === "all_students" && user?.role === "student") ||
      (m.toId === "all_teachers" && user?.role === "teacher")
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

        return {
          id: c.id,
          isRemote: true,
          subject: c.subject || "Discussion",
          date: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "",
          lastSenderName,
          messages: msgs,
          isFromMe,
        };
      });
    }
    return localMessages.map((m) => ({
      id: m.id,
      isRemote: false,
      subject: m.subject,
      date: m.date,
      lastSenderName: m.fromName,
      messages: [{ id: m.id, sender_id: m.fromId, body: m.body, created_at: m.date }],
      isFromMe: m.fromId === user?.id,
      localMsg: m,
    }));
  }, [remoteConvs, localMessages, isSupabaseConfigured, user?.id, remoteProfiles, db.users]);

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
          memberIds = [to];
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
        await loadConversations();
        toastMsg.success("Réponse envoyée ✓");
      } else {
        const msg = { id: uid("MSG"), fromId: user.id, fromName: user.name, toId: "dest", subject: "Re: Message", body: replyBody.trim(), date: today(), lu: false };
        update((d) => ({ ...d, messages: [msg, ...d.messages] }));
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

  const handleDeleteConversation = async (item: any) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la discussion "${item.subject}" et tous ses messages ?`)) return;
    try {
      if (item.isRemote) {
        await deleteConversation(item.id, user?.id);
        await loadConversations();
      } else {
        update((d) => ({
          ...d,
          messages: d.messages.filter((m) => m.id !== item.id),
        }));
      }
      toastMsg.success("Conversation supprimée ✓");
      log(`Conversation supprimée : ${item.subject}`);
    } catch (err: any) {
      console.error("Erreur suppression conversation:", err);
      toastMsg.error("Échec de suppression", err.message || "Erreur réseau");
    }
  };

  const handleDeleteMessage = async (msg: any, parentItem: any) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce message ?")) return;
    try {
      if (parentItem.isRemote && msg.id) {
        await deleteMessage(msg.id, user?.id);
        await loadConversations();
      } else {
        update((d) => ({
          ...d,
          messages: d.messages.filter((m) => m.id !== msg.id),
        }));
      }
      toastMsg.success("Message supprimé ✓");
    } catch (err: any) {
      console.error("Erreur suppression message:", err);
      toastMsg.error("Échec de suppression du message", err.message);
    }
  };

  const targets = useMemo(() => {
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

    // Rassembler tous les profils (distants et locaux)
    const allCandidates = [
      ...remoteProfiles,
      ...db.users.map((u) => ({ id: u.id, name: u.name, username: u.username, role: u.role })),
    ];

    allCandidates.forEach((p) => {
      if (!p.id || seen.has(p.id)) return;
      seen.add(p.id);

      if (isStudent) {
        // Pour les étudiants : masquer strictement le nom personnel des administrateurs
        if (p.role === "superadmin") {
          opts.push({
            id: p.id,
            label: "🛡️ Direction (Super Administrateur)",
            icon: <ShieldCheck size={14} className="text-red-400" />,
            category: "admin",
          });
        } else if (p.role === "admin" || p.role === "partner_admin") {
          opts.push({
            id: p.id,
            label: "🛡️ Scolarité & Support (Administration)",
            icon: <ShieldCheck size={14} className="text-cyan-400" />,
            category: "admin",
          });
        } else if (p.role === "teacher") {
          opts.push({
            id: p.id,
            label: `👨‍🏫 ${p.name || p.username} (Formateur)`,
            icon: <UserCircle2 size={14} className="text-emerald-400" />,
            category: "teacher",
          });
        } else if (p.role === "student") {
          opts.push({
            id: p.id,
            label: `🎓 ${p.name || p.username} (Apprenant)`,
            icon: <Users size={14} className="text-purple-400" />,
            category: "student",
          });
        }
      } else {
        const isAdm = p.role === "superadmin" || p.role === "admin" || p.role === "partner_admin";
        const isTeach = p.role === "teacher";
        const cat = isAdm ? "admin" : isTeach ? "teacher" : "student";
        const rTag = p.role === "superadmin" ? "Super Admin" : p.role === "admin" ? "Admin" : p.role === "teacher" ? "Formateur" : "Apprenant";
        opts.push({
          id: p.id,
          label: `${p.name || p.username} (${rTag})`,
          icon: <UserCircle2 size={14} />,
          category: cat,
        });
      }
    });

    return opts.filter((t) => {
      if (recipientRoleFilter !== "all" && t.category !== recipientRoleFilter) return false;
      if (recipientSearch && !t.label.toLowerCase().includes(recipientSearch.toLowerCase())) return false;
      return true;
    });
  }, [remoteProfiles, db.users, user, recipientRoleFilter, recipientSearch]);

  return (
    <div>
      <PageHead
        title="Messagerie interne"
        subtitle="Conversations instantanées et annonces multi-espaces"
        actions={
          <Btn onClick={() => setMode(mode === "inbox" ? "new" : "inbox")}>
            {mode === "inbox" ? <><Send size={16} /> Nouveau message</> : <><Inbox size={16} /> Boîte de réception</>}
          </Btn>
        }
      />

      {mode === "new" ? (
        <Card className="mx-auto max-w-2xl p-6">
          <form onSubmit={send} className="space-y-4">
            <Field label="Destinataire">
              {/* Filtres par rôle */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Tous" },
                  ...(user?.role !== "student" ? [{ id: "broadcast", label: "📢 Diffusions" }] : []),
                  { id: "admin", label: "🛡️ Direction & Admin" },
                  { id: "teacher", label: "👨‍🏫 Formateurs" },
                  { id: "student", label: "🎓 Apprenants" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRecipientRoleFilter(f.id as any)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
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
                <div className="rounded-xl border border-white/5 p-4 text-center text-xs text-slate-500">
                  Aucun contact correspondant à votre filtre.
                </div>
              ) : (
                <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {targets.map((t) => (
                    <button type="button" key={t.id} onClick={() => setTo(t.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                        to === t.id ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-300 hover:bg-white/5"
                      )}>
                      {t.icon} <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Objet"><Input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de la discussion" /></Field>
            <Field label="Message"><Textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Rédigez votre message..." /></Field>
            <Btn type="submit" disabled={sending} className="w-full py-3">
              <Send size={16} /> {sending ? "Envoi en cours..." : "Envoyer le message"}
            </Btn>
          </form>
        </Card>
      ) : displayItems.length === 0 ? (
        <Empty icon={<Mail size={40} />} title="Aucun message" sub="Vos conversations apparaîtront ici." />
      ) : (
        <div className="space-y-4">
          {displayItems.map((item) => {
            const incoming = !item.isFromMe;
            return (
              <Card key={item.id} className="p-5" glow={incoming ? "cyan" : "green"}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    {incoming ? <Mail size={16} className="text-cyan-300" /> : <Send size={16} className="text-emerald-300" />}
                    <p className="text-sm font-bold text-white">{item.subject}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">{item.date}</span>
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
                      onClick={() => { setReplyingTo(item.id); setReplyBody(""); }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 hover:underline"
                    >
                      <Reply size={14} /> Répondre
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { db, user, update } = useStore();
  const [filterType, setFilterType] = useState<"all" | "unread" | "info" | "paiement" | "presence">("all");
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
      if (filterType === "unread") return !read;
      if (filterType === "info") return n.type === "info" || n.type === "inscription";
      if (filterType === "paiement") return n.type === "paiement" || n.type === "bourse";
      if (filterType === "presence") return n.type === "presence" || n.type === "test";
      return true;
    });
  }, [mine, filterType, readSet]);

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
        subtitle="Suivi en temps réel de votre dossier, alertes académiques et financières"
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
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold transition",
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

      {/* Filtres de catégorie : boutons rectangulaires aux coins légèrement arrondis */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: `Toutes (${mine.length})` },
          { id: "unread", label: `Non lues (${unreadCount})` },
          { id: "info", label: "📢 Annonces & Info" },
          { id: "paiement", label: "💳 Finances" },
          { id: "presence", label: "🛡️ Présences & Examens" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterType(f.id as any)}
            className={cn(
              "rounded-md border px-3.5 py-1.5 text-xs font-bold transition-all",
              filterType === f.id
                ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
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
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-bold", isRead ? "text-slate-300" : "text-white")}>{n.title}</p>
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
      }).catch(() => {});
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
