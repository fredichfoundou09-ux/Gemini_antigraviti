import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check, Archive, Clock, ShieldAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { toastMsg } from "@/lib/toast";

export function AcademicYearSelector() {
  const { db, activeAcademicYear, setActiveAcademicYear, user } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const years = db.academicYears || [];
  const current = activeAcademicYear || years.find((y) => y.statut === "active") || years[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!current || years.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm",
          current.statut === "active"
            ? "border-cyan-500/30 bg-[#08162B]/80 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-950/40 hover:shadow-[0_0_12px_rgba(0,229,255,0.2)]"
            : "border-amber-500/30 bg-[#1A1208]/80 text-amber-200 hover:border-amber-400"
        )}
        title="Session académique en cours de consultation"
      >
        <Calendar size={14} className={current.statut === "active" ? "text-cyan-400" : "text-amber-400"} />
        <span className="font-mono tracking-tight font-bold">{current.label}</span>
        {current.statut === "cloturee" && (
          <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300 uppercase">
            Clôturée
          </span>
        )}
        <ChevronDown size={13} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 z-50 mt-1.5 w-64 origin-top-right rounded-2xl border border-white/10 bg-[#08162B] p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/40">
          <div className="border-b border-white/10 px-2.5 pb-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Année Scolaire / Académique
            </p>
            <p className="text-[11px] text-slate-300">
              Filtre les inscriptions, présences, notes et finances associées.
            </p>
          </div>

          <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
            {years.map((y) => {
              const isSelected = y.id === current.id;
              return (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => {
                    setActiveAcademicYear(y.id);
                    setIsOpen(false);
                    toastMsg.info(`Session active : ${y.label} (${y.statut})`);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer",
                    isSelected
                      ? "bg-cyan-500/15 text-cyan-200 font-bold border border-cyan-500/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {y.statut === "active" ? (
                      <Clock size={14} className="text-emerald-400" />
                    ) : y.statut === "cloturee" ? (
                      <Archive size={14} className="text-amber-400" />
                    ) : (
                      <Calendar size={14} className="text-slate-400" />
                    )}
                    <div>
                      <p className="font-mono">{y.label}</p>
                      {y.description && (
                        <p className="text-[10px] text-slate-400 line-clamp-1">{y.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {y.statut === "active" && (
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                        Active
                      </span>
                    )}
                    {y.statut === "cloturee" && (
                      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                        Clôturée
                      </span>
                    )}
                    {isSelected && <Check size={14} className="text-cyan-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {(user?.role === "superadmin" || user?.role === "admin") && (
            <div className="mt-1.5 border-t border-white/10 pt-1.5 px-1">
              <a
                href="#/app/parametres?tab=academic"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-white/5 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-white/10 transition"
              >
                Gérer les années académiques &rarr;
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
