import { useState } from "react";
import { Shield, CheckCircle2, XCircle, Search, Award } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, formationLabel } from "@/lib/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function CertificateVerifyPage() {
  const { db } = useStore();
  const [numero, setNumero] = useState("");
  const [result, setResult] = useState<"none" | "found" | "notfound">("none");
  const [cert, setCert] = useState<any>(null);

  const search = () => {
    if (!numero.trim()) return;
    const found = db.certificates.find((c) => c.numero.toLowerCase() === numero.trim().toLowerCase());
    if (found) {
      const student = db.students.find((s) => s.id === found.studentId);
      setCert({ ...found, student });
      setResult("found");
    } else {
      setCert(null);
      setResult("notfound");
    }
  };

  return (
    <div className="min-h-screen bg-[#05070D] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_30px_-6px_rgba(0,229,255,0.8)]">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-black text-white">Vérification de certificat</h1>
          <p className="mt-2 text-sm text-slate-400">SENTINELLES NUMÉRIQUES — Service de vérification authentique</p>
        </div>

        <Card className="p-6" glow="cyan">
          <Field label="Numéro du certificat">
            <div className="flex gap-2">
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="ex: SN-CERT-2026-0001"
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="font-mono"
              />
              <Btn onClick={search}><Search size={16} /></Btn>
            </div>
          </Field>
          <p className="mt-2 text-[11px] text-slate-500">Entrez le numéro de certificat tel qu'il figure sur le document officiel, ou scannez le QR Code correspondant.</p>
        </Card>

        {result === "found" && cert && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/5 px-5 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-300" />
              <div>
                <p className="font-display font-black text-emerald-300">Certificat AUTHENTIQUE</p>
                <p className="text-xs text-slate-400">Ce certificat est enregistré dans la base officielle de SENTINELLES NUMÉRIQUES.</p>
              </div>
            </div>

            <Card className="overflow-hidden" glow="gold">
              <div className="border-b border-white/5 bg-amber-400/5 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Award size={20} className="text-amber-300" />
                  <p className="font-display font-black text-white">{cert.numero}</p>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <InfoRow label="Bénéficiaire" value={cert.student ? `${cert.student.prenom} ${cert.student.nom}` : cert.studentId} />
                <InfoRow label="N° Apprenant" value={cert.studentId} mono />
                <InfoRow label="Formation" value={formationLabel(cert.formation)} />
                <InfoRow label="Résultat" value={cert.resultat} />
                <InfoRow label="Note obtenue" value={`${cert.note}/20`} />
                <InfoRow label="Période" value={cert.periode} />
                <InfoRow label="Date d'émission" value={cert.date ? format(new Date(cert.date), "d MMMM yyyy", { locale: fr }) : "—"} />
              </div>
            </Card>
          </div>
        )}

        {result === "notfound" && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-500/40 bg-red-500/5 px-5 py-4">
            <XCircle size={24} className="shrink-0 text-red-400" />
            <div>
              <p className="font-display font-black text-red-400">Certificat introuvable</p>
              <p className="text-xs text-slate-400">Le numéro « {numero} » ne correspond à aucun certificat enregistré. Vérifiez la saisie ou contactez l'établissement.</p>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">Service de vérification — SENTINELLES NUMÉRIQUES · ENIA 2.0</p>
          <a href="/" className="text-xs text-cyan-400 hover:underline">← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-0.5 font-bold text-slate-200", mono && "font-mono text-cyan-300")}>{value}</p>
    </div>
  );
}
