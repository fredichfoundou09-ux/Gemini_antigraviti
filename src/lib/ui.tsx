import React, { ReactNode } from "react";
import {
  Code2, Network, Server, Terminal, ShieldCheck, Sigma, Lock, Cog, Zap, Cpu, Plug,
  Factory, Waves, GitBranch, Ruler, Binary, AudioWaveform, Calculator, Wrench, FolderLock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Formation } from "./types";
export { SentinelLogo, SENTINEL_ASSETS } from "@/components/SentinelLogo";

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
  const w = window.open("", "_blank", "width=900,height=750");
  if (!w) return;
  w.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    body {
      padding: 24px;
    }
    .receipt, .print-doc, .document-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff !important;
      border: 1.5px solid #0f172a !important;
      border-radius: 8px;
      padding: 28px 32px;
      color: #0f172a !important;
      box-shadow: none !important;
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 0 0 8px 0;
      color: #0f172a !important;
      font-weight: 800;
      line-height: 1.2;
    }
    p {
      margin: 0 0 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
      color: #0f172a !important;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .label {
      color: #475569 !important;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 3px;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 9px 12px;
      text-align: left;
      font-size: 12.5px;
      color: #0f172a !important;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #1e293b !important;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    hr {
      border: none !important;
      border-top: 1.5px solid #0f172a !important;
      margin: 18px 0 !important;
    }
    /* Normalisation des styles colorés pour impression papier nette */
    .accent, .cyan, .gold, .red, .green {
      color: #0f172a !important;
      font-weight: 700;
    }
    .badge-official {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #0f172a;
      background: #f8fafc;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }
    @media print {
      body {
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .receipt, .print-doc, .document-container {
        border: 1.5px solid #000000 !important;
        border-radius: 0 !important;
        padding: 20px 24px !important;
        max-width: 100% !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        text-shadow: none !important;
        box-shadow: none !important;
      }
      [style*="color:#fff"], [style*="color: #fff"], [style*="color:white"], [style*="color: white"] {
        color: #000000 !important;
      }
      [style*="color:#38bdf8"], [style*="color: #38bdf8"], [style*="color:#00E5FF"], [style*="color: #00E5FF"],
      [style*="color:#34d399"], [style*="color: #34d399"], [style*="color:#00FF88"], [style*="color: #00FF88"],
      [style*="color:#f87171"], [style*="color: #f87171"], [style*="color:#FF174F"], [style*="color: #FF174F"],
      [style*="color:#FFB300"], [style*="color: #FFB300"] {
        color: #000000 !important;
      }
      [style*="background:rgba"], [style*="background: rgba"], [style*="background:#0A1224"], [style*="background: #0A1224"] {
        background: #ffffff !important;
      }
      [style*="border-color:#1d2b45"], [style*="border-color: #1d2b45"], [style*="border:1px solid #1d2b45"], [style*="border: 1px solid #1d2b45"] {
        border-color: #000000 !important;
      }
    }
  </style>
</head>
<body>
  ${body}
  <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
</body>
</html>`);
  w.document.close();
}

export function officialPrintDoc(title: string, contentHTML: string, docType = "DOCUMENT OFFICIEL") {
  return `
    <div class="receipt">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/assets/branding/sentinel-symbol.png" style="height:52px;width:52px;object-fit:contain" alt="SENTINEL'S" />
          <div>
            <h2 style="margin:0;font-size:16px;font-weight:900;letter-spacing:1px;color:#0f172a">SENTINELLE NUMÉRIQUE</h2>
            <p style="margin:2px 0 0;font-size:10.5px;color:#334155;text-transform:uppercase;letter-spacing:1px;font-weight:700">ENIA 2.0 · RÉPUBLIQUE DU CONGO</p>
          </div>
        </div>
        <div style="text-align:right">
          <span class="badge-official">${docType}</span>
          <p style="margin:4px 0 0;font-size:11px;color:#475569;font-weight:600">${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>
      ${contentHTML}
      <div style="margin-top:28px;border-top:1px dashed #cbd5e1;padding-top:12px;text-align:center;font-size:9.5px;color:#64748b;letter-spacing:1.5px;font-weight:600">
        SENTINELLES NUMÉRIQUES — ÉCOLE DU NUMÉRIQUE ET DE L'INTELLIGENCE ARTIFICIELLE (ENIA 2.0)
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
    <div className={cn("rounded-lg border bg-gradient-to-br from-[#092033]/75 via-[#0A1726]/75 to-[#080A0F]/80 backdrop-blur-lg transition-all duration-250 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]", g, className)}>
      {children}
    </div>
  );
}

export function Btn({
  children, onClick, variant = "primary", className, type = "button", disabled, title,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "red" | "green" | "ghost" | "outline";
  className?: string; type?: "button" | "submit"; disabled?: boolean; title?: string;
}) {
  const v = {
    primary: "bg-gradient-to-r from-[#006DFF] to-[#00C8FF] text-white shadow-[0_0_18px_rgba(0,229,255,0.45)] hover:brightness-115 border border-[#00E5FF]/40",
    red: "bg-gradient-to-r from-[#8B0035] to-[#FF174F] text-white shadow-[0_0_18px_rgba(255,23,79,0.4)] hover:brightness-115 border border-[#FF174F]/50",
    green: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_18px_rgba(0,255,136,0.4)] hover:brightness-115 border border-emerald-400/40",
    ghost: "bg-white/5 text-[#B8F3FF] hover:bg-white/10 border border-white/10",
    outline: "bg-[#092033]/80 text-[#00E5FF] border border-[#00C8FF]/40 hover:bg-[#00C8FF]/15 hover:border-[#00C8FF] hover:shadow-[0_0_15px_rgba(0,229,255,0.25)]",
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title}
      className={cn("inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none", v, className)}>
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
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", c, className)}>{children}</span>;
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
  "w-full rounded-md border border-[#006DFF]/30 bg-[#0B111A]/90 px-3.5 py-2.5 text-sm text-[#B8F3FF] placeholder-[#4C91B5]/60 outline-none transition-all focus:border-[#00C8FF] focus:shadow-[0_0_16px_rgba(0,229,255,0.4)]";

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

export function Stat({ icon, label, value, color = "cyan", sub, action }: { icon: ReactNode; label: string; value: ReactNode; color?: "cyan" | "red" | "green" | "gold" | "blue"; sub?: string; action?: ReactNode }) {
  const c = {
    cyan: "text-[#00E5FF] bg-[#071A2B] border-[#00C8FF]/40",
    red: "text-[#FF174F] bg-[#2A0815] border-[#FF174F]/40",
    green: "text-[#00FF88] bg-[#052619] border-[#00FF88]/40",
    gold: "text-[#FFB300] bg-[#261E05] border-[#FFB300]/40",
    blue: "text-[#008CFF] bg-[#081830] border-[#006DFF]/40",
  }[color];
  return (
    <Card className="p-4 relative group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4C91B5]">{label}</p>
          <p className="font-display mt-1.5 text-2xl font-bold text-[#B8F3FF]">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-[#27506B]">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={cn("rounded border p-2.5", c)}>{icon}</div>
          {action}
        </div>
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
    <div className="h-2 w-full overflow-hidden rounded-md bg-white/5">
      <div className={cn("h-full rounded-md bg-gradient-to-r transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
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
    <div className={cn("mb-4 inline-flex items-center gap-2 rounded-md border bg-white/[0.03] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em]", c)}>
      <span className="h-1.5 w-1.5 rounded-sm bg-current animate-pulse" />
      {children}
    </div>
  );
}
