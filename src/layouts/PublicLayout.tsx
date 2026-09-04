import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck, LogIn, Menu, X, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { useStore } from "@/lib/store";
import { Btn } from "@/lib/ui";

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

      {/* Nav Header */}
      <header className="sticky top-0 z-40 border-b border-[#006DFF]/30 bg-[#0B111A]/95 shadow-[0_4px_20px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded border border-[#00C8FF]/50 bg-[#071A2B] p-1 shadow-[0_0_15px_rgba(0,229,255,0.4)] transition group-hover:border-[#00E5FF]">
              <img
                src="/logo.png"
                alt="SENTINELLE NUMÉRIQUE"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="font-display text-sm font-black tracking-wider text-white sm:text-base">
                SENTINELLE <span className="text-[#FF174F] drop-shadow-[0_0_8px_#FF174F]">NUMÉRIQUE</span>
              </p>
              <p className="hidden text-[9px] uppercase tracking-[0.25em] text-[#00E5FF] sm:block font-mono font-bold">
                ENIA 2.0 • CENTRE DE CYBERDÉFENSE & INGÉNIERIE
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                    isActive
                      ? "border-[#00C8FF] bg-[#071A2B] text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.35)]"
                      : "border-transparent text-[#4C91B5] hover:border-[#006DFF]/50 hover:bg-[#0B111A] hover:text-[#B8F3FF]"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/connexion" className="ml-3">
              <Btn variant={user ? "outline" : "primary"} className="px-4 py-1.5 text-xs font-bold tracking-wider uppercase">
                <LogIn size={14} /> {user ? "Mon Espace" : "Connexion"}
              </Btn>
            </Link>
          </nav>

          <button
            onClick={() => setOpen(!open)}
            className="rounded border border-[#006DFF]/40 bg-[#071A2B] p-2 text-[#00E5FF] md:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <nav className="border-t border-[#006DFF]/30 bg-[#0B111A] px-4 py-3 md:hidden space-y-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded border border-transparent px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#4C91B5] hover:border-[#00C8FF] hover:bg-[#071A2B] hover:text-[#00E5FF]"
              >
                {l.label}
              </NavLink>
            ))}
            <Link
              to="/connexion"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded border border-[#00E5FF]/40 bg-gradient-to-r from-[#006DFF] to-[#00C8FF] px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              {user ? "Mon Espace" : "Connexion"}
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
              <div className="flex h-8 w-8 items-center justify-center rounded border border-[#00C8FF]/40 bg-[#071A2B] p-1">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
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
