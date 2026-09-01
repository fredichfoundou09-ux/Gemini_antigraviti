import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays, ClipboardCheck, FileText,
  TestTube2, PenLine, Wallet, Award, BadgeDollarSign, MessagesSquare, Bell, Settings,
  PenSquare, LogOut, ShieldCheck, Menu, X, UserCircle, NotebookPen, FolderOpen, BookMarked,
  ScrollText, Database, Activity, Medal, Handshake, Megaphone, RotateCcw, Clock, Eye,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useStore } from "@/lib/store";
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
  { to: "/app/qr-scanner", label: "Scanner QR", icon: <ShieldCheck size={18} />, roles: ["superadmin", "admin", "teacher"] },
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

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout() {
  const { user: storeUser, logout: storeLogout } = useStore();
  const { profile, logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

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

  const logout = () => {
    storeLogout();
    authLogout();
  };

  if (!user) return null;

  const items = MENU.filter((m) => m.roles.includes(user.role));
  const unread = useStore().db.notifications.filter((n) => !n.lu && (n.toId === user.id || n.toId === "all")).length;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_18px_-4px_rgba(0,229,255,0.8)]">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-display truncate text-[13px] font-bold tracking-wide text-white">SENTINELLES</p>
          <p className="truncate text-[10px] uppercase tracking-[0.25em] text-cyan-300">Numériques</p>
        </div>
      </div>
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
      <div className="border-t border-white/5 p-3">
        <button
          onClick={() => {
            logout();
            // Empêche le bouton « Retour » de restaurer une page privée depuis le cache.
            try { window.history.replaceState(null, "", "/#/connexion"); } catch { /* ignore */ }
            navigate("/connexion", { replace: true });
            setTimeout(() => window.location.reload(), 50);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/10"
        >
          <LogOut size={18} /> Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05070D]">
      {/* Desktop sidebar */}
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

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-[#05070D]/85 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden">
              <Menu size={18} />
            </button>
            <div>
              <p className="text-sm font-bold text-white">Bonjour, {user.name.split(" ")[0]} 👋</p>
              <Badge color={user.role === "student" ? "green" : user.role === "teacher" ? "cyan" : "gold"}>{roleLabel[user.role]}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications" className="relative rounded-xl border border-white/10 p-2.5 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unread}</span>
              )}
            </NavLink>
            <NavLink to="/" className="hidden rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300 sm:block">
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
              <X size={18} />
            </button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-65px)] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
