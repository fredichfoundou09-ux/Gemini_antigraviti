import { useState } from "react";
import { Shield, CheckCircle2, XCircle, Search, Award, AlertTriangle, Share2, Download, Copy } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Btn, Card, Field, Input, formationLabel, Badge } from "@/lib/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { credentialService, DigitalCertificate } from "@/modules/credentials/services/credentialService";
import { toastMsg } from "@/lib/toast";

export function CertificateVerifyPage() {
  const { db } = useStore();
  const [numero, setNumero] = useState("");
  const [result, setResult] = useState<"none" | "found" | "notfound">("none");
  const [cert, setCert] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    reason?: string;
    tampered: boolean;
  } | null>(null);

  const search = async () => {
    if (!numero.trim()) return;
    const found = db.certificates.find((c) => c.numero.toLowerCase() === numero.trim().toLowerCase());
    if (found) {
      const student = db.students.find((s) => s.id === found.studentId);
      const studentName = student ? `${student.prenom} ${student.nom}` : found.studentId;
      const certObj: DigitalCertificate = {
        id: found.id,
        numero: found.numero,
        studentId: found.studentId,
        studentName,
        formation: found.formation,
        mention: found.resultat || "Bien",
        date: found.date,
        status: (found as any).status || "valide",
        digital_signature: (found as any).digital_signature,
        revocation_reason: (found as any).revocation_reason,
        expires_at: (found as any).expires_at,
      };

      const verification = await credentialService.verifyCertificate(certObj);
      setVerificationResult(verification);
      setCert({ ...certObj, student });
      setResult("found");
    } else {
      setCert(null);
      setVerificationResult(null);
      setResult("notfound");
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href.split("?")[0] + `?id=${cert?.numero}`;
    navigator.clipboard.writeText(url);
    toastMsg.success("Lien copié !", "Lien public de vérification prêt à être partagé.");
  };

  const handleDownloadOpenBadgeV2 = () => {
    if (!cert) return;
    const badge = credentialService.exportOpenBadgesV2(cert);
    const blob = new Blob([JSON.stringify(badge, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openbadge-v2-${cert.numero}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastMsg.success("Open Badge 2.0 téléchargé", "Assertion conforme au standard 1EdTech.");
  };

  const handleDownloadOpenBadgeV3 = () => {
    if (!cert) return;
    const badge = credentialService.exportOpenBadgesV3(cert);
    const blob = new Blob([JSON.stringify(badge, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifiable-credential-v3-${cert.numero}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toastMsg.success("Open Badge 3.0 W3C téléchargé", "Verifiable Credential généré.");
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-16 text-white">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/50 bg-[#E60000] shadow-[0_0_30px_rgba(255,0,0,0.6)]">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-black text-white">
            Vérification de Diplômes & Certificats
          </h1>
          <p className="mt-2 text-sm text-white/70">
            SENTINELLES NUMÉRIQUES — Registre public et signatures infalsifiables
          </p>
        </div>

        <Card className="p-6 border border-white/15 bg-black/80">
          <Field label="Numéro officiel du certificat">
            <div className="flex gap-2">
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="ex: SN-CERT-2026-0001"
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="font-mono text-white"
              />
              <Btn onClick={search} className="bg-[#E60000] hover:bg-[#FF2A2A] text-white">
                <Search size={16} />
              </Btn>
            </div>
          </Field>
          <p className="mt-2 text-[11px] text-white/50">
            Saisissez le matricule ou scannez le QR Code pour vérifier l'authenticité et le statut légal.
          </p>
        </Card>

        {result === "found" && cert && (
          <div className="mt-5 space-y-4">
            {/* Statut officiel */}
            {cert.status === "revoque" ? (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/60 bg-red-950/40 p-4 text-red-200">
                <AlertTriangle size={26} className="text-red-400 shrink-0" />
                <div>
                  <p className="font-black text-sm uppercase">CERTIFICAT RÉVOQUÉ</p>
                  <p className="text-xs text-white/80">
                    Motif : {cert.revocation_reason || "Annulé par l'autorité académique."}
                  </p>
                </div>
              </div>
            ) : verificationResult?.tampered ? (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/60 bg-red-950/40 p-4 text-red-200">
                <XCircle size={26} className="text-red-400 shrink-0" />
                <div>
                  <p className="font-black text-sm uppercase">SIGNATURE NON CONFORME (ALTÉRATION)</p>
                  <p className="text-xs text-white/80">
                    Les données du document ne correspondent pas à la signature scellée sur le registre.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/60 bg-emerald-950/40 p-4 text-emerald-200">
                <CheckCircle2 size={26} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="font-black text-sm uppercase">CERTIFICAT AUTHENTIQUE & ACTIF</p>
                  <p className="text-xs text-white/80">
                    Intégrité cryptographique confirmée par le registre officiel.
                  </p>
                </div>
              </div>
            )}

            <Card className="overflow-hidden border border-white/10 bg-black/60">
              <div className="border-b border-white/10 bg-white/5 p-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-red-500" />
                  <p className="font-black font-mono text-sm text-white">{cert.numero}</p>
                </div>
                <Badge color={cert.status === "revoque" ? "red" : "green"}>
                  {cert.status === "revoque" ? "RÉVOQUÉ" : "VALIDE"}
                </Badge>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-white/50 block">Bénéficiaire :</span>
                  <span className="font-bold text-white text-sm">
                    {cert.student ? `${cert.student.prenom} ${cert.student.nom}` : cert.studentId}
                  </span>
                </div>
                <div>
                  <span className="text-white/50 block">Matricule :</span>
                  <span className="font-mono text-white/80">{cert.studentId}</span>
                </div>
                <div>
                  <span className="text-white/50 block">Formation :</span>
                  <span className="font-semibold text-white">{formationLabel(cert.formation)}</span>
                </div>
                <div>
                  <span className="text-white/50 block">Mention / Résultat :</span>
                  <span className="font-semibold text-white">{cert.mention || "Admis"}</span>
                </div>
                <div>
                  <span className="text-white/50 block">Date de délivrance :</span>
                  <span className="text-white/80">
                    {cert.date ? format(new Date(cert.date), "d MMMM yyyy", { locale: fr }) : "—"}
                  </span>
                </div>
              </div>

              {/* Actions d'export Open Badges et Partage */}
              <div className="border-t border-white/10 p-3 bg-white/[0.02] flex flex-wrap gap-2 justify-end">
                <Btn variant="outline" onClick={handleCopyLink} className="text-xs py-1">
                  <Share2 size={13} /> Partager
                </Btn>
                <Btn variant="outline" onClick={handleDownloadOpenBadgeV2} className="text-xs py-1">
                  <Download size={13} /> Open Badge 2.0
                </Btn>
                <Btn variant="outline" onClick={handleDownloadOpenBadgeV3} className="text-xs py-1">
                  <Download size={13} /> Open Badge 3.0 (W3C)
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {result === "notfound" && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-red-500/50 bg-red-950/30 p-4 text-red-200">
            <XCircle size={24} className="shrink-0 text-red-400" />
            <div>
              <p className="font-black text-sm">Certificat introuvable</p>
              <p className="text-xs text-white/70">
                Le numéro « {numero} » ne correspond à aucun document certifié enregistré dans notre registre.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-white/40">
            Registre officiel de certification · SENTINELLES NUMÉRIQUES ENIA
          </p>
          <a href="/" className="text-xs text-red-400 hover:underline mt-1 inline-block">
            ← Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}
