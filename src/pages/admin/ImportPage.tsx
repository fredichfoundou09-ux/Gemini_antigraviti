import { useRef, useState } from "react";
import { Upload, CheckCircle2, XCircle, AlertTriangle, Download, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, PageHead, Badge, today, formationLabel } from "@/lib/ui";
import { Formation } from "@/lib/types";
import { validate, studentSchema } from "@/lib/validators";
import { toastMsg } from "@/lib/toast";
import { cn } from "@/utils/cn";

interface ImportRow {
  idx: number;
  raw: Record<string, string>;
  status: "valid" | "error" | "warning";
  errors: Record<string, string>;
  nom?: string;
  prenom?: string;
  formation?: Formation;
  telephone?: string;
  whatsapp?: string;
  email?: string;
  niveau?: string;
}

const TEMPLATE_HEADERS = ["nom", "prenom", "formation", "telephone", "whatsapp", "email", "niveau"];
const FORMATION_MAPPING: Record<string, Formation> = {
  informatique: "informatique", génieinformatique: "informatique",
  industriel: "industriel", génieindustriel: "industriel",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[;,\t]/).map((h) => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(/[;,\t]/);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
    return obj;
  });
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(";"), "DUPONT;Jean;informatique;06 12 34 56;06 12 34 56;jean@exemple.com;Baccalauréat C"].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modele-import-apprenants.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function ImportPage() {
  const { update, nextStudentId, log } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [imported, setImported] = useState(0);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const handleFile = async (file: File) => {
    const text = await file.text();
    const raw = parseCSV(text);
    const parsed: ImportRow[] = raw.map((r, idx) => {
      const formation = FORMATION_MAPPING[r.formation?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "") ?? ""] as Formation | undefined;
      const data = { nom: r.nom, prenom: r.prenom, formation, telephone: r.telephone, whatsapp: r.whatsapp || r.telephone, email: r.email, niveau: r.niveau };
      const v = validate(studentSchema, data);
      return {
        idx, raw: r, ...data, formation,
        status: v.ok ? "valid" : "error",
        errors: v.ok ? {} : v.errors,
      } as ImportRow;
    });
    setRows(parsed);
    setStep("preview");
  };

  const importAll = () => {
    const valid = rows.filter((r) => r.status === "valid");
    let count = 0;
    update((d) => {
      const next = { ...d };
      for (const row of valid) {
        const id = nextStudentId();
        const s = {
          id, nom: row.nom!, prenom: row.prenom!, dateNaissance: "", sexe: "M" as const,
          telephone: row.telephone!, whatsapp: row.whatsapp || row.telephone!,
          email: row.email || "", adresse: "", niveau: row.niveau || "",
          formation: row.formation!, modules: [], dateInscription: today(),
          statutPaiement: "impaye" as const, statut: "actif" as const,
        };
        next.students = [s, ...next.students];
        count++;
      }
      return next;
    });
    const skipped = rows.length - valid.length;
    setImported(count);
    log(`Import CSV : ${count} apprenant(s) importé(s), ${skipped} ignoré(s)`);
    toastMsg.success(`${count} apprenant(s) importé(s)`, skipped > 0 ? `${skipped} ligne(s) ignorée(s) pour erreur` : undefined);
    setStep("done");
  };

  const validCount = rows.filter((r) => r.status === "valid").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-5">
      <PageHead
        title="Import d'apprenants"
        subtitle="Importez des apprenants en masse depuis un fichier CSV ou Excel"
        actions={<Btn variant="outline" onClick={downloadTemplate}><Download size={14} /> Modèle CSV</Btn>}
      />

      {step === "upload" && (
        <Card className="p-8 text-center" glow="cyan">
          <Upload size={44} className="mx-auto mb-4 text-cyan-300" />
          <h3 className="font-display text-xl font-black text-white">Importer un fichier</h3>
          <p className="mt-2 text-sm text-slate-400">Formats acceptés : CSV (séparateur ; ou ,) — Excel (.csv exporté)</p>
          <p className="mt-1 text-xs text-slate-500">Colonnes attendues : {TEMPLATE_HEADERS.join(", ")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Btn onClick={() => fileRef.current?.click()}>Choisir un fichier</Btn>
            <Btn variant="outline" onClick={downloadTemplate}><Download size={14} /> Télécharger le modèle</Btn>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </Card>
      )}

      {step === "preview" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center" glow="cyan"><p className="text-[10px] uppercase text-slate-500">Total lignes</p><p className="font-display text-2xl font-black text-white">{rows.length}</p></Card>
            <Card className="p-4 text-center" glow="green"><p className="text-[10px] uppercase text-slate-500">Valides</p><p className="font-display text-2xl font-black text-emerald-300">{validCount}</p></Card>
            <Card className="p-4 text-center" glow="red"><p className="text-[10px] uppercase text-slate-500">Erreurs</p><p className="font-display text-2xl font-black text-red-400">{errorCount}</p></Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-4 py-3">#</th><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Prénom</th>
                  <th className="px-4 py-3">Formation</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.idx} className={cn("border-b border-white/5 last:border-0", row.status === "error" && "bg-red-500/[0.03]")}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-white">{row.nom || <span className="text-red-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-300">{row.prenom || <span className="text-red-400">—</span>}</td>
                    <td className="px-4 py-3">
                      {row.formation ? <Badge color={row.formation === "informatique" ? "red" : "cyan"}>{formationLabel(row.formation)}</Badge> : <Badge color="red">Invalide</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.telephone || "—"}</td>
                    <td className="px-4 py-3">
                      {row.status === "valid"
                        ? <span className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 size={14} /> Valide</span>
                        : <span className="flex items-center gap-1.5 text-red-400"><XCircle size={14} />{Object.values(row.errors)[0]}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {errorCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
              {errorCount} ligne(s) seront ignorées. Corrigez votre fichier et réimportez pour inclure les données manquantes.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={() => { setRows([]); setStep("upload"); }}>Annuler</Btn>
            {validCount > 0 && <Btn onClick={importAll}><Users size={15} /> Importer {validCount} apprenant(s)</Btn>}
          </div>
        </>
      )}

      {step === "done" && (
        <Card className="p-8 text-center" glow="green">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-300" />
          <h3 className="font-display text-xl font-black text-white">{imported} apprenant(s) importé(s)</h3>
          <p className="mt-2 text-sm text-slate-400">Les comptes individuels seront créés manuellement depuis la page Apprenants.</p>
          <Btn className="mt-5" onClick={() => { setRows([]); setStep("upload"); }}>Importer un autre fichier</Btn>
        </Card>
      )}
    </div>
  );
}
