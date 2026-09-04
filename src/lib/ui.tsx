import React, { ReactNode } from "react";
import {
  Code2, Network, Server, Terminal, ShieldCheck, Sigma, Lock, Cog, Zap, Cpu, Plug,
  Factory, Waves, GitBranch, Ruler, Binary, AudioWaveform, Calculator, Wrench, FolderLock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Formation } from "./types";

/* ---------- helpers ---------- */
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const fmt = (n: number) => n.toLocaleString("fr-FR");

export const money = (n: number) => `${fmt(n)} FCFA`;

export const formationLabel = (f: Formation) => (f === "informatique" ? "Génie Informatique" : "Génie Industriel");

export const today = () => new Date().toISOString().slice(0, 10);

export function readImage(file: File, maxW = 700): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function printHTML(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
    body{margin:0;background:#05070D;color:#F5F7FA;padding:32px}
    .receipt{max-width:720px;margin:0 auto;background:#0A1224;border:1px solid #00E5FF;border-radius:16px;padding:32px}
    h1,h2,h3{margin:0 0 8px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #1d2b45}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .label{color:#8A94A6;font-size:12px;text-transform:uppercase;letter-spacing:1px}
    .accent{color:#00E5FF}.gold{color:#FFB300}.red{color:#FF1744}.green{color:#00FF88}
    @media print{body{background:#fff;color:#000}.receipt{background:#fff;border:2px solid #000;color:#000}}
  </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

export function officialPrintDoc(title: string, contentHTML: string, docType = "DOCUMENT OFFICIEL") {
  return `
    <div class="receipt">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #00E5FF;padding-bottom:16px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" style="height:56px;width:56px;object-fit:contain" alt="Logo" />
          <div>
            <h2 style="margin:0;font-size:16px;font-weight:900;letter-spacing:1px;color:#fff">SENTINELLE NUMÉRIQUE</h2>
            <p style="margin:2px 0 0;font-size:10px;color:#00E5FF;text-transform:uppercase;letter-spacing:1px">ENIA 2.0 · CONGO BRAZZAVILLE</p>
          </div>
        </div>
        <div style="text-align:right">
          <span style="display:inline-block;padding:4px 8px;border-radius:6px;background:rgba(0,229,255,0.1);border:1px solid #00E5FF;font-size:10px;font-weight:bold;color:#00E5FF">${docType}</span>
          <p style="margin:4px 0 0;font-size:11px;color:#8A94A6">${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>
      ${contentHTML}
      <div style="margin-top:30px;border-top:1px dashed #1d2b45;padding-top:12px;text-align:center;font-size:9px;color:#8A94A6;letter-spacing:2px">
        APPRENDRE • INNOVER • CRÉER • CODER • SÉCURISER — SENTINELLE NUMÉRIQUE
      </div>
    </div>
  `;
}

export const moduleIcon = (key: string, className = "h-5 w-5") => {
  const map: Record<string, ReactNode> = {
    code: <Code2 className={className} />,
    network: <Network className={className} />,
    server: <Server className={className} />,
    terminal: <Terminal className={className} />,
    shield: <ShieldCheck className={className} />,
    sigma: <Sigma className={className} />,
    lock: <Lock className={className} />,
    folder: <FolderLock className={className} />,
    cog: <Cog className={className} />,
    zap: <Zap className={className} />,
    cpu: <Cpu className={className} />,
    plug: <Plug className={className} />,
    factory: <Factory className={className} />,
    waves: <Waves className={className} />,
    git: <GitBranch className={className} />,
    ruler: <Ruler className={className} />,
    binary: <Binary className={className} />,
    audio: <AudioWaveform className={className} />,
    calc: <Calculator className={className} />,
    wrench: <Wrench className={className} />,
  };
  return map[key] ?? <Code2 className={className} />;
};

/* ---------- primitives ---------- */
export function Card({ children, className, glow = "cyan" }: { children: ReactNode; className?: string; glow?: "cyan" | "red" | "green" | "gold" | "none" }) {
  const g =
    glow === "red"
      ? "border-[#FF174F]/40 hover:border-[#FF174F] hover:shadow-[0_0_24px_-4px_rgba(255,23,79,0.4)]"
      : glow === "green"
      ? "border-emerald-400/35 hover:border-emerald-400 hover:shadow-[0_0_24px_-4px_rgba(0,255,136,0.35)]"
      : glow === "gold"
      ? "border-amber-400/35 hover:border-amber-400 hover:shadow-[0_0_24px_-4px_rgba(255,179,0,0.35)]"
      : glow === "none"
      ? "border-[#006DFF]/25"
      : "border-[#006DFF]/35 hover:border-[#00C8FF]/70 hover:shadow-[0_0_24px_-4px_rgba(0,229,255,0.35)]";
  return (
    <div className={cn("rounded-lg border bg-gradient-to-br from-[#092033]/95 via-[#0A1726]/95 to-[#080A0F]/98 backdrop-blur-md transition-all duration-250 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]", g, className)}>
      {children}
    </div>
  );
}

export function Btn({
  children, onClick, variant = "primary", className, type = "button", disabled,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "red" | "green" | "ghost" | "outline";
  className?: string; type?: "button" | "submit"; disabled?: boolean;
}) {
  const v = {
    primary: "bg-gradient-to-r from-[#006DFF] to-[#00C8FF] text-white shadow-[0_0_18px_rgba(0,229,255,0.45)] hover:brightness-115 border border-[#00E5FF]/40",
    red: "bg-gradient-to-r from-[#8B0035] to-[#FF174F] text-white shadow-[0_0_18px_rgba(255,23,79,0.4)] hover:brightness-115 border border-[#FF174F]/50",
    green: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_18px_rgba(0,255,136,0.4)] hover:brightness-115 border border-emerald-400/40",
    ghost: "bg-white/5 text-[#B8F3FF] hover:bg-white/10 border border-white/10",
    outline: "bg-[#092033]/80 text-[#00E5FF] border border-[#00C8FF]/40 hover:bg-[#00C8FF]/15 hover:border-[#00C8FF] hover:shadow-[0_0_15px_rgba(0,229,255,0.25)]",
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className={cn("inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", v, className)}>
      {children}
    </button>
  );
}

export function Badge({ children, color = "cyan", className }: { children: ReactNode; color?: "cyan" | "red" | "green" | "gold" | "gray" | "blue"; className?: string }) {
  const c = {
    cyan: "bg-[#071A2B] text-[#00E5FF] border-[#00C8FF]/40 shadow-[0_0_10px_rgba(0,200,255,0.2)]",
    red: "bg-[#2A0815] text-[#FF174F] border-[#FF174F]/40 shadow-[0_0_10px_rgba(255,23,79,0.2)]",
    green: "bg-[#052619] text-[#00FF88] border-[#00FF88]/40 shadow-[0_0_10px_rgba(0,255,136,0.2)]",
    gold: "bg-[#261E05] text-[#FFB300] border-[#FFB300]/40 shadow-[0_0_10px_rgba(255,179,0,0.2)]",
    gray: "bg-[#0B111A] text-[#4C91B5] border-[#006DFF]/25",
    blue: "bg-[#081830] text-[#008CFF] border-[#006DFF]/40",
  }[color];
  return <span className={cn("inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", c, className)}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#4C91B5]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#27506B]">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded border border-[#006DFF]/30 bg-[#0B111A]/90 px-3.5 py-2.5 text-sm text-[#B8F3FF] placeholder-[#4C91B5]/60 outline-none transition-all focus:border-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,229,255,0.4)]";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "appearance-none", props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-[90px]", props.className)} />;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-lg border border-[#00C8FF]/40 bg-[#0B111A] p-6 shadow-[0_0_60px_-10px_rgba(0,200,255,0.4)]", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#006DFF]/20 pb-3">
          <h3 className="font-display text-lg font-bold text-[#B8F3FF]">{title}</h3>
          <button onClick={onClose} className="rounded border border-white/10 px-2.5 py-1 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ icon, label, value, color = "cyan", sub }: { icon: ReactNode; label: string; value: ReactNode; color?: "cyan" | "red" | "green" | "gold" | "blue"; sub?: string }) {
  const c = {
    cyan: "text-[#00E5FF] bg-[#071A2B] border-[#00C8FF]/40",
    red: "text-[#FF174F] bg-[#2A0815] border-[#FF174F]/40",
    green: "text-[#00FF88] bg-[#052619] border-[#00FF88]/40",
    gold: "text-[#FFB300] bg-[#261E05] border-[#FFB300]/40",
    blue: "text-[#008CFF] bg-[#081830] border-[#006DFF]/40",
  }[color];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4C91B5]">{label}</p>
          <p className="font-display mt-1.5 text-2xl font-bold text-[#B8F3FF]">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-[#27506B]">{sub}</p>}
        </div>
        <div className={cn("rounded border p-2.5", c)}>{icon}</div>
      </div>
    </Card>
  );
}

export function PageHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-black tracking-tight text-[#B8F3FF] sm:text-3xl lg:text-4xl drop-shadow-[0_0_15px_rgba(0,229,255,0.35)]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm font-semibold tracking-wider uppercase text-[#4C91B5]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#006DFF]/30 bg-[#0B111A]/60 py-14 text-center">
      <div className="mb-3 text-[#4C91B5]">{icon}</div>
      <p className="font-semibold text-[#B8F3FF]">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-[#4C91B5]">{sub}</p>}
    </div>
  );
}

export function Progress({ value, color = "cyan" }: { value: number; color?: "cyan" | "red" | "green" | "gold" }) {
  const c = { cyan: "from-cyan-400 to-blue-500", red: "from-red-500 to-rose-500", green: "from-emerald-400 to-teal-500", gold: "from-amber-300 to-orange-400" }[color];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function SectionTitle({ children, color = "cyan" }: { children: ReactNode; color?: "cyan" | "red" | "green" | "blue" | "gold" }) {
  const c = {
    cyan: "text-cyan-300 border-cyan-400/30",
    red: "text-red-400 border-red-500/30",
    green: "text-emerald-300 border-emerald-400/30",
    blue: "text-blue-400 border-blue-500/30",
    gold: "text-amber-300 border-amber-400/30",
  }[color];
  return (
    <div className={cn("mb-4 inline-flex items-center gap-2 rounded-full border bg-white/[0.03] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]", c)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {children}
    </div>
  );
}
