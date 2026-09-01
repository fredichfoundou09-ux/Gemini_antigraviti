import React, { useState, useEffect, useRef, useMemo } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays, ClipboardCheck, FileText,
  TestTube2, PenLine, Wallet, Award, BadgeDollarSign, MessagesSquare, Bell, Settings,
  PenSquare, LogOut, ShieldCheck, Menu, X, UserCircle, NotebookPen, FolderOpen, BookMarked,
  ScrollText, Database, Activity, Medal, Handshake, Megaphone, RotateCcw, Clock, Eye,
  Search, ArrowRight, Home, Calendar,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useStore } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/lib/ui";

const roleLabel: Record<string, string> = {
  superadmin: "SUPER ADMIN",
  admin: "ADMINISTRATION",
  partner_admin: "ADMIN PARTENAIRE",
  teacher: "FORMATEUR",
  student: "APPRENANT",
  partner: "PARTENAIRE",
};

interface MenuItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  end?: boolean;
}

const MENU: MenuItem[] = [
  { to: "/app/dashboard", label: "Tableau de bord", icon: <LayoutDashboard size={18} />, roles: ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"], end: true },
  { to: "/app/vitrine", label: "Vitrine & Programmes", icon: <Eye size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/partner/dashboard", label: "Dashboard partenaire", icon: <LayoutDashboard size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/apprenants", label: "Apprenants", icon: <Users size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/enseignants", label: "Enseignants", icon: <GraduationCap size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/formations", label: "Formations", icon: <BookOpen size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/modules", label: "Modules", icon: <BookOpen size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/emploi-du-temps", label: "Emploi du temps", icon: <CalendarDays size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/presences", label: "Présences", icon: <ClipboardCheck size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/cours", label: "Cours", icon: <FileText size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/tests", label: "Tests", icon: <TestTube2 size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/notes", label: "Notes", icon: <PenLine size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/certificats", label: "Certificats", icon: <Award size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/bourses", label: "Bourses", icon: <BadgeDollarSign size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/rapports", label: "Rapports", icon: <Activity size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/enya", label: "Enya", icon: <GraduationCap size={18} />, roles: ["partner_admin", "partner"] },
  { to: "/app/partner/profil", label: "Profil", icon: <UserCircle size={18} />, roles: ["partner_admin", "partner"] },
  // Admin
  { to: "/app/etudiants", label: "Apprenants", icon: <Users size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/enseignants", label: "Enseignants", icon: <GraduationCap size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/enseignants-heures", label: "Heures enseignants", icon: <Clock size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/modules", label: "Formations & Modules", icon: <BookOpen size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/emploi-du-temps", label: "Emploi du temps", icon: <CalendarDays size={18} />, roles: ["superadmin", "admin", "teacher", "student"] },
  { to: "/app/presences", label: "Présences", icon: <ClipboardCheck size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/calendrier", label: "Calendrier visuel", icon: <CalendarDays size={18} />, roles: ["superadmin", "admin", "teacher", "student"] },
  { to: "/app/bulletins", label: "Bulletins de notes", icon: <FileText size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/import", label: "Import CSV", icon: <Users size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/qr-scanner", label: "Scanner QR Présence", icon: <ShieldCheck size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/cours", label: "Cours & Supports", icon: <FileText size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/devoirs", label: "Devoirs remis", icon: <ClipboardCheck size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/tests", label: "Tests", icon: <TestTube2 size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/notes", label: "Notes", icon: <PenLine size={18} />, roles: ["superadmin", "admin", "teacher"] },
  { to: "/app/paiements", label: "Paiements", icon: <Wallet size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/certificats", label: "Certificats", icon: <Award size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/bourses", label: "Bourses", icon: <BadgeDollarSign size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/enia", label: "ENIA 2.0", icon: <GraduationCap size={18} />, roles: ["superadmin", "admin", "partner_admin", "partner", "teacher", "student"] },
  { to: "/app/enia-admin", label: "Admin ENIA 2.0", icon: <PenSquare size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/messages", label: "Messagerie", icon: <MessagesSquare size={18} />, roles: ["superadmin", "admin", "teacher", "student"] },
  { to: "/app/notifications", label: "Notifications", icon: <Bell size={18} />, roles: ["superadmin", "admin", "teacher", "student"] },
  { to: "/app/utilisateurs", label: "Utilisateurs", icon: <ShieldCheck size={18} />, roles: ["superadmin"] },
  { to: "/app/contenu", label: "Contenu du site", icon: <PenSquare size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/avantages", label: "Avantages", icon: <Medal size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/partenaires", label: "Partenaires", icon: <Handshake size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/annonces", label: "Annonces", icon: <Megaphone size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/journal", label: "Journal d'activité", icon: <Activity size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/rapports", label: "Rapports", icon: <Activity size={18} />, roles: ["superadmin", "admin", "partner_admin"] },
  { to: "/app/parametres", label: "Paramètres", icon: <Settings size={18} />, roles: ["superadmin", "admin"] },
  { to: "/app/initialisation", label: "Initialiser le logiciel", icon: <RotateCcw size={18} />, roles: ["superadmin"] },
  // Teacher
  { to: "/app/mon-profil-formateur", label: "Mon profil", icon: <UserCircle size={18} />, roles: ["teacher"] },
  { to: "/app/mes-classes", label: "Mes classes", icon: <Database size={18} />, roles: ["teacher"] },
  { to: "/app/mes-apprenants", label: "Mes apprenants", icon: <Users size={18} />, roles: ["teacher"] },
  { to: "/app/mes-cours", label: "Publier un cours", icon: <NotebookPen size={18} />, roles: ["teacher"] },
  // Student
  { to: "/app/mon-profil", label: "Mon profil", icon: <UserCircle size={18} />, roles: ["student"] },
  { to: "/app/ma-formation", label: "Ma formation", icon: <BookMarked size={18} />, roles: ["student"] },
  { to: "/app/mes-modules", label: "Mes modules", icon: <BookOpen size={18} />, roles: ["student"] },
  { to: "/app/mes-cours", label: "Mes cours", icon: <FolderOpen size={18} />, roles: ["student"] },
  { to: "/app/mes-devoirs", label: "Mes devoirs", icon: <ClipboardCheck size={18} />, roles: ["student"] },
  { to: "/app/mes-documents", label: "Mes documents", icon: <ScrollText size={18} />, roles: ["student"] },
  { to: "/app/mes-presences", label: "Mes présences", icon: <ClipboardCheck size={18} />, roles: ["student"] },
  { to: "/app/mes-notes", label: "Mes notes", icon: <PenLine size={18} />, roles: ["student"] },
  { to: "/app/mes-paiements", label: "Mes paiements", icon: <Wallet size={18} />, roles: ["student"] },
  { to: "/app/mon-certificat", label: "Mon certificat", icon: <Award size={18} />, roles: ["student"] },
  { to: "/app/ma-bourse", label: "Ma bourse", icon: <BadgeDollarSign size={18} />, roles: ["student"] },
];

export default function DashboardLayout() {
  const { db, user: storeUser, logout: storeLogout } = useStore();
  const { profile, logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const user = storeUser || (profile ? {
    id: profile.id,
    username: profile.username,
    password: "",
    role: profile.role,
    name: profile.name,
    email: profile.email || "",
    phone: profile.phone || "",
    actif: profile.active,
    createdAt: profile.created_at?.slice(0, 10) || ""
  } : null);

  // Raccourci Ctrl+K / Cmd+K pour ouvrir la recherche globale
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  const logout = () => {
    storeLogout();
    authLogout();
  };

  // Résultats de la recherche globale
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const students = db.students
      .filter((s) => `${s.nom} ${s.prenom} ${s.matricule} ${s.filiere}`.toLowerCase().includes(q))
      .slice(0, 5);

    const teachers = db.teachers
      .filter((t) => `${t.nom} ${t.prenom} ${t.specialite}`.toLowerCase().includes(q))
      .slice(0, 5);

    const modules = db.modules
      .filter((m) => `${m.titre} ${m.code}`.toLowerCase().includes(q))
      .slice(0, 5);

    const courses = db.courses
      .filter((c) => `${c.titre} ${c.description || ""}`.toLowerCase().includes(q))
      .slice(0, 5);

    const documents = db.documents
      .filter((d) => `${d.titre} ${d.description || ""}`.toLowerCase().includes(q))
      .slice(0, 5);

    const messages = db.messages
      .filter((m) => `${m.subject} ${m.body}`.toLowerCase().includes(q))
      .slice(0, 5);

    const total = students.length + teachers.length + modules.length + courses.length + documents.length + messages.length;
    return { students, teachers, modules, courses, documents, messages, total };
  }, [searchQuery, db]);

  if (!user) return null;

  const items = MENU.filter((m) => m.roles.includes(user.role));
  const unreadNotifications = db.notifications.filter((n) => !n.lu && (n.toId === user.id || n.toId === "all")).length;
  const unreadMessages = db.messages.filter((m) => !m.lu && m.toId === user.id).length;

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <img
          src="/logo.png"
          alt="SENTINELLE NUMÉRIQUE"
          className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.7)]"
        />
        <div className="min-w-0">
          <p className="font-display truncate text-[13px] font-black tracking-wide text-white">SENTINELLE</p>
          <p className="truncate text-[10px] uppercase tracking-[0.25em] font-extrabold text-red-400">NUMÉRIQUE</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            end={m.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-300 border border-cyan-400/30 shadow-[0_0_18px_-6px_rgba(0,229,255,0.6)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"
              )
            }
          >
            {m.icon}
            <span className="truncate">{m.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Footer in Sidebar */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 font-display font-bold text-white text-sm shadow">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user.name}</p>
            <p className="truncate text-[10px] text-cyan-300/80 uppercase font-semibold">{roleLabel[user.role]}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-night min-h-screen text-slate-100 pb-16 lg:pb-0">
      {/* Desktop Sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/5 bg-[#07102B]/90 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-cyan-400/20 bg-[#07102B]">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-[#05070D]/85 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden" aria-label="Ouvrir le menu">
              <Menu size={18} />
            </button>

            {/* Logo compact sur mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <img src="/logo.png" alt="Logo" className="h-7 w-7 object-contain" />
              <span className="font-display text-xs font-black text-white">SENTINELLE</span>
            </div>

            {/* Salutation desktop */}
            <div className="hidden lg:block">
              <p className="text-sm font-bold text-white">Bonjour, {user.name.split(" ")[0]} 👋</p>
              <Badge color={user.role === "student" ? "green" : user.role === "teacher" ? "cyan" : "gold"}>{roleLabel[user.role]}</Badge>
            </div>
          </div>

          {/* Barre de Recherche Globale */}
          <div className="flex-1 max-w-md mx-2 sm:mx-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-slate-400 hover:border-cyan-400/40 hover:text-slate-200 transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Search size={15} className="text-cyan-400 shrink-0" />
                <span className="truncate">Rechercher apprenants, cours, documents…</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Actions Header : Messages, Notifications, Site public, Déconnexion */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NavLink
              to="/app/messages"
              className="relative rounded-xl border border-white/10 p-2.5 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
              title="Messagerie interne"
            >
              <MessagesSquare size={18} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white shadow-[0_0_10px_#00E5FF]">
                  {unreadMessages}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/app/notifications"
              className="relative rounded-xl border border-white/10 p-2.5 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
              title="Notifications"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_10px_#EF4444]">
                  {unreadNotifications}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/"
              className="hidden rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300 sm:block"
            >
              Site public
            </NavLink>

            <button
              onClick={() => {
                logout();
                try { window.history.replaceState(null, "", "/#/connexion"); } catch { /* ignore */ }
                navigate("/connexion", { replace: true });
                setTimeout(() => window.location.reload(), 50);
              }}
              className="rounded-xl border border-red-500/30 p-2.5 text-red-400 transition hover:bg-red-500/10"
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Modal de Recherche Globale */}
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-16 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
            <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/30 bg-[#07102B] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 bg-white/[0.02]">
                <Search size={18} className="text-cyan-400" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher apprenants, formateurs, cours, documents, messages…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button onClick={() => setSearchOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                {!searchQuery.trim() ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <p className="font-semibold text-slate-300">Recherche universelle Sentinelle Numérique</p>
                    <p className="mt-1 text-slate-500">Tapez un mot-clé pour explorer les apprenants, modules, documents et messages.</p>
                  </div>
                ) : searchResults && searchResults.total === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">Aucun résultat trouvé pour « {searchQuery} »</p>
                ) : (
                  searchResults && (
                    <div className="space-y-4">
                      {/* Apprenants */}
                      {searchResults.students.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">Apprenants ({searchResults.students.length})</p>
                          <div className="space-y-1">
                            {searchResults.students.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => { setSearchOpen(false); navigate("/app/etudiants"); }}
                                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left text-xs hover:border-cyan-400/30 hover:bg-white/5 transition"
                              >
                                <div>
                                  <span className="font-bold text-white">{s.nom} {s.prenom}</span>
                                  <span className="ml-2 text-slate-400">({s.matricule}) · {s.filiere}</span>
                                </div>
                                <ArrowRight size={14} className="text-cyan-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Formateurs */}
                      {searchResults.teachers.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-300">Formateurs ({searchResults.teachers.length})</p>
                          <div className="space-y-1">
                            {searchResults.teachers.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => { setSearchOpen(false); navigate("/app/enseignants"); }}
                                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left text-xs hover:border-amber-400/30 hover:bg-white/5 transition"
                              >
                                <div>
                                  <span className="font-bold text-white">{t.nom} {t.prenom}</span>
                                  <span className="ml-2 text-slate-400">· {t.specialite}</span>
                                </div>
                                <ArrowRight size={14} className="text-amber-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Modules & Cours */}
                      {(searchResults.modules.length > 0 || searchResults.courses.length > 0) && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Pédagogie ({searchResults.modules.length + searchResults.courses.length})</p>
                          <div className="space-y-1">
                            {searchResults.modules.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => { setSearchOpen(false); navigate("/app/modules"); }}
                                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left text-xs hover:border-emerald-400/30 hover:bg-white/5 transition"
                              >
                                <div>
                                  <span className="font-bold text-white">{m.titre}</span>
                                  <span className="ml-2 text-slate-400">[{m.code}]</span>
                                </div>
                                <ArrowRight size={14} className="text-emerald-400" />
                              </button>
                            ))}
                            {searchResults.courses.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => { setSearchOpen(false); navigate("/app/cours"); }}
                                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left text-xs hover:border-emerald-400/30 hover:bg-white/5 transition"
                              >
                                <span className="font-bold text-white">{c.titre}</span>
                                <ArrowRight size={14} className="text-emerald-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {searchResults.documents.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-purple-300">Documents ({searchResults.documents.length})</p>
                          <div className="space-y-1">
                            {searchResults.documents.map((d) => (
                              <button
                                key={d.id}
                                onClick={() => { setSearchOpen(false); navigate(user.role === "student" ? "/app/mes-documents" : "/app/cours"); }}
                                className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left text-xs hover:border-purple-400/30 hover:bg-white/5 transition"
                              >
                                <span className="font-bold text-white">{d.titre}</span>
                                <ArrowRight size={14} className="text-purple-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Body Content */}
        <main className="min-h-[calc(100vh-65px)] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ================= BOTTOM NAVIGATION MOBILE (Section 15) ================= */}
      <nav className="no-print fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#07102B]/95 px-2 py-2 backdrop-blur-lg lg:hidden">
        <NavLink
          to="/app/dashboard"
          end
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition",
              isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
            )
          }
        >
          <Home size={18} />
          <span>Accueil</span>
        </NavLink>

        <NavLink
          to={user.role === "student" ? "/app/mes-cours" : "/app/cours"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition",
              isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
            )
          }
        >
          <BookOpen size={18} />
          <span>Cours</span>
        </NavLink>

        <NavLink
          to="/app/messages"
          className={({ isActive }) =>
            cn(
              "relative flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition",
              isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
            )
          }
        >
          <MessagesSquare size={18} />
          {unreadMessages > 0 && (
            <span className="absolute top-0 right-2 flex h-2 w-2 rounded-full bg-cyan-400" />
          )}
          <span>Messages</span>
        </NavLink>

        <NavLink
          to="/app/emploi-du-temps"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition",
              isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
            )
          }
        >
          <Calendar size={18} />
          <span>Planning</span>
        </NavLink>

        <NavLink
          to={user.role === "student" ? "/app/mon-profil" : user.role === "teacher" ? "/app/mon-profil-formateur" : "/app/parametres"}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-[10px] font-bold transition",
              isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
            )
          }
        >
          <UserCircle size={18} />
          <span>Profil</span>
        </NavLink>
      </nav>
    </div>
  );
}
