import heroSentinels3dImg from "@/assets/branding/hero-sentinels-3d-bg.jpg";

interface Sentinel3DBackgroundProps {
  className?: string;
  imageClassName?: string;
  fixed?: boolean;
}

export function Sentinel3DBackground({
  className = "",
  imageClassName = "",
  fixed = false,
}: Sentinel3DBackgroundProps) {
  return (
    <div
      className={`pointer-events-none ${
        fixed ? "fixed inset-0" : "absolute top-0 inset-x-0 h-[760px] sm:h-[840px]"
      } z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* Ambient technological halos */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[20%] left-1/4 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[400px] bg-[#00D9FF]/[0.10] rounded-full blur-[130px]" />
        <div className="absolute top-[20%] right-1/4 translate-x-1/2 -translate-y-1/2 w-[650px] h-[400px] bg-[#00D9FF]/[0.10] rounded-full blur-[130px]" />
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#FF1018]/[0.24] rounded-full blur-[100px]" />
        <div className="bg-circuit scanlines absolute inset-0 opacity-25" />
      </div>

      {/* 3D SENTINEL'S CENTRAL HERO BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center overflow-hidden">
        <div className="relative w-full max-w-[1580px] px-2 sm:px-6 flex items-center justify-center">
          {/* Seamless edge fade overlays - reduced opacity for clear visibility through glass */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-black opacity-35" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black via-transparent to-black opacity-25" />
          <img
            src={heroSentinels3dImg}
            alt="SENTINEL'S 3D Hero Emblem"
            className={`w-full max-h-[480px] sm:max-h-[540px] md:max-h-[580px] lg:max-h-[640px] xl:max-h-[700px] object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,0.95)] filter brightness-105 ${imageClassName}`}
          />
        </div>
      </div>

      {/* Bottom fade to seamlessly blend into black background on long pages */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black to-transparent z-[6]" />
    </div>
  );
}

export default Sentinel3DBackground;
