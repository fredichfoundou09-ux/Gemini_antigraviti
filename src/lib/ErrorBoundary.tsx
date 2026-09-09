import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Home, Copy, CheckCircle2 } from "lucide-react";
import { SentinelLogo } from "@/components/SentinelLogo";

interface Props {
  children: ReactNode;
}

interface CrashReport {
  timestamp: string;
  url: string;
  userAgent: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

const CRASH_STORAGE_KEY = "sn_crash_reports";

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught runtime error:", error, errorInfo);

    try {
      const report: CrashReport = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        errorName: error.name || "Error",
        errorMessage: error.message || String(error),
        errorStack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
      };

      const existingRaw = localStorage.getItem(CRASH_STORAGE_KEY);
      const existing: CrashReport[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(report);
      localStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(existing.slice(0, 10)));

      window.dispatchEvent(new CustomEvent("sn:runtime-error", { detail: report }));
    } catch {
      // ignore
    }
  }

  private handleCopyDiagnostic = () => {
    const { error, errorInfo } = this.state;
    const diagnostic = {
      app: "SENTINELLES NUMÉRIQUES",
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
      componentStack: errorInfo?.componentStack,
    };

    navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2)).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }).catch(() => {});
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-6 text-white font-sans selection:bg-[#00E5FF]/20">
          <div className="relative max-w-lg w-full rounded-2xl border border-red-500/40 bg-[#0B111A]/95 p-8 shadow-[0_0_50px_rgba(255,23,79,0.25)] backdrop-blur-xl">
            {/* Ambient cyber glow */}
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#006DFF]/10 blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4 mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/15 shadow-[0_0_20px_rgba(255,23,79,0.4)] p-2">
                <SentinelLogo variant="symbol" alt="SENTINEL'S" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-widest text-red-400 uppercase font-black">
                  // ANOMALIE SYSTÈME DÉTECTÉE
                </span>
                <h1 className="font-display text-xl font-black text-white tracking-wide">
                  Erreur d'Exécution de l'Interface
                </h1>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed font-rajdhani text-[14px]">
              Une exception inattendue a interrompu l'affichage de ce module. Vos données locales et votre session sont protégées.
            </p>

            {this.state.error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-black/60 p-3.5 font-mono text-[11px] text-red-300/90 break-words max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="mb-6 flex justify-end">
              <button
                type="button"
                onClick={this.handleCopyDiagnostic}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 transition"
              >
                {this.state.copied ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Diagnostic copié !</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copier le rapport pour le support</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF174F] to-[#E60039] px-4 py-2.5 font-oxanium text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,23,68,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <RefreshCw size={14} />
                Recharger le module
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.hash = "#/";
                  window.location.reload();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#006DFF]/30 bg-[#006DFF]/10 px-4 py-2.5 font-oxanium text-xs font-bold uppercase tracking-wider text-[#B8F3FF] transition-all hover:bg-[#006DFF]/20"
              >
                <Home size={14} />
                Retour accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
