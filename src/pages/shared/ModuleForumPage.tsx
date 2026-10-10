import React, { useEffect, useState } from "react";
import {
  MessagesSquare,
  Pin,
  CheckCircle2,
  MessageCircle,
  Send,
  Plus,
  ShieldCheck,
  Trash2,
  Edit2,
  Search,
  Printer,
  Sparkles,
  User,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { forumService, ForumThread, ForumPost } from "@/modules/forum/services/forumService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Textarea, printHTML } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const ModuleForumPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [newReply, setNewReply] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Modales
  const [showNewThreadModal, setShowNewThreadModal] = useState<boolean>(false);
  const [newThreadData, setNewThreadData] = useState({ title: "", content: "" });

  const [editThreadModal, setEditThreadModal] = useState<boolean>(false);
  const [editThreadData, setEditThreadData] = useState({ title: "", content: "" });

  const [editPostModal, setEditPostModal] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [editPostContent, setEditPostContent] = useState<string>("");

  const isTeacherOrStaff =
    profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin";

  useEffect(() => {
    if (db.modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(db.modules[0].id);
    }
  }, [db.modules]);

  useEffect(() => {
    if (selectedModuleId) {
      loadThreads(selectedModuleId);
    }
  }, [selectedModuleId]);

  const loadThreads = async (modId: string) => {
    setLoading(true);
    try {
      const list = await forumService.getThreads(modId);
      setThreads(list);
      if (list.length > 0) {
        // Préserver le thread actif si existant
        if (selectedThread) {
          const current = list.find((t) => t.id === selectedThread.id);
          if (current) {
            handleSelectThread(current);
            return;
          }
        }
        handleSelectThread(list[0]);
      } else {
        setSelectedThread(null);
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectThread = async (t: ForumThread) => {
    setSelectedThread(t);
    const postList = await forumService.getPosts(t.id);
    setPosts(postList);
  };

  const handleCreateThread = async () => {
    if (!newThreadData.title.trim() || !newThreadData.content.trim()) {
      toastMsg.error("Champs obligatoires", "Veuillez renseigner le titre et votre question.");
      return;
    }

    const res = await forumService.createThread({
      module_id: selectedModuleId,
      author_id: profile?.id || "mock-user",
      author_name: profile?.name || "Membre",
      author_role: profile?.role || "student",
      title: newThreadData.title.trim(),
      content: newThreadData.content.trim(),
    });

    if (res.success) {
      toastMsg.success("Question publiée", "Votre sujet est maintenant visible sur le forum du module.");
      setShowNewThreadModal(false);
      setNewThreadData({ title: "", content: "" });
      await loadThreads(selectedModuleId);
      if (res.data) {
        handleSelectThread(res.data);
      }
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleOpenEditThread = () => {
    if (!selectedThread) return;
    setEditThreadData({ title: selectedThread.title, content: selectedThread.content });
    setEditThreadModal(true);
  };

  const handleSaveEditThread = async () => {
    if (!selectedThread) return;
    if (!editThreadData.title.trim() || !editThreadData.content.trim()) {
      toastMsg.error("Champs requis", "Le titre et le contenu ne peuvent pas être vides.");
      return;
    }

    const res = await forumService.updateThread(selectedThread.id, {
      title: editThreadData.title.trim(),
      content: editThreadData.content.trim(),
    });

    if (res.success) {
      toastMsg.success("Sujet modifié", "Les modifications ont été enregistrées avec succès.");
      setEditThreadModal(false);
      setSelectedThread({
        ...selectedThread,
        title: editThreadData.title.trim(),
        content: editThreadData.content.trim(),
      });
      loadThreads(selectedModuleId);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!window.confirm("Êtes-vous certain de vouloir supprimer définitivement ce sujet et toutes ses réponses ?")) {
      return;
    }

    const res = await forumService.deleteThread(threadId);
    if (res.success) {
      toastMsg.success("Sujet supprimé", "La discussion a été retirée du forum.");
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
        setPosts([]);
      }
      loadThreads(selectedModuleId);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleSendReply = async () => {
    if (!selectedThread || !newReply.trim()) return;

    const res = await forumService.replyToThread({
      thread_id: selectedThread.id,
      author_id: profile?.id || "mock-user",
      author_name: profile?.name || "Membre",
      author_role: profile?.role || "student",
      content: newReply.trim(),
    });

    if (res.success) {
      toastMsg.success("Réponse envoyée", "Votre contribution a été ajoutée ✓");
      setNewReply("");
      const updated = await forumService.getPosts(selectedThread.id);
      setPosts(updated);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleOpenEditPost = (post: ForumPost) => {
    setEditingPost(post);
    setEditPostContent(post.content);
    setEditPostModal(true);
  };

  const handleSaveEditPost = async () => {
    if (!editingPost || !editPostContent.trim()) return;

    const res = await forumService.updatePost(editingPost.id, editPostContent.trim());
    if (res.success) {
      toastMsg.success("Message modifié", "Votre réponse a été mise à jour.");
      setEditPostModal(false);
      setEditingPost(null);
      if (selectedThread) {
        const updated = await forumService.getPosts(selectedThread.id);
        setPosts(updated);
      }
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce message ?")) return;

    const res = await forumService.deletePost(postId);
    if (res.success) {
      toastMsg.success("Message supprimé", "La réponse a été retirée du fil.");
      if (selectedThread) {
        const updated = await forumService.getPosts(selectedThread.id);
        setPosts(updated);
      }
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleToggleSolution = async (post: ForumPost) => {
    if (!isTeacherOrStaff) return;

    await forumService.pinSolution(post.id, !post.is_pinned_solution);
    toastMsg.success(
      "Statut mis à jour",
      post.is_pinned_solution ? "Solution retirée" : "Validée comme solution officielle ✓"
    );
    if (selectedThread) {
      const updated = await forumService.getPosts(selectedThread.id);
      setPosts(updated);
    }
  };

  const handlePrintThread = () => {
    if (!selectedThread) return;
    const currentModule = db.modules.find((m) => m.id === selectedModuleId);

    const postsHtml = posts
      .map(
        (p, idx) => `
        <div style="margin-bottom:14px;padding:12px;border:1px solid ${p.is_pinned_solution ? '#10b981' : '#cbd5e1'};border-radius:6px;background:${p.is_pinned_solution ? '#f0fdf4' : '#ffffff'}">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;color:#475569">
            <strong>#${idx + 1} — ${p.author_name} (${p.author_role.toUpperCase()}) ${p.is_pinned_solution ? '· SOLUTION VALIDÉE' : ''}</strong>
            <span>${p.created_at.slice(0, 10)}</span>
          </div>
          <div style="font-size:12.5px;color:#0f172a;white-space:pre-wrap">${p.content}</div>
        </div>
      `
      )
      .join("");

    printHTML(
      `Discussion — ${selectedThread.title}`,
      `
      <div class="document-container">
        <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px">
          <span class="badge-official">FORUM PÉDAGOGIQUE · ${currentModule?.titre || 'MODULE'}</span>
          <h1 style="margin:8px 0 4px 0;font-size:18px;color:#0c4a6e">${selectedThread.title}</h1>
          <p style="margin:0;font-size:11px;color:#64748b">Initié par <strong>${selectedThread.author_name}</strong> (${selectedThread.author_role}) le ${selectedThread.created_at.slice(0, 10)} · ${posts.length} réponse(s)</p>
        </div>

        <div style="padding:14px;background:#f8fafc;border-left:4px solid #0284c7;border-radius:4px;margin-bottom:20px;font-size:13px;color:#0f172a">
          <strong>Question initiale :</strong>
          <p style="margin:6px 0 0 0;white-space:pre-wrap">${selectedThread.content}</p>
        </div>

        <h3 style="font-size:14px;color:#0c4a6e;margin-bottom:12px">Contributions et Réponses :</h3>
        ${postsHtml || '<p style="color:#64748b;font-style:italic">Aucune réponse à cette date.</p>'}
      </div>
    `
    );
  };

  const filteredThreads = threads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      t.author_name.toLowerCase().includes(q)
    );
  });

  const selectedModuleObj = db.modules.find((m) => m.id === selectedModuleId);

  return (
    <div className="space-y-6">
      <PageHead
        title="Forum Collaboratif & Q&R Pédagogiques"
        subtitle="Entraide entre apprenants, assistance directe des formateurs et validation certifiée des solutions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedThread && (
              <Btn onClick={handlePrintThread} variant="outline" className="border-cyan-500/30 text-cyan-200">
                <Printer size={14} /> Imprimer / PDF
              </Btn>
            )}
            <Btn
              onClick={() => setShowNewThreadModal(true)}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <Plus size={14} /> Poser une question
            </Btn>
          </div>
        }
      />

      {/* Barre supérieure : Sélecteur de module & Recherche rapide */}
      <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 flex items-center gap-2">
            <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider shrink-0">
              Module :
            </span>
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="w-full rounded-xl border border-cyan-500/30 bg-[#07101E] px-3 py-2 text-xs font-medium text-white focus:border-cyan-400 focus:outline-none"
            >
              {db.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-7 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une question, mot-clé ou auteur dans ce module..."
              className="w-full rounded-xl border border-cyan-500/30 bg-[#07101E] pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Vue en 2 colonnes HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne gauche (4 colonnes) : Liste des fils de discussion */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <MessagesSquare size={14} className="text-cyan-400" />
              Sujets ({filteredThreads.length})
            </h3>
            {selectedModuleObj && (
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                {selectedModuleObj.titre}
              </span>
            )}
          </div>

          {filteredThreads.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 text-xs border border-white/5 bg-[#0B1220]/60">
              {searchQuery ? "Aucun sujet ne correspond à votre recherche." : "Aucune discussion ouverte sur ce module. Soyez le premier à poser une question !"}
            </Card>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {filteredThreads.map((t) => {
                const isSelected = selectedThread?.id === t.id;
                const canManageThread =
                  isTeacherOrStaff || profile?.id === t.author_id || profile?.name === t.author_name;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectThread(t)}
                    className={`group relative rounded-xl border p-3.5 transition cursor-pointer text-left ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-950/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "border-white/10 bg-[#0B1220]/80 text-slate-300 hover:border-cyan-500/40 hover:bg-[#0E1729]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-white group-hover:text-cyan-200 line-clamp-1">
                        {t.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.is_pinned && <Pin size={12} className="text-amber-400" />}
                        {canManageThread && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(t.id);
                            }}
                            title="Supprimer ce sujet"
                            className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {t.content}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-2">
                      <span className="flex items-center gap-1 text-cyan-300/80">
                        <User size={10} /> {t.author_name} ({t.author_role})
                      </span>
                      <span className="font-mono text-slate-400">{t.created_at.slice(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne droite (8 colonnes) : Fil sélectionné & Réponses */}
        <div className="lg:col-span-8 space-y-4">
          {selectedThread ? (
            <>
              {/* Question principale */}
              <Card className="p-5 border border-cyan-500/40 bg-[#0B1220] shadow-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-white">{selectedThread.title}</h2>
                      {selectedThread.is_pinned && <Badge color="gold">Épinglé</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <User size={12} className="text-cyan-400" />
                      Posté par <strong className="text-cyan-200">{selectedThread.author_name}</strong> ({selectedThread.author_role})
                      <span>·</span>
                      <Clock size={12} /> {selectedThread.created_at.slice(0, 10)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(isTeacherOrStaff || profile?.id === selectedThread.author_id) && (
                      <button
                        type="button"
                        onClick={handleOpenEditThread}
                        className="px-2.5 py-1 text-xs rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 transition flex items-center gap-1 font-semibold"
                      >
                        <Edit2 size={12} /> Éditer
                      </button>
                    )}
                    {(isTeacherOrStaff || profile?.id === selectedThread.author_id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteThread(selectedThread.id)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-red-500/30 bg-red-950/40 text-red-300 hover:bg-red-900/60 transition flex items-center gap-1 font-semibold"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-cyan-500/20 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {selectedThread.content}
                </div>
              </Card>

              {/* Liste des réponses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-cyan-400" />
                    Réponses ({posts.length})
                  </h3>
                </div>

                {posts.length === 0 ? (
                  <Card className="p-6 text-center text-xs text-slate-400 border border-white/5 bg-[#0B1220]/40">
                    Aucune réponse enregistrée. Soyez le premier à apporter votre aide !
                  </Card>
                ) : (
                  posts.map((post) => {
                    const isAuthor = profile?.id === post.author_id || profile?.name === post.author_name;
                    const canManagePost = isTeacherOrStaff || isAuthor;

                    return (
                      <Card
                        key={post.id}
                        className={`p-4 border transition ${
                          post.is_pinned_solution
                            ? "border-emerald-500/70 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "border-white/10 bg-[#0B1220]/80 hover:border-cyan-500/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-white">{post.author_name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 font-mono border border-cyan-500/20">
                              {post.author_role}
                            </span>
                            {post.is_pinned_solution && (
                              <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={12} className="text-emerald-400" /> Solution validée
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono">
                              {post.created_at.slice(0, 10)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Validation solution (Formateur / Admin) */}
                            {isTeacherOrStaff && (
                              <button
                                type="button"
                                onClick={() => handleToggleSolution(post)}
                                className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition cursor-pointer"
                              >
                                {post.is_pinned_solution ? "Retirer solution" : "Marquer solution ✓"}
                              </button>
                            )}

                            {/* Édition */}
                            {canManagePost && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditPost(post)}
                                title="Modifier ce message"
                                className="p-1 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            {/* Suppression de message (Spécifiquement demandée !) */}
                            {canManagePost && (
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post.id)}
                                title="Supprimer ce message"
                                className="p-1 text-slate-400 hover:text-red-400 transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                          {post.content}
                        </p>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Formulaire de réponse directe */}
              <Card className="p-4 border border-cyan-500/30 bg-[#0B1220]/90 space-y-3">
                <Textarea
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="Rédigez une réponse bienveillante et constructive..."
                  className="text-xs min-h-[75px] bg-[#07101E] border-cyan-500/30 focus:border-cyan-400"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Sparkles size={13} className="text-cyan-400" /> Vos réponses contribuent à la réussite collective
                  </span>
                  <Btn
                    onClick={handleSendReply}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold"
                  >
                    <Send size={14} /> Envoyer la réponse
                  </Btn>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center text-slate-400 border border-white/5 bg-[#0B1220]/40 space-y-2">
              <MessagesSquare size={36} className="mx-auto text-cyan-400/50 mb-2" />
              <h3 className="text-sm font-bold text-white">Sélectionnez une discussion</h3>
              <p className="text-xs text-slate-400">
                Choisissez un sujet dans la colonne de gauche ou posez une nouvelle question pédagogique.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Création Sujet */}
      <Modal open={showNewThreadModal} onClose={() => setShowNewThreadModal(false)} title="Poser une nouvelle question">
        <div className="space-y-4">
          <Field label="Titre de votre question">
            <Input
              value={newThreadData.title}
              onChange={(e) => setNewThreadData({ ...newThreadData, title: e.target.value })}
              placeholder="ex: Erreur de configuration Docker lors du TP 3"
            />
          </Field>
          <Field label="Détail du problème ou de la question">
            <Textarea
              value={newThreadData.content}
              onChange={(e) => setNewThreadData({ ...newThreadData, content: e.target.value })}
              placeholder="Décrivez précisément votre démarche, vos erreurs ou le point théorique à éclaircir..."
              className="min-h-[120px]"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowNewThreadModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleCreateThread} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Publier sur le forum
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Édition Sujet */}
      <Modal open={editThreadModal} onClose={() => setEditThreadModal(false)} title="Modifier le sujet">
        <div className="space-y-4">
          <Field label="Titre">
            <Input
              value={editThreadData.title}
              onChange={(e) => setEditThreadData({ ...editThreadData, title: e.target.value })}
            />
          </Field>
          <Field label="Contenu">
            <Textarea
              value={editThreadData.content}
              onChange={(e) => setEditThreadData({ ...editThreadData, content: e.target.value })}
              className="min-h-[120px]"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setEditThreadModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSaveEditThread} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal Édition Réponse */}
      <Modal open={editPostModal} onClose={() => setEditPostModal(false)} title="Modifier votre réponse">
        <div className="space-y-4">
          <Field label="Message">
            <Textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              className="min-h-[120px]"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setEditPostModal(false)}>
              Annuler
            </Btn>
            <Btn onClick={handleSaveEditPost} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Mettre à jour
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
};
