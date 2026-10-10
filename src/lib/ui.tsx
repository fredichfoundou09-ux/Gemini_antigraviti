import React, { ReactNode } from "react";
import {
  Code2, Network, Server, Terminal, ShieldCheck, Sigma, Lock, Cog, Zap, Cpu, Plug,
  Factory, Waves, GitBranch, Ruler, Binary, AudioWaveform, Calculator, Wrench, FolderLock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Formation } from "./types";
import { getBrazzavilleDateISO } from "./timeUtils";
export { SentinelLogo, SENTINEL_ASSETS } from "@/components/SentinelLogo";

/* ---------- helpers ---------- */
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const fmt = (n: number) => n.toLocaleString("fr-FR");

export const money = (n: number) => `${fmt(n)} FCFA`;

export const formationLabel = (f: Formation) => (f === "informatique" ? "Génie Informatique" : "Génie Industriel");

export const today = () => getBrazzavilleDateISO();

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

function sanitizePrintHtml(html: string): string {
  // Supprime les émojis bruts pour un document officiel, net et épuré
  return html.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
}

export function printHTML(title: string, body: string) {
  const cleanedBody = sanitizePrintHtml(body);
  const w = window.open("", "_blank", "width=960,height=800");
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
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    body {
      padding: 16px;
    }
    .print-actions-toolbar {
      max-width: 860px;
      margin: 0 auto 16px auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }
    .print-actions-toolbar .brand-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #38bdf8;
    }
    .print-actions-toolbar .btn-group {
      display: flex;
      gap: 8px;
    }
    .print-actions-toolbar button {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .print-actions-toolbar button:hover {
      background: #0369a1;
    }
    .print-actions-toolbar button.btn-secondary {
      background: #334155;
    }
    .print-actions-toolbar button.btn-secondary:hover {
      background: #475569;
    }
    .receipt, .print-doc, .document-container {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff !important;
      border: 2px solid #0284c7 !important;
      border-radius: 8px;
      padding: 28px 32px;
      color: #0f172a !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 0 0 8px 0;
      color: #0c4a6e !important;
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
      background-color: #0284c7 !important;
      color: #ffffff !important;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    hr {
      border: none !important;
      border-top: 2px solid #0284c7 !important;
      margin: 18px 0 !important;
    }
    /* Styles colorés Sentinelle préservés pour impression papier nette et professionnelle */
    .accent, .cyan {
      color: #0284c7 !important;
      font-weight: 700;
    }
    .gold {
      color: #b45309 !important;
      font-weight: 700;
    }
    .red {
      color: #dc2626 !important;
      font-weight: 700;
    }
    .green {
      color: #059669 !important;
      font-weight: 700;
    }
    .badge-official {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1.5px solid #0284c7;
      background: #f0f9ff;
      font-size: 10.5px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
    }
    @media print {
      body {
        padding: 0 !important;
        background: #ffffff !important;
      }
      .print-actions-toolbar {
        display: none !important;
      }
      .receipt, .print-doc, .document-container {
        border: 2px solid #0284c7 !important;
        border-radius: 0 !important;
        padding: 16px 20px !important;
        max-width: 100% !important;
        box-shadow: none !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions-toolbar">
    <div class="brand-title">SENTINELLES NUMÉRIQUES — Impression & Export PDF</div>
    <div class="btn-group">
      <button onclick="window.print()">Imprimer / Enregistrer en PDF (Ctrl+P)</button>
      <button class="btn-secondary" onclick="downloadDoc()">Télécharger (HTML / Document)</button>
      <button class="btn-secondary" onclick="window.close()">Fermer</button>
    </div>
  </div>
  ${cleanedBody}
  <script>
    function downloadDoc() {
      const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.html';
      a.click();
    }
    window.onload = function() {
      setTimeout(function() { window.print(); }, 350);
    };
  </script>
</body>
</html>`);
  w.document.close();
}

export function officialPrintDoc(title: string, contentHTML: string, docType = "DOCUMENT OFFICIEL") {
  return `
    <div class="receipt">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/assets/branding/sentinel-symbol.webp" style="height:52px;width:52px;object-fit:contain" alt="SENTINEL'S" />
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
      ? "border-neonred/40 hover:border-neonred hover:shadow-[0_0_24px_-4px_rgba(255,16,24,0.4)]"
      : glow === "green"
      ? "border-emerald-400/35 hover:border-emerald-400 hover:shadow-[0_0_24px_-4px_rgba(0,255,136,0.35)]"
      : glow === "gold"
      ? "border-amber-400/35 hover:border-amber-400 hover:shadow-[0_0_24px_-4px_rgba(255,179,0,0.35)]"
      : glow === "none"
      ? "border-electric/25"
      : "border-electric/35 hover:border-cyber/70 hover:shadow-[0_0_24px_-4px_rgba(0,200,255,0.35)]";
  return (
    <div className={cn("rounded-lg border bg-gradient-to-br from-panel/75 via-panel2/75 to-night/80 backdrop-blur-lg transition-all duration-250 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)]", g, className)}>
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
    primary: "bg-gradient-to-r from-electric to-cyber text-white shadow-[0_0_18px_rgba(0,200,255,0.45)] hover:brightness-115 border border-neon/40",
    red: "bg-gradient-to-r from-magentadark to-magenta text-white shadow-[0_0_18px_rgba(255,16,24,0.4)] hover:brightness-115 border border-magenta/50",
    green: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_18px_rgba(0,255,136,0.4)] hover:brightness-115 border border-emerald-400/40",
    ghost: "bg-white/5 text-hudtext hover:bg-white/10 border border-white/10",
    outline: "bg-panel/80 text-neon border border-cyber/40 hover:bg-cyber/15 hover:border-cyber hover:shadow-[0_0_15px_rgba(0,200,255,0.25)]",
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title}
      className={cn("inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer", v, className)}>
      {children}
    </button>
  );
}

export function Badge({ children, color = "cyan", className }: { children: ReactNode; color?: "cyan" | "red" | "green" | "gold" | "gray" | "blue"; className?: string }) {
  const c = {
    cyan: "bg-night3 text-neon border-cyber/40 shadow-[0_0_10px_rgba(0,200,255,0.2)]",
    red: "bg-magentadark/30 text-magenta border-magenta/40 shadow-[0_0_10px_rgba(255,16,24,0.2)]",
    green: "bg-emerald-950/60 text-emerald-300 border-emerald-400/40 shadow-[0_0_10px_rgba(0,255,136,0.2)]",
    gold: "bg-amber-950/60 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(255,179,0,0.2)]",
    gray: "bg-night2 text-hudmuted border-electric/25",
    blue: "bg-panel text-electric2 border-electric/40",
  }[color];
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", c, className)}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-hudmuted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-huddim">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-electric/30 bg-night2/90 px-3.5 py-2.5 text-sm text-hudtext placeholder:text-hudmuted/60 outline-none transition-all focus:border-cyber focus:shadow-[0_0_16px_rgba(0,200,255,0.4)]";

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
      <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-lg border border-cyber/40 bg-night2 p-6 shadow-[0_0_60px_-10px_rgba(0,200,255,0.4)]", wide ? "max-w-4xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-electric/20 pb-3">
          <h3 className="font-display text-lg font-bold text-hudtext">{title}</h3>
          <button onClick={onClose} className="rounded border border-white/10 px-2.5 py-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ icon, label, value, color = "cyan", sub, action }: { icon: ReactNode; label: string; value: ReactNode; color?: "cyan" | "red" | "green" | "gold" | "blue"; sub?: string; action?: ReactNode }) {
  const c = {
    cyan: "text-neon bg-night3 border-cyber/40",
    red: "text-magenta bg-magentadark/30 border-magenta/40",
    green: "text-emerald-300 bg-emerald-950/60 border-emerald-400/40",
    gold: "text-amber-300 bg-amber-950/60 border-amber-400/40",
    blue: "text-electric2 bg-panel border-electric/40",
  }[color];
  return (
    <Card className="p-4 relative group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-hudmuted">{label}</p>
          <p className="font-display mt-1.5 text-2xl font-bold text-hudtext">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-huddim">{sub}</p>}
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
        <h1 className="font-display text-2xl font-black tracking-tight text-hudtext sm:text-3xl lg:text-4xl drop-shadow-[0_0_15px_rgba(0,200,255,0.35)]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm font-semibold tracking-wider uppercase text-hudmuted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-electric/30 bg-night2/60 py-14 text-center">
      <div className="mb-3 text-hudmuted">{icon}</div>
      <p className="font-semibold text-hudtext">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-sm text-hudmuted">{sub}</p>}
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
