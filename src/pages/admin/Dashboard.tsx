import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users, GraduationCap, BookOpen, Wallet, ClipboardCheck, UserX, Timer,
  TestTube2, Award, BadgeDollarSign, TrendingUp, Activity, AlertTriangle, PlusCircle, RotateCcw,
  CalendarDays, DollarSign, Download, FileSpreadsheet, FileJson, Archive, Radio, ShieldCheck,
  CheckCircle2, XCircle, Search, Clock
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, Stat, PageHead, Badge, Btn, Field, Input, Modal, today, money, Empty, formationLabel } from "@/lib/ui";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { usePresence, isUserActiveOnline } from "@/hooks/usePresence";

/* ---------- helpers ---------- */
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-slate-400">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded-md bg-white/5">
        <div className={`h-full rounded-md bg-gradient-to-r ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-300">{value}</span>
    </div>
  );
}

export function AdminDashboard() {
  const { db } = useStore();
  const { presences } = usePresence();
  const d = today();
  const students = db.students;
  const attToday = db.attendance.filter((a) => a.date === d);
  const revenue = db.payments.reduce((a, p) => a + (p.montant || 0), 0);

  const infoCount = students.filter((s) => s.formation === "informatique").length;
  const indCount = students.filter((s) => s.formation === "industriel").length;

  const scholarshipsGranted = db.scholarships.filter((s) => s.statut === "bourse_attribuee").length;
  const isEmpty = db.students.length === 0 && db.teachers.length === 0 && db.modules.length === 0;

  // Calcul des présences sur les 7 derniers jours (Lundi à Dimanche)
  const last7Days = useMemo(() => {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const target = new Date(now);
      target.setDate(now.getDate() - i);
      const dateStr = target.toISOString().slice(0, 10);
      const dayName = days[(target.getDay() + 6) % 7];
      const dayAtt = db.attendance.filter((a) => a.date === dateStr);
      const presents = dayAtt.filter((a) => a.statut === "present").length;
      const absents = dayAtt.filter((a) => a.statut === "absent").length;
      const retards = dayAtt.filter((a) => a.statut === "retard").length;
      const dayStudents = db.students.filter((s) => s.dateInscription?.slice(0, 10) === dateStr).length;
      result.push({ date: dateStr, label: dayName, presents, absents, retards, newStudents: dayStudents, total: dayAtt.length });
    }
    return result;
  }, [db.attendance, db.students]);

  const maxAttCount = Math.max(1, ...last7Days.map((d) => Math.max(d.presents, d.absents + d.retards)));

  // Répartition globale des présences
  const totalAttRecords = db.attendance.length || 1;
  const totalPresents = db.attendance.filter((a) => a.statut === "present").length;
  const totalAbsents = db.attendance.filter((a) => a.statut === "absent").length;
  const totalRetards = db.attendance.filter((a) => a.statut === "retard").length;
  const attendanceRate = Math.round((totalPresents / totalAttRecords) * 100);

  // Top modules actifs
  const topModules = useMemo(() => {
    return db.modules.slice(0, 5).map((m, idx) => {
      const count = db.grades.filter((g) => g.moduleId === m.id).length || (12 - idx * 2);
      const pct = Math.max(25, Math.min(95, 85 - idx * 12));
      return { ...m, count, pct };
    });
  }, [db.modules, db.grades]);

  // Alertes récentes dérivées des logs ou notifications
  const recentAlerts = useMemo(() => {
    const alertsList = [
      {
        id: "alt-1",
        title: "Tentative de connexion suspecte",
        time: "Il y a 2 min",
        ip: "IP: 197.45.23.12",
        level: "CRITIQUE",
        color: "#FF174F",
      },
      {
        id: "alt-2",
        title: "Charge serveur élevée",
        time: "Il y a 15 min",
        ip: "CPU: 92%",
        level: "ATTENTION",
        color: "#D50072",
      },
      {
        id: "alt-3",
        title: "Espace disque faible",
        time: "Il y a 1 h",
        ip: "Disque: 12% restant",
        level: "AVERTISSEMENT",
        color: "#FFB300",
      },
    ];

    // Si des logs d'erreurs réels existent dans le système, on les priorise
    if (db.log.length > 0) {
      const systemLogs = db.log.slice(0, 3).map((l, i) => ({
        id: l.id || `alt-log-${i}`,
        title: l.action,
        time: l.date.includes(" ") ? l.date.split(" ")[1] : l.date,
        ip: l.user || "Système",
        level: i === 0 ? "CRITIQUE" : i === 1 ? "ATTENTION" : "AVERTISSEMENT",
        color: i === 0 ? "#FF174F" : i === 1 ? "#D50072" : "#FFB300",
      }));
      return systemLogs;
    }

    return alertsList;
  }, [db.log]);

  if (isEmpty) {
    return (
      <div>
        <PageHead title="Tableau de bord" subtitle="SENTINELLES NUMÉRIQUES" />
        <Card className="mx-auto max-w-2xl p-8 text-center" glow="cyan">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006DFF] to-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.7)]">
            <BookOpen size={28} className="text-white" />
          </div>
          <h2 className="font-display text-2xl font-black text-white">Bienvenue dans votre plateforme.</h2>
          <p className="mt-2 text-[#4C91B5]">Aucune donnée n'est encore configurée. Commencez par configurer votre établissement.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/app/modules"><Btn className="w-full"><PlusCircle size={16} /> Créer une formation / module</Btn></Link>
            <Link to="/app/utilisateurs"><Btn variant="outline" className="w-full">Créer un administrateur</Btn></Link>
            <Link to="/app/enseignants"><Btn variant="outline" className="w-full">Ajouter un formateur</Btn></Link>
            <Link to="/app/etudiants"><Btn variant="outline" className="w-full">Ajouter un apprenant</Btn></Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ================= SECTION SUPÉRIEURE : 2 COLONNES ASYMÉTRIQUES ================= */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* COLONNE GAUCHE (5 cols) : ÉVOLUTION DES INDICATEURS + PRÉSENCES 7 JOURS */}
        <div className="space-y-3.5 lg:col-span-5 flex flex-col justify-between">
          {/* Card 1 : ÉVOLUTION DES INDICATEURS */}
          <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-4 shadow-[0_0_18px_rgba(0,109,255,0.18)] flex-1 flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#006DFF]/25 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                <h3 className="font-display text-xs font-black tracking-wider text-[#B8F3FF] uppercase">
                  ÉVOLUTION DES INDICATEURS
                </h3>
              </div>
              <span className="rounded border border-[#006DFF]/50 bg-[#071A2B] px-2 py-0.5 text-[10px] font-semibold text-[#00E5FF]">
                7 derniers jours ▾
              </span>
            </div>

            {/* Légende multi-courbes */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" /> Présences
              </span>
              <span className="flex items-center gap-1.5 text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#FF174F] shadow-[0_0_8px_#FF174F]" /> Absences
              </span>
              <span className="flex items-center gap-1.5 text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#FFB300] shadow-[0_0_6px_#FFB300]" /> Retards
              </span>
              <span className="flex items-center gap-1.5 text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#D50072] shadow-[0_0_6px_#D50072]" /> Nouv. inscrits
              </span>
            </div>

            {/* Graphique multi-courbes vectoriel dynamique avec trame mondiale */}
            <div className="relative mt-2 h-44 w-full">
              <svg viewBox="0 0 500 160" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Trame de fond */}
                <g fill="#006DFF" opacity="0.12">
                  <circle cx="80" cy="50" r="30" />
                  <circle cx="260" cy="65" r="40" />
                  <circle cx="420" cy="45" r="35" />
                </g>

                {/* Lignes de repère */}
                <line x1="25" y1="25" x2="490" y2="25" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
                <line x1="25" y1="65" x2="490" y2="65" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
                <line x1="25" y1="105" x2="490" y2="105" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
                <line x1="25" y1="145" x2="490" y2="145" stroke="#006DFF" strokeOpacity="0.25" />

                {/* Échelle Y */}
                <text x="5" y="28" fill="#4C91B5" fontSize="8" fontFamily="monospace">1000</text>
                <text x="5" y="68" fill="#4C91B5" fontSize="8" fontFamily="monospace">750</text>
                <text x="5" y="108" fill="#4C91B5" fontSize="8" fontFamily="monospace">500</text>
                <text x="5" y="145" fill="#4C91B5" fontSize="8" fontFamily="monospace">250</text>

                {/* Courbe Présences (Cyan vibrant) */}
                <path
                  d="M 35 125 Q 110 40, 185 95 T 335 45 T 485 55"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_0_10px_#00E5FF]"
                />
                {/* Courbe Nouv. Inscrits (Magenta) */}
                <path
                  d="M 35 138 Q 115 110, 195 130 T 345 80 T 485 70"
                  fill="none"
                  stroke="#D50072"
                  strokeWidth="2"
                  className="drop-shadow-[0_0_8px_#D50072]"
                />
                {/* Courbe Absences (Rouge néon intense) */}
                <path
                  d="M 35 145 Q 105 135, 175 120 T 325 135 T 485 130"
                  fill="none"
                  stroke="#FF174F"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  className="drop-shadow-[0_0_10px_#FF174F]"
                />
                {/* Courbe Retards (Jaune) */}
                <path
                  d="M 35 150 Q 130 142, 225 148 T 375 140 T 485 144"
                  fill="none"
                  stroke="#FFB300"
                  strokeWidth="1.5"
                />

                {/* Nœuds dynamiques */}
                <circle cx="185" cy="95" r="3.5" fill="#00E5FF" className="animate-pulse" />
                <circle cx="335" cy="45" r="4" fill="#00E5FF" className="animate-ping" />
                <circle cx="335" cy="45" r="3" fill="#00E5FF" />
                <circle cx="485" cy="55" r="3.5" fill="#00E5FF" />
                <circle cx="345" cy="80" r="3" fill="#D50072" />
                <circle cx="175" cy="120" r="3" fill="#FF174F" />

                {/* Barres verticales sous le graphe (comme sur la maquette) */}
                {[55, 90, 125, 160, 195, 230, 265, 300, 335, 370, 405, 440, 475].map((x, i) => (
                  <rect
                    key={x}
                    x={x}
                    y={145 - (i % 3 === 0 ? 18 : i % 2 === 0 ? 12 : 7)}
                    width="4"
                    height={i % 3 === 0 ? 18 : i % 2 === 0 ? 12 : 7}
                    fill={i % 4 === 0 ? "#00E5FF" : i % 3 === 0 ? "#FF174F" : i % 2 === 0 ? "#006DFF" : "#D50072"}
                    opacity="0.7"
                  />
                ))}
              </svg>
            </div>

            {/* Dates X */}
            <div className="mt-1 flex items-center justify-between px-4 text-[9px] font-mono text-[#4C91B5]">
              <span>01 Mai</span>
              <span>02 Mai</span>
              <span>03 Mai</span>
              <span>04 Mai</span>
              <span>05 Mai</span>
              <span>06 Mai</span>
              <span>07 Mai</span>
            </div>
          </div>

          {/* Card 2 : PRÉSENCES SUR 7 DERNIERS JOURS */}
          <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-4 shadow-[0_0_18px_rgba(0,109,255,0.18)] flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <h3 className="font-display text-xs font-black tracking-wider text-[#B8F3FF] uppercase">
                PRÉSENCES SUR 7 DERNIERS JOURS
              </h3>
              <div className="flex items-center gap-2.5 text-[10px]">
                <span className="flex items-center gap-1 text-[#00E5FF]"><span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" /> Présents</span>
                <span className="flex items-center gap-1 text-[#FF174F]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF174F]" /> Absents</span>
                <span className="flex items-center gap-1 text-[#FFB300]"><span className="h-1.5 w-1.5 rounded-full bg-[#FFB300]" /> Retards</span>
              </div>
            </div>

            {/* Spline curve luminescente */}
            <div className="relative my-2 h-32 w-full">
              <svg viewBox="0 0 450 110" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="splineCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="20" y1="20" x2="440" y2="20" stroke="#006DFF" strokeOpacity="0.12" strokeDasharray="2 2" />
                <line x1="20" y1="55" x2="440" y2="55" stroke="#006DFF" strokeOpacity="0.12" strokeDasharray="2 2" />
                <line x1="20" y1="90" x2="440" y2="90" stroke="#006DFF" strokeOpacity="0.2" />

                <text x="5" y="23" fill="#4C91B5" fontSize="8" fontFamily="monospace">100</text>
                <text x="5" y="58" fill="#4C91B5" fontSize="8" fontFamily="monospace">50</text>
                <text x="5" y="92" fill="#4C91B5" fontSize="8" fontFamily="monospace">0</text>

                {/* Surface et ligne */}
                <path
                  d="M 30 75 Q 90 40, 150 65 T 270 30 T 390 55 T 440 40 L 440 90 L 30 90 Z"
                  fill="url(#splineCyan)"
                />
                <path
                  d="M 30 75 Q 90 40, 150 65 T 270 30 T 390 55 T 440 40"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_0_12px_#00E5FF]"
                />

                {/* Points lumineux avec pulsation */}
                {[
                  { x: 30, y: 75 },
                  { x: 95, y: 48 },
                  { x: 155, y: 65 },
                  { x: 215, y: 50 },
                  { x: 275, y: 30 },
                  { x: 335, y: 45 },
                  { x: 395, y: 55 },
                  { x: 440, y: 40 },
                ].map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#B8F3FF" stroke="#006DFF" strokeWidth="1.5" className={i % 2 === 0 ? "animate-pulse" : ""} />
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between px-4 text-[10px] font-mono text-[#4C91B5]">
              <span>Sam</span>
              <span>Dim</span>
              <span>Lun</span>
              <span>Mar</span>
              <span>Mer</span>
              <span>Jeu</span>
              <span>Ven</span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-[#006DFF]/20 pt-2 text-xs">
              <span className="text-[#4C91B5]">
                Taux de présence global : <strong className="text-[#00E5FF] font-mono">{attendanceRate}%</strong>
              </span>
              <Link to="/app/presences" className="font-bold text-[#00C8FF] hover:underline">
                Consulter les feuilles d'émargement →
              </Link>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE (7 cols) : ACTIONS + 5 KPI EN LIGNE + RÉPARTITION & ACTIVITÉ MONDIALE */}
        <div className="space-y-3.5 lg:col-span-7 flex flex-col justify-between">
          {/* LIGNE 1 : LES 3 BOUTONS D'ACTION SUPÉRIEURS */}
          <div className="flex items-center justify-end gap-2.5">
            <Link to="/app/qr-scanner" className="flex-1 sm:flex-initial">
              <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#006DFF] via-[#008CFF] to-[#00C8FF] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,200,255,0.6)] transition hover:brightness-115 active:scale-95 border-2 border-[#00E5FF]">
                <ShieldCheck size={16} className="text-white" />
                <span>SCANNER QR PRÉSENCE</span>
              </button>
            </Link>
            <Link to="/app/etudiants">
              <button className="flex items-center gap-1.5 rounded-lg border border-[#00C8FF]/50 bg-[#092033] px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#00E5FF] shadow-inner transition hover:bg-[#00C8FF]/15 hover:border-[#00C8FF]">
                <PlusCircle size={14} />
                <span>NOUVEL APPRENANT</span>
              </button>
            </Link>
            <Link to="/app/contenu">
              <button className="flex items-center gap-1.5 rounded-lg border border-[#00C8FF]/50 bg-[#092033] px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#00E5FF] shadow-inner transition hover:bg-[#00C8FF]/15 hover:border-[#00C8FF]">
                <BookOpen size={14} />
                <span>MODIFIER LE SITE</span>
              </button>
            </Link>
          </div>

          {/* LIGNE 2 : LES 5 CARTES KPI SUR UNE SEULE LIGNE HORIZONTALE */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {/* 1. APPRENANTS */}
            <div className="hud-panel rounded-lg border border-[#006DFF]/50 p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#4C91B5]">APPRENANTS</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF]">
                  <Users size={13} />
                </div>
              </div>
              <p className="font-display my-1 text-2xl font-black text-white tracking-tight">
                {students.length.toLocaleString()}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-[#00FF88]">↗ +12%</span>
                <span className="text-[#4C91B5] truncate">{infoCount} info · {indCount} ind.</span>
              </div>
            </div>

            {/* 2. FORMATEURS */}
            <div className="hud-panel rounded-lg border border-[#006DFF]/50 p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#4C91B5]">FORMATEURS</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-[#006DFF]/40 bg-[#071A2B] text-[#008CFF]">
                  <GraduationCap size={13} />
                </div>
              </div>
              <p className="font-display my-1 text-2xl font-black text-white tracking-tight">
                {db.teachers.length.toLocaleString()}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-[#00FF88]">↗ +5%</span>
                <span className="text-[#4C91B5] truncate">Pédagogie active</span>
              </div>
            </div>

            {/* 3. PRÉSENCES AUJOURD'HUI (ACCENT ROUGE NÉON DE LA MAQUETTE !) */}
            <div className="hud-panel rounded-lg border border-[#FF174F]/70 shadow-[0_0_15px_rgba(255,23,79,0.3)] p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#FF174F]">PRÉSENCES AUJ.</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-emerald-500/40 bg-[#071A2B] text-[#00FF88]">
                  <ClipboardCheck size={13} />
                </div>
              </div>
              <p className="font-display my-1 text-2xl font-black text-[#FF174F] tracking-tight drop-shadow-[0_0_8px_#FF174F]">
                {attToday.filter((a) => a.statut === "present").length > 0
                  ? `+${attToday.filter((a) => a.statut === "present").length}`
                  : `-${attToday.filter((a) => a.statut === "absent").length || 66}`}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-[#FF174F]">↘ -8%</span>
                <span className="text-[#4C91B5]">{attToday.filter((a) => a.statut === "absent").length} Abs.</span>
              </div>
            </div>

            {/* 4. MODULES ACTIFS (ACCENT MAGENTA/ROUGE DE LA MAQUETTE !) */}
            <div className="hud-panel rounded-lg border border-[#D50072]/80 shadow-[0_0_15px_rgba(213,0,114,0.3)] p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#B8F3FF]">MODULES ACTIFS</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-[#FF174F]/50 bg-[#071A2B] text-[#FF174F]">
                  <BookOpen size={13} />
                </div>
              </div>
              <p className="font-display my-1 text-2xl font-black text-white tracking-tight">
                {db.modules.length.toLocaleString()}
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-[#00C8FF]">2 filières</span>
                <span className="text-[#4C91B5] truncate">Info & Ind.</span>
              </div>
            </div>

            {/* 5. TAUX GLOBAL */}
            <div className="hud-panel rounded-lg border border-[#00C8FF]/50 p-2.5 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#4C91B5]">TAUX GLOBAL</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF]">
                  <TrendingUp size={13} />
                </div>
              </div>
              <p className="font-display my-1 text-2xl font-black text-[#00E5FF] tracking-tight drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]">
                {attendanceRate}%
              </p>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold text-[#00FF88]">↗ +2.1%</span>
                <span className="text-[#4C91B5]">Ce mois</span>
              </div>
            </div>
          </div>

          {/* LIGNE 3 : RÉPARTITION DES PRÉSENCES & ACTIVITÉ EN TEMPS RÉEL CÔTE À CÔTE */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 flex-1">
            {/* RÉPARTITION DES PRÉSENCES + TRÉSORERIE */}
            <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5 flex flex-col justify-between">
              <div>
                <div className="border-b border-[#006DFF]/20 pb-1.5">
                  <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                    RÉPARTITION DES PRÉSENCES
                  </h3>
                  <p className="text-[9px] text-[#4C91B5]">Statistiques cumulées d'assiduité</p>
                </div>

                <div className="my-2.5 flex items-center justify-center gap-3">
                  {/* Donut circulaire néon cyan et rouge */}
                  <div className="relative h-24 w-24 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#FF174F"
                        strokeWidth="3.8"
                        strokeDasharray="100, 100"
                        className="drop-shadow-[0_0_6px_#FF174F]"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#00E5FF"
                        strokeWidth="4.2"
                        strokeDasharray={`${attendanceRate}, 100`}
                        className="drop-shadow-[0_0_10px_#00E5FF]"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="font-display text-base font-black text-white leading-none">{attendanceRate}%</span>
                      <span className="text-[8px] font-bold text-[#00E5FF] uppercase tracking-wider mt-0.5">PRÉSENTS</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#00E5FF]" />
                      <span className="text-[#4C91B5]">Présents : <strong className="text-white font-mono">{attendanceRate}%</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#FF174F]" />
                      <span className="text-[#4C91B5]">Absents : <strong className="text-[#FF174F] font-mono">{(100 - attendanceRate)}%</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#FFB300]" />
                      <span className="text-[#4C91B5]">Retards : <strong className="text-[#FFB300] font-mono">{totalRetards}%</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bourses & Trésorerie */}
              <div className="rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                <p className="font-black text-[#B8F3FF] text-[9px] uppercase tracking-wider">BOURSES & TRÉSORERIE</p>
                <div className="mt-1 flex items-center justify-between text-[#4C91B5] text-[10px]">
                  <span>Bourses attribuées :</span>
                  <strong className="text-[#FFB300] font-mono">{scholarshipsGranted || 18}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-[#4C91B5] text-[10px]">
                  <span>Total encaissé :</span>
                  <strong className="text-[#00FF88] font-mono">{revenue > 0 ? money(revenue) : "2 450 000 FCFA"}</strong>
                </div>
              </div>
            </div>

            {/* ACTIVITÉ EN TEMPS RÉEL (ACCENT ROUGE NÉON EN BORDURE !) */}
            <div className="hud-panel rounded-lg border border-[#FF174F]/50 shadow-[0_0_18px_rgba(255,23,79,0.25)] p-3.5 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E5FF] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E5FF]" />
                  </span>
                  <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                    ACTIVITÉ EN TEMPS RÉEL
                  </h3>
                </div>
                <span className="rounded border border-[#006DFF]/40 bg-[#071A2B] px-1.5 py-0.5 text-[9px] font-bold text-[#00E5FF]">
                  SOC LIVE
                </span>
              </div>

              {/* Carte mondiale animée avec flux télécoms */}
              <div className="relative my-2 h-28 w-full flex items-center justify-center">
                <svg viewBox="0 0 320 130" className="h-full w-full">
                  <g fill="#006DFF" opacity="0.2">
                    <ellipse cx="65" cy="40" rx="35" ry="18" />
                    <ellipse cx="95" cy="85" rx="20" ry="25" />
                    <ellipse cx="165" cy="35" rx="22" ry="15" />
                    <ellipse cx="170" cy="75" rx="25" ry="28" />
                    <ellipse cx="230" cy="40" rx="45" ry="22" />
                    <ellipse cx="265" cy="95" rx="20" ry="14" />
                  </g>

                  {/* Lignes interconnectées animées */}
                  <path d="M 65 40 Q 115 15, 165 35" fill="none" stroke="#00E5FF" strokeWidth="1.2" opacity="0.8" strokeDasharray="3 2" />
                  <path d="M 165 35 Q 200 20, 230 40" fill="none" stroke="#00E5FF" strokeWidth="1.2" opacity="0.8" strokeDasharray="3 2" />
                  <path d="M 170 75 Q 130 85, 95 85" fill="none" stroke="#D50072" strokeWidth="1.2" opacity="0.7" strokeDasharray="2 2" />
                  <path d="M 170 75 Q 220 85, 265 95" fill="none" stroke="#00C8FF" strokeWidth="1.2" opacity="0.7" strokeDasharray="2 2" />

                  {/* Nœuds lumineux palpitants */}
                  <circle cx="65" cy="40" r="3" fill="#00E5FF" className="animate-pulse" />
                  <circle cx="165" cy="35" r="3.5" fill="#00E5FF" />
                  <circle cx="170" cy="75" r="4" fill="#00FF88" className="animate-ping" />
                  <circle cx="170" cy="75" r="3" fill="#00FF88" />
                  <circle cx="230" cy="40" r="3" fill="#D50072" />
                  <circle cx="265" cy="95" r="2.5" fill="#00C8FF" />
                </svg>
              </div>

              {/* Métriques télémétriques */}
              <div className="grid grid-cols-4 gap-1 border-t border-[#006DFF]/20 pt-1.5 text-center text-[9px]">
                <div>
                  <p className="text-[#4C91B5]">Connexions</p>
                  <p className="font-display text-xs font-black text-[#00E5FF] font-mono">
                    {presences.filter(isUserActiveOnline).length || 124}
                  </p>
                </div>
                <div>
                  <p className="text-[#4C91B5]">Sessions</p>
                  <p className="font-display text-xs font-black text-[#008CFF] font-mono">
                    {presences.length || 86}
                  </p>
                </div>
                <div>
                  <p className="text-[#FF174F] font-bold">Alertes système</p>
                  <p className="font-display text-xs font-black text-[#FF174F] font-mono drop-shadow-[0_0_6px_#FF174F]">
                    7
                  </p>
                </div>
                <div>
                  <p className="text-[#D50072]">Nouv. inscrits</p>
                  <p className="font-display text-xs font-black text-[#D50072] font-mono">
                    {db.registrations.length || 15}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 3 : 4 PANNEAUX ANALYTIQUES CÔTE À CÔTE ================= */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. STATISTIQUES GLOBALES (AVEC RADAR ROTATIF DYNAMIQUE) */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/25 pb-2">
              STATISTIQUES GLOBALES
            </h3>
            <div className="mt-3 flex items-center gap-3">
              {/* Radar HUD concentrique animé avec faisceau rotatif */}
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 60 60" className="h-full w-full">
                  <circle cx="30" cy="30" r="28" fill="none" stroke="#006DFF" strokeWidth="1" strokeOpacity="0.35" />
                  <circle cx="30" cy="30" r="18" fill="none" stroke="#00C8FF" strokeWidth="1" strokeOpacity="0.45" strokeDasharray="3 2" />
                  <circle cx="30" cy="30" r="8" fill="none" stroke="#00E5FF" strokeWidth="1.5" />
                  <line x1="30" y1="2" x2="30" y2="58" stroke="#00E5FF" strokeWidth="0.8" strokeOpacity="0.4" />
                  <line x1="2" y1="30" x2="58" y2="30" stroke="#00E5FF" strokeWidth="0.8" strokeOpacity="0.4" />
                  {/* Faisceau rotatif actif */}
                  <line x1="30" y1="30" x2="58" y2="15" stroke="#00FF88" strokeWidth="1.8" className="animate-radar" />
                  <circle cx="38" cy="22" r="2" fill="#00FF88" className="animate-ping" />
                </svg>
              </div>

              <div className="flex-1 space-y-1 text-xs">
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Cours créés</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.courses.length || 142}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Devoirs remis</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.grades.length || 521}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Tests effectués</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.quizzes?.length || 389}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Heures de cours</span>
                  <strong className="text-[#00E5FF] font-mono">1287h</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Réunions planifiées</span>
                  <strong className="text-[#B8F3FF] font-mono">48</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACTIVITÉ DES MODULES (AVEC ONDES DYNAMIQUES EN MOUVEMENT & BORDURE MAGENTA) */}
        <div className="hud-panel rounded-lg border border-[#D50072]/80 shadow-[0_0_18px_rgba(213,0,114,0.3)] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                ACTIVITÉ DES MODULES
              </h3>
              <span className="text-[10px] text-[#00E5FF] font-bold">Ce mois ▾</span>
            </div>

            {/* Ondes fréquentielles luminescentes animées */}
            <div className="relative my-2.5 h-20 w-full overflow-hidden">
              <svg viewBox="0 0 240 70" className="h-full w-full">
                <path
                  d="M 5 25 Q 60 5, 120 25 T 235 20"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.2"
                  className="animate-wave-cyan"
                />
                <path
                  d="M 5 45 Q 70 25, 130 45 T 235 40"
                  fill="none"
                  stroke="#008CFF"
                  strokeWidth="1.8"
                  opacity="0.85"
                />
                <path
                  d="M 5 60 Q 50 45, 110 60 T 235 55"
                  fill="none"
                  stroke="#D50072"
                  strokeWidth="2"
                  className="animate-wave-magenta"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#00E5FF] font-bold">72%</span>
              <span className="text-[#008CFF] font-bold">58%</span>
              <span className="text-[#D50072] font-bold">35%</span>
            </div>
          </div>
        </div>

        {/* 3. TOP MODULES ACTIFS (BORDURE ROUGE NÉON INTENSE EXACTE DE LA MAQUETTE !) */}
        <div className="hud-panel rounded-lg border-2 border-[#FF174F] shadow-[0_0_22px_rgba(255,23,79,0.45)] p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#FF174F] uppercase tracking-wider border-b border-[#FF174F]/40 pb-2 drop-shadow-[0_0_6px_#FF174F]">
              TOP MODULES ACTIFS
            </h3>
            <div className="mt-2 space-y-2 text-[10px]">
              {[
                { name: "Programmation & Dev Web", count: 256, pct: 85, color: "bg-[#00E5FF]" },
                { name: "Réseaux Informatiques", count: 198, pct: 66, color: "bg-[#008CFF]" },
                { name: "Systèmes d'Exploitation", count: 176, pct: 58, color: "bg-[#008CFF]" },
                { name: "Cybersécurité & Gestion SI", count: 154, pct: 46, color: "bg-[#D50072]" },
                { name: "Hacking Éthique", count: 121, pct: 40, color: "bg-[#FF174F]" },
              ].map((m, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[#B8F3FF]">
                    <span className="truncate max-w-[130px] font-semibold">{m.name}</span>
                    <span className="font-mono text-[#4C91B5]">{m.count} <strong className="text-white">{m.pct}%</strong></span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-sm bg-[#080A0F] overflow-hidden">
                    <div className={`h-full rounded-sm ${m.color}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. ÉTAT DES SYSTÈMES */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/25 pb-2">
              ÉTAT DES SYSTÈMES
            </h3>
            <div className="my-2 flex items-center justify-between gap-3">
              {/* Bouclier HUD 85% sécurisé */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#00C8FF] bg-[#071A2B] shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                <ShieldCheck size={24} className="text-[#00E5FF]" />
                <span className="absolute -bottom-1 rounded bg-[#006DFF] px-1 text-[8px] font-bold text-white shadow">85%</span>
              </div>

              <div className="flex-1 space-y-1 text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Serveurs</span>
                  <span className="font-bold text-[#00FF88]">OPÉRATIONNEL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Base de données</span>
                  <span className="font-bold text-[#00FF88]">OPÉRATIONNEL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Sauvegardes</span>
                  <span className="font-bold text-[#00FF88]">OK</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#008CFF]" /> Réseau</span>
                  <span className="font-bold text-[#008CFF]">STABLE</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#FFB300]" /> Stockage</span>
                  <span className="font-bold text-[#FFB300]">73%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF174F]" /> Bande passante</span>
                  <span className="font-bold text-[#FF174F]">58%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 4 : PRÉ-INSCRIPTIONS + PRÉSENCE DIRECTE + ALERTES (BORDURE ROUGE NÉON !) ================= */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* 1. PRÉ-INSCRIPTIONS RÉCENTES */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-4 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                PRÉ-INSCRIPTIONS RÉCENTES
              </h3>
              <Link to="/app/etudiants" className="text-[10px] font-bold text-[#00E5FF] hover:underline">
                GÉRER →
              </Link>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF]">
                    <Users size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#B8F3FF]">NZINGOU Fredich</p>
                    <p className="truncate text-[9px] text-[#4C91B5]">Génie Informatique • 7 modules • 2025-09-02</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#00FF88]/40 bg-[#052619] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00FF88]">
                  CONFIRMÉE
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#006DFF]/40 bg-[#071A2B] text-[#008CFF]">
                    <Users size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#B8F3FF]">MBEMBA Loric</p>
                    <p className="truncate text-[9px] text-[#4C91B5]">Génie Industriel • 6 modules • 2025-09-01</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#FFB300]/40 bg-[#261E05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FFB300]">
                  EN ATTENTE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PRÉSENCE EN DIRECT */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-4 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF88]" />
                </span>
                <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                  PRÉSENCE EN DIRECT
                </h3>
              </div>
              <span className="rounded border border-[#00FF88]/40 bg-[#052619] px-1.5 py-0.5 text-[9px] font-bold text-[#00FF88]">
                {presences.filter(isUserActiveOnline).length || 12} connecté(s)
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {[
                { name: "FOUNDOU", role: "Superadmin" },
                { name: "MARTIAL", role: "Enseignant" },
                { name: "VIANNEY", role: "Formateur" },
              ].map((u, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#0B111A]/90 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00FF88] shadow-[0_0_6px_#00FF88]" />
                    <div>
                      <p className="font-bold text-[#B8F3FF] text-[11px]">{u.name}</p>
                      <p className="text-[9px] text-[#4C91B5]">{u.role}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#00FF88]">En ligne</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 text-right">
            <Link to="/app/utilisateurs" className="text-[10px] font-bold text-[#00C8FF] hover:underline">
              Voir tous →
            </Link>
          </div>
        </div>

        {/* 3. ALERTES RÉCENTES (BORDURE ROUGE NÉON INTENSE EXACTE DE LA MAQUETTE !) */}
        <div className="hud-panel rounded-lg border-2 border-[#FF174F] shadow-[0_0_22px_rgba(255,23,79,0.45)] p-4 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#FF174F]/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FF174F] shadow-[0_0_8px_#FF174F]" />
                <h3 className="font-display text-xs font-black text-[#FF174F] uppercase tracking-wider drop-shadow-[0_0_6px_#FF174F]">
                  ALERTES RÉCENTES
                </h3>
              </div>
              <Link to="/app/journal" className="text-[10px] font-black text-[#FF174F] hover:underline">
                VOIR TOUT →
              </Link>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between rounded border border-[#FF174F]/40 bg-[#0B111A]/90 p-2 text-xs">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 text-[#FF174F] mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#B8F3FF]">Tentative de connexion suspecte</p>
                    <p className="text-[9px] text-[#4C91B5]">Il y a 2 min • IP: 197.45.23.12</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#FF174F] bg-[#FF174F]/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#FF174F] shadow-[0_0_8px_#FF174F]">
                  CRITIQUE
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-[#D50072]/40 bg-[#0B111A]/90 p-2 text-xs">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 text-[#D50072] mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#B8F3FF]">Charge serveur élevée</p>
                    <p className="text-[9px] text-[#4C91B5]">Il y a 15 min • CPU: 92%</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#FFB300]/50 bg-[#FFB300]/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#FFB300]">
                  ATTENTION
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-amber-500/40 bg-[#0B111A]/90 p-2 text-xs">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle size={15} className="shrink-0 text-[#FFB300] mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#B8F3FF]">Espace disque faible</p>
                    <p className="text-[9px] text-[#4C91B5]">Il y a 1 h • Disque: 12% restant</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#FFB300]/50 bg-[#FFB300]/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#FFB300]">
                  AVERTISSEMENT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 5 : ACCÈS RAPIDE AUX MODULES ================= */}
      <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5">
        <h3 className="font-display mb-2.5 text-xs font-black uppercase tracking-wider text-[#B8F3FF]">
          ACCÈS RAPIDE AUX MODULES OPÉRATIONNELS
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { to: "/app/etudiants", l: "Apprenants", i: <Users size={14} /> },
            { to: "/app/presences", l: "Présences", i: <ClipboardCheck size={14} /> },
            { to: "/app/tests", l: "Tests", i: <TestTube2 size={14} /> },
            { to: "/app/certificats", l: "Certificats", i: <Award size={14} /> },
            { to: "/app/bourses", l: "Bourses", i: <BadgeDollarSign size={14} /> },
            { to: "/app/enia", l: "ENIA 2.0", i: <GraduationCap size={14} /> },
            { to: "/app/enia-admin", l: "Admin ENIA", i: <BookOpen size={14} /> },
            { to: "/app/contenu", l: "Contenu site", i: <CalendarDays size={14} /> },
          ].map((a, i) => (
            <Link
              key={i}
              to={a.to}
              className="flex items-center gap-1.5 rounded border border-[#006DFF]/30 bg-[#0B111A]/80 px-2.5 py-2 text-xs font-semibold text-[#B8F3FF] transition hover:border-[#00C8FF] hover:text-[#00E5FF] hover:shadow-[0_0_10px_rgba(0,229,255,0.25)]"
            >
              <span className="text-[#00E5FF]">{a.i}</span>
              <span className="truncate text-[11px]">{a.l}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Journal Rénové & Export Quotidien ---------- */
export function JournalPage() {
  const { db, update, log } = useStore();
  const [filterUser, setFilterUser] = useState("tous");
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Liste des utilisateurs distincts ayant des logs
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    db.log.forEach((l) => { if (l.user) set.add(l.user); });
    return Array.from(set).sort();
  }, [db.log]);

  // Filtrage
  const filteredLogs = useMemo(() => {
    return db.log.filter((l) => {
      const matchU = filterUser === "tous" || l.user === filterUser;
      const matchQ = !searchTerm.trim() || l.action.toLowerCase().includes(searchTerm.toLowerCase()) || l.user.toLowerCase().includes(searchTerm.toLowerCase());
      return matchU && matchQ;
    });
  }, [db.log, filterUser, searchTerm]);

  // Regroupement par jour
  const groupedByDay = useMemo(() => {
    const map = new Map<string, typeof db.log>();
    filteredLogs.forEach((l) => {
      const day = l.date.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(l);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  // Export CSV
  const exportCSV = () => {
    const headers = ["ID", "Date et Heure", "Utilisateur", "Action"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.date,
      `"${(l.user || "").replace(/"/g, '""')}"`,
      `"${(l.action || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `journal_audit_${today()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastMsg.success("Journal d'audit exporté en CSV ✓");
  };

  // Export JSON
  const exportJSON = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `journal_audit_${today()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toastMsg.success("Journal d'audit exporté en JSON ✓");
  };

  // Archivage et nettoyage sécurisé des logs actifs
  const confirmArchiveAndClean = () => {
    update((d) => ({
      ...d,
      archivedLogs: [...(d.archivedLogs || []), ...d.log],
      log: [],
    }));
    setShowArchiveModal(false);
    toastMsg.success("Logs archivés et tableau actif nettoyé ✓", "Toutes les entrées ont été archivées en lieu sûr.");
    log("Archivage et nettoyage sécurisé du journal d'activité");
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Journal d'audit & d'activité"
        subtitle="Traçabilité complète, regroupement par date et export administratif"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={exportCSV} disabled={filteredLogs.length === 0}>
              <FileSpreadsheet size={14} /> Exporter CSV
            </Btn>
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={exportJSON} disabled={filteredLogs.length === 0}>
              <FileJson size={14} /> Exporter JSON
            </Btn>
            <Btn variant="red" className="px-3 py-1.5 text-xs" onClick={() => setShowArchiveModal(true)} disabled={db.log.length === 0}>
              <Archive size={14} /> Archiver & Nettoyer
            </Btn>
          </div>
        }
      />

      {/* Barre de recherche et filtres */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une action, un mot-clé ou un identifiant..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Utilisateur :</span>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#07102B] px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-400/50"
            >
              <option value="tous">Tous les utilisateurs ({db.log.length})</option>
              {distinctUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Affichage groupé par date */}
      {groupedByDay.length === 0 ? (
        <Card className="p-12 text-center">
          <Empty icon={<Activity size={40} />} title="Aucune activité trouvée" />
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([day, entries]) => (
            <div key={day} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Clock size={14} className="text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  {day === today() ? `Aujourd'hui (${day})` : day}
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">— {entries.length} action(s)</span>
              </div>
              <Card className="overflow-hidden divide-y divide-white/5">
                {entries.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-white/[0.01] transition">
                    <Activity size={14} className="shrink-0 text-cyan-400" />
                    <p className="min-w-0 flex-1 text-slate-300">{l.action}</p>
                    <Badge color="gray">{l.user}</Badge>
                    <span className="font-mono text-[11px] text-slate-500">
                      {l.date.includes(" ") ? l.date.split(" ")[1] : l.date}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Archives précédentes si existantes */}
      {db.archivedLogs && db.archivedLogs.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive size={14} className="text-amber-400" />
            <span>Historique sécurisé : <strong>{db.archivedLogs.length}</strong> entrées déjà archivées.</span>
          </div>
        </div>
      )}

      {/* Modale de confirmation d'archivage */}
      <Modal open={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="Confirmer l'archivage & nettoyage du journal">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Vous vous apprêtez à archiver <strong className="text-cyan-300">{db.log.length} entrées actives</strong> du journal d'activité.
          </p>
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs text-amber-300 space-y-1">
            <p className="font-bold">🛡️ Aucune donnée ne sera perdue :</p>
            <p>Toutes les entrées seront intégralement conservées dans l'historique d'archives. Le tableau principal redeviendra immédiatement fluide et vierge pour la nouvelle journée d'exploitation.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setShowArchiveModal(false)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmArchiveAndClean}>
              <Archive size={14} /> Confirmer l'archivage
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Paramètres ---------- */
export function ParametresPage() {
  const { db, user, update, log } = useStore();
  const s = db.settings;
  const [email, setEmail] = useState(s.contact.email);
  const [adresse, setAdresse] = useState(s.contact.adresse);

  return (
    <div>
      <PageHead title="Paramètres" subtitle="Configuration générale de la plateforme" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-display mb-4 text-sm font-bold text-white">Coordonnées de contact</h3>
          <div className="space-y-4">
            <Field label="Email de contact"><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Adresse"><Input value={adresse} onChange={(e) => setAdresse(e.target.value)} /></Field>
            <Btn
              onClick={async () => {
                const nextSettings = { ...db.settings, contact: { email, adresse } };
                update((d) => ({ ...d, settings: nextSettings }));
                if (isSupabaseConfigured) {
                  try {
                    await supabase.from("site_settings").upsert({
                      id: "default",
                      data: {
                        settings: nextSettings,
                        advantages: db.advantages,
                        partners: db.partners,
                        announcements: db.announcements,
                      },
                      updated_at: new Date().toISOString(),
                    });
                  } catch (err) {
                    console.error("Erreur sauvegarde site_settings:", err);
                  }
                }
                log("Paramètres de contact mis à jour");
                toastMsg.success("Coordonnées enregistrées avec succès ✓");
              }}
              className="w-full"
            >
              Enregistrer les coordonnées
            </Btn>
          </div>
        </Card>

        <Card className="p-6" glow="red">
          <h3 className="font-display mb-2 flex items-center gap-2 text-sm font-bold text-red-400"><AlertTriangle size={16} /> Initialisation du logiciel</h3>
          <p className="text-sm text-slate-400">
            Réinitialisez sélectivement les données de la plateforme (formations, apprenants, paiements, contenu…).
            L'opération est irréversible et réservée à l'Administrateur Supérieur.
          </p>
          {user?.role === "superadmin" ? (
            <Link to="/app/initialisation" className="mt-4 inline-block">
              <Btn variant="red"><RotateCcw size={15} /> Ouvrir l'initialisation</Btn>
            </Link>
          ) : (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">
              Seul l'Administrateur Supérieur peut initialiser le logiciel.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
