import { useEffect, useMemo, useState } from "react";
import { Send, Mail, Bell, CheckCheck, Users, UserCircle2, Inbox, ChevronRight, MessageSquare, Reply, CornerDownRight, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, Textarea, Empty, PageHead, Badge, uid, today } from "@/lib/ui";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { fetchMyConversations, startConversation, replyToConversation, subscribeToAllMessages, deleteConversation, deleteMessage } from "@/lib/supabase/communication";
import { toastMsg } from "@/lib/toast";

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
      setRemoteConvs(convs);

      // Marquer automatiquement les conversations actives comme lues côté Supabase
      if (convs && convs.length > 0) {
        const sb = getSupabase();
        convs.forEach((c: any) => {
          sb.rpc("mark_conversation_as_read", { p_conversation_id: c.id }).then().catch(() => {});
        });
      }

      // Marquer les messages locaux comme lus
      update((d) => ({
        ...d,
        messages: (d.messages || []).map((m) =>
          m.toId === user?.id || m.toId === "all_students" || m.toId === "all_teachers" ? { ...m, lu: true } : m
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

  // Messages locaux (fallback ou mix)
  const localMessages = db.messages
    .filter((m) => m.toId === user!.id || m.fromId === user!.id || m.toId === "all_students" || m.toId === "all_teachers")
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
        return {
          id: c.id,
          isRemote: true,
          subject: c.subject || "Discussion",
          date: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "",
          lastSenderName: sender?.name || sender?.username || (isFromMe ? "Moi" : "Expéditeur inconnu"),
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
      toastMsg.error("Échec de suppression du message", err.message || "Erreur réseau");
    }
  };

  const targets = useMemo(() => {
    const opts: { id: string; label: string; icon: React.ReactNode }[] = [];
    if (["superadmin", "admin", "teacher"].includes(user!.role)) {
      opts.push({ id: "all_students", label: "Tous les apprenants", icon: <Users size={14} /> });
    }
    if (["superadmin", "admin"].includes(user!.role)) {
      opts.push({ id: "all_teachers", label: "Tous les enseignants", icon: <UserCircle2 size={14} /> });
    }

    const seen = new Set<string>();
    if (user?.id) seen.add(user.id);

    // Profils Supabase distants
    remoteProfiles.forEach((p) => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        opts.push({ id: p.id, label: `${p.name || p.username} (${p.role})`, icon: <UserCircle2 size={14} /> });
      }
    });

    // Utilisateurs locaux
    db.users.filter((u) => !seen.has(u.id)).forEach((u) => {
      opts.push({ id: u.id, label: `${u.name} (${u.role})`, icon: <UserCircle2 size={14} /> });
    });

    return opts;
  }, [remoteProfiles, db.users, user]);

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
                    const senderObj = db.users.find((u) => u.id === m.sender_id);
                    const authorName = senderObj?.name || (fromMe ? "Moi" : "Correspondant");
                    const canDelete = fromMe || user?.role === "superadmin" || user?.role === "admin";
                    return (
                      <div key={m.id || idx} className={cn("group relative rounded-xl p-3 text-sm transition", fromMe ? "bg-white/[0.04] border border-white/10 ml-6" : "bg-cyan-950/20 border border-cyan-400/20 mr-6")}>
                        <div className="flex justify-between items-center mb-1 text-[11px] text-slate-400">
                          <span className={cn("font-semibold", fromMe ? "text-slate-300" : "text-cyan-300")}>{authorName}</span>
                          <div className="flex items-center gap-2">
                            {m.created_at && <span>{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
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
                        <p className="whitespace-pre-wrap text-slate-200">{m.body}</p>
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
  const mine = db.notifications
    .filter((n) => n.toId === user!.id || n.toId === "all")
    .sort((a, b) => b.date.localeCompare(a.date));

  const markAll = () =>
    update((d) => ({ ...d, notifications: d.notifications.map((n) => (n.toId === user!.id || n.toId === "all") ? { ...n, lu: true } : n) }));

  return (
    <div>
      <PageHead
        title="Notifications"
        subtitle="Alertes, annonces et suivi de votre dossier"
        actions={<Btn variant="outline" onClick={markAll}><CheckCheck size={16} /> Tout marquer comme lu</Btn>}
      />
      {mine.length === 0 ? (
        <Empty icon={<Bell size={40} />} title="Aucune notification" />
      ) : (
        <div className="space-y-3">
          {mine.map((n) => (
            <div key={n.id} className={cn("flex items-start gap-3 rounded-2xl border bg-[#0A1224]/70 p-4", notifColor[n.type] ?? "border-white/10")}>
              <div className={cn("mt-0.5 rounded-xl border p-2", notifColor[n.type] ?? "")}><Bell size={16} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    {!n.lu && <span className="h-2 w-2 rounded-full bg-red-500" />}
                    <span className="text-[11px] text-slate-500">{n.date}</span>
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{n.body}</p>
                {!n.lu && (
                  <button
                    onClick={() => update((d) => ({ ...d, notifications: d.notifications.map((x) => x.id === n.id ? { ...x, lu: true } : x) }))}
                    className="mt-2 text-xs font-bold text-cyan-300 hover:underline"
                  >
                    Marquer comme lu
                  </button>
                )}
              </div>
            </div>
          ))}
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
