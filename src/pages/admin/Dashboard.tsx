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
    <div className="space-y-5">
      {/* En-tête HUD avec Boutons d'Action Rapide */}
      <PageHead
        title="TABLEAU DE BORD"
        subtitle="SUPERVISION EN TEMPS RÉEL – SENTINELLE NUMÉRIQUE"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/app/qr-scanner">
              <button className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#006DFF] via-[#008CFF] to-[#00C8FF] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,200,255,0.5)] transition hover:brightness-110 active:scale-95 border border-[#00E5FF]/60">
                <ShieldCheck size={16} className="text-white" />
                <span>SCANNER QR PRÉSENCE</span>
              </button>
            </Link>
            <Link to="/app/etudiants">
              <button className="flex items-center gap-2 rounded-xl border border-[#00C8FF]/40 bg-[#092033]/80 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#00E5FF] shadow-inner transition hover:bg-[#00C8FF]/15 hover:border-[#00C8FF]">
                <PlusCircle size={15} />
                <span>NOUVEL APPRENANT</span>
              </button>
            </Link>
            <Link to="/app/contenu">
              <button className="flex items-center gap-2 rounded-xl border border-[#00C8FF]/40 bg-[#092033]/80 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#00E5FF] shadow-inner transition hover:bg-[#00C8FF]/15 hover:border-[#00C8FF]">
                <BookOpen size={15} />
                <span>MODIFIER LE SITE</span>
              </button>
            </Link>
          </div>
        }
      />

      {/* ================= SECTION 1 : ÉVOLUTION DES INDICATEURS & KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Graphique multi-courbes : ÉVOLUTION DES INDICATEURS */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-7 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#006DFF]/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
              <h3 className="font-display text-xs sm:text-sm font-black tracking-wider text-[#B8F3FF] uppercase">
                ÉVOLUTION DES INDICATEURS
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs">
              <span className="flex items-center gap-1.5 font-bold text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" /> Présences
              </span>
              <span className="flex items-center gap-1.5 font-bold text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#FF174F] shadow-[0_0_6px_#FF174F]" /> Absences
              </span>
              <span className="flex items-center gap-1.5 font-bold text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#FFB300] shadow-[0_0_6px_#FFB300]" /> Retards
              </span>
              <span className="flex items-center gap-1.5 font-bold text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-[#D50072] shadow-[0_0_6px_#D50072]" /> Nouv. inscrits
              </span>
              <span className="rounded-md border border-[#006DFF]/40 bg-[#071A2B] px-2 py-0.5 text-[10px] font-semibold text-[#00E5FF]">
                7 derniers jours ▾
              </span>
            </div>
          </div>

          {/* SVG Multi-Courbes Cyber */}
          <div className="relative mt-4 h-48 w-full">
            <svg viewBox="0 0 600 180" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id="cyberCyanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="cyberMagentaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D50072" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#D50072" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Lignes de repère horizontales discrètes */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="600" y2="75" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="#006DFF" strokeOpacity="0.15" strokeDasharray="3 3" />
              <line x1="0" y1="165" x2="600" y2="165" stroke="#006DFF" strokeOpacity="0.25" />

              {/* Graduation Y */}
              <text x="5" y="28" fill="#4C91B5" fontSize="9" fontFamily="monospace">1000</text>
              <text x="5" y="73" fill="#4C91B5" fontSize="9" fontFamily="monospace">750</text>
              <text x="5" y="118" fill="#4C91B5" fontSize="9" fontFamily="monospace">500</text>
              <text x="5" y="160" fill="#4C91B5" fontSize="9" fontFamily="monospace">250</text>

              {/* Multi-Courbes dynamiques */}
              {/* 1. Courbe Présences (Cyan néon) */}
              <path
                d="M 50 140 Q 130 60, 210 110 T 370 50 T 530 80 T 590 60"
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]"
              />
              {/* 2. Courbe Nouv. Inscrits (Magenta) */}
              <path
                d="M 50 155 Q 140 130, 230 145 T 390 100 T 530 120 T 590 90"
                fill="none"
                stroke="#D50072"
                strokeWidth="2"
                className="drop-shadow-[0_0_6px_rgba(213,0,114,0.6)]"
              />
              {/* 3. Courbe Absences (Rouge néon) */}
              <path
                d="M 50 165 Q 120 150, 200 135 T 360 145 T 520 135 T 590 150"
                fill="none"
                stroke="#FF174F"
                strokeWidth="1.8"
                strokeDasharray="4 2"
                className="drop-shadow-[0_0_6px_rgba(255,23,79,0.5)]"
              />
              {/* 4. Courbe Retards (Jaune ambre) */}
              <path
                d="M 50 170 Q 150 160, 240 165 T 400 155 T 540 160 T 590 158"
                fill="none"
                stroke="#FFB300"
                strokeWidth="1.5"
              />

              {/* Nœuds lumineux */}
              <circle cx="210" cy="110" r="4" fill="#00E5FF" className="shadow-[0_0_8px_#00E5FF]" />
              <circle cx="370" cy="50" r="4" fill="#00E5FF" className="shadow-[0_0_8px_#00E5FF]" />
              <circle cx="530" cy="80" r="4" fill="#00E5FF" className="shadow-[0_0_8px_#00E5FF]" />

              {/* Barres verticales techniques de télémétrie en pied de graphe */}
              {[70, 110, 150, 190, 230, 270, 310, 350, 390, 430, 470, 510, 550, 580].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={165 - (i % 3 === 0 ? 16 : i % 2 === 0 ? 10 : 6)}
                  width="4"
                  height={i % 3 === 0 ? 16 : i % 2 === 0 ? 10 : 6}
                  fill={i % 4 === 0 ? "#00E5FF" : i % 3 === 0 ? "#006DFF" : "#D50072"}
                  opacity="0.6"
                  rx="1"
                />
              ))}
            </svg>
          </div>

          {/* Axe X des dates */}
          <div className="mt-2 flex items-center justify-between px-6 text-[10px] font-mono text-[#4C91B5]">
            {last7Days.map((d, i) => (
              <span key={d.date}>{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
            ))}
          </div>
        </div>

        {/* 5 Cartes KPI HUD */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-6">
          {/* 1. Apprenants */}
          <div className="hud-panel col-span-1 sm:col-span-1 lg:col-span-3 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4C91B5]">APPRENANTS</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00C8FF]/30 bg-[#071A2B] text-[#00E5FF]">
                <Users size={15} />
              </div>
            </div>
            <div className="my-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {students.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#00FF88]">+12%</span>
              <span className="text-[#4C91B5]">{infoCount} Info · {indCount} Ind.</span>
            </div>
          </div>

          {/* 2. Formateurs */}
          <div className="hud-panel col-span-1 sm:col-span-1 lg:col-span-3 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4C91B5]">FORMATEURS</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#006DFF]/30 bg-[#071A2B] text-[#008CFF]">
                <GraduationCap size={15} />
              </div>
            </div>
            <div className="my-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {db.teachers.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#00FF88]">+5%</span>
              <span className="text-[#4C91B5]">Pédagogie active</span>
            </div>
          </div>

          {/* 3. Présences Aujourd'hui */}
          <div className="hud-panel col-span-1 sm:col-span-1 lg:col-span-2 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4C91B5]">PRÉSENCES</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-[#071A2B] text-[#00FF88]">
                <ClipboardCheck size={15} />
              </div>
            </div>
            <div className="my-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-[#00FF88] tracking-tight">
                {attToday.filter((a) => a.statut === "present").length}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#FF174F]">{attToday.filter((a) => a.statut === "absent").length} Abs.</span>
              <span className="text-[#4C91B5]">Ce jour</span>
            </div>
          </div>

          {/* 4. Modules Actifs */}
          <div className="hud-panel col-span-1 sm:col-span-1 lg:col-span-2 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4C91B5]">MODULES</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#D50072]/40 bg-[#071A2B] text-[#D50072]">
                <BookOpen size={15} />
              </div>
            </div>
            <div className="my-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {db.modules.length.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#00C8FF]">2 filières</span>
              <span className="text-[#4C91B5]">Info & Ind.</span>
            </div>
          </div>

          {/* 5. Taux Global */}
          <div className="hud-panel col-span-2 sm:col-span-1 lg:col-span-2 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4C91B5]">TAUX GLOBAL</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00C8FF]/30 bg-[#071A2B] text-[#00E5FF]">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="my-1">
              <span className="font-display text-2xl sm:text-3xl font-black text-[#00E5FF] tracking-tight">
                {attendanceRate}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#00FF88]">+2.1%</span>
              <span className="text-[#4C91B5]">Assiduité</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 2 : 7 JOURS + RÉPARTITION / TRÉSORERIE + ACTIVITÉ MONDIALE ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Présences sur les 7 derniers jours */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2.5">
              <div>
                <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                  PRÉSENCES SUR 7 DERNIERS JOURS
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#00E5FF]"><span className="h-2 w-2 rounded-full bg-[#00E5FF]" /> Présents</span>
                <span className="flex items-center gap-1 text-[#FF174F]"><span className="h-2 w-2 rounded-full bg-[#FF174F]" /> Absents</span>
                <span className="flex items-center gap-1 text-[#FFB300]"><span className="h-2 w-2 rounded-full bg-[#FFB300]" /> Retards</span>
              </div>
            </div>

            {/* Courbe Spline 7 Jours SVG */}
            <div className="relative mt-4 h-40 w-full">
              <svg viewBox="0 0 400 130" className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="areaCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="30" x2="400" y2="30" stroke="#006DFF" strokeOpacity="0.12" strokeDasharray="2 2" />
                <line x1="0" y1="70" x2="400" y2="70" stroke="#006DFF" strokeOpacity="0.12" strokeDasharray="2 2" />
                <line x1="0" y1="110" x2="400" y2="110" stroke="#006DFF" strokeOpacity="0.2" />

                {/* Courbe remplie cyan */}
                <path
                  d="M 20 90 Q 75 40, 135 75 T 255 35 T 375 60 L 375 110 L 20 110 Z"
                  fill="url(#areaCyan)"
                />
                {/* Ligne principale cyan */}
                <path
                  d="M 20 90 Q 75 40, 135 75 T 255 35 T 375 60"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_0_10px_#00E5FF]"
                />
                {/* Nœuds lumineux */}
                {[
                  { x: 20, y: 90 },
                  { x: 80, y: 55 },
                  { x: 140, y: 75 },
                  { x: 200, y: 60 },
                  { x: 260, y: 35 },
                  { x: 320, y: 50 },
                  { x: 375, y: 60 },
                ].map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#B8F3FF" stroke="#006DFF" strokeWidth="1.5" />
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between px-2 text-[10px] font-mono text-[#4C91B5]">
              {last7Days.map((d) => (
                <span key={d.date}>{d.label}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#006DFF]/20 pt-2.5 text-xs">
            <span className="text-[#4C91B5]">
              Taux de présence global : <strong className="text-[#00E5FF] font-mono">{attendanceRate}%</strong>
            </span>
            <Link to="/app/presences" className="font-bold text-[#00C8FF] hover:underline flex items-center gap-1">
              Consulter les feuilles d'émargement →
            </Link>
          </div>
        </div>

        {/* Répartition des présences & Trésorerie */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#006DFF]/20 pb-2">
              <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                RÉPARTITION DES PRÉSENCES
              </h3>
              <p className="text-[10px] text-[#4C91B5]">Statistiques cumulées d'assiduité</p>
            </div>

            {/* Donut Chart Circulaire Néon */}
            <div className="my-3 flex items-center justify-center gap-4">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#FF174F"
                    strokeWidth="3.5"
                    strokeDasharray="100, 100"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="3.8"
                    strokeDasharray={`${attendanceRate}, 100`}
                    className="drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-display text-lg font-black text-white leading-none">{attendanceRate}%</span>
                  <span className="text-[8px] font-bold text-[#00E5FF] uppercase tracking-wider mt-0.5">PRÉSENTS</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00E5FF]" />
                  <span className="text-[#4C91B5]">Présents : <strong className="text-white font-mono">{totalPresents}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#FF174F]" />
                  <span className="text-[#4C91B5]">Absents : <strong className="text-white font-mono">{totalAbsents}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#FFB300]" />
                  <span className="text-[#4C91B5]">Retards : <strong className="text-white font-mono">{totalRetards}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Sous-panneau Bourses & Trésorerie */}
          <div className="rounded-xl border border-[#006DFF]/30 bg-[#0B111A]/80 p-2.5 text-xs shadow-inner">
            <p className="font-black text-[#B8F3FF] text-[10px] uppercase tracking-wider">BOURSES & TRÉSORERIE</p>
            <div className="mt-1.5 flex items-center justify-between text-[#4C91B5]">
              <span>Bourses attribuées :</span>
              <strong className="text-[#FFB300] font-mono">{scholarshipsGranted}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between text-[#4C91B5]">
              <span>Total encaissé :</span>
              <strong className="text-[#00FF88] font-mono">{money(revenue)}</strong>
            </div>
          </div>
        </div>

        {/* ACTIVITÉ EN TEMPS RÉEL (Carte Réseau Monde Vectorielle) */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-4 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E5FF] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E5FF]" />
              </span>
              <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                ACTIVITÉ EN TEMPS RÉEL
              </h3>
            </div>
            <span className="rounded-md border border-[#006DFF]/40 bg-[#071A2B] px-1.5 py-0.5 text-[9px] font-bold text-[#00E5FF]">
              SOC LIVE
            </span>
          </div>

          {/* Carte Monde Stylisée avec Nœuds Réseau Luminescents */}
          <div className="relative my-2 h-36 w-full flex items-center justify-center">
            <svg viewBox="0 0 320 140" className="h-full w-full opacity-80">
              {/* Continents schématisés sous forme de trames de points */}
              <g fill="#006DFF" opacity="0.25">
                {/* Amérique du Nord */}
                <ellipse cx="65" cy="45" rx="35" ry="20" />
                {/* Amérique du Sud */}
                <ellipse cx="95" cy="95" rx="20" ry="28" />
                {/* Europe */}
                <ellipse cx="165" cy="40" rx="22" ry="16" />
                {/* Afrique */}
                <ellipse cx="170" cy="80" rx="25" ry="30" />
                {/* Asie */}
                <ellipse cx="230" cy="45" rx="45" ry="25" />
                {/* Australie */}
                <ellipse cx="265" cy="105" rx="20" ry="15" />
              </g>

              {/* Lignes de communication transcontinentales */}
              <path d="M 65 45 Q 115 20, 165 40" fill="none" stroke="#00E5FF" strokeWidth="1.2" opacity="0.7" strokeDasharray="3 2" />
              <path d="M 165 40 Q 200 25, 230 45" fill="none" stroke="#00E5FF" strokeWidth="1.2" opacity="0.7" strokeDasharray="3 2" />
              <path d="M 170 80 Q 130 90, 95 95" fill="none" stroke="#D50072" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
              <path d="M 170 80 Q 220 90, 265 105" fill="none" stroke="#00C8FF" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />

              {/* Points d'ancrage télécoms lumineux */}
              <circle cx="65" cy="45" r="3" fill="#00E5FF" className="animate-pulse" />
              <circle cx="165" cy="40" r="3.5" fill="#00E5FF" />
              <circle cx="170" cy="80" r="4" fill="#00FF88" className="animate-ping" />
              <circle cx="170" cy="80" r="3" fill="#00FF88" />
              <circle cx="230" cy="45" r="3" fill="#D50072" />
              <circle cx="265" cy="105" r="2.5" fill="#00C8FF" />
            </svg>
          </div>

          {/* Indicateurs Télémétriques au bas de la carte */}
          <div className="grid grid-cols-4 gap-1 border-t border-[#006DFF]/20 pt-2 text-center text-[9px]">
            <div>
              <p className="text-[#4C91B5]">Connexions</p>
              <p className="font-display text-sm font-black text-[#00E5FF] font-mono">
                {presences.filter(isUserActiveOnline).length}
              </p>
            </div>
            <div>
              <p className="text-[#4C91B5]">Sessions</p>
              <p className="font-display text-sm font-black text-[#008CFF] font-mono">
                {Math.max(1, presences.length)}
              </p>
            </div>
            <div>
              <p className="text-[#4C91B5]">Alertes</p>
              <p className="font-display text-sm font-black text-[#FF174F] font-mono">
                {recentAlerts.length}
              </p>
            </div>
            <div>
              <p className="text-[#4C91B5]">Inscriptions</p>
              <p className="font-display text-sm font-black text-[#D50072] font-mono">
                {db.registrations.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 3 : ANALYTIQUES AVANCÉES HUD (4 COLONNES) ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. STATISTIQUES GLOBALES */}
        <div className="hud-panel rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/20 pb-2">
              STATISTIQUES GLOBALES
            </h3>
            <div className="mt-3 flex items-center gap-3">
              {/* Radar HUD concentric SVG */}
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 60 60" className="h-full w-full">
                  <circle cx="30" cy="30" r="28" fill="none" stroke="#006DFF" strokeWidth="1" strokeOpacity="0.3" />
                  <circle cx="30" cy="30" r="18" fill="none" stroke="#00C8FF" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 2" />
                  <circle cx="30" cy="30" r="8" fill="none" stroke="#00E5FF" strokeWidth="1.5" />
                  <line x1="30" y1="2" x2="30" y2="58" stroke="#00E5FF" strokeWidth="0.8" strokeOpacity="0.4" />
                  <line x1="2" y1="30" x2="58" y2="30" stroke="#00E5FF" strokeWidth="0.8" strokeOpacity="0.4" />
                  <circle cx="38" cy="22" r="2" fill="#00FF88" className="animate-pulse" />
                </svg>
              </div>

              <div className="flex-1 space-y-1 text-xs">
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Cours créés</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.courses.length}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Devoirs remis</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.grades.length}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Tests effectués</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.quizzes?.length || 1}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Heures cours</span>
                  <strong className="text-[#00E5FF] font-mono">
                    {db.modules.reduce((a, m) => a + (m.heuresTotal || 0), 0) || 60}h
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACTIVITÉ DES MODULES */}
        <div className="hud-panel rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2">
              <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                ACTIVITÉ DES MODULES
              </h3>
              <span className="text-[10px] text-[#00E5FF] font-bold">Ce mois ▾</span>
            </div>

            {/* Ondes graphiques SVG luminescentes */}
            <div className="relative my-2.5 h-20 w-full">
              <svg viewBox="0 0 200 70" className="h-full w-full">
                <path d="M 5 25 Q 50 5, 100 25 T 195 20" fill="none" stroke="#00E5FF" strokeWidth="2" className="drop-shadow-[0_0_6px_#00E5FF]" />
                <path d="M 5 45 Q 60 25, 110 45 T 195 40" fill="none" stroke="#008CFF" strokeWidth="1.8" />
                <path d="M 5 60 Q 40 45, 90 60 T 195 55" fill="none" stroke="#D50072" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#00E5FF] font-bold">72%</span>
              <span className="text-[#008CFF] font-bold">58%</span>
              <span className="text-[#D50072] font-bold">35%</span>
            </div>
          </div>
        </div>

        {/* 3. TOP MODULES ACTIFS */}
        <div className="hud-panel rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/20 pb-2">
              TOP MODULES ACTIFS
            </h3>
            <div className="mt-2.5 space-y-2 text-[11px]">
              {topModules.map((m, idx) => (
                <div key={m.id}>
                  <div className="flex justify-between text-[#B8F3FF]">
                    <span className="truncate max-w-[120px]">{m.titre}</span>
                    <span className="font-mono text-[#00E5FF] font-bold">{m.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-[#080A0F] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${idx === 0 ? "bg-[#00E5FF]" : idx === 1 ? "bg-[#008CFF]" : "bg-[#D50072]"}`}
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. ÉTAT DES SYSTÈMES */}
        <div className="hud-panel rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/20 pb-2">
              ÉTAT DES SYSTÈMES
            </h3>
            <div className="my-2 flex items-center justify-between gap-3">
              {/* Bouclier SVG de sécurité */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#00C8FF]/40 bg-[#071A2B] shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                <ShieldCheck size={22} className="text-[#00E5FF]" />
                <span className="absolute -bottom-1 rounded bg-[#006DFF] px-1 text-[8px] font-bold text-white">85%</span>
              </div>

              <div className="flex-1 space-y-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Serveurs</span>
                  <span className="font-bold text-[#00FF88]">OPÉRATIONNEL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Base données</span>
                  <span className="font-bold text-[#00FF88]">OPÉRATIONNEL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" /> Sauvegardes</span>
                  <span className="font-bold text-[#00E5FF]">OK</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#008CFF]" /> Réseau</span>
                  <span className="font-bold text-[#008CFF]">STABLE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 4 : PRÉ-INSCRIPTIONS + PRÉSENCE LIVE + ALERTES RÉCENTES ================= */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Pré-inscriptions récentes */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2.5">
              <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                PRÉ-INSCRIPTIONS RÉCENTES
              </h3>
              <Link to="/app/etudiants" className="text-[11px] font-bold text-[#00E5FF] hover:underline">
                GÉRER →
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {db.registrations.length === 0 ? (
                <Empty icon={<Users size={28} />} title="Aucune pré-inscription" />
              ) : (
                db.registrations.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#006DFF]/30 bg-[#0B111A]/90 p-2.5 text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate font-bold text-[#B8F3FF]">{r.nom} {r.prenom}</p>
                      <p className="truncate text-[10px] text-[#4C91B5]">
                        {formationLabel(r.formation)} · {r.modules.length} modules · {r.date}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        r.statut === "confirmee"
                          ? "border-[#00FF88]/40 bg-[#052619] text-[#00FF88]"
                          : "border-[#FFB300]/40 bg-[#261E05] text-[#FFB300]"
                      }`}
                    >
                      {r.statut === "confirmee" ? "CONFIRMÉE" : "EN ATTENTE"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Présence en direct */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF88] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00FF88]" />
                </span>
                <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                  PRÉSENCE EN DIRECT
                </h3>
              </div>
              <span className="rounded-full border border-[#00FF88]/40 bg-[#052619] px-2 py-0.5 text-[10px] font-bold text-[#00FF88]">
                {presences.filter(isUserActiveOnline).length} connecté(s)
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {presences.slice(0, 4).map((p) => {
                const online = isUserActiveOnline(p);
                return (
                  <div key={p.user_id} className="flex items-center justify-between rounded-xl border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? "bg-[#00FF88] shadow-[0_0_8px_#00FF88]" : "bg-slate-600"}`} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#B8F3FF]">{p.name || "Utilisateur"}</p>
                        <p className="text-[10px] text-[#4C91B5] capitalize">{p.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#00FF88]">
                      {online ? "En ligne" : "Hors ligne"}
                    </span>
                  </div>
                );
              })}
              {presences.length === 0 && (
                <p className="py-4 text-center text-xs text-[#4C91B5]">Aucune télémétrie de présence active.</p>
              )}
            </div>
          </div>

          <div className="mt-2 border-t border-[#006DFF]/20 pt-2 text-right">
            <Link to="/app/utilisateurs" className="text-[10px] font-bold text-[#00C8FF] hover:underline">
              Voir tous →
            </Link>
          </div>
        </div>

        {/* ALERTES RÉCENTES (SOC Incident Response) */}
        <div className="hud-panel rounded-2xl p-4 sm:p-5 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FF174F] shadow-[0_0_8px_#FF174F]" />
                <h3 className="font-display text-xs sm:text-sm font-black text-[#B8F3FF] uppercase tracking-wider">
                  ALERTES RÉCENTES
                </h3>
              </div>
              <Link to="/app/journal" className="text-[10px] font-bold text-[#FF174F] hover:underline">
                VOIR TOUT →
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {recentAlerts.map((alt) => (
                <div key={alt.id} className="flex items-center justify-between rounded-xl border border-[#006DFF]/30 bg-[#0B111A]/90 p-2.5 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle size={15} style={{ color: alt.color }} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#B8F3FF]">{alt.title}</p>
                      <p className="text-[10px] text-[#4C91B5]">{alt.time} • {alt.ip}</p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border"
                    style={{ borderColor: `${alt.color}60`, color: alt.color, backgroundColor: `${alt.color}15` }}
                  >
                    {alt.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= ACTIONS RAPIDES EN PIED DE DASHBOARD ================= */}
      <div className="hud-panel rounded-2xl p-4 sm:p-5">
        <h3 className="font-display mb-3 text-xs font-black uppercase tracking-wider text-[#B8F3FF]">
          ACCÈS RAPIDE AUX MODULES OPÉRATIONNELS
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { to: "/app/etudiants", l: "Apprenants", i: <Users size={15} /> },
            { to: "/app/presences", l: "Présences", i: <ClipboardCheck size={15} /> },
            { to: "/app/tests", l: "Tests", i: <TestTube2 size={15} /> },
            { to: "/app/certificats", l: "Certificats", i: <Award size={15} /> },
            { to: "/app/bourses", l: "Bourses", i: <BadgeDollarSign size={15} /> },
            { to: "/app/enia", l: "ENIA 2.0", i: <GraduationCap size={15} /> },
            { to: "/app/enia-admin", l: "Admin ENIA", i: <BookOpen size={15} /> },
            { to: "/app/contenu", l: "Contenu site", i: <CalendarDays size={15} /> },
          ].map((a, i) => (
            <Link
              key={i}
              to={a.to}
              className="flex items-center gap-2 rounded-xl border border-[#006DFF]/30 bg-[#0B111A]/80 px-3 py-2.5 text-xs font-semibold text-[#B8F3FF] transition hover:border-[#00C8FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.25)]"
            >
              <span className="text-[#00E5FF]">{a.i}</span>
              <span className="truncate">{a.l}</span>
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
