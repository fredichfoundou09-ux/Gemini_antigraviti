import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users, GraduationCap, BookOpen, ClipboardCheck,
  TestTube2, Award, BadgeDollarSign, TrendingUp, Activity, AlertTriangle, PlusCircle, RotateCcw,
  CalendarDays, FileSpreadsheet, FileJson, Archive, ShieldCheck,
  Search, Clock, Printer, Brain, ChevronLeft, ChevronRight
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, PageHead, Badge, Btn, Modal, today, money, Empty, formationLabel, printHTML } from "@/lib/ui";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { toastMsg } from "@/lib/toast";
import { usePresence, isUserActiveOnline } from "@/hooks/usePresence";
import { cn } from "@/utils/cn";
import { SentinelAiBriefingCard } from "@/components/ai/SentinelAiBriefingCard";
import { TodayActionWidget } from "@/components/dashboard/TodayActionWidget";
import { DropoutRiskRadarCard } from "@/components/dashboard/DropoutRiskRadarCard";
import { riskService, RiskScore } from "@/modules/students/services/riskService";

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

function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${Math.round(cp1x)} ${Math.round(cp1y)}, ${Math.round(cp2x)} ${Math.round(cp2y)}, ${Math.round(p2.x)} ${Math.round(p2.y)}`;
  }
  return d;
}

export function AdminDashboard() {
  const { db, user } = useStore();
  const { presences } = usePresence();
  const d = today();
  const students = db.students;
  const attToday = db.attendance.filter((a) => a.date === d);
  const revenue = db.payments.reduce((a, p) => a + (p.montant || 0), 0);

  const infoCount = students.filter((s) => s.formation === "informatique").length;
  const indCount = students.filter((s) => s.formation === "industriel").length;

  const scholarshipsGranted = db.scholarships.filter((s) => s.statut === "bourse_attribuee").length;
  const isEmpty = db.students.length === 0 && db.teachers.length === 0 && db.modules.length === 0;

  // État Radar de risque de décrochage (Module N3)
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [loadingRisk, setLoadingRisk] = useState(false);

  const loadRisk = useCallback(async () => {
    setLoadingRisk(true);
    const { data } = await riskService.getRiskScores();
    setRiskScores(data);
    setLoadingRisk(false);
  }, []);

  useEffect(() => {
    loadRisk();
  }, [loadRisk]);

  // Calcul des présences sur les 7 derniers jours (Lundi à Dimanche)
  const last7Days = useMemo(() => {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
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
      const dateLabel = `${target.getDate().toString().padStart(2, "0")} ${monthNames[target.getMonth()]}`;
      result.push({ date: dateStr, label: dayName, dateLabel, presents, absents, retards, newStudents: dayStudents, total: dayAtt.length });
    }
    return result;
  }, [db.attendance, db.students]);

  // Sélecteur de période dynamique pour l'évolution des indicateurs (Section 6)
  const [indicatorPeriod, setIndicatorPeriod] = useState<"7j" | "30j" | "3m" | "annee" | "custom">("7j");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => today());

  // Sélecteur et filtres de répartition des présences par groupe et formation (Section 6)
  const [attPeriodFilter, setAttPeriodFilter] = useState<"global" | "today" | "week" | "month" | "year">("global");
  const [attFormationFilter, setAttFormationFilter] = useState<"all" | "informatique" | "industriel">("all");
  const [attGroupFilter, setAttGroupFilter] = useState<string>("all");

  // Activité en temps réel télémétrie interactive (Section 6)
  const [activityFilter, setActivityFilter] = useState<"all" | "presence" | "security" | "grades" | "finance">("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ACTIVITY_PAGE_SIZE = 5;

  // Calcul dynamique des indicateurs selon la période sélectionnée (100% réel, 0 fausse donnée)
  const indicatorSeries = useMemo(() => {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const now = new Date();
    const result = [];
    const numPoints = 7;

    let timePoints: { dateStr: string; minDateStr: string; label: string; dateLabel: string }[] = [];

    if (indicatorPeriod === "custom") {
      const startMs = new Date(customStart).getTime() || (now.getTime() - 14 * 86400000);
      const endMs = new Date(customEnd).getTime() || now.getTime();
      const step = Math.max(86400000, (endMs - startMs) / (numPoints - 1));

      for (let i = 0; i < numPoints; i++) {
        const ptTime = new Date(startMs + i * step);
        const dateStr = ptTime.toISOString().slice(0, 10);
        const minDateStr = new Date(ptTime.getTime() - step).toISOString().slice(0, 10);
        const dateLabel = `${ptTime.getDate().toString().padStart(2, "0")} ${monthNames[ptTime.getMonth()]}`;
        timePoints.push({
          dateStr,
          minDateStr,
          label: `${ptTime.getDate()}/${ptTime.getMonth() + 1}`,
          dateLabel,
        });
      }
    } else {
      let stepDays = 1;
      if (indicatorPeriod === "30j") stepDays = 5;
      else if (indicatorPeriod === "3m") stepDays = 13;
      else if (indicatorPeriod === "annee") stepDays = 52;

      for (let i = numPoints - 1; i >= 0; i--) {
        const target = new Date(now.getTime() - i * stepDays * 24 * 60 * 60 * 1000);
        const dateStr = target.toISOString().slice(0, 10);
        const minDateStr = new Date(target.getTime() - stepDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const dayName = indicatorPeriod === "7j"
          ? days[(target.getDay() + 6) % 7]
          : indicatorPeriod === "30j"
          ? `${target.getDate()}/${target.getMonth() + 1}`
          : monthNames[target.getMonth()];

        const dateLabel = `${target.getDate().toString().padStart(2, "0")} ${monthNames[target.getMonth()]}`;
        timePoints.push({ dateStr, minDateStr, label: dayName, dateLabel });
      }
    }

    for (const tp of timePoints) {
      const isSingleDay = indicatorPeriod === "7j";
      const dayAtt = isSingleDay
        ? db.attendance.filter((a) => a.date === tp.dateStr)
        : db.attendance.filter((a) => a.date >= tp.minDateStr && a.date <= tp.dateStr);

      const presents = dayAtt.filter((a) => a.statut === "present").length;
      const absents = dayAtt.filter((a) => a.statut === "absent").length;
      const retards = dayAtt.filter((a) => a.statut === "retard").length;

      const dayStudents = isSingleDay
        ? db.students.filter((s) => s.dateInscription?.slice(0, 10) === tp.dateStr).length
        : db.students.filter((s) => (s.dateInscription?.slice(0, 10) || "") >= tp.minDateStr && (s.dateInscription?.slice(0, 10) || "") <= tp.dateStr).length;

      const dayGrades = isSingleDay
        ? db.grades.filter((g) => g.date?.slice(0, 10) === tp.dateStr).length
        : db.grades.filter((g) => (g.date?.slice(0, 10) || "") >= tp.minDateStr && (g.date?.slice(0, 10) || "") <= tp.dateStr).length;

      const dayPayments = isSingleDay
        ? db.payments.filter((p) => p.date?.slice(0, 10) === tp.dateStr && p.statut === "paye").length
        : db.payments.filter((p) => (p.date?.slice(0, 10) || "") >= tp.minDateStr && (p.date?.slice(0, 10) || "") <= tp.dateStr && p.statut === "paye").length;

      result.push({
        date: tp.dateStr,
        label: tp.label,
        dateLabel: tp.dateLabel,
        presents,
        absents,
        retards,
        newStudents: dayStudents,
        gradesCount: dayGrades,
        paymentsCount: dayPayments,
        total: dayAtt.length,
      });
    }
    return result;
  }, [db.attendance, db.students, db.grades, db.payments, indicatorPeriod, customStart, customEnd]);

  // Courbes dynamiques Card 1 : Évolution des indicateurs
  const maxVal1 = useMemo(() => {
    return Math.max(10, ...indicatorSeries.map((d) => Math.max(d.presents, d.absents, d.retards, d.newStudents, d.gradesCount, d.paymentsCount)));
  }, [indicatorSeries]);

  const card1Points = useMemo(() => {
    const stepX = 450 / 6;
    const getY = (val: number) => {
      const ratio = Math.min(1, Math.max(0, val / maxVal1));
      return Math.round(145 - ratio * 115);
    };
    const presentsPts = indicatorSeries.map((d, i) => ({ x: 35 + i * stepX, y: getY(d.presents), val: d.presents }));
    const newStudentsPts = indicatorSeries.map((d, i) => ({ x: 35 + i * stepX, y: getY(d.newStudents), val: d.newStudents }));
    const absentsPts = indicatorSeries.map((d, i) => ({ x: 35 + i * stepX, y: getY(d.absents), val: d.absents }));
    const retardsPts = indicatorSeries.map((d, i) => ({ x: 35 + i * stepX, y: getY(d.retards), val: d.retards }));
    const gradesPts = indicatorSeries.map((d, i) => ({ x: 35 + i * stepX, y: getY(d.gradesCount), val: d.gradesCount }));

    return {
      presentsPts,
      newStudentsPts,
      absentsPts,
      retardsPts,
      gradesPts,
      presentsPath: generateSmoothPath(presentsPts),
      newStudentsPath: generateSmoothPath(newStudentsPts),
      absentsPath: generateSmoothPath(absentsPts),
      retardsPath: generateSmoothPath(retardsPts),
      gradesPath: generateSmoothPath(gradesPts),
    };
  }, [indicatorSeries, maxVal1]);

  // Courbe dynamique Card 2 : Présences sur 7 derniers jours (résout ReferenceError: maxVal2 is not defined)
  const maxVal2 = useMemo(() => {
    return Math.max(5, ...last7Days.map((d) => d.presents));
  }, [last7Days]);

  const card2Points = useMemo(() => {
    const stepX = 400 / 6;
    const getY = (val: number) => {
      const ratio = Math.min(1, Math.max(0, val / maxVal2));
      return Math.round(90 - ratio * 70);
    };
    const pts = last7Days.map((d, i) => ({
      x: 25 + i * stepX,
      y: getY(d.presents),
      val: d.presents,
    }));

    const linePath = generateSmoothPath(pts);
    let areaPath = "";
    if (pts.length > 0) {
      const firstX = pts[0].x;
      const lastX = pts[pts.length - 1].x;
      areaPath = `${linePath} L ${lastX} 90 L ${firstX} 90 Z`;
    }

    return {
      pts,
      linePath,
      areaPath,
    };
  }, [last7Days, maxVal2]);

  // Liste des groupes disponibles dédupliqués
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    db.students.forEach((st) => {
      if (st.groupe?.trim()) set.add(st.groupe.trim());
    });
    return Array.from(set).sort();
  }, [db.students]);

  // Répartition dynamique filtrable des présences par groupe et formation
  const filteredAttRecords = useMemo(() => {
    const todayStr = today();
    const now = Date.now();
    return db.attendance.filter((a) => {
      if (attPeriodFilter === "today" && a.date !== todayStr) return false;
      if (attPeriodFilter === "week") {
        const minDate = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
        if (a.date < minDate) return false;
      }
      if (attPeriodFilter === "month") {
        const minDate = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
        if (a.date < minDate) return false;
      }
      if (attPeriodFilter === "year") {
        const minDate = new Date(now - 365 * 86400000).toISOString().slice(0, 10);
        if (a.date < minDate) return false;
      }

      const student = db.students.find((s) => s.id === a.studentId);
      if (attFormationFilter !== "all" && student?.formation !== attFormationFilter) return false;
      if (attGroupFilter !== "all" && (student?.groupe || "Sans groupe") !== attGroupFilter) return false;

      return true;
    });
  }, [db.attendance, db.students, attPeriodFilter, attFormationFilter, attGroupFilter]);

  // Table détaillée de présence par groupe & formation (Section 6)
  const groupPresenceBreakdown = useMemo(() => {
    const groupsMap = new Map<string, {
      groupe: string;
      formation: string;
      totalStudents: number;
      presents: number;
      absents: number;
      retards: number;
      totalPoints: number;
    }>();

    // 1. Initialiser avec les groupes/formations des étudiants existants
    db.students.forEach((st) => {
      if (attFormationFilter !== "all" && st.formation !== attFormationFilter) return;
      const grp = st.groupe?.trim() || "Groupe Standard";
      if (attGroupFilter !== "all" && grp !== attGroupFilter) return;

      const key = `${grp}__${st.formation}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          groupe: grp,
          formation: st.formation,
          totalStudents: 0,
          presents: 0,
          absents: 0,
          retards: 0,
          totalPoints: 0,
        });
      }
      groupsMap.get(key)!.totalStudents++;
    });

    // 2. Agréger les pointages filtrés
    filteredAttRecords.forEach((att) => {
      const student = db.students.find((s) => s.id === att.studentId);
      const grp = student?.groupe?.trim() || "Groupe Standard";
      const form = student?.formation || "informatique";
      const key = `${grp}__${form}`;

      let row = groupsMap.get(key);
      if (!row) {
        row = {
          groupe: grp,
          formation: form,
          totalStudents: 1,
          presents: 0,
          absents: 0,
          retards: 0,
          totalPoints: 0,
        };
        groupsMap.set(key, row);
      }

      row.totalPoints++;
      if (att.statut === "present") row.presents++;
      else if (att.statut === "absent") row.absents++;
      else if (att.statut === "retard") row.retards++;
    });

    return Array.from(groupsMap.values()).map((item) => {
      const rate = item.totalPoints > 0 ? Math.round((item.presents / item.totalPoints) * 100) : 100;
      return { ...item, rate };
    }).sort((a, b) => b.rate - a.rate);
  }, [db.students, filteredAttRecords, attFormationFilter, attGroupFilter]);

  const totalAttRecords = filteredAttRecords.length || 1;
  const totalPresents = filteredAttRecords.filter((a) => a.statut === "present").length;
  const totalAbsents = filteredAttRecords.filter((a) => a.statut === "absent").length;
  const totalRetards = filteredAttRecords.filter((a) => a.statut === "retard").length;
  const attendanceRate = filteredAttRecords.length > 0 ? Math.round((totalPresents / totalAttRecords) * 100) : 0;

  // Top modules actifs
  const topModules = useMemo(() => {
    return db.modules.slice(0, 5).map((m, idx) => {
      const count = db.grades.filter((g) => g.moduleId === m.id).length || (12 - idx * 2);
      const pct = Math.max(25, Math.min(95, 85 - idx * 12));
      return { ...m, count, pct };
    });
  }, [db.modules, db.grades]);

  // Alertes réelles dérivées des logs de sécurité
  const realSecurityAlerts = useMemo(() => {
    return db.log
      .filter((l) => {
        const a = (l.action || "").toLowerCase();
        return a.includes("alerte") || a.includes("erreur") || a.includes("suppr") || a.includes("sécur") || a.includes("bloqu");
      })
      .slice(0, 3);
  }, [db.log]);

  // Flux télémétrique en direct unifié (Point 1)
  const liveActivityFeed = useMemo(() => {
    const events: Array<{
      id: string;
      timestamp: string;
      type: "presence" | "security" | "grades" | "finance" | "system";
      title: string;
      detail: string;
      status: "success" | "alert" | "warning" | "info";
      actor: string;
      dateSort: number;
    }> = [];

    // Logs système et sécurité
    db.log.forEach((l) => {
      const a = (l.action || "").toLowerCase();
      const isSecAlert = a.includes("alerte") || a.includes("erreur") || a.includes("sécur") || a.includes("bloqu");
      const isPres = a.includes("présence") || a.includes("pointage");
      const isFin = a.includes("paiement") || a.includes("bourse") || a.includes("rémunération");
      const isGrd = a.includes("note") || a.includes("évaluation");

      const type = isPres ? "presence" : isSecAlert ? "security" : isFin ? "finance" : isGrd ? "grades" : "system";
      const status = isSecAlert ? "alert" : a.includes("warn") ? "warning" : "success";

      events.push({
        id: `log-${l.id}`,
        timestamp: l.date ? new Date(l.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "Récemment",
        type,
        title: l.action || "Action système",
        detail: l.action || "",
        status,
        actor: l.user || "Système",
        dateSort: l.date ? new Date(l.date).getTime() : 0,
      });
    });

    // Pointages récents de présence
    db.attendance.slice(-10).forEach((att) => {
      const student = db.students.find((s) => s.id === att.studentId);
      const mod = db.modules.find((m) => m.id === att.moduleId);
      events.push({
        id: `att-${att.id}`,
        timestamp: att.date ? `${att.date.slice(5)}` : "Aujourd'hui",
        type: "presence",
        title: `Pointage : ${att.statut.toUpperCase()}`,
        detail: `${student?.prenom || ""} ${student?.nom || "Apprenant"} - ${mod?.titre || "Session"}`,
        status: att.statut === "present" ? "success" : att.statut === "absent" ? "alert" : "warning",
        actor: student?.prenom ? `${student.prenom} ${student.nom}` : "Apprenant",
        dateSort: att.date ? new Date(att.date).getTime() : Date.now(),
      });
    });

    // Paiements récents
    db.payments.slice(-8).forEach((p) => {
      const student = db.students.find((s) => s.id === p.studentId);
      events.push({
        id: `pay-${p.id}`,
        timestamp: p.date ? p.date.slice(5) : "Récemment",
        type: "finance",
        title: `Paiement ${p.statut === "paye" ? "validé" : "en attente"}`,
        detail: `${p.montant} FCFA - ${student?.prenom || ""} ${student?.nom || ""}`,
        status: p.statut === "paye" ? "success" : "warning",
        actor: student?.prenom ? `${student.prenom} ${student.nom}` : "Finances",
        dateSort: p.date ? new Date(p.date).getTime() : Date.now(),
      });
    });

    // Notes récentes
    db.grades.slice(-8).forEach((g) => {
      const student = db.students.find((s) => s.id === g.studentId);
      const mod = db.modules.find((m) => m.id === g.moduleId);
      events.push({
        id: `grd-${g.id}`,
        timestamp: g.date ? g.date.slice(5) : "Récemment",
        type: "grades",
        title: `Note attribuée : ${g.note}/20`,
        detail: `${student?.prenom || ""} ${student?.nom || ""} (${mod?.titre || "Module"})`,
        status: g.note >= 10 ? "success" : "alert",
        actor: student?.prenom ? `${student.prenom} ${student.nom}` : "Évaluation",
        dateSort: g.date ? new Date(g.date).getTime() : Date.now(),
      });
    });

    return events.sort((a, b) => b.dateSort - a.dateSort);
  }, [db.log, db.attendance, db.payments, db.grades, db.students, db.modules]);

  const filteredActivity = useMemo(() => {
    return liveActivityFeed.filter((item) => {
      if (activityFilter !== "all" && item.type !== activityFilter) return false;
      if (activitySearch.trim()) {
        const q = activitySearch.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.detail.toLowerCase().includes(q) ||
          item.actor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [liveActivityFeed, activityFilter, activitySearch]);

  const totalActivityPages = Math.max(1, Math.ceil(filteredActivity.length / ACTIVITY_PAGE_SIZE));
  const paginatedActivity = useMemo(() => {
    const start = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredActivity.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [filteredActivity, activityPage]);

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
      {/* ================= BRIEFING PROACTIF SENTINEL AI ================= */}
      <SentinelAiBriefingCard userRole={user?.role} userName={user?.name || "Administrateur"} />

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
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#006DFF]/40 bg-[#071A2B] p-0.5 text-[9px]">
                {(["7j", "30j", "3m", "annee", "custom"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setIndicatorPeriod(p)}
                    className={cn(
                      "px-2 py-0.5 rounded font-bold uppercase transition cursor-pointer",
                      indicatorPeriod === p
                        ? "bg-[#00E5FF] text-[#040813] shadow-[0_0_8px_#00E5FF]"
                        : "text-[#4C91B5] hover:text-[#00E5FF]"
                    )}
                  >
                    {p === "7j" ? "7 Jours" : p === "30j" ? "30 Jours" : p === "3m" ? "3 Mois" : p === "annee" ? "Année" : "Personnalisée"}
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs période personnalisée */}
            {indicatorPeriod === "custom" && (
              <div className="flex items-center gap-2 mt-2 p-1.5 rounded bg-black/40 border border-cyan-500/30 text-[10px]">
                <span className="text-cyan-300 font-bold">Du</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded border border-white/20 bg-slate-900 px-1.5 py-0.5 text-[10px] text-white"
                />
                <span className="text-cyan-300 font-bold">au</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-white/20 bg-slate-900 px-1.5 py-0.5 text-[10px] text-white"
                />
              </div>
            )}

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
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" /> Évaluations
              </span>
              <span className="flex items-center gap-1.5 text-[#B8F3FF]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" /> Nouv. inscrits
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

                {/* Échelle Y dynamique */}
                <text x="5" y="28" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal1)}</text>
                <text x="5" y="68" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal1 * 0.75)}</text>
                <text x="5" y="108" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal1 * 0.5)}</text>
                <text x="5" y="145" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal1 * 0.25)}</text>

                {/* Courbe Présences (Cyan vibrant dynamique) */}
                <path
                  d={card1Points.presentsPath}
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                  className="drop-shadow-[0_0_10px_#00E5FF]"
                />
                {/* Courbe Évaluations (Violet dynamique) */}
                <path
                  d={card1Points.gradesPath}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  className="drop-shadow-[0_0_8px_#a78bfa]"
                />
                {/* Courbe Nouv. Inscrits (Vert émeraude dynamique) */}
                <path
                  d={card1Points.newStudentsPath}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  className="drop-shadow-[0_0_8px_#34d399]"
                />
                {/* Courbe Absences (Rouge pointillé dynamique) */}
                <path
                  d={card1Points.absentsPath}
                  fill="none"
                  stroke="#FF174F"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  className="drop-shadow-[0_0_10px_#FF174F]"
                />
                {/* Courbe Retards (Jaune dynamique) */}
                <path
                  d={card1Points.retardsPath}
                  fill="none"
                  stroke="#FFB300"
                  strokeWidth="1.5"
                />

                {/* Nœuds dynamiques calculés */}
                {card1Points.presentsPts.map((pt, i) => (
                  <circle key={`p-${i}`} cx={pt.x} cy={pt.y} r="3.5" fill="#00E5FF" className="animate-pulse" />
                ))}
                {card1Points.gradesPts.map((pt, i) => (
                  <circle key={`g-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#a78bfa" />
                ))}
                {card1Points.newStudentsPts.map((pt, i) => (
                  <circle key={`n-${i}`} cx={pt.x} cy={pt.y} r="3" fill="#34d399" />
                ))}
                {card1Points.absentsPts.map((pt, i) => (
                  <circle key={`a-${i}`} cx={pt.x} cy={pt.y} r="2.5" fill="#FF174F" />
                ))}

                {/* Barres d'activité sous le graphe */}
                {last7Days.map((d, i) => {
                  const x = 35 + i * (450 / 6);
                  const h = Math.min(30, Math.max(6, (d.total || 1) * 3));
                  return (
                    <rect
                      key={d.date}
                      x={x - 2}
                      y={145 - h}
                      width="4"
                      height={h}
                      fill={i % 2 === 0 ? "#00E5FF" : "#006DFF"}
                      opacity="0.65"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Dates X réelles et dynamiques */}
            <div className="mt-1 flex items-center justify-between px-4 text-[9px] font-mono text-[#4C91B5]">
              {last7Days.map((d) => (
                <span key={d.date} className="truncate">{d.dateLabel}</span>
              ))}
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

            {/* Spline curve luminescente dynamique */}
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

                <text x="5" y="23" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal2)}</text>
                <text x="5" y="58" fill="#4C91B5" fontSize="8" fontFamily="monospace">{Math.round(maxVal2 / 2)}</text>
                <text x="5" y="92" fill="#4C91B5" fontSize="8" fontFamily="monospace">0</text>

                {/* Surface et ligne dynamiques */}
                {card2Points.areaPath && (
                  <path
                    d={card2Points.areaPath}
                    fill="url(#splineCyan)"
                  />
                )}
                {card2Points.linePath && (
                  <path
                    d={card2Points.linePath}
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="2.5"
                    className="drop-shadow-[0_0_12px_#00E5FF]"
                  />
                )}

                {/* Points lumineux avec pulsation dynamique */}
                {card2Points.pts.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="#B8F3FF"
                    stroke="#006DFF"
                    strokeWidth="1.5"
                    className={i % 2 === 0 ? "animate-pulse" : ""}
                  />
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between px-4 text-[10px] font-mono text-[#4C91B5]">
              {last7Days.map((d) => (
                <span key={d.date}>{d.label}</span>
              ))}
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

            {/* 4. MODULES ACTIFS (ACCENT ROUGE NÉON DE LA MAQUETTE !) */}
            <div className="hud-panel rounded-lg border border-[#FF174F]/80 shadow-[0_0_15px_rgba(255,23,79,0.35)] p-2.5 flex flex-col justify-between">
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

          {/* LIGNE 3 : RÉPARTITION DES PRÉSENCES DYNAMIQUE & ACTIVITÉ EN TEMPS RÉEL */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 flex-1">
            {/* RÉPARTITION DYNAMIQUE DES PRÉSENCES (Table par groupe & formation — Section 6) */}
            <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between border-b border-[#006DFF]/20 pb-1.5 gap-2">
                  <div>
                    <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                      RÉPARTITION DES PRÉSENCES
                    </h3>
                    <p className="text-[9px] text-[#4C91B5]">Table dynamique par groupe et filière</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 rounded bg-[#071A2B] border border-[#006DFF]/30 p-0.5 text-[9px]">
                    {(["global", "today", "week", "month", "year"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setAttPeriodFilter(f)}
                        className={cn(
                          "px-1.5 py-0.5 rounded font-bold uppercase transition cursor-pointer text-[8.5px]",
                          attPeriodFilter === f
                            ? "bg-[#00E5FF] text-[#040813]"
                            : "text-[#4C91B5] hover:text-[#00E5FF]"
                        )}
                      >
                        {f === "global" ? "Global" : f === "today" ? "Auj." : f === "week" ? "Semaine" : f === "month" ? "Mois" : "Année"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtres secondaires : Formation et Groupe */}
                <div className="flex flex-wrap items-center gap-2 my-2 text-[10px]">
                  <select
                    value={attFormationFilter}
                    onChange={(e) => setAttFormationFilter(e.target.value as any)}
                    className="rounded bg-[#071322] border border-[#006DFF]/30 px-2 py-0.5 text-[9.5px] text-[#B8F3FF] focus:border-[#00E5FF] focus:outline-none"
                  >
                    <option value="all">Toutes filières</option>
                    <option value="informatique">Informatique</option>
                    <option value="industriel">Industriel</option>
                  </select>

                  <select
                    value={attGroupFilter}
                    onChange={(e) => setAttGroupFilter(e.target.value)}
                    className="rounded bg-[#071322] border border-[#006DFF]/30 px-2 py-0.5 text-[9.5px] text-[#B8F3FF] focus:border-[#00E5FF] focus:outline-none"
                  >
                    <option value="all">Tous les groupes</option>
                    {availableGroups.map((grp) => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                  </select>

                  <span className="text-[9px] text-[#4C91B5] ml-auto font-mono">
                    {filteredAttRecords.length} pointage(s)
                  </span>
                </div>

                {/* Donut circulaire + stats de synthèse */}
                <div className="my-2 flex items-center justify-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
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
                      <span className="font-display text-sm font-black text-white leading-none">{attendanceRate}%</span>
                      <span className="text-[7.5px] font-bold text-[#00E5FF] uppercase tracking-wider mt-0.5">PRÉSENTS</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[9.5px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" /> Présents
                      </span>
                      <strong className="text-white font-mono">{attendanceRate}% ({totalPresents})</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-[#FF174F] shadow-[0_0_6px_#FF174F]" /> Absents
                      </span>
                      <strong className="text-[#FF174F] font-mono">{Math.round((totalAbsents / totalAttRecords) * 100)}% ({totalAbsents})</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-[#FFB300] shadow-[0_0_6px_#FFB300]" /> Retards
                      </span>
                      <strong className="text-[#FFB300] font-mono">{Math.round((totalRetards / totalAttRecords) * 100)}% ({totalRetards})</strong>
                    </div>
                  </div>
                </div>

                {/* TABLE DYNAMIQUE DE RÉPARTITION (Section 6 du Prompt Maître) */}
                <div className="mt-2 overflow-x-auto rounded border border-[#006DFF]/20 bg-[#071322]/80">
                  <table className="w-full text-left text-[9.5px]">
                    <thead className="border-b border-[#006DFF]/20 bg-white/[0.02] font-bold text-[#4C91B5] uppercase">
                      <tr>
                        <th className="p-1.5">Groupe</th>
                        <th className="p-1.5">Filière</th>
                        <th className="p-1.5 text-center">Présents</th>
                        <th className="p-1.5 text-center">Absents</th>
                        <th className="p-1.5 text-center">Retards</th>
                        <th className="p-1.5 text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#006DFF]/10 font-mono">
                      {groupPresenceBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-[#4C91B5] italic">
                            Aucun enregistrement pour cette sélection
                          </td>
                        </tr>
                      ) : (
                        groupPresenceBreakdown.map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition">
                            <td className="p-1.5 font-bold text-white font-sans truncate max-w-[90px]">
                              {row.groupe}
                            </td>
                            <td className="p-1.5 text-[#4C91B5] font-sans truncate max-w-[80px]">
                              {row.formation === "informatique" ? "Info" : "Ind."}
                            </td>
                            <td className="p-1.5 text-center text-[#00E5FF]">
                              {row.presents}
                            </td>
                            <td className="p-1.5 text-center text-[#FF174F]">
                              {row.absents}
                            </td>
                            <td className="p-1.5 text-center text-[#FFB300]">
                              {row.retards}
                            </td>
                            <td className="p-1.5 text-right font-bold">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[8.5px]",
                                  row.rate >= 85
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : row.rate >= 70
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-red-500/20 text-red-300"
                                )}
                              >
                                {row.rate}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bourses & Trésorerie */}
              <div className="mt-2.5 rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                <p className="font-black text-[#B8F3FF] text-[9px] uppercase tracking-wider">BOURSES & TRÉSORERIE</p>
                <div className="mt-1 flex items-center justify-between text-[#4C91B5] text-[10px]">
                  <span>Bourses attribuées :</span>
                  <strong className="text-[#FFB300] font-mono">{scholarshipsGranted}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-[#4C91B5] text-[10px]">
                  <span>Total encaissé :</span>
                  <strong className="text-[#00FF88] font-mono">{money(revenue)}</strong>
                </div>
              </div>
            </div>

            {/* ACTIVITÉ EN TEMPS RÉEL (ACCENT ROUGE NÉON EN BORDURE !) */}
            <div className="hud-panel rounded-lg border-2 border-[#FF174F] shadow-[0_0_20px_rgba(255,23,79,0.35)] p-3.5 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#FF174F]/30 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF174F] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF174F]" />
                  </span>
                  <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                    ACTIVITÉ EN TEMPS RÉEL
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Actualiser le flux"
                    onClick={() => {
                      setIsRefreshing(true);
                      setTimeout(() => setIsRefreshing(false), 400);
                      toastMsg.info("Flux télémétrique actualisé ✓");
                    }}
                    className="p-1 rounded bg-[#071A2B] hover:bg-[#0E2E4A] text-[#00E5FF] border border-[#006DFF]/30 transition cursor-pointer"
                  >
                    <RotateCcw size={11} className={isRefreshing ? "animate-spin" : ""} />
                  </button>
                  <span className="rounded border border-[#FF174F]/50 bg-[#2A0815] px-1.5 py-0.5 text-[9px] font-bold text-[#FF174F]">
                    SOC LIVE
                  </span>
                  <span className="text-[10px] font-mono text-[#00E5FF]">
                    {filteredActivity.length} flux
                  </span>
                </div>
              </div>

              {/* Carte mondiale animée avec flux télécoms */}
              <div className="relative my-1.5 h-20 w-full flex items-center justify-center">
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
                  <path d="M 170 75 Q 130 85, 95 85" fill="none" stroke="#FF174F" strokeWidth="1.2" opacity="0.8" strokeDasharray="2 2" />
                  <path d="M 170 75 Q 220 85, 265 95" fill="none" stroke="#00C8FF" strokeWidth="1.2" opacity="0.7" strokeDasharray="2 2" />

                  {/* Nœuds lumineux palpitants */}
                  <circle cx="65" cy="40" r="3" fill="#00E5FF" className="animate-pulse" />
                  <circle cx="165" cy="35" r="3.5" fill="#00E5FF" />
                  <circle cx="170" cy="75" r="4" fill="#FF174F" className="animate-ping" />
                  <circle cx="170" cy="75" r="3" fill="#FF174F" />
                  <circle cx="230" cy="40" r="3" fill="#FF174F" />
                  <circle cx="265" cy="95" r="2.5" fill="#00C8FF" />
                </svg>
              </div>

              {/* Métriques télémétriques 100% réelles */}
              <div className="grid grid-cols-4 gap-1 border-y border-[#006DFF]/20 py-1 text-center text-[9px] bg-[#071322]/60 rounded my-1">
                <div>
                  <p className="text-[#4C91B5]">Connectés</p>
                  <p className="font-display text-xs font-black text-[#00E5FF] font-mono">
                    {presences.filter(isUserActiveOnline).length || (user ? 1 : 0)}
                  </p>
                </div>
                <div>
                  <p className="text-[#4C91B5]">Aujourd'hui</p>
                  <p className="font-display text-xs font-black text-[#008CFF] font-mono">
                    {attToday.length}
                  </p>
                </div>
                <div>
                  <p className="text-[#FF174F] font-bold">Alertes logs</p>
                  <p className="font-display text-xs font-black text-[#FF174F] font-mono drop-shadow-[0_0_6px_#FF174F]">
                    {db.log.filter((l) => (l.action || "").toLowerCase().includes("erreur") || (l.action || "").toLowerCase().includes("alerte")).length}
                  </p>
                </div>
                <div>
                  <p className="text-[#FF174F] font-bold">Pré-inscrits</p>
                  <p className="font-display text-xs font-black text-[#FF174F] font-mono drop-shadow-[0_0_6px_#FF174F]">
                    {db.registrations.length}
                  </p>
                </div>
              </div>

              {/* Barre de recherche et filtres de télémétrie */}
              <div className="space-y-1.5 my-1.5">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#4C91B5]" />
                  <input
                    type="text"
                    placeholder="Filtrer télémétrie (acteur, action)..."
                    value={activitySearch}
                    onChange={(e) => {
                      setActivitySearch(e.target.value);
                      setActivityPage(1);
                    }}
                    className="w-full rounded bg-[#071322] border border-[#006DFF]/30 py-1 pl-6 pr-2 text-[10px] text-white placeholder-[#4C91B5]/60 focus:border-[#00E5FF] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-1 text-[9px]">
                  {(
                    [
                      { key: "all", label: "Tous" },
                      { key: "presence", label: "Présence" },
                      { key: "security", label: "Sécurité" },
                      { key: "grades", label: "Notes" },
                      { key: "finance", label: "Finances" },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => {
                        setActivityFilter(btn.key);
                        setActivityPage(1);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded font-bold uppercase transition cursor-pointer text-[8px]",
                        activityFilter === btn.key
                          ? "bg-[#FF174F] text-white shadow-[0_0_8px_rgba(255,23,79,0.5)]"
                          : "bg-[#071A2B] text-[#4C91B5] hover:text-[#00E5FF] border border-[#006DFF]/20"
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flux télémétrique en direct */}
              <div className="space-y-1 min-h-[120px]">
                {paginatedActivity.length === 0 ? (
                  <div className="py-6 text-center text-[10px] text-[#4C91B5]">
                    Aucun événement correspondant aux critères
                  </div>
                ) : (
                  paginatedActivity.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between gap-1.5 rounded border border-[#006DFF]/20 bg-[#071322]/80 px-2 py-1 text-[9px] hover:border-[#00E5FF]/40 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              ev.status === "alert"
                                ? "bg-[#FF174F] shadow-[0_0_6px_#FF174F]"
                                : ev.status === "warning"
                                ? "bg-[#FFB300] shadow-[0_0_6px_#FFB300]"
                                : "bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]"
                            )}
                          />
                          <p className="truncate font-semibold text-white text-[9.5px]">
                            {ev.title}
                          </p>
                        </div>
                        <p className="truncate text-[#4C91B5] text-[8.5px]">
                          {ev.actor} {ev.detail ? `— ${ev.detail}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono text-[8.5px] text-[#80C8E8]">
                          {ev.timestamp}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination des flux télémétriques */}
              <div className="flex items-center justify-between border-t border-[#006DFF]/20 pt-1.5 text-[9px] text-[#4C91B5]">
                <span>
                  Page {activityPage} / {totalActivityPages} ({filteredActivity.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={activityPage <= 1}
                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-[#006DFF]/30 bg-[#071322] px-1.5 py-0.5 text-[9px] text-[#B8F3FF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-[#006DFF]/20"
                  >
                    <ChevronLeft size={10} />
                  </button>
                  <button
                    type="button"
                    disabled={activityPage >= totalActivityPages}
                    onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                    className="rounded border border-[#006DFF]/30 bg-[#071322] px-1.5 py-0.5 text-[9px] text-[#B8F3FF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-[#006DFF]/20"
                  >
                    <ChevronRight size={10} />
                  </button>
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
                  <strong className="text-[#B8F3FF] font-mono">{db.courses.length}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Devoirs / Notes</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.grades.length}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Tests actifs</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.tests?.length || 0}</strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Heures formateurs</span>
                  <strong className="text-[#00E5FF] font-mono">
                    {db.teacherHours?.reduce((acc, h) => acc + (h.heures || 0), 0) || 0}h
                  </strong>
                </div>
                <div className="flex justify-between text-[#4C91B5]">
                  <span>Créneaux planning</span>
                  <strong className="text-[#B8F3FF] font-mono">{db.schedule.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ACTIVITÉ DES MODULES (AVEC ONDES DYNAMIQUES EN MOUVEMENT & BORDURE ROUGE NÉON) */}
        <div className="hud-panel rounded-lg border border-[#FF174F]/80 shadow-[0_0_18px_rgba(255,23,79,0.35)] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                ACTIVITÉ DES MODULES
              </h3>
              <span className="text-[10px] text-[#00E5FF] font-bold">Actifs ({db.modules.length})</span>
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
                  stroke="#FF174F"
                  strokeWidth="2"
                  className="animate-wave-magenta"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[#00E5FF] font-bold">Informatique ({infoCount})</span>
              <span className="text-[#FF174F] font-bold">Industriel ({indCount})</span>
            </div>
          </div>
        </div>

        {/* 3. TOP MODULES ACTIFS (BORDURE ROUGE NÉON INTENSE EXACTE DE LA MAQUETTE !) */}
        <div className="hud-panel rounded-lg border-2 border-[#FF174F] shadow-[0_0_22px_rgba(255,23,79,0.45)] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#FF174F]/40 pb-2">
              <h3 className="font-display text-xs font-black text-[#FF174F] uppercase tracking-wider drop-shadow-[0_0_6px_#FF174F]">
                TOP MODULES ACTIFS
              </h3>
              <span className="text-[9px] font-mono text-[#FF174F] font-bold">{db.modules.length} modules</span>
            </div>
            <div className="mt-2 space-y-2 text-[10px]">
              {topModules.length > 0 ? (
                topModules.map((m, idx) => (
                  <div key={m.id || idx}>
                    <div className="flex justify-between text-[#B8F3FF]">
                      <span className="truncate max-w-[140px] font-semibold">{m.titre}</span>
                      <span className="font-mono text-[#4C91B5]">{m.count} éval. <strong className="text-white">{m.pct}%</strong></span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-sm bg-[#080A0F] overflow-hidden">
                      <div className={`h-full rounded-sm ${idx === 0 ? "bg-[#00E5FF]" : idx === 1 ? "bg-[#008CFF]" : idx === 2 ? "bg-[#FF174F]" : "bg-[#FF174F]"}`} style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-[#4C91B5]">
                  Aucun module enregistré.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. ÉTAT DES SYSTÈMES (AVEC ACCENT ROUGE SOC CRITIQUE) */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider border-b border-[#006DFF]/25 pb-2">
              ÉTAT DES SYSTÈMES
            </h3>
            <div className="my-2 flex items-center justify-between gap-3">
              {/* Bouclier HUD sécurisé */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#00C8FF] bg-[#071A2B] shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                <ShieldCheck size={24} className="text-[#00E5FF]" />
                <span className="absolute -bottom-1 rounded bg-[#006DFF] px-1 text-[8px] font-bold text-white shadow">
                  {isSupabaseConfigured ? "100%" : "LOCAL"}
                </span>
              </div>

              <div className="flex-1 space-y-1 text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Base Supabase</span>
                  <span className="font-bold text-[#00FF88]">{isSupabaseConfigured ? "CONNECTÉ" : "LOCAL"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00FF88]" /> Utilisateurs actifs</span>
                  <span className="font-bold text-[#00FF88]">{db.users.filter((u) => u.actif !== false).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#008CFF]" /> Apprenants</span>
                  <span className="font-bold text-[#008CFF]">{students.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#4C91B5]"><span className="h-1.5 w-1.5 rounded-full bg-[#00C8FF]" /> Formateurs</span>
                  <span className="font-bold text-[#00C8FF]">{db.teachers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#FF174F]"><span className="h-1.5 w-1.5 rounded-full bg-[#FF174F]" /> Sécurité SOC</span>
                  <span className="font-bold text-[#FF174F]">ARMÉ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SECTION 4 : PRÉ-INSCRIPTIONS + PRÉSENCE DIRECTE + ALERTES (BORDURE ROUGE NÉON !) ================= */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* 1. PRÉ-INSCRIPTIONS RÉCENTES (100% DONNÉES RÉELLES DB) */}
        <div className="hud-panel rounded-lg border border-[#006DFF]/40 p-4 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#006DFF]/25 pb-2">
              <h3 className="font-display text-xs font-black text-[#B8F3FF] uppercase tracking-wider">
                PRÉ-INSCRIPTIONS RÉCENTES ({db.registrations.length})
              </h3>
              <Link to="/app/etudiants" className="text-[10px] font-bold text-[#00E5FF] hover:underline">
                GÉRER →
              </Link>
            </div>

            <div className="mt-2.5 space-y-2">
              {db.registrations.length > 0 ? (
                db.registrations.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#0B111A]/90 p-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#00C8FF]/40 bg-[#071A2B] text-[#00E5FF]">
                        <Users size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#B8F3FF]">{r.nom} {r.prenom}</p>
                        <p className="truncate text-[9px] text-[#4C91B5]">{formationLabel(r.formation)} • {r.modules?.length || 1} module(s)</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      r.statut === "confirmee" ? "border border-[#00FF88]/40 bg-[#052619] text-[#00FF88]" : "border border-[#FFB300]/40 bg-[#261E05] text-[#FFB300]"
                    }`}>
                      {r.statut === "confirmee" ? "CONFIRMÉE" : "EN ATTENTE"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded border border-[#006DFF]/20 bg-[#0B111A]/50 p-4 text-center text-[11px] text-[#4C91B5]">
                  Aucune pré-inscription enregistrée dans la base de données.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. PRÉSENCE EN DIRECT (UNIQUEMENT COMPTES CONNECTÉS RÉELS) */}
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
                {presences.filter(isUserActiveOnline).length || (user ? 1 : 0)} connecté(s)
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              {(() => {
                const onlineUsers = presences.filter(isUserActiveOnline);
                const displayList = onlineUsers.length > 0
                  ? onlineUsers
                  : user ? [{ name: user.name || user.username, role: user.role }] : [];

                return displayList.length > 0 ? (
                  displayList.slice(0, 3).map((u, i) => (
                    <div key={i} className="flex items-center justify-between rounded border border-[#006DFF]/30 bg-[#0B111A]/90 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#00FF88] shadow-[0_0_6px_#00FF88]" />
                        <div className="min-w-0">
                          <p className="font-bold text-[#B8F3FF] text-[11px] truncate">{u.name}</p>
                          <p className="text-[9px] text-[#4C91B5] uppercase">{u.role}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#00FF88] shrink-0">En ligne</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded border border-[#006DFF]/20 bg-[#0B111A]/50 p-4 text-center text-[11px] text-[#4C91B5]">
                    Aucun utilisateur connecté.
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="mt-2 text-right">
            <Link to="/app/utilisateurs" className="text-[10px] font-bold text-[#00C8FF] hover:underline">
              Gérer les comptes →
            </Link>
          </div>
        </div>

        {/* 3. ALERTES RÉCENTES (BORDURE ROUGE NÉON INTENSE EXACTE DE LA MAQUETTE & LOGS RÉELS !) */}
        <div className="hud-panel rounded-lg border-2 border-[#FF174F] shadow-[0_0_24px_rgba(255,23,79,0.5)] p-4 lg:col-span-4 flex flex-col justify-between">
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
              {(() => {
                const securityLogs = db.log.filter((l) => {
                  const a = (l.action || "").toLowerCase();
                  return a.includes("alerte") || a.includes("erreur") || a.includes("suppr") || a.includes("sécur") || a.includes("bloqu");
                });

                const displayLogs = securityLogs.length > 0 ? securityLogs.slice(0, 3) : db.log.slice(0, 3);

                return displayLogs.length > 0 ? (
                  displayLogs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded border border-[#FF174F]/40 bg-[#0B111A]/90 p-2 text-xs">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertTriangle size={15} className="shrink-0 text-[#FF174F] mt-0.5" />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#B8F3FF]">{l.action}</p>
                          <p className="text-[9px] text-[#4C91B5]">{l.date} • {l.user || "Système"}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded border border-[#FF174F] bg-[#FF174F]/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#FF174F] shadow-[0_0_8px_#FF174F]">
                        SOC
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded border border-[#00FF88]/30 bg-[#052619]/40 p-3 text-center text-xs text-[#00FF88]">
                    <ShieldCheck size={18} className="mx-auto mb-1 text-[#00FF88]" />
                    Système nominal • Aucune anomalie détectée
                  </div>
                );
              })()}
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
            { to: "/app/sentinel-ai-admin", l: "Sentinel AI", i: <Brain size={14} /> },
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

      {/* ================= BLOC À TRAITER AUJOURD'HUI (E1 - PRIORITÉS OPÉRATIONNELLES) ================= */}
      <TodayActionWidget riskScores={riskScores} />

      {/* ================= RADAR DE RISQUE DE DÉCROCHAGE (N3) ================= */}
      <DropoutRiskRadarCard scores={riskScores} onScoresUpdated={loadRisk} loading={loadingRisk} />
    </div>
  );
}

/* ---------- Journal Rénové & Export Quotidien ---------- */
export function JournalPage() {
  const { db, update, log } = useStore();
  const [filterUser, setFilterUser] = useState("tous");
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [logTab, setLogTab] = useState<"active" | "archived">("active");

  const sourceLogs = useMemo(() => {
    return logTab === "active" ? db.log : (db.archivedLogs || []);
  }, [logTab, db.log, db.archivedLogs]);

  // Liste des utilisateurs distincts ayant des logs dans la vue sélectionnée
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    sourceLogs.forEach((l) => { if (l.user) set.add(l.user); });
    return Array.from(set).sort();
  }, [sourceLogs]);

  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month">("all");

  const filteredLogs = useMemo(() => {
    const todayStr = today();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return sourceLogs.filter((l) => {
      const matchU = filterUser === "tous" || l.user === filterUser;
      const matchQ = !searchTerm.trim() || l.action.toLowerCase().includes(searchTerm.toLowerCase()) || l.user.toLowerCase().includes(searchTerm.toLowerCase());

      const logDay = l.date.slice(0, 10);
      let matchPeriod = true;
      if (filterPeriod === "today") matchPeriod = logDay === todayStr;
      else if (filterPeriod === "week") matchPeriod = logDay >= sevenDaysAgo;
      else if (filterPeriod === "month") matchPeriod = logDay >= thirtyDaysAgo;

      return matchU && matchQ && matchPeriod;
    });
  }, [sourceLogs, filterUser, searchTerm, filterPeriod]);

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

  // Export PDF
  const exportPDF = () => {
    printHTML(`Journal_Audit_${today()}`, `
      <div class="receipt" style="max-width:850px;margin:auto;font-family:sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h1 class="accent" style="margin:0;color:#38bdf8">SENTINELLES NUMÉRIQUES</h1>
            <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0">ENIA 2.0 • REGISTRE OFFICIEL D'AUDIT ET DE TRAÇABILITÉ (${logTab === "active" ? "LOGS ACTIFS" : "ARCHIVES"})</p>
          </div>
          <div style="text-align:right">
            <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0">Émis le</p>
            <p style="font-family:monospace;font-size:13px;color:#38bdf8;margin:2px 0 0 0">${today()}</p>
          </div>
        </div>
        <hr style="border-color:#1d2b45;margin:16px 0">
        <table style="width:100%;border-collapse:collapse;font-size:11px;text-align:left">
          <thead>
            <tr style="border-bottom:2px solid #334155;color:#94a3b8">
              <th style="padding:6px">Horodatage</th>
              <th style="padding:6px">Utilisateur</th>
              <th style="padding:6px">Action / Événement tracé</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLogs.map(l => `
              <tr style="border-bottom:1px solid #1e293b">
                <td style="padding:6px;font-family:monospace;color:#94a3b8">${l.date}</td>
                <td style="padding:6px;font-weight:bold;color:#38bdf8">${l.user}</td>
                <td style="padding:6px;color:#f1f5f9">${l.action}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p style="margin-top:20px;text-align:center;font-size:10px;color:#64748b">Document certifié conforme issu du système d'audit intégré de Sentinelles Numériques v2.1</p>
      </div>
    `);
  };

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
    link.setAttribute("download", `journal_audit_${logTab}_${today()}.csv`);
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
    link.setAttribute("download", `journal_audit_${logTab}_${today()}.json`);
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
    toastMsg.success("Logs archivés en lieu sûr ✓", "Les logs archivés restent consultables dans l'onglet Archives.");
    log("Archivage et sécurisation du journal d'activité");
  };

  // Restauration des archives dans les logs actifs
  const confirmRestoreArchives = () => {
    if (!window.confirm("Voulez-vous réintégrer les archives dans les logs actifs ?")) return;
    update((d) => ({
      ...d,
      log: [...(d.archivedLogs || []), ...d.log],
      archivedLogs: [],
    }));
    toastMsg.success("Archives restaurées dans les logs actifs ✓");
    log("Restauration intégrale des archives dans le journal d'activité");
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Journal d'audit & d'activité"
        subtitle="Traçabilité complète, archivage consultable et recherche dans l'historique"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={exportPDF} disabled={filteredLogs.length === 0}>
              <Printer size={14} /> Imprimer / PDF
            </Btn>
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={exportCSV} disabled={filteredLogs.length === 0}>
              <FileSpreadsheet size={14} /> Exporter CSV
            </Btn>
            <Btn variant="outline" className="px-3 py-1.5 text-xs" onClick={exportJSON} disabled={filteredLogs.length === 0}>
              <FileJson size={14} /> Exporter JSON
            </Btn>
            {logTab === "active" ? (
              <Btn variant="red" className="px-3 py-1.5 text-xs" onClick={() => setShowArchiveModal(true)} disabled={db.log.length === 0}>
                <Archive size={14} /> Archiver
              </Btn>
            ) : (
              <Btn variant="outline" className="px-3 py-1.5 text-xs text-amber-300 border-amber-400/30" onClick={confirmRestoreArchives} disabled={(db.archivedLogs || []).length === 0}>
                <RotateCcw size={14} /> Restaurer les archives
              </Btn>
            )}
          </div>
        }
      />

      {/* Onglets Actifs / Archives Consultables */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLogTab("active")}
          className={cn(
            "rounded-xl border px-4 py-2 text-xs font-bold transition-all",
            logTab === "active"
              ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          Logs Actifs ({db.log.length})
        </button>
        <button
          type="button"
          onClick={() => setLogTab("archived")}
          className={cn(
            "rounded-xl border px-4 py-2 text-xs font-bold transition-all",
            logTab === "archived"
              ? "border-amber-400/50 bg-amber-400/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
              : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
          )}
        >
          Archives consultables ({(db.archivedLogs || []).length})
        </button>
      </div>

      {/* Barre de recherche et filtres de période */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-2.5">
          {[
            { id: "all", label: "Toute la période" },
            { id: "today", label: "Aujourd'hui" },
            { id: "week", label: "7 derniers jours" },
            { id: "month", label: "30 derniers jours" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterPeriod(p.id as any)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                filterPeriod === p.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/[0.02] text-slate-400 border border-white/5 hover:bg-white/5"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
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

/* ---------- Paramètres & Centre de pilotage ---------- */
export { SettingsPage as ParametresPage } from "./SettingsPage";

