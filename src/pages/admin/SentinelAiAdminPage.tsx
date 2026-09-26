import React, { useState, useEffect, useMemo } from "react";
import {
  Brain,
  Shield,
  CheckCircle,
  FileText,
  Search,
  RefreshCw,
  PlusCircle,
  Activity,
  Layers,
  Zap,
  Clock,
  Cpu,
  BarChart3,
  FolderOpen,
  Check,
  Trash2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { ingestDocumentForRag } from "@/lib/ai/documentIngestion";

interface MemoryItem {
  id: string;
  user_id?: string;
  category?: string;
  content: string;
  status: "candidate" | "validated" | "unverified" | "archived" | string;
  hierarchy_level?: number;
  created_at: string;
}

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  is_official?: boolean;
  version?: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  role: string;
  intent: string;
  tool_name?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  status: string;
  created_at: string;
}

export function SentinelAiAdminPage() {
  const [activeTab, setActiveTab] = useState<"moderation" | "rag" | "observability">("moderation");
  const [loading, setLoading] = useState(false);

  // Données
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filtres
  const [memoryFilter, setMemoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modale Nouvelle Connaissance
  const [newDocModal, setNewDocModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("rules");
  const [newContent, setNewContent] = useState("");

  // Upload RAG
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Charger les données
  const fetchData = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Mémoires
        const { data: memData } = await supabase
          .from("ai_memories")
          .select("*")
          .order("created_at", { ascending: false });
        if (memData) setMemories(memData);

        // 2. Documents officiels & RAG
        const { data: docData } = await supabase
          .from("ai_knowledge_docs")
          .select("*")
          .order("created_at", { ascending: false });
        if (docData) setKnowledgeDocs(docData);

        // 3. Télémétrie d'audit
        const { data: logData } = await supabase
          .from("ai_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (logData) setAuditLogs(logData);
      } else {
        // Fallback local storage
        const raw = localStorage.getItem("sn_db_v2");
        const db = raw ? JSON.parse(raw) : {};
        setMemories(db.ai_memories || []);
      }
    } catch (err: any) {
      console.warn("Erreur chargement Sentinel AI Admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Validation d'une mémoire candidate (unverified -> validated_knowledge)
  const handleValidateMemory = async (id: string) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("ai_memories")
          .update({ status: "validated", hierarchy_level: 6 })
          .eq("id", id);
        if (error) throw error;
      }

      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "validated", hierarchy_level: 6 } : m))
      );

      // Local storage sync
      const raw = localStorage.getItem("sn_db_v2");
      if (raw) {
        const db = JSON.parse(raw);
        if (db.ai_memories) {
          db.ai_memories = db.ai_memories.map((m: any) =>
            m.id === id ? { ...m, status: "validated", hierarchy_level: 6 } : m
          );
          localStorage.setItem("sn_db_v2", JSON.stringify(db));
        }
      }

      toastMsg.success("Connaissance validée avec succès !", "Elle est maintenant classée comme source officielle pour l'agent.");
    } catch (e: any) {
      toastMsg.error("Échec de validation : " + (e.message || "Erreur"));
    }
  };

  // Rejet / Archivage d'une mémoire
  const handleArchiveMemory = async (id: string) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("ai_memories")
          .update({ status: "archived" })
          .eq("id", id);
        if (error) throw error;
      }

      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "archived" } : m))
      );
      toastMsg.info("Connaissance archivée", "L'agent ne l'utilisera plus dans ses déductions.");
    } catch (e: any) {
      toastMsg.error("Échec archivage : " + (e.message || "Erreur"));
    }
  };

  // Création d'une nouvelle connaissance officielle
  const handleCreateOfficialKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toastMsg.warning("Veuillez renseigner le titre et le contenu.");
      return;
    }

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from("ai_knowledge_docs").insert({
          title: newTitle.trim(),
          category: newCategory,
          content: newContent.trim(),
          is_official: true,
          hierarchy_level: 3,
          target_roles: ["superadmin", "admin", "teacher", "student", "partner", "partner_admin"],
        }).select().single();

        if (error) throw error;
        if (data) setKnowledgeDocs((prev) => [data, ...prev]);
      } else {
        const newDoc: KnowledgeDoc = {
          id: "doc-" + Date.now(),
          title: newTitle.trim(),
          category: newCategory,
          content: newContent.trim(),
          is_official: true,
          created_at: new Date().toISOString(),
        };
        setKnowledgeDocs((prev) => [newDoc, ...prev]);
      }

      toastMsg.success("Connaissance officielle ajoutée !", "Elle est immédiatement consultable par le RAG de Sentinel AI.");
      setNewTitle("");
      setNewContent("");
      setNewDocModal(false);
    } catch (err: any) {
      toastMsg.error("Erreur création : " + (err.message || "Inconnue"));
    }
  };

  // Upload de fichier RAG
  const handleFileUpload = async (file: File) => {
    setUploadingDoc(true);
    try {
      const res = await ingestDocumentForRag(file, { title: file.name });
      toastMsg.success(
        `Document "${res.title}" indexé !`,
        `${res.chunksCount} fragments découpés avec protection anti-injection (v${res.version}).`
      );
      fetchData();
    } catch (err: any) {
      toastMsg.error("Échec d'indexation : " + (err.message || "Erreur"));
    } finally {
      setUploadingDoc(false);
    }
  };

  // Statistiques calculées pour l'observabilité
  const stats = useMemo(() => {
    const totalRequests = auditLogs.length;
    const totalTokens = auditLogs.reduce((acc, log) => acc + (log.total_tokens || 0), 0);
    const avgLatency = totalRequests > 0
      ? Math.round(auditLogs.reduce((acc, log) => acc + (log.latency_ms || 0), 0) / totalRequests)
      : 0;

    const roleBreakdown: Record<string, number> = {};
    const toolBreakdown: Record<string, number> = {};

    auditLogs.forEach((log) => {
      roleBreakdown[log.role] = (roleBreakdown[log.role] || 0) + 1;
      if (log.tool_name) {
        toolBreakdown[log.tool_name] = (toolBreakdown[log.tool_name] || 0) + 1;
      }
    });

    return { totalRequests, totalTokens, avgLatency, roleBreakdown, toolBreakdown };
  }, [auditLogs]);

  // Filtrage des mémoires
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchFilter =
        memoryFilter === "all" ? true : m.status?.toLowerCase() === memoryFilter.toLowerCase();
      const matchSearch =
        !searchQuery ||
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [memories, memoryFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#040810] via-cyan-950/20 to-[#040810] p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_20px_rgba(0,229,255,0.25)]">
            <Brain size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black uppercase tracking-wider text-white">Centre de Contrôle Sentinel AI</h1>
              <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-400/30">
                SUPERADMIN / STAFF
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Modération des connaissances candidates, gestion du corpus RAG et télémétrie NVIDIA Nemotron
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
          <button
            onClick={() => setNewDocModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-500/20 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition shadow-lg cursor-pointer"
          >
            <PlusCircle size={14} /> Nouvelle Connaissance
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("moderation")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === "moderation"
              ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <CheckCircle size={15} /> Modération des Connaissances
          <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-300">
            {memories.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rag")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === "rag"
              ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Layers size={15} /> Base Documentaire & Syllabi (RAG)
          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-300">
            {knowledgeDocs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("observability")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === "observability"
              ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <Activity size={15} /> Observabilité & Tokens NVIDIA
          <span className="rounded-full bg-purple-400/20 px-2 py-0.5 text-[10px] text-purple-300">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ONGLET 1 : MODÉRATION DES CONNAISSANCES CANDIDATES */}
      {/* ========================================================= */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400">Statut :</span>
              <div className="flex gap-1">
                {["all", "unverified", "candidate", "validated", "archived"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setMemoryFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition cursor-pointer ${
                      memoryFilter === st
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold"
                        : "text-slate-400 hover:text-white bg-white/5"
                    }`}
                  >
                    {st === "all" ? "Tous" : st === "unverified" ? "À valider" : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full md:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher dans la mémoire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-black/60 pl-8 pr-3 py-1.5 text-xs text-slate-200 border border-white/10 focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/30 p-12 text-center text-slate-400">
              <Brain size={32} className="mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">Aucune connaissance candidate trouvée</p>
              <p className="text-xs mt-1">Les informations nouvelles formulées par les utilisateurs apparaîtront ici.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredMemories.map((m) => {
                const isValidated = m.status === "validated";
                const isArchived = m.status === "archived";
                return (
                  <div
                    key={m.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-cyan-400/30 transition shadow-md"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                            isValidated
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-400/30"
                              : isArchived
                              ? "bg-slate-900 text-slate-500 border-slate-700"
                              : "bg-amber-950/60 text-amber-300 border-amber-400/30"
                          }`}
                        >
                          {isValidated ? "Validé (Officiel)" : isArchived ? "Archivé" : "Candidate (Non vérifiée)"}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(m.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-2 py-0.2 rounded border border-cyan-400/20">
                          Niveau Hiérarchie : {m.hierarchy_level ?? (isValidated ? 6 : 10)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 font-medium leading-relaxed">{m.content}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isValidated && (
                        <button
                          onClick={() => handleValidateMemory(m.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
                          title="Valider cette information comme connaissance officielle"
                        >
                          <Check size={14} /> Valider
                        </button>
                      )}
                      {!isArchived && (
                        <button
                          onClick={() => handleArchiveMemory(m.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40 transition cursor-pointer"
                          title="Rejeter et archiver cette information"
                        >
                          <Trash2 size={14} /> Rejeter
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ONGLET 2 : CORPUS DOCUMENTAIRE & SYLLABI (RAG) */}
      {/* ========================================================= */}
      {activeTab === "rag" && (
        <div className="space-y-6">
          {/* Bannière de téléversement RAG */}
          <div className="rounded-2xl border border-dashed border-cyan-400/40 bg-cyan-950/10 p-6 text-center">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,.txt,.csv,.md,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleFileUpload(f);
                  e.target.value = "";
                }
              }}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/30">
                <FolderOpen size={24} />
              </div>
              <h3 className="text-sm font-bold text-white">Indexation Documentaire RAG Sécurisée</h3>
              <p className="text-xs text-slate-400 max-w-lg">
                Téléversez les règlements officiels, syllabi de cours et chartes pédagogiques (PDF, DOCX, TXT, CSV, MD).
                Chaque document est assaini contre les prompt injections et découpé en fragments indexés.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingDoc}
                className="mt-2 flex items-center gap-2 rounded-xl border border-cyan-400/60 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 transition cursor-pointer disabled:opacity-50"
              >
                {uploadingDoc ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                {uploadingDoc ? "Assainissement & Indexation en cours..." : "Téléverser un document de cours"}
              </button>
            </div>
          </div>

          {/* Liste des documents de la base */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText size={14} className="text-cyan-400" /> Documents Officiels de Sentinelles Numériques ({knowledgeDocs.length})
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {knowledgeDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-white/10 bg-black/40 p-4 hover:border-cyan-400/30 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/30 uppercase tracking-wider">
                        {doc.category}
                      </span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle size={11} /> Document Officiel
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{doc.content}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Niveau 3 • Priorité Active</span>
                    <span>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ONGLET 3 : OBSERVABILITÉ & AUDIT TOKENS NVIDIA */}
      {/* ========================================================= */}
      {activeTab === "observability" && (
        <div className="space-y-6">
          {/* 4 Compteurs KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                <Zap size={14} /> Total Requêtes IA
              </p>
              <p className="text-2xl font-black text-white mt-1">{stats.totalRequests}</p>
              <p className="text-[10px] text-slate-400 mt-1">Appels enregistrés</p>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1">
                <Cpu size={14} /> Tokens Nemotron
              </p>
              <p className="text-2xl font-black text-white mt-1">{stats.totalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 mt-1">Consommation cumulée</p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                <Clock size={14} /> Latence Moyenne
              </p>
              <p className="text-2xl font-black text-white mt-1">{stats.avgLatency} ms</p>
              <p className="text-[10px] text-slate-400 mt-1">Temps de réponse de l'agent</p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                <Shield size={14} /> Rôles Actifs
              </p>
              <p className="text-2xl font-black text-white mt-1">
                {Object.keys(stats.roleBreakdown).length || 3}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Apprenant, Prof, Admin</p>
            </div>
          </div>

          {/* Table du journal d'audit */}
          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <BarChart3 size={14} className="text-cyan-400" /> Journal Télémétrique d'Audit ({auditLogs.length})
              </h3>
              <span className="text-[10px] text-slate-400">Derniers appels analysés</span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Aucun log d'audit enregistré pour l'instant. Les futures requêtes enrichiront ce tableau.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-bold uppercase text-slate-400">
                      <th className="py-2">Horodatage</th>
                      <th className="py-2">Rôle</th>
                      <th className="py-2">Intention</th>
                      <th className="py-2">Outil Appelé</th>
                      <th className="py-2">Tokens</th>
                      <th className="py-2">Latence</th>
                      <th className="py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-2 font-mono text-[11px] text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString("fr-FR")}
                        </td>
                        <td className="py-2">
                          <span className="rounded bg-cyan-950/60 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-400/20">
                            {log.role}
                          </span>
                        </td>
                        <td className="py-2 text-slate-300 font-medium">{log.intent}</td>
                        <td className="py-2 font-mono text-[11px] text-slate-400">
                          {log.tool_name || "—"}
                        </td>
                        <td className="py-2 font-mono text-purple-300">
                          {log.total_tokens || (log.prompt_tokens + log.completion_tokens)}
                        </td>
                        <td className="py-2 font-mono text-emerald-300">{log.latency_ms} ms</td>
                        <td className="py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              log.status === "success"
                                ? "bg-emerald-950/60 text-emerald-300"
                                : "bg-red-950/60 text-red-300"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE NOUVELLE CONNAISSANCE OFFICIELLE */}
      {newDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-[#060b13] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain size={16} className="text-cyan-400" /> Ajouter une Connaissance Officielle
              </h3>
              <button
                onClick={() => setNewDocModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOfficialKnowledge} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Titre du document</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Procédure de rattrapage des évaluations"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/60 px-3 py-2 text-xs text-white border border-white/10 focus:border-cyan-400/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Catégorie</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/60 px-3 py-2 text-xs text-white border border-white/10 focus:border-cyan-400/50 focus:outline-none"
                >
                  <option value="rules">Règlement & Procédures</option>
                  <option value="course">Support de Cours & Syllabus</option>
                  <option value="general">Général & Institutionnel</option>
                  <option value="faq">Questions Fréquentes (FAQ)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Contenu officiel</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Décrivez avec précision la règle ou la connaissance institutionnelle..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-black/60 p-3 text-xs text-white border border-white/10 focus:border-cyan-400/50 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewDocModal(false)}
                  className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition shadow-lg cursor-pointer"
                >
                  Enregistrer dans le RAG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
