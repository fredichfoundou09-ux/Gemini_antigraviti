import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, X, Play } from "lucide-react";

interface IntroSplashProps {
  onFinish?: () => void;
  videoSrc?: string;
}

export function IntroSplash({
  onFinish,
  videoSrc = "/sentinel-intro.mp4",
}: IntroSplashProps) {
  const [visible, setVisible] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      const seen = sessionStorage.getItem("sentinel_intro_seen");
      if (seen) return false;
      const hash = window.location.hash || "";
      // Only show on root public home
      if (hash && hash !== "#/" && hash !== "#") return false;
      return true;
    } catch {
      return false;
    }
  });
  const [fading, setFading] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [requiresUserClick, setRequiresUserClick] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishCalledRef = useRef(false);

  const complete = () => {
    if (finishCalledRef.current) return;
    finishCalledRef.current = true;
    try {
      sessionStorage.setItem("sentinel_intro_seen", "1");
    } catch { /* ignore */ }
    setVisible(false);
    onFinish?.();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tentative de lecture automatique (muet pour compatibilité universelle iOS / Android / Desktop)
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.info("Autoplay restriction detected:", err?.message);
        setRequiresUserClick(true);
      });
    }

    // Minuteur de sécurité de repli (8 secondes max si la vidéo tarde à charger)
    const fallbackTimer = setTimeout(() => {
      complete();
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      // Ajuster le minuteur de secours précisément à la durée de la vidéo + marge de 800ms
      const dynamicLimit = (video.duration * 1000) + 800;
      setTimeout(() => {
        complete();
      }, dynamicLimit);
    }
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setRequiresUserClick(false);
      }).catch(() => {
        complete();
      });
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] w-screen h-screen bg-[#020508] select-none flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ease-out ${
        fading ? "opacity-0 scale-[1.01] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Effet d'ambiance Cyber Sentinel en arrière-plan */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[1200px] h-[60vh] max-h-[800px] bg-[#00D9FF]/[0.07] rounded-full blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[65vw] max-w-[900px] h-[45vh] max-h-[600px] bg-[#FF1018]/[0.10] rounded-full blur-[140px]" />
      </div>

      {/* Barre supérieure HUD avec branding et bouton Passer */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-[2px]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="font-sentinel text-xs sm:text-sm font-semibold tracking-widest text-cyan-300 uppercase">
            SENTINEL'S
          </span>
          <span className="hidden sm:inline text-xs text-slate-500 uppercase tracking-wider">
            | Initialisation
          </span>
        </div>

        {/* Bouton Passer (Skip) haute visibilité */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            complete();
          }}
          className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#07131D]/80 backdrop-blur-md px-4 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_18px_rgba(0,217,255,0.35)] transition-all duration-200 cursor-pointer"
          title="Passer l'introduction et ouvrir l'application"
          aria-label="Passer l'introduction"
        >
          <span>Passer</span>
          <X size={15} className="text-cyan-400 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      </header>

      {/* Conteneur principal 100% responsive (Mobile & Desktop) */}
      <main className="relative w-full h-full flex items-center justify-center p-0 sm:p-4 md:p-6">
        <div className="relative w-full h-full max-w-full max-h-screen flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            autoPlay
            muted={isMuted}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={complete}
            onError={() => {
              console.warn("Vidéo non disponible ou erreur lecture, ouverture directe de l'application");
              complete();
            }}
            className="w-full h-full max-w-full max-h-screen object-contain drop-shadow-[0_0_35px_rgba(0,217,255,0.15)]"
          />

          {/* Bouton de reprise manuelle si le navigateur bloque l'autoplay strict */}
          {requiresUserClick && (
            <button
              type="button"
              onClick={handleManualPlay}
              className="absolute z-20 flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#020508]/90 border border-cyan-400/40 text-cyan-300 shadow-[0_0_40px_rgba(0,217,255,0.3)] hover:scale-105 transition-transform cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 animate-pulse">
                <Play size={26} className="ml-1" />
              </div>
              <span className="text-sm font-semibold tracking-wider uppercase font-sentinel">
                Lancer la vidéo
              </span>
            </button>
          )}
        </div>
      </main>

      {/* Barre inférieure HUD avec contrôle audio et progression */}
      <footer className="absolute bottom-0 inset-x-0 z-30 flex flex-col bg-gradient-to-t from-black/85 via-black/45 to-transparent backdrop-blur-[2px]">
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4">
          {/* Bouton de son interactif */}
          <button
            type="button"
            onClick={toggleSound}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs text-slate-300 hover:text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-500/10 transition cursor-pointer"
            title={isMuted ? "Activer le son" : "Couper le son"}
            aria-label={isMuted ? "Activer le son" : "Couper le son"}
          >
            {isMuted ? (
              <>
                <VolumeX size={15} className="text-slate-400" />
                <span className="hidden xs:inline">Son désactivé</span>
              </>
            ) : (
              <>
                <Volume2 size={15} className="text-cyan-400 animate-pulse" />
                <span className="hidden xs:inline text-cyan-300">Son actif</span>
              </>
            )}
          </button>

          {/* Indicateur de chargement Sentinel */}
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400 font-mono tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>ACCÈS EN COURS</span>
          </div>
        </div>

        {/* Barre de progression fluide en temps réel */}
        <div className="w-full h-1 bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-[#006DFF] to-[#FF174F] transition-all duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </footer>
    </div>
  );
}

export default IntroSplash;
