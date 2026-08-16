import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { Badge, Btn, Card, Empty, Field, Input, PageHead, Select, uid, today } from "@/lib/ui";

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
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function writeQueue(q: OfflineScan[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

export function QrScannerPage() {
  const { db, user, update, log, notify } = useStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [queue, setQueue] = useState<OfflineScan[]>(readQueue());
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { writeQueue(queue); }, [queue]);

  const schedules = db.schedule.filter((s) => !moduleId || s.moduleId === moduleId);

  const parseToken = (raw: string) => {
    // Nouveau format attendu : QR_TOKEN|student_id|schedule_id|expires_at|signature
    // Fallback ancien : SN|id|nom|prenom|formation
    const parts = raw.split("|");
    if (parts[0] === "QR_TOKEN") return { kind: "secure", studentId: parts[1], scheduleId: parts[2], expiresAt: parts[3], signature: parts[4] };
    if (parts[0] === "SN") return { kind: "legacy", studentId: parts[1] };
    return { kind: "unknown" };
  };

  const validateScan = (raw: string) => {
    const parsed = parseToken(raw.trim());
    if (!parsed.studentId) return { ok: false, reason: "invalid_token" };
    const student = db.students.find((s) => s.id === parsed.studentId);
    if (!student) return { ok: false, reason: "student_not_found" };
    const targetScheduleId = parsed.scheduleId || scheduleId;
    const schedule = db.schedule.find((s) => s.id === targetScheduleId);
    if (!schedule && !moduleId) return { ok: false, reason: "session_required" };
    const targetModule = schedule?.moduleId || moduleId;
    if (!student.modules.includes(targetModule)) return { ok: false, reason: "outside_session" };
    const now = new Date();
    if ((parsed as any).expiresAt && new Date((parsed as any).expiresAt).getTime() < now.getTime()) return { ok: false, reason: "expired_token" };
    const already = db.attendance.some((a) => a.studentId === student.id && a.date === today() && a.moduleId === targetModule);
    if (already) return { ok: false, reason: "duplicate_scan" };
    return { ok: true, student, schedule, moduleId: targetModule };
  };

  const record = (raw: string) => {
    const scan: OfflineScan = { id: uid("SCAN"), token: raw, date: today(), heure: new Date().toTimeString().slice(0, 5), status: navigator.onLine ? "synced" : "pending" };
    const validation = validateScan(raw);
    if (!validation.ok) {
      setQueue((q) => [{ ...scan, status: "failed", reason: validation.reason }, ...q]);
      setMessage(`Scan refusé : ${validation.reason}`);
      return;
    }
    const student = validation.student!;
    const targetModuleId = validation.moduleId!;
    if (!navigator.onLine) {
      setQueue((q) => [{ ...scan, studentId: student.id, scheduleId: validation.schedule?.id, status: "pending" }, ...q]);
      setMessage("Hors ligne : scan ajouté à la file de synchronisation.");
      return;
    }
    update((d) => ({
      ...d,
      attendance: [{ id: uid("ATT"), studentId: student.id, date: today(), moduleId: targetModuleId, statut: "present", heure: scan.heure, salle: validation.schedule?.salle || "", teacherId: validation.schedule?.teacherId || user!.id }, ...d.attendance]
    }));
    if (student.userId) notify(student.userId, "Présence enregistrée", `Présence validée à ${scan.heure}.`, "presence");
    log(`Présence QR enregistrée : ${student.prenom} ${student.nom}`);
    setQueue((q) => [{ ...scan, studentId: student.id, scheduleId: validation.schedule?.id, status: "synced" }, ...q]);
    setMessage("Présence enregistrée.");
  };

  const syncQueue = () => {
    const pending = queue.filter((s) => s.status === "pending");
    pending.forEach((s) => record(s.token));
    setQueue((q) => q.map((x) => x.status === "pending" ? { ...x, status: "synced" as const } : x));
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setMessage("Caméra non disponible sur cet appareil.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    if (videoRef.current) videoRef.current.srcObject = stream;
    setCameraActive(true);
    setMessage("Caméra activée. Si votre navigateur supporte BarcodeDetector, le scan automatique pourra être branché ici.");
  };

  return (
    <div className="space-y-5">
      <PageHead title="Scanner QR Présence" subtitle="Caméra, validation anti-fraude et file offline" actions={<Btn onClick={syncQueue} variant="outline"><RefreshCw size={14}/> Synchroniser</Btn>} />
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Module"><Select value={moduleId} onChange={(e) => setModuleId(e.target.value)}><option value="">Choisir un module</option>{db.modules.map((m) => <option key={m.id} value={m.id}>{m.numero}. {m.titre}</option>)}</Select></Field>
          <Field label="Séance"><Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}><option value="">Selon QR / aucune</option>{schedules.map((s) => <option key={s.id} value={s.id}>{s.jour} {s.heureDebut}-{s.heureFin}</option>)}</Select></Field>
          <div className="flex items-end"><Btn onClick={startCamera} className="w-full"><Camera size={15}/> Caméra</Btn></div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <video ref={videoRef} autoPlay playsInline className="h-56 w-full object-cover" />
        </div>
        {!cameraActive && <p className="mt-2 text-xs text-slate-500">Vous pouvez utiliser la saisie manuelle ci-dessous si la caméra n'est pas disponible.</p>}
      </Card>
      <Card className="p-5">
        <Field label="Token QR / QR legacy"><Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="QR_TOKEN|... ou SN|..." /></Field>
        <Btn className="mt-3" onClick={() => { record(manualToken); setManualToken(""); }}>Valider le scan</Btn>
        {message && <p className="mt-3 text-sm text-cyan-300">{message}</p>}
      </Card>
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2"><WifiOff size={16} className="text-amber-300"/><h3 className="font-display text-sm font-bold text-white">File offline / audit ({queue.length})</h3></div>
        {queue.length === 0 ? <Empty icon={<ShieldAlert size={32}/>} title="Aucun scan" /> : <div className="space-y-2">{queue.slice(0, 20).map((s) => <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"><span className="font-mono text-slate-400">{s.date} {s.heure}</span><Badge color={s.status === "synced" ? "green" : s.status === "failed" ? "red" : "gold"}>{s.status}{s.reason ? ` · ${s.reason}` : ""}</Badge></div>)}</div>}
      </Card>
    </div>
  );
}
