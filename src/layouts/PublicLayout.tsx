import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck, LogIn, Menu, X, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { useStore } from "@/lib/store";
import { Btn, SentinelLogo } from "@/lib/ui";

const LINKS = [
  { to: "/", label: "Accueil" },
  { to: "/formations", label: "Formations" },
  { to: "/tarifs", label: "Frais & Tarifs" },
  { to: "/pre-inscription", label: "Pré-inscription" },
];

export default function PublicLayout() {
  const { db, user } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const s = db.settings;

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#B8F3FF] antialiased selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
      {/* HUD Scanline & Grid Effect */}
      <div className="fixed inset-0 pointer-events-none z-0 hud-grid-pattern opacity-40" />

      {/* Nav Header — 88px, #02080E, fine cyan line */}
      <header className="sticky top-0 z-50 h-[88px] border-b border-[#00D9FF] bg-[#02080E]/95 shadow-[0_1px_15px_rgba(0,217,255,0.35)] backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1648px] items-center justify-between gap-4 px-4 sm:px-8">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-[8px] border border-[#FF1018] bg-[#071A2B] p-1.5 shadow-[0_0_14px_rgba(255,16,24,0.45)] transition group-hover:shadow-[0_0_20px_rgba(255,16,24,0.65)]">
              <SentinelLogo
                variant="symbol"
                alt="Symbole SENTINEL'S"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="font-display text-[20px] sm:text-[22px] font-black tracking-wider text-[#FF1530] drop-shadow-[0_0_12px_rgba(255,21,48,0.55)] leading-tight">
                SENTINELLE NUMÉRIQUE
              </p>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[2px] text-[#00D9FF] font-mono font-bold mt-0.5">
                ENIA 2.0 - CENTRE DE CYBERDÉFENSE & INGÉNIERIE
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 lg:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex h-[38px] items-center rounded-md border px-4 sm:px-5 font-display text-xs font-bold tracking-wider uppercase transition-all",
                  isActive
                    ? "border-[#00D9FF] bg-[#00263A] text-[#00F0FF] shadow-[0_0_12px_rgba(0,217,255,0.35)]"
                    : "border-white/15 bg-[#060D15]/80 text-[#F5F7FA] hover:border-[#00D9FF]/50 hover:text-[#00D9FF]"
                )
              }
            >
              ACCUEIL
            </NavLink>
            <NavLink
              to="/formations"
              className={({ isActive }) =>
                cn(
                  "flex h-[38px] items-center rounded-md border px-4 sm:px-5 font-display text-xs font-bold tracking-wider uppercase transition-all",
                  isActive
                    ? "border-[#00D9FF] bg-[#00263A] text-[#00F0FF] shadow-[0_0_12px_rgba(0,217,255,0.35)]"
                    : "border-white/15 bg-[#060D15]/80 text-[#F5F7FA] hover:border-[#00D9FF]/50 hover:text-[#00D9FF]"
                )
              }
            >
              FORMATIONS
            </NavLink>
            <NavLink
              to="/tarifs"
              className={({ isActive }) =>
                cn(
                  "flex h-[38px] items-center rounded-md border px-4 sm:px-5 font-display text-xs font-bold tracking-wider uppercase transition-all",
                  isActive
                    ? "border-[#00D9FF] bg-[#00263A] text-[#00F0FF] shadow-[0_0_12px_rgba(0,217,255,0.35)]"
                    : "border-white/15 bg-[#060D15]/80 text-[#F5F7FA] hover:border-[#00D9FF]/50 hover:text-[#00D9FF]"
                )
              }
            >
              FRAIS & TARIFS
            </NavLink>
            <NavLink
              to="/pre-inscription"
              className={({ isActive }) =>
                cn(
                  "flex h-[38px] items-center rounded-md border px-4 sm:px-5 font-display text-xs font-bold tracking-wider uppercase transition-all",
                  isActive
                    ? "border-[#00D9FF] bg-[#00263A] text-[#00F0FF] shadow-[0_0_12px_rgba(0,217,255,0.35)]"
                    : "border-white/15 bg-[#060D15]/80 text-[#F5F7FA] hover:border-[#00D9FF]/50 hover:text-[#00D9FF]"
                )
              }
            >
              PRÉ-INSCRIPTION
            </NavLink>
            <Link to="/connexion">
              <button
                type="button"
                className="flex h-[38px] items-center gap-2 rounded-md border border-[#00D9FF] bg-[#060D15]/80 px-4 sm:px-5 font-display text-xs font-bold tracking-wider uppercase text-[#00D9FF] shadow-[0_0_10px_rgba(0,217,255,0.25)] transition-all hover:bg-[#00D9FF]/15 hover:shadow-[0_0_16px_rgba(0,217,255,0.45)]"
              >
                <LogIn size={15} className="text-[#00D9FF]" />
                <span>MON ESPACE</span>
              </button>
            </Link>
          </nav>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setOpen(!open)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#00D9FF]/40 bg-[#071A2B] p-2 text-[#00D9FF] lg:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <nav className="border-t border-[#00D9FF]/30 bg-[#02080E]/95 px-5 py-4 lg:hidden space-y-2">
            <NavLink
              to="/"
              onClick={() => setOpen(false)}
              className="block rounded-lg border border-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F5F7FA] hover:border-[#00D9FF] hover:bg-[#071A2B] hover:text-[#00D9FF]"
            >
              ACCUEIL
            </NavLink>
            <NavLink
              to="/formations"
              onClick={() => setOpen(false)}
              className="block rounded-lg border border-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F5F7FA] hover:border-[#00D9FF] hover:bg-[#071A2B] hover:text-[#00D9FF]"
            >
              FORMATIONS
            </NavLink>
            <NavLink
              to="/tarifs"
              onClick={() => setOpen(false)}
              className="block rounded-lg border border-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F5F7FA] hover:border-[#00D9FF] hover:bg-[#071A2B] hover:text-[#00D9FF]"
            >
              FRAIS & TARIFS
            </NavLink>
            <NavLink
              to="/pre-inscription"
              onClick={() => setOpen(false)}
              className="block rounded-lg border border-transparent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F5F7FA] hover:border-[#00D9FF] hover:bg-[#071A2B] hover:text-[#00D9FF]"
            >
              PRÉ-INSCRIPTION
            </NavLink>
            <Link
              to="/connexion"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-[#00D9FF] bg-[#00D9FF]/15 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.3)]"
            >
              <LogIn size={15} />
              <span>MON ESPACE</span>
            </Link>
          </nav>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10">
        <Outlet />
      </main>

      {/* HUD Footer */}
      <footer className="relative z-10 border-t border-[#006DFF]/30 bg-[#0B111A]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FF174F]/40 bg-[#071A2B] p-1 shadow-[0_0_10px_rgba(255,23,79,0.25)]">
                <SentinelLogo variant="symbol" alt="Symbole SENTINEL'S" className="h-full w-full object-contain" />
              </div>
              <span className="font-display text-sm font-black text-white">
                SENTINELLE <span className="text-[#FF174F]">NUMÉRIQUE</span>
              </span>
            </div>
            <p className="text-xs text-[#4C91B5] leading-relaxed">{s.branding.subtitle}</p>
            <p className="mt-3 text-[10px] text-[#00E5FF] font-mono font-bold uppercase tracking-wider">
              APPRENDRE • INNOVER • CRÉER • CODER • SÉCURISER
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#00E5FF]">
              INFORMATIONS PRATIQUES
            </p>
            <ul className="space-y-2 text-xs text-[#4C91B5]">
              <li>📅 Début : <span className="text-[#B8F3FF] font-semibold">{s.infos.debut}</span></li>
              <li>📍 <span className="text-[#B8F3FF] font-semibold">{s.infos.lieu}</span></li>
              <li>⏱️ Durée : <span className="text-[#B8F3FF] font-semibold">{s.infos.duree}</span></li>
              <li className="flex items-center gap-2 text-[#00FF88]">
                <MessageCircle size={14} /> {s.infos.whatsapp.join(" / ")}
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-mono font-bold uppercase tracking-[0.2em] text-[#00E5FF]">
              PARTENAIRES OFFICIELS
            </p>
            <div className="flex flex-wrap gap-2">
              {db.partners.filter((p) => p.actif).map((p) => (
                <span key={p.id} className="rounded border border-[#006DFF]/30 bg-[#071A2B] px-2.5 py-1 text-xs font-semibold text-[#B8F3FF]">
                  {p.nom}
                </span>
              ))}
              {db.partners.filter((p) => p.actif).length === 0 && (
                <span className="text-xs text-[#4C91B5] italic">Aucun partenaire externe</span>
              )}
            </div>
            <p className="mt-4 text-[10px] text-[#4C91B5] font-mono">
              © {new Date().getFullYear()} {s.branding.name} — SOC & Cyber Platform.{" "}
              {loc.pathname !== "/" && (
                <Link to="/" className="text-[#00E5FF] hover:underline">
                  Retour à l'accueil →
                </Link>
              )}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
