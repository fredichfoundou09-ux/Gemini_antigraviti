import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, ShieldAlert, WifiOff, CheckCircle2, UserCheck, ShieldCheck, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import { Badge, Btn, Card, Empty, Field, Input, PageHead, Select, uid, today } from "@/lib/ui";
import { toastMsg } from "@/lib/toast";
import {
  verifyRotatingQrToken,
  queueOfflineOperation,
  syncOfflineQueue,
} from "@/lib/offlineQueue";

type ScanStatus = "pending" | "synced" | "failed";

interface OfflineScan {
  id: string;
  token: string;
  studentId?: string;
  scheduleId?: string;
  date: string;
  heure: string;
  status: ScanStatus;
  reason?: string;
}

const QUEUE_KEY = "sn_qr_offline_queue_v1";

function readQueue(): OfflineScan[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: OfflineScan[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function QrScannerPage() {
  const { db, user, update, log, notify } = useStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [queue, setQueue] = useState<OfflineScan[]>(readQueue());
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState("");

  // Mode Hybride (E2) : Automatique direct VS Confirmation manuelle par le formateur
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(() => {
    return localStorage.getItem("sn_attendance_require_confirm") === "true";
  });
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    raw: string;
    student: any;
    schedule: any;
    moduleId: string;
    heure: string;
  } | null>(null);

  useEffect(() => {
    writeQueue(queue);
  }, [queue]);

  const toggleConfirmMode = (val: boolean) => {
    setRequireConfirmation(val);
    localStorage.setItem("sn_attendance_require_confirm", val ? "true" : "false");
  };

  const schedules = db.schedule.filter((s) => !moduleId || s.moduleId === moduleId);

  const validateScan = (raw: string) => {
    const trimmed = raw.trim();
    let studentId: string | undefined;
    let targetScheduleId: string | undefined;
    let isRotatif = false;

    if (trimmed.startsWith("QR_TOKEN|")) {
      const res = verifyRotatingQrToken(trimmed);
      if (!res.valid) {
        return { ok: false, reason: `ACCÈS REFUSÉ : ${res.reason || "QR Code dynamique 30s invalide"}` };
      }
      studentId = res.studentId;
      targetScheduleId = res.scheduleId;
      isRotatif = true;
    } else if (trimmed.startsWith("SN|")) {
      const parts = trimmed.split("|");
      studentId = parts[1];
    } else {
      return { ok: false, reason: "ACCÈS REFUSÉ : Format de QR Code non reconnu ou altéré." };
    }

    if (!studentId) {
      return { ok: false, reason: "ACCÈS REFUSÉ : Identifiant apprenant absent." };
    }

    const student = db.students.find((s) => s.id === studentId);
    if (!student) {
      return { ok: false, reason: "ACCÈS REFUSÉ : Apprenant introuvable dans la base de données." };
    }

    const finalScheduleId = targetScheduleId || scheduleId;
    const schedule = db.schedule.find((s) => s.id === finalScheduleId);
    if (!schedule && !moduleId) {
      return { ok: false, reason: "ACCÈS REFUSÉ : Veuillez sélectionner la séance ou le module cible." };
    }
    const targetModule = schedule?.moduleId || moduleId;

    // Règle d'éligibilité : Si l'apprenant n'est pas inscrit dans le module -> ACCÈS REFUSÉ
    if (!student.modules.includes(targetModule)) {
      const modObj = db.modules.find((m) => m.id === targetModule);
      return {
        ok: false,
        reason: `ACCÈS REFUSÉ : Apprenant non inscrit dans le module « ${modObj?.titre || targetModule} ». Présence interdite.`,
      };
    }

    const already = db.attendance.some(
      (a) => a.studentId === student.id && a.date === today() && a.moduleId === targetModule
    );
    if (already) {
      return {
        ok: false,
        reason: `PRÉSENCE DÉJÀ VALIDÉE : ${student.prenom} ${student.nom} est déjà enregistré(e) aujourd'hui pour ce cours.`,
      };
    }

    return { ok: true, student, schedule, moduleId: targetModule, isRotatif };
  };

  const handleProcessScan = (raw: string) => {
    setMessage("");
    const validation = validateScan(raw);
    const heure = new Date().toTimeString().slice(0, 5);

    if (!validation.ok) {
      const scan: OfflineScan = {
        id: uid("SCAN"),
        token: raw,
        date: today(),
        heure,
        status: "failed",
        reason: validation.reason,
      };
      setQueue((q) => [scan, ...q]);
      setMessage(validation.reason || "Validation refusée");
      toastMsg.error("Validation de présence refusée", validation.reason);
      return;
    }

    const student = validation.student!;
    const targetModuleId = validation.moduleId!;

    // Mode Hybride : si confirmation requise par le formateur
    if (requireConfirmation) {
      setPendingConfirmation({
        raw,
        student,
        schedule: validation.schedule,
        moduleId: targetModuleId,
        heure,
      });
      return;
    }

    commitAttendance(raw, student, validation.schedule, targetModuleId, heure);
  };

  const commitAttendance = async (
    raw: string,
    student: any,
    schedule: any,
    targetModuleId: string,
    heure: string
  ) => {
    const scan: OfflineScan = {
      id: uid("SCAN"),
      token: raw,
      date: today(),
      heure,
      status: navigator.onLine ? "synced" : "pending",
    };

    if (!navigator.onLine) {
      // Stockage dans la file d'attente IndexedDB + locale
      await queueOfflineOperation("attendance", {
        studentId: student.id,
        moduleId: targetModuleId,
        date: today(),
        statut: "present",
        teacherId: schedule?.teacherId || user!.id,
      });

      setQueue((q) => [{ ...scan, studentId: student.id, scheduleId: schedule?.id, status: "pending" }, ...q]);
      setMessage("Pointage hors-ligne mémorisé : synchronisation automatique dès retour du réseau.");
      toastMsg.info("Pointage hors-ligne", `${student.prenom} ${student.nom} en attente de sync.`);
      setPendingConfirmation(null);
      return;
    }

    update((d) => ({
      ...d,
      attendance: [
        {
          id: uid("ATT"),
          studentId: student.id,
          date: today(),
          moduleId: targetModuleId,
          statut: "present",
          heure,
          salle: schedule?.salle || "",
          teacherId: schedule?.teacherId || user!.id,
        },
        ...d.attendance,
      ],
    }));

    if (student.userId) {
      notify(
        student.userId,
        "Présence validée ✓",
        `Votre présence a été validée avec succès pour le module à ${heure}.`,
        "presence"
      );
    }
    log(`Présence QR validée : ${student.prenom} ${student.nom} [Module: ${targetModuleId}]`);
    setQueue((q) => [{ ...scan, studentId: student.id, scheduleId: schedule?.id, status: "synced" }, ...q]);
    const successMsg = `PRÉSENCE VALIDÉE ✓ : ${student.prenom} ${student.nom} (${student.id}) présent(e) à ${heure}.`;
    setMessage(successMsg);
    toastMsg.success("Présence validée avec succès ✓", `${student.prenom} ${student.nom}`);
    setPendingConfirmation(null);
  };

  const syncQueue = async () => {
    await syncOfflineQueue();
    const pending = queue.filter((s) => s.status === "pending");
    pending.forEach((s) => handleProcessScan(s.token));
    setQueue((q) => q.map((x) => (x.status === "pending" ? { ...x, status: "synced" as const } : x)));
    toastMsg.success("File de présence synchronisée", "Tous les pointages locaux ont été appliqués.");
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return setMessage("Caméra non disponible sur cet appareil.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      setMessage("Caméra activée. Détection active.");
    } catch {
      setMessage("Impossible d'accéder au flux vidéo de la caméra.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHead
        title="Scanner QR Présence (Anti-fraude rotatif 30s)"
        subtitle="Caméra, validation temporelle stricte et mode hybride formateur"
        actions={
          <Btn onClick={syncQueue} variant="outline">
            <RefreshCw size={14} /> Synchroniser la file
          </Btn>
        }
      />

      {/* Barre de contrôle du mode de validation Hybride (E2) */}
      <Card className="p-4 border border-white/10 bg-black/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-red-500" />
              Mode d'enregistrement de présence (E2 Hybride)
            </p>
            <p className="text-[11px] text-white/60">
              Choisissez entre validation automatique instantanée ou approbation préalable par le formateur.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => toggleConfirmMode(false)}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                !requireConfirmation ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              🤖 Automatique direct
            </button>
            <button
              type="button"
              onClick={() => toggleConfirmMode(true)}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                requireConfirmation ? "bg-[#E60000] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              ✋ Confirmation formateur
            </button>
          </div>
        </div>
      </Card>

      {/* Modal / Card de confirmation préalable si mode Hybride activé */}
      {pendingConfirmation && (
        <Card className="p-5 border-2 border-amber-500/70 bg-amber-950/40 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck size={28} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Confirmation Formateur Requise
                </p>
                <p className="text-base font-black text-white">
                  {pendingConfirmation.student.prenom} {pendingConfirmation.student.nom} (
                  {pendingConfirmation.student.id})
                </p>
                <p className="text-xs text-white/70">
                  Heure de pointage : <span className="font-mono font-bold text-white">{pendingConfirmation.heure}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Btn
                variant="outline"
                onClick={() => setPendingConfirmation(null)}
              >
                Rejeter
              </Btn>
              <Btn
                onClick={() =>
                  commitAttendance(
                    pendingConfirmation.raw,
                    pendingConfirmation.student,
                    pendingConfirmation.schedule,
                    pendingConfirmation.moduleId,
                    pendingConfirmation.heure
                  )
                }
                className="bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold"
              >
                Confirmer la présence ✓
              </Btn>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Module">
            <Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="">Choisir un module</option>
              {db.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.numero}. {m.titre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Séance">
            <Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              <option value="">Selon QR / aucune</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.jour} {s.heureDebut}-{s.heureFin}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Btn onClick={startCamera} className="w-full">
              <Camera size={15} /> Activer la Caméra
            </Btn>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/60">
          <video ref={videoRef} autoPlay playsInline className="h-56 w-full object-cover" />
        </div>
        {!cameraActive && (
          <p className="mt-2 text-xs text-white/50">
            Saisie manuelle ou douchette code-barre disponible ci-dessous.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <Field label="Token QR Dynamique (rotatif 30s) ou Legacy">
          <Input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="QR_TOKEN|STU_...|SCH_...|... ou SN|STU_..."
          />
        </Field>
        <Btn
          className="mt-3 bg-[#E60000] hover:bg-[#FF2A2A] text-white font-bold"
          onClick={() => {
            handleProcessScan(manualToken);
            setManualToken("");
          }}
        >
          Valider le scan
        </Btn>
        {message && (
          <div
            className={cn(
              "mt-4 p-3.5 rounded-xl border flex items-center gap-3 text-sm font-semibold",
              message.includes("REFUSÉ")
                ? "border-red-500/60 bg-red-950/40 text-red-200 shadow-[0_0_15px_rgba(255,0,0,0.2)]"
                : "border-emerald-500/60 bg-emerald-950/40 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            )}
          >
            {message.includes("REFUSÉ") ? (
              <ShieldAlert className="text-red-400 shrink-0" size={20} />
            ) : (
              <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
            )}
            <span>{message}</span>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-amber-300" />
            <h3 className="font-display text-sm font-bold text-white">
              Historique local & File offline ({queue.length})
            </h3>
          </div>
          <span className="text-[10px] text-white/50 font-mono">Anti-doublons actif</span>
        </div>
        {queue.length === 0 ? (
          <Empty icon={<ShieldAlert size={32} />} title="Aucun scan enregistré" />
        ) : (
          <div className="space-y-2">
            {queue.slice(0, 20).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
              >
                <span className="font-mono text-white/60">
                  {s.date} {s.heure}
                </span>
                <Badge
                  color={s.status === "synced" ? "green" : s.status === "failed" ? "red" : "gold"}
                >
                  {s.status}
                  {s.reason ? ` · ${s.reason}` : ""}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
