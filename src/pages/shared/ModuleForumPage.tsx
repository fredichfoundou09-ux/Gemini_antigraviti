import React, { useEffect, useState } from "react";
import { MessagesSquare, Pin, CheckCircle2, MessageCircle, Send, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/lib/store";
import { forumService, ForumThread, ForumPost } from "@/modules/forum/services/forumService";
import { Card, PageHead, Badge, Btn, Modal, Field, Input, Select, Textarea, Empty } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";

export const ModuleForumPage: React.FC = () => {
  const { profile } = useAuth();
  const { db } = useStore();
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [newReply, setNewReply] = useState<string>("");
  const [showNewThreadModal, setShowNewThreadModal] = useState<boolean>(false);
  const [newThreadData, setNewThreadData] = useState({ title: "", content: "" });
  const [loading, setLoading] = useState(false);

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
    if (!newThreadData.title || !newThreadData.content) {
      toastMsg.error("Champs obligatoires", "Veuillez renseigner le titre et votre question.");
      return;
    }

    const res = await forumService.createThread({
      module_id: selectedModuleId,
      author_id: profile?.id || "mock-user",
      author_name: profile?.name || "Membre",
      author_role: profile?.role || "student",
      title: newThreadData.title,
      content: newThreadData.content,
    });

    if (res.success) {
      toastMsg.success("Question publiée", "Votre sujet est maintenant visible sur le forum du module.");
      setShowNewThreadModal(false);
      setNewThreadData({ title: "", content: "" });
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
      toastMsg.success("Réponse envoyée", "Votre contribution a été ajoutée.");
      setNewReply("");
      const updated = await forumService.getPosts(selectedThread.id);
      setPosts(updated);
    } else {
      toastMsg.error("Erreur", res.error);
    }
  };

  const handleToggleSolution = async (post: ForumPost) => {
    const isTeacher = profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin";
    if (!isTeacher) return;

    await forumService.pinSolution(post.id, !post.is_pinned_solution);
    toastMsg.success("Statut mis à jour", post.is_pinned_solution ? "Solution retirée" : "Validée comme solution officielle ✓");
    if (selectedThread) {
      const updated = await forumService.getPosts(selectedThread.id);
      setPosts(updated);
    }
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Forum & Questions-Réponses Pédagogiques"
        subtitle="Entraide entre pairs, résolution collaborative et validation des solutions par les formateurs"
        actions={
          <Btn onClick={() => setShowNewThreadModal(true)} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
            <Plus size={14} /> Poser une question
          </Btn>
        }
      />

      {/* Sélecteur de module */}
      <Card className="p-4 border border-white/10 bg-black/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-white">Module d'apprentissage :</span>
          <select
            value={selectedModuleId}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="rounded-lg border border-white/20 bg-black px-3 py-1.5 text-xs text-white"
          >
            {db.modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.numero}. {m.titre}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Vue en 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : liste des discussions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
            Sujets de discussion ({threads.length})
          </h3>

          {threads.length === 0 ? (
            <Card className="p-6 text-center text-white/50 text-xs">
              Aucun sujet ouvert sur ce module. Soyez le premier à poser une question !
            </Card>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectThread(t)}
                className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                  selectedThread?.id === t.id
                    ? "border-red-500 bg-red-950/20 text-white"
                    : "border-white/10 bg-black/40 text-white/70 hover:border-white/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-white line-clamp-1">{t.title}</span>
                  {t.is_pinned && <Pin size={13} className="text-red-400 shrink-0" />}
                </div>
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{t.content}</p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
                  <span>Par {t.author_name} ({t.author_role})</span>
                  <span>{t.created_at.slice(0, 10)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Colonne droite : contenu du sujet & réponses */}
        <div className="lg:col-span-2 space-y-4">
          {selectedThread ? (
            <>
              {/* Question principale */}
              <Card className="p-5 border border-white/10 bg-black/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-black text-white">{selectedThread.title}</h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      Posté par <span className="font-semibold text-white">{selectedThread.author_name}</span> (
                      {selectedThread.author_role}) le {selectedThread.created_at.slice(0, 10)}
                    </p>
                  </div>
                  {selectedThread.is_pinned && (
                    <Badge color="red">Épinglé</Badge>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-white/90 whitespace-pre-wrap leading-relaxed">
                  {selectedThread.content}
                </div>
              </Card>

              {/* Réponses */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Réponses & Contributions ({posts.length})
                </h3>

                {posts.map((post) => (
                  <Card
                    key={post.id}
                    className={`p-4 border transition ${
                      post.is_pinned_solution
                        ? "border-emerald-500/70 bg-emerald-950/20"
                        : "border-white/10 bg-black/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{post.author_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                          {post.author_role}
                        </span>
                        {post.is_pinned_solution && (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Solution validée par le formateur
                          </span>
                        )}
                      </div>

                      {/* Action formateur pour épingler/retirer la solution */}
                      {(profile?.role === "teacher" || profile?.role === "admin" || profile?.role === "superadmin") && (
                        <button
                          type="button"
                          onClick={() => handleToggleSolution(post)}
                          className="text-[10px] font-bold text-white/50 hover:text-emerald-400 cursor-pointer"
                        >
                          {post.is_pinned_solution ? "Retirer solution" : "Marquer solution ✓"}
                        </button>
                      )}
                    </div>

                    <p className="mt-2.5 text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Champ d'ajout de réponse */}
              <Card className="p-4 border border-white/10 bg-black/60">
                <div className="flex gap-2">
                  <Textarea
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    placeholder="Écrivez une réponse constructive..."
                    className="text-xs min-h-[60px]"
                  />
                  <Btn
                    onClick={handleSendReply}
                    className="self-end bg-[#E60000] hover:bg-[#FF2A2A] text-white shrink-0"
                  >
                    <Send size={14} /> Répondre
                  </Btn>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center text-white/50">
              Sélectionnez un sujet ou lancez une nouvelle question.
            </Card>
          )}
        </div>
      </div>

      {/* Modal Création de Sujet */}
      <Modal open={showNewThreadModal} onClose={() => setShowNewThreadModal(false)} title="Poser une nouvelle question">
        <div className="space-y-4">
          <Field label="Titre clair de votre question">
            <Input
              value={newThreadData.title}
              onChange={(e) => setNewThreadData({ ...newThreadData, title: e.target.value })}
              placeholder="ex: Erreur de configuration Docker lors de l'exercice 3"
            />
          </Field>
          <Field label="Détail du problème">
            <Textarea
              value={newThreadData.content}
              onChange={(e) => setNewThreadData({ ...newThreadData, content: e.target.value })}
              placeholder="Expliquez ce qui bloque, collez les messages d'erreur éventuels..."
            />
          </Field>
          <Btn onClick={handleCreateThread} className="w-full bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold">
            Publier sur le forum
          </Btn>
        </div>
      </Modal>
    </div>
  );
};
