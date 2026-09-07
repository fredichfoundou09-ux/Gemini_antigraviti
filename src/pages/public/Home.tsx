import { Link } from "react-router-dom";
import {
  ShieldCheck, CalendarDays, MapPin, Clock, MessageCircle, FileText,
  Code2, Medal, Award, GraduationCap, TrendingUp, ChevronRight, ChevronDown, UserCircle2, ArrowRight,
  BookOpen, Settings, Handshake,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { moduleIcon, money, Btn, SectionTitle, formationLabel, SentinelLogo } from "@/lib/ui";
import avantageImg from "@/assets/avantage-etudiants.jpg";
import responsableImg from "@/assets/responsable.jpg";
import sentinelSymbolImg from "@/assets/branding/sentinel-symbol.png";
import heroSentinels3dImg from "@/assets/branding/hero-sentinels-3d-bg.jpg";
import { Sentinel3DBackground } from "@/components/Sentinel3DBackground";


export default function Home() {
  const { db } = useStore();
  const s = db.settings;
  const infos = s.infos;
  const infoModules = db.modules.filter((m) => m.formation === "informatique");
  const indModules = db.modules.filter((m) => m.formation === "industriel");
  const respImg = s.hero?.responsibleImage;
  const displayAdvantages = (s.avantages && s.avantages.length > 0)
    ? s.avantages.filter(Boolean).map((txt, idx) => {
        const found = db.advantages?.find((a) => a.titre.toLowerCase() === txt.toLowerCase());
        return {
          id: found?.id || `sa-${idx}`,
          titre: txt,
          description: found?.description || "",
          explication: found?.explication || "",
          image: found?.image || "",
          ordre: idx,
        };
      })
    : [...db.advantages].sort((a, b) => a.ordre - b.ordre);

  const activeAnnouncements = db.announcements.filter((a) => a.actif);

  return (
    <div>
      {/* ============ HERO — 1648 × 940 PX CANONICAL FIDELITY REPRODUCTION ============ */}
      <section className="relative w-full overflow-hidden bg-black text-white pt-2 sm:pt-3 pb-3 sm:pb-4 min-h-[760px] xl:h-[calc(100vh-88px)] xl:min-h-[780px] xl:max-h-[880px] flex flex-col justify-between select-none">
        <Sentinel3DBackground />

        <div className="relative z-20 mx-auto w-full max-w-[1648px] px-4 sm:px-8 flex flex-col justify-between flex-1">
          {/* Active announcements if any */}
          {activeAnnouncements.length > 0 && (
            <div className="mb-3 space-y-2 z-30">
              {activeAnnouncements.slice(0, 1).map((a) => {
                const c = a.couleur === "red" ? "border-red-500/40 bg-red-500/5" : a.couleur === "green" ? "border-emerald-400/40 bg-emerald-400/5" : a.couleur === "gold" ? "border-amber-400/40 bg-amber-400/5" : "border-cyan-400/40 bg-cyan-400/5";
                return (
                  <div key={a.id} className={`flex items-start gap-2.5 rounded-xl border ${c} px-4 py-2 backdrop-blur`}>
                    <span className="text-base">📢</span>
                    <div><p className="text-xs font-bold text-white">{a.titre}</p><p className="text-[11px] text-slate-300">{a.contenu}</p></div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ZONE: 3 INSTITUTIONAL BADGES (Centered horizontally, rounded-lg, glassmorphism) */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-3.5 mb-4 sm:mb-5 z-30 relative">
            {/* Badge 1: ENIA 2.0 */}
            <div className="flex h-[42px] sm:h-[44px] items-center gap-2.5 rounded-lg border border-white/20 bg-[#060D17]/85 px-5 sm:px-6 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.8)] transition hover:border-[#00D9FF]/40">
              <span className="flex h-4 w-4 items-center justify-center text-[#00D9FF]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                </svg>
              </span>
              <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                ENIA 2.0 – École du Numérique et de l’Intelligence Artificielle
              </span>
            </div>

            {/* Badge 2: OG ESNID-Company */}
            <div className="flex h-[42px] sm:h-[44px] items-center gap-2 rounded-lg border border-white/20 bg-[#060D17]/85 px-5 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.8)] transition hover:border-[#00D9FF]/40">
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-white/10 px-1.5 py-0.5 rounded">OG</span>
              <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                ESNID-Company
              </span>
            </div>

            {/* Badge 3: SENTINEL'S */}
            <div className="flex h-[42px] sm:h-[44px] items-center gap-2 rounded-lg border border-white/20 bg-[#060D17]/85 px-5 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.8)] transition hover:border-[#FF1018]/40">
              <img src={sentinelSymbolImg} alt="" className="h-3.5 w-3.5 object-contain filter drop-shadow-[0_0_6px_rgba(255,16,24,0.8)]" />
              <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide">
                SENTINEL'S
              </span>
            </div>
          </div>

          {/* MAIN HERO CENTER AREA (Titles on left, Coach card on right, aligned on the exact same top horizontal line) */}
          <div className="relative w-full flex items-start justify-between mt-1 sm:mt-2 mb-auto">
            {/* HERO TITLES (Left Side - elevated and flush with right coach card) */}
            <div className="relative z-[30] max-w-[560px] flex flex-col items-start self-start pt-0">
              {/* Badge: • SENTINELLES - ACADEMY */}
              <div className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-[#00D9FF] bg-[#00D9FF]/10 px-4 text-xs font-bold uppercase tracking-[2px] text-[#00D9FF] shadow-[0_0_14px_rgba(0,217,255,0.3)] mb-3 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D9FF] animate-pulse" />
                <span>SENTINELLES - ACADEMY</span>
              </div>

              {/* Title: SENTINELLES NUMÉRIQUES */}
              <h1 className="font-display text-[42px] sm:text-[54px] lg:text-[62px] font-black text-white leading-[0.92] tracking-tight uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
                SENTINELLES<br />
                NUMÉRIQUES
              </h1>

              {/* Fine separator line + Subtitle */}
              <div className="mt-3.5 w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-[1px] w-8 sm:w-12 bg-[#00D9FF]" />
                  <div className="h-[1px] flex-1 bg-white/20" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[1.6px] sm:tracking-[2px] text-[#00D9FF] uppercase leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  CENTRE DE FORMATION EN GÉNIE INFORMATIQUE ET GÉNIE INDUSTRIEL
                </p>
              </div>
            </div>

            {/* CARTE RESPONSABLE (Right Side - aligned on same top line) */}
            <div className="relative z-[30] shrink-0 self-start hidden md:block pt-0">
              <div className="relative w-[400px] lg:w-[435px] rounded-lg border border-[#00D9FF] bg-[#020812]/92 p-4 shadow-[0_0_22px_rgba(0,217,255,0.25)] backdrop-blur-md">
                {/* HUD Corner Angle Brackets */}
                <span className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 border-t-2 border-l-2 border-[#00D9FF]" />
                <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 border-t-2 border-r-2 border-[#00D9FF]" />
                <span className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-[#00D9FF]" />
                <span className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 border-b-2 border-r-2 border-[#00D9FF]" />

                {/* Top-Right Gear Icon */}
                <div className="absolute top-3 right-3 text-[#00D9FF]">
                  <Settings size={17} className="animate-spin-slow opacity-90" />
                </div>

                <div className="flex items-center gap-3.5">
                  {/* Photo Container */}
                  <div className="relative shrink-0">
                    <div className="h-[102px] w-[94px] sm:w-[100px] overflow-hidden rounded-lg border border-[#00D9FF] bg-[#071A2B] shadow-[0_0_15px_rgba(0,217,255,0.3)]">
                      <img
                        src={respImg || responsableImg}
                        alt="Coach Fredich FOUNDOU"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    {/* Security Badge Under/At corner of Photo */}
                    <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-[4px] border border-[#00D9FF] bg-[#020B15] shadow-[0_0_8px_rgba(0,230,118,0.6)]">
                      <ShieldCheck size={13} className="text-[#00E676]" />
                    </div>
                  </div>

                  {/* Responsible Info */}
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-mono text-[10.5px] font-bold uppercase tracking-[1.5px] text-[#00D9FF]">
                      RESPONSABLE DU CENTRE
                    </p>
                    <p className="font-display text-[18px] sm:text-[20px] font-black leading-tight text-[#FF9D00] mt-0.5 whitespace-nowrap drop-shadow-[0_0_10px_rgba(255,157,0,0.4)]">
                      Coach Fredich FOUNDOU
                    </p>
                    <p className="text-[11.5px] sm:text-[12px] text-[#A6E9FF] font-medium leading-snug mt-1">
                      Étudiant-chercheur en Génie Informatique
                    </p>
                    <p className="text-[10px] text-[#00D9FF] font-mono font-bold mt-0.5">
                      © ENIA 2.0
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ZONE: BOTTOM PARALLEL CARDS & CENTERED TRIGGER BUTTON (Aligned on the exact same bottom baseline) */}
          <div className="relative z-[30] mt-auto flex flex-col lg:flex-row items-center lg:items-end justify-between gap-4 lg:gap-6 xl:gap-8 w-full pb-2">
            {/* LEFT CARD: TRAINING TITLE & QUOTE (Touching left extremity) */}
            <div className="w-full lg:w-[480px] xl:w-[540px] 2xl:w-[580px] shrink-0 min-h-[180px] rounded-[16px] border border-[#00D9FF] bg-[#020812]/90 p-5 sm:p-6 shadow-[0_0_22px_rgba(0,217,255,0.2)] backdrop-blur-md flex flex-col justify-between">
              <div>
                <p className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-[1.5px] text-white/90">
                  CENTRE DE FORMATION EN
                </p>
                <h3 className="font-display text-[24px] sm:text-[28px] xl:text-[30px] font-black text-[#00D9FF] leading-tight tracking-wide drop-shadow-[0_0_14px_rgba(0,217,255,0.45)] mt-0.5">
                  GÉNIE INFORMATIQUE
                </h3>
                <h3 className="font-display text-[24px] sm:text-[28px] xl:text-[30px] font-black text-[#FF1018] leading-tight tracking-wide drop-shadow-[0_0_14px_rgba(255,16,24,0.45)]">
                  ET GÉNIE INDUSTRIEL
                </h3>
              </div>
              <p className="text-[12.5px] sm:text-[13.5px] text-[#E0EBF5] leading-relaxed italic mt-2">
                « Formons aujourd'hui les talents numériques et industriels qui construisent l'avenir. »
              </p>
            </div>

            {/* CENTER TRIGGER BUTTON: • INFORMATIONS PRATIQUES ∨ (Centered horizontally, rectangular with rounded corners) */}
            <div className="shrink-0 flex items-center justify-center my-3 lg:my-0 lg:pb-0">
              <a
                href="#infos-pratiques"
                className="inline-flex h-[42px] items-center gap-2 rounded-lg border border-[#00D9FF] bg-[#02080E]/90 px-5 text-xs font-bold uppercase tracking-[2px] text-[#00D9FF] shadow-[0_0_15px_rgba(0,217,255,0.25)] transition hover:bg-[#00D9FF]/15 hover:shadow-[0_0_22px_rgba(0,217,255,0.45)] whitespace-nowrap"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D9FF] animate-pulse" />
                <span>INFORMATIONS PRATIQUES</span>
                <ChevronDown size={16} className="text-[#00D9FF]" />
              </a>
            </div>

            {/* RIGHT CARD: REGISTRATION & MINI-INFO BLOCKS (Touching right extremity) */}
            <div className="w-full lg:w-[480px] xl:w-[540px] 2xl:w-[580px] shrink-0 min-h-[180px] rounded-[16px] border border-[#00D9FF] bg-[#020812]/90 p-5 sm:p-6 shadow-[0_0_22px_rgba(0,217,255,0.2)] backdrop-blur-md flex flex-col justify-between gap-3">
              {/* Top Buttons: S'INSCRIRE & DÉCOUVRIR LES FORMATIONS */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Link
                  to="/pre-inscription"
                  className="flex h-[34px] sm:w-[150px] items-center justify-center gap-1.5 rounded-[6px] bg-[#00B4D8] hover:bg-[#00C8FF] px-3.5 text-xs font-display font-black uppercase tracking-wider text-white shadow-[0_0_15px_rgba(0,180,216,0.55)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText size={15} className="text-white" />
                  <span>S'INSCRIRE</span>
                </Link>

                <Link
                  to="/formations"
                  className="flex h-[34px] flex-1 items-center justify-between rounded-[6px] border border-[#00D9FF] bg-transparent hover:bg-[#00D9FF]/10 px-3.5 text-xs font-display font-bold uppercase tracking-wider text-[#00D9FF] shadow-[0_0_12px_rgba(0,217,255,0.2)] transition-all"
                >
                  <span>DÉCOUVRIR LES FORMATIONS</span>
                  <ChevronRight size={15} className="text-[#00D9FF]" />
                </Link>
              </div>

              {/* Separator */}
              <div className="w-full h-[1px] bg-white/[0.12]" />

              {/* Mini-Cards: DÉBUT, DURÉE, WHATSAPP */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-left">
                {/* DÉBUT */}
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-white/[0.02] p-1.5 sm:p-2 border border-white/5">
                  <CalendarDays size={17} className="text-[#00D9FF] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-400 leading-none">
                      DÉBUT
                    </p>
                    <p className="text-xs sm:text-[13px] font-bold text-white mt-1 truncate">
                      {infos.debut || "10 août"}
                    </p>
                  </div>
                </div>

                {/* DURÉE */}
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-white/[0.02] p-1.5 sm:p-2 border border-white/5">
                  <Clock size={17} className="text-[#00D9FF] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-400 leading-none">
                      DURÉE
                    </p>
                    <p className="text-xs sm:text-[13px] font-bold text-white mt-1 truncate">
                      {infos.duree || "3 mois"}
                    </p>
                  </div>
                </div>

                {/* WHATSAPP */}
                <div className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-white/[0.02] p-1.5 sm:p-2 border border-white/5">
                  <div className="h-5 w-5 rounded-full bg-[#00E676]/15 flex items-center justify-center shrink-0">
                    <MessageCircle size={14} className="text-[#00E676]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase font-mono font-bold tracking-wider text-[#00E676] leading-none">
                      WHATSAPP
                    </p>
                    <p className="text-xs sm:text-[13px] font-bold text-white mt-1 truncate">
                      {infos.whatsapp[0] || "06 63 28 87 4"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INFORMATIONS PRATIQUES ============ */}
      <section id="infos-pratiques" className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionTitle color="cyan">Informations pratiques</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: <CalendarDays size={22} className="text-[#00E5FF]" />, t: "Début de la formation", v: infos.debut, b: "border-[#006DFF]/40" },
            { icon: <MapPin size={22} className="text-[#008CFF]" />, t: "Lieu", v: infos.lieu, b: "border-[#008CFF]/40" },
            { icon: <Clock size={22} className="text-[#FF174F]" />, t: "Durée", v: infos.duree, b: "border-[#FF174F]/50 shadow-[0_0_15px_rgba(255,23,79,0.2)]" },
            { icon: <MessageCircle size={22} className="text-[#00FF88]" />, t: "WhatsApp", v: infos.whatsapp.join("  •  "), b: "border-[#00FF88]/40" },
            { icon: <FileText size={22} className="text-amber-300" />, t: "Inscription", v: infos.inscription, b: "border-amber-400/40" },
          ].map((c, i) => (
            <div key={i} className={`rounded-lg border ${c.b} bg-[#0B111A]/90 p-5 backdrop-blur transition hover:-translate-y-1 hover:border-[#00C8FF]`}>
              <div className="mb-3 inline-flex rounded border border-[#006DFF]/30 bg-[#071A2B] p-2.5">{c.icon}</div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#4C91B5]">{c.t}</p>
              <p className="mt-1.5 text-sm font-bold text-[#B8F3FF]">{c.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FORMATIONS ============ */}
      <section className="relative border-y border-[#006DFF]/25 bg-[#071A2B]/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <SectionTitle color="cyan">Nos formations</SectionTitle>
            <h2 className="font-display text-2xl font-black text-white sm:text-4xl">Deux parcours, un même avenir</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[#4C91B5]">{s.branding.subtitle}</p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 items-start">
            {/* Informatique */}
            <div>
              <div className="mb-6 flex items-center gap-3.5 rounded-lg border-2 border-[#FF174F]/50 bg-gradient-to-r from-[#FF174F]/15 to-transparent p-4 min-h-[90px] shadow-[0_0_20px_rgba(255,23,79,0.25)]">
                <Code2 size={28} className="text-[#FF174F] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-black text-[#FF174F]">{s.formations.informatique.titre}</h3>
                  <p className="text-xs text-[#4C91B5] mt-0.5">{s.formations.informatique.description}</p>
                </div>
              </div>
              <div className="space-y-4">
                {infoModules.map((m) => (
                  <div key={m.id} className="group rounded-lg border border-[#FF174F]/30 bg-[#0B111A]/90 p-5 transition hover:border-[#FF174F] hover:shadow-[0_0_25px_-5px_rgba(255,23,79,0.4)]">
                    <div className="flex items-center gap-3">
                      <div className="rounded border border-[#FF174F]/40 bg-[#2A0815] p-2.5 text-[#FF174F]">{moduleIcon(m.icon, "h-5 w-5")}</div>
                      <div>
                        <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#FF174F]/90">MODULE {String(m.numero).padStart(2, "0")}</p>
                        <h4 className="font-display text-base font-bold text-white">{m.titre}</h4>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {m.notions.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#B8F3FF]">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF174F]" /> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Industriel */}
            <div>
              <div className="mb-6 flex items-center gap-3.5 rounded-lg border-2 border-[#00C8FF]/50 bg-gradient-to-r from-[#00C8FF]/15 to-transparent p-4 min-h-[90px] shadow-[0_0_20px_rgba(0,200,255,0.25)]">
                <BookOpen size={28} className="text-[#00E5FF] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-black text-[#00E5FF]">{s.formations.industriel.titre}</h3>
                  <p className="text-xs text-[#4C91B5] mt-0.5">{s.formations.industriel.description}</p>
                </div>
              </div>
              <div className="space-y-4">
                {indModules.map((m) => (
                  <div key={m.id} className="group rounded-lg border border-[#006DFF]/30 bg-[#0B111A]/90 p-5 transition hover:border-[#00C8FF] hover:shadow-[0_0_25px_-5px_rgba(0,229,255,0.4)]">
                    <div className="flex items-center gap-3">
                      <div className="rounded border border-[#00C8FF]/40 bg-[#071A2B] p-2.5 text-[#00E5FF]">{moduleIcon(m.icon, "h-5 w-5")}</div>
                      <div>
                        <p className="font-mono text-[10px] font-bold tracking-[0.25em] text-[#00C8FF]">MODULE {String(m.numero).padStart(2, "0")}</p>
                        <h4 className="font-display text-base font-bold text-white">{m.titre}</h4>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {m.notions.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#B8F3FF]">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#00E5FF]" /> {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FRAIS + AVANTAGES ============ */}
      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* frais */}
          <div>
            <SectionTitle color="blue">Frais de formation</SectionTitle>
            <div className="rounded-lg border border-[#006DFF]/40 bg-[#0B111A]/90 p-6 shadow-[0_0_30px_-10px_rgba(0,109,255,0.4)]">
              <div className="mb-5 flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#071A2B] px-4 py-3">
                <span className="text-sm font-bold text-[#B8F3FF]">Frais d'inscription</span>
                <span className="font-display text-lg font-black text-amber-300">{money(s.frais.inscription)}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded border border-[#FF174F]/35 bg-[#2A0815]/30 p-4">
                  <h4 className="font-display mb-3 text-sm font-black text-[#FF174F]">GÉNIE INFORMATIQUE</h4>
                  <ul className="space-y-2">
                    {s.frais.informatique.map((f) => (
                      <li key={f.id} className="flex items-center justify-between rounded bg-[#0B111A] px-3 py-2 text-sm border border-[#FF174F]/20">
                        <span className="text-[#4C91B5]">{f.label}</span>
                        <span className="font-bold text-[#FF174F] font-mono">{money(f.montant)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border border-[#00C8FF]/35 bg-[#071A2B]/40 p-4">
                  <h4 className="font-display mb-3 text-sm font-black text-[#00E5FF]">GÉNIE INDUSTRIEL</h4>
                  <ul className="space-y-2">
                    {s.frais.industriel.map((f) => (
                      <li key={f.id} className="flex items-center justify-between rounded bg-[#0B111A] px-3 py-2 text-sm border border-[#00C8FF]/20">
                        <span className="text-[#4C91B5]">{f.label}</span>
                        <span className="font-bold text-[#00E5FF] font-mono">{money(f.montant)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link to="/pre-inscription" className="mt-5 block">
                <Btn className="w-full py-3 font-bold uppercase tracking-wider">Pré-inscription en ligne <ArrowRight size={16} /></Btn>
              </Link>
            </div>
          </div>

          {/* avantages */}
          <div>
            <SectionTitle color="green">Avantages</SectionTitle>
            <div className="overflow-hidden rounded-lg border border-[#00FF88]/30 bg-[#0B111A]/90">
              <div className="space-y-3 p-6">
                {displayAdvantages.length === 0 ? (
                  <p className="text-sm text-[#4C91B5]">Aucun avantage enregistré pour le moment.</p>
                ) : displayAdvantages.map((a, i) => {
                  const colors = ["border-amber-400/30", "border-[#00C8FF]/30", "border-[#00FF88]/30"];
                  const icons = [<Award size={20} className="text-amber-300" />, <Medal size={20} className="text-[#00E5FF]" />, <TrendingUp size={20} className="text-[#00FF88]" />];
                  return (
                    <div key={a.id} className={`rounded border ${colors[i % 3]} bg-[#071A2B]/70 p-3.5`}>
                      <div className="flex items-start gap-3">
                        {a.image ? <img src={a.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : <div className="mt-0.5 shrink-0">{icons[i % 3]}</div>}
                        <div>
                          <p className="text-sm font-bold text-[#B8F3FF]">{a.titre}</p>
                          {a.description ? <p className="text-sm font-semibold text-[#4C91B5]">{a.description}</p> : null}
                          {a.explication ? <p className="mt-1 text-xs text-[#27506B]">{a.explication}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="relative">
                <img src={s.advantageImage || avantageImg} onError={(e) => { (e.target as HTMLImageElement).src = avantageImg; }} alt="Étudiants ENIA dans la salle informatique moderne" className="h-56 w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B111A] via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2 rounded border border-[#00C8FF]/40 bg-[#0B111A]/90 px-3 py-1.5 backdrop-blur">
                  <GraduationCap size={15} className="text-[#00E5FF]" />
                  <span className="text-xs font-bold text-white">ENIA 2.0 — L'avenir numérique</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ NOS PARTENAIRES OFFICIELS ============ */}
      {db.partners && db.partners.filter((p) => p.actif).length > 0 && (
        <section className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                <Handshake size={18} />
              </span>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-black text-white tracking-wide">
                  NOS PARTENAIRES OFFICIELS
                </h3>
                <p className="text-xs text-[#4C91B5] font-mono">
                  ALLIANCES STRATÉGIQUES & INSTITUTIONNELLES
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {db.partners.filter((p) => p.actif).map((p) => (
              <div
                key={p.id}
                className="group relative flex items-center gap-4 rounded-xl border border-[#006DFF]/30 bg-gradient-to-r from-[#071A2B]/85 to-[#0B111A]/95 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_0_25px_rgba(0,229,255,0.2)] hover:-translate-y-0.5"
              >
                {p.logo ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/50 p-1.5 shadow-inner">
                    <img
                      src={p.logo}
                      alt={p.nom}
                      className="h-full w-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                      onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#00C8FF]/30 bg-[#00C8FF]/10 text-[#00E5FF]">
                    <Handshake size={24} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-display text-sm font-bold text-white group-hover:text-[#00E5FF] transition-colors truncate">
                    {p.nom}
                  </h4>
                  {p.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {p.description}
                    </p>
                  )}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#00E5FF] hover:underline"
                    >
                      <span>Consulter le site officiel</span>
                      <ArrowRight size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ BOURSE BANNER ============ */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-lg border-2 border-[#00C8FF]/50 bg-gradient-to-r from-[#071A2B] via-[#0B111A] to-[#2A0815] p-8 shadow-[0_0_50px_-10px_rgba(0,229,255,0.4)] sm:p-10">
          <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border-2 border-[#00C8FF]/50 bg-[#071A2B] shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                <GraduationCap size={38} className="text-[#00E5FF]" />
              </div>
              <div>
                <p className="font-display text-4xl font-black tracking-wide text-white drop-shadow-[0_0_20px_rgba(0,229,255,0.6)] sm:text-5xl">
                  {s.bourse.title}
                </p>
                <p className="mt-2 text-lg font-bold uppercase tracking-[0.2em] text-[#00FF88]">{s.bourse.subtitle}</p>
              </div>
            </div>
            <div>
              <Link to="/pre-inscription">
                <Btn variant="red" className="animate-pulse-glow px-8 py-4 text-base font-bold uppercase tracking-wider">{s.bourse.button}</Btn>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* formation chips */}
      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><UserCircle2 size={14} /> {formationLabel("informatique")}</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span className="flex items-center gap-1.5"><UserCircle2 size={14} /> {formationLabel("industriel")}</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>{infos.duree}</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>Début : {infos.debut}</span>
        </div>
      </div>
    </div>
  );
}
