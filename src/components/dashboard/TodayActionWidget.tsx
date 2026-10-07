import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardCheck,
  Wallet,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/lib/ui";
import { RiskScore } from "@/modules/students/services/riskService";

interface TodayActionWidgetProps {
  riskScores?: RiskScore[];
  onOpenRiskModal?: () => void;
}

export function TodayActionWidget({ riskScores = [], onOpenRiskModal }: TodayActionWidgetProps) {
  const { db } = useStore();

  const pendingSubmissionsCount = useMemo(() => {
    return (db.submissions || []).filter(
      (sub) => sub.note === undefined || sub.note === null
    ).length;
  }, [db.submissions]);

  const overdueInvoices = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (db.invoices || []).filter(
      (inv) => inv.dueDate && inv.dueDate < todayStr
    );
  }, [db.invoices]);

  const recentAbsencesCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (db.attendance || []).filter(
      (att) => att.date === todayStr && att.statut === "absent"
    ).length;
  }, [db.attendance]);

  const highRiskStudents = useMemo(() => {
    return riskScores.filter((r) => r.level === "critique" || r.level === "eleve");
  }, [riskScores]);

  return (
    <Card className="p-4 border-[var(--sn-red)]/40 bg-[var(--sn-black)]">
      <div className="flex items-center justify-between border-b border-[var(--sn-line)] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--sn-red)] animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            À Traiter Aujourd'hui (Priorités Opérationnelles)
          </h3>
        </div>
        <span className="rounded-full bg-[var(--sn-red)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--sn-red)]">
          {pendingSubmissionsCount + overdueInvoices.length + highRiskStudents.length} actions
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Copies à corriger */}
        <Link
          to="/app/evaluations-devoirs"
          className="group flex flex-col justify-between rounded-md border border-[var(--sn-line)] bg-white/[0.02] p-3 transition-all hover:border-[var(--sn-red)] hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/70">Copies à corriger</span>
            <ClipboardCheck className="h-4 w-4 text-white/50 group-hover:text-[var(--sn-red)]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{pendingSubmissionsCount}</span>
            <span className="flex items-center text-[10px] text-white/50 group-hover:text-white">
              Évaluer <ArrowRight className="ml-1 h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Impayés de scolarité */}
        <Link
          to="/app/paiements"
          className="group flex flex-col justify-between rounded-md border border-[var(--sn-line)] bg-white/[0.02] p-3 transition-all hover:border-[var(--sn-red)] hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/70">Relances impayés</span>
            <Wallet className="h-4 w-4 text-white/50 group-hover:text-[var(--sn-red)]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{overdueInvoices.length}</span>
            <span className="flex items-center text-[10px] text-white/50 group-hover:text-white">
              Relancer <ArrowRight className="ml-1 h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Absences du jour */}
        <Link
          to="/app/presences"
          className="group flex flex-col justify-between rounded-md border border-[var(--sn-line)] bg-white/[0.02] p-3 transition-all hover:border-[var(--sn-red)] hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/70">Absences du jour</span>
            <Clock className="h-4 w-4 text-white/50 group-hover:text-[var(--sn-red)]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{recentAbsencesCount}</span>
            <span className="flex items-center text-[10px] text-white/50 group-hover:text-white">
              Pointer <ArrowRight className="ml-1 h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Décrochage précoce */}
        <button
          type="button"
          onClick={onOpenRiskModal}
          className="group flex flex-col justify-between rounded-md border border-[var(--sn-red)]/50 bg-[var(--sn-black)] p-3 text-left transition-all hover:border-[var(--sn-red)] hover:shadow-[0_0_12px_rgba(255,0,0,0.2)] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--sn-red)]">Risque décrochage</span>
            <ShieldAlert className="h-4 w-4 text-[var(--sn-red)]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[var(--sn-red)]">{highRiskStudents.length}</span>
            <span className="flex items-center text-[10px] text-white/70 group-hover:text-white">
              Détails <ArrowRight className="ml-1 h-3 w-3" />
            </span>
          </div>
        </button>
      </div>
    </Card>
  );
}
