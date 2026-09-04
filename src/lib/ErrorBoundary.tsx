import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import { SentinelLogo } from "@/components/SentinelLogo";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error:", error, errorInfo);
  }

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
              <div className="mb-6 rounded-lg border border-red-500/20 bg-black/60 p-3.5 font-mono text-[11px] text-red-300/90 break-words max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF174F] to-[#E60039] px-4 py-2.5 font-oxanium text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,23,68,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <RefreshCw size={14} />
                Recharger le module
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
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
