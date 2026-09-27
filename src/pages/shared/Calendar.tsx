import React from "react";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, GraduationCap, Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Badge, PageHead, formationLabel, moduleIcon } from "@/lib/ui";
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, getDay, startOfMonth, endOfMonth, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { scheduleFor } from "@/lib/access";

const COLORS: Record<string, string> = {
  informatique: "border-red-500/40 bg-red-500/10",
  industriel: "border-cyan-400/40 bg-cyan-400/10",
};

const TEXT_COLORS: Record<string, string> = {
  informatique: "text-red-300",
  industriel: "text-cyan-300",
};

type ViewMode = "week" | "month";

export function VisualCalendar() {
  const { db, user } = useStore();
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const items = useMemo(() => scheduleFor(db, user), [db, user]);

  const modName = (id: string) => db.modules.find((m) => m.id === id)?.titre ?? "—";
  const modFormation = (id: string) => db.modules.find((m) => m.id === id)?.formation ?? "informatique";
  const modIcon = (id: string) => db.modules.find((m) => m.id === id)?.icon ?? "code";
  const teacherName = (id: string) => {
    const t = db.teachers.find((t) => t.id === id);
    return t ? `${t.prenom} ${t.nom}` : "—";
  };

  // Vue semaine
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekNum = getWeek(currentDate, { locale: fr });

  const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const itemsForDate = (date: Date) => {
    const dayName = DAY_NAMES[getDay(date) === 0 ? 6 : getDay(date) - 1];
    return items.filter((s) => {
      if (s.date) return isSameDay(new Date(s.date), date);
      return s.jour === dayName;
    });
  };

  // Vue mois
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });

  const navigate = (dir: 1 | -1) => {
    if (view === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  return (
    <div className="space-y-5">
      <PageHead
        title="Calendrier"
        subtitle={view === "week"
          ? `Semaine ${weekNum} — ${format(weekStart, "d MMMM", { locale: fr })} au ${format(weekEnd, "d MMMM yyyy", { locale: fr })}`
          : format(currentDate, "MMMM yyyy", { locale: fr })}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              <button onClick={() => setView("week")} className={cn("px-3.5 py-2 text-xs font-bold", view === "week" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400 hover:bg-white/5")}><Calendar size={14} className="inline mr-1" />Semaine</button>
              <button onClick={() => setView("month")} className={cn("px-3.5 py-2 text-xs font-bold border-l border-white/10", view === "month" ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400 hover:bg-white/5")}><Calendar size={14} className="inline mr-1" />Mois</button>
            </div>
            <button onClick={() => navigate(-1)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="rounded-xl border border-cyan-400/30 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">Aujourd'hui</button>
            <button onClick={() => navigate(1)} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5"><ChevronRight size={16} /></button>
          </div>
        }
      />

      {/* Vue Semaine (Agrandie & Spatiale) */}
      {view === "week" && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#081120]/80 p-2 shadow-xl backdrop-blur-md">
          <div className="grid min-w-[880px]" style={{ gridTemplateColumns: "90px repeat(7, 1fr)" }}>
            {/* Header */}
            <div className="border-b border-white/10 p-3" />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={i} className={cn("border-b border-l border-white/10 p-3 text-center transition-colors", isToday && "bg-cyan-400/10")}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{DAY_NAMES[i]}</p>
                  <p className={cn("font-display text-2xl font-black mt-0.5", isToday ? "text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "text-white")}>
                    {format(day, "d")}
                  </p>
                </div>
              );
            })}

            {/* Slots horaires 07h-20h avec cases agrandies */}
            {Array.from({ length: 13 }, (_, h) => h + 7).map((hour) => (
              <React.Fragment key={`h-${hour}`}>
                <div className="border-b border-white/5 p-3 text-right flex items-center justify-end">
                  <span className="font-mono text-xs font-semibold text-slate-500">{String(hour).padStart(2, "0")}:00</span>
                </div>
                {weekDays.map((day, di) => {
                  const dayItems = itemsForDate(day).filter((s) => {
                    const h = parseInt(s.heureDebut.split(":")[0], 10);
                    return h === hour;
                  });
                  return (
                    <div key={`${hour}-${di}`} className={cn("relative border-b border-l border-white/5 min-h-[82px] p-2 flex flex-col gap-1.5 transition-colors", isSameDay(day, new Date()) && "bg-cyan-400/[0.02]")}>
                      {dayItems.map((item) => {
                        const f = modFormation(item.moduleId);
                        const isInfo = f === "informatique";
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={cn(
                              "w-full rounded-xl border p-2.5 text-left text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                              isInfo
                                ? "border-red-500/50 bg-gradient-to-br from-red-950/50 to-[#15070c] shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:border-red-400"
                                : "border-cyan-400/50 bg-gradient-to-br from-cyan-950/50 to-[#071524] shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:border-cyan-300"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-[10px] font-bold text-slate-400">{item.heureDebut} - {item.heureFin}</span>
                              {item.salle && (
                                <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-semibold text-amber-300">
                                  {item.salle}
                                </span>
                              )}
                            </div>
                            <p className={cn("font-bold truncate text-xs leading-snug", isInfo ? "text-red-200" : "text-cyan-200")}>
                              {modName(item.moduleId)}
                            </p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="truncate">{teacherName(item.teacherId)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Vue Mois (Agrandie & Spatiale) */}
      {view === "month" && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#081120]/80 p-2 shadow-xl backdrop-blur-md">
          <div className="min-w-[850px] grid grid-cols-7">
            {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((d) => (
              <div key={d} className="border-b border-white/10 p-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">{d}</div>
            ))}
            {monthDays.map((day, i) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());
              const dayItems = itemsForDate(day);
              return (
                <div key={i} className={cn("min-h-[145px] border-b border-l border-white/5 p-2 flex flex-col justify-between transition-colors", !isCurrentMonth && "opacity-25", isToday && "bg-cyan-400/[0.04]")}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className={cn("text-xs font-bold w-7 h-7 flex items-center justify-center rounded-xl", isToday ? "bg-cyan-400 text-[#05070D] font-black shadow-[0_0_10px_rgba(6,182,212,0.6)]" : "text-slate-300")}>
                        {format(day, "d")}
                      </p>
                      {dayItems.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">{dayItems.length} séance(s)</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {dayItems.slice(0, 3).map((item) => {
                        const f = modFormation(item.moduleId);
                        const isInfo = f === "informatique";
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={cn(
                              "w-full rounded-lg border p-1.5 text-left text-[11px] transition-all duration-150 hover:-translate-y-0.5",
                              isInfo
                                ? "border-red-500/40 bg-gradient-to-r from-red-950/40 to-transparent text-red-200 hover:border-red-400"
                                : "border-cyan-400/40 bg-gradient-to-r from-cyan-950/40 to-transparent text-cyan-200 hover:border-cyan-300"
                            )}
                          >
                            <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
                              <span>{item.heureDebut}</span>
                              {item.salle && <span className="text-amber-300">{item.salle}</span>}
                            </div>
                            <span className="font-bold truncate block text-xs mt-0.5">{modName(item.moduleId)}</span>
                          </button>
                        );
                      })}
                      {dayItems.length > 3 && (
                        <p className="text-[10px] font-semibold text-cyan-400/80 pl-1">+{dayItems.length - 3} autre(s) créneau(x)</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-red-500/50 bg-red-500/10" />Génie Informatique</div>
        <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-cyan-400/50 bg-cyan-400/10" />Génie Industriel</div>
      </div>

      {/* Modal détail session */}
      {selectedItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-[#081021]/95 p-6 shadow-[0_0_60px_-12px_rgba(0,229,255,0.5)]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-xl border p-2.5", COLORS[modFormation(selectedItem.moduleId)])}>
                  {moduleIcon(modIcon(selectedItem.moduleId), "h-5 w-5 " + TEXT_COLORS[modFormation(selectedItem.moduleId)])}
                </div>
                <div>
                  <p className="font-display text-base font-bold text-white">{modName(selectedItem.moduleId)}</p>
                  <Badge color={modFormation(selectedItem.moduleId) === "informatique" ? "red" : "cyan"}>{formationLabel(modFormation(selectedItem.moduleId) as any)}</Badge>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p className="flex items-center gap-2"><Clock size={14} className="text-cyan-300" /> {selectedItem.jour} • {selectedItem.heureDebut} — {selectedItem.heureFin}</p>
              <p className="flex items-center gap-2"><MapPin size={14} className="text-blue-400" /> {selectedItem.salle || "Salle non précisée"}</p>
              <p className="flex items-center gap-2"><GraduationCap size={14} className="text-emerald-300" /> {teacherName(selectedItem.teacherId)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
