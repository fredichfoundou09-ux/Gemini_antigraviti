import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, X } from "lucide-react";

interface IntroSplashProps {
  onFinish?: () => void;
  videoSrc?: string;
  maxDurationMs?: number;
}

export function IntroSplash({
  onFinish,
  videoSrc = "/sentinel-intro.mp4",
  maxDurationMs = 3400,
}: IntroSplashProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishCalledRef = useRef(false);

  const complete = () => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, 500);
  };

  useEffect(() => {
    // 1. Démarrage de la lecture vidéo
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Autoplay bloqué ou erreur média : transition gracieuse sans bloquer l'application
          console.info("Autoplay notice:", err?.message || "User interaction required");
        });
      }
    }

    // 2. Minuteur de sécurité infaillible (3.4s) pour garantir que l'application s'affiche toujours
    const safetyTimer = setTimeout(() => {
      complete();
    }, maxDurationMs);

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [maxDurationMs]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#020508] select-none transition-all duration-500 ease-out ${
        fading ? "opacity-0 scale-[1.02] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Halos d'ambiance Sentinel's pour fondre la vidéo dans l'écran */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#00D9FF]/[0.08] rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[400px] bg-[#FF1018]/[0.12] rounded-full blur-[120px]" />
      </div>

      {/* Cadre vidéo cinématique responsive */}
      <div className="relative w-full max-w-2xl px-4 flex flex-col items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-xl border border-cyan-500/20 shadow-[0_0_50px_rgba(0,217,255,0.15)] bg-black aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            autoPlay
            muted={isMuted}
            preload="auto"
            onEnded={complete}
            onError={() => {
              complete();
            }}
            className="w-full h-full object-contain"
          />

          {/* Bouton pour réactiver le son si souhaité */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                const nextMuted = !isMuted;
                videoRef.current.muted = nextMuted;
                setIsMuted(nextMuted);
              }
            }}
            className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/60 backdrop-blur-md p-2 text-slate-300 hover:text-cyan-300 hover:border-cyan-400/40 transition z-10"
            title={isMuted ? "Activer le son" : "Couper le son"}
            aria-label="Contrôle du son"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Bouton Passer (Skip) en haut à droite */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              complete();
            }}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:border-cyan-400/50 hover:bg-cyan-500/20 transition shadow-lg z-10"
          >
            <span>Passer</span>
            <X size={14} />
          </button>

          {/* Barre de progression technologique en bas de vidéo */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-[#006DFF] to-[#FF174F]"
              style={{
                animation: `progressLinear ${maxDurationMs}ms linear forwards`,
              }}
            />
          </div>
        </div>

        {/* Branding compact discret sous la vidéo */}
        <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-sentinel tracking-widest uppercase">
          <span className="h-1.5 w-1.5 rounded-sm bg-cyan-400 animate-pulse" />
          <span>SENTINELLE NUMÉRIQUE — CHARGEMENT EN COURS</span>
        </div>
      </div>

      <style>{`
        @keyframes progressLinear {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default IntroSplash;
