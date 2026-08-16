import { Award, BookOpen, Download, FileText, Users, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { Btn, Card, PageHead, Stat } from "@/lib/ui";
import { exportCsv, exportJsonAsExcel } from "@/lib/export";

export function ReportsPage() {
  const { db } = useStore();
  const rows = [
    { categorie: "pédagogique", indicateur: "apprenants", valeur: db.students.length },
    { categorie: "pédagogique", indicateur: "enseignants", valeur: db.teachers.length },
    { categorie: "pédagogique", indicateur: "modules", valeur: db.modules.length },
    { categorie: "présence", indicateur: "présents", valeur: db.attendance.filter((a) => a.statut === "present").length },
    { categorie: "présence", indicateur: "absents", valeur: db.attendance.filter((a) => a.statut === "absent").length },
    { categorie: "financier", indicateur: "paiements", valeur: db.payments.reduce((a, p) => a + p.montant, 0) },
    { categorie: "institutionnel", indicateur: "certificats", valeur: db.certificates.length },
    { categorie: "institutionnel", indicateur: "bourses", valeur: db.scholarships.length },
  ];
  return (
    <div className="space-y-5">
      <PageHead title="Rapports" subtitle="Rapports pédagogiques, financiers, administratifs et institutionnels" actions={<div className="flex gap-2"><Btn variant="outline" onClick={() => exportCsv("rapports-sentinelles", rows)}><Download size={14}/> CSV</Btn><Btn variant="outline" onClick={() => exportJsonAsExcel("rapports-sentinelles", rows)}><Download size={14}/> Excel</Btn></div>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4"><Stat icon={<Users size={20}/>} label="Apprenants" value={db.students.length}/><Stat icon={<BookOpen size={20}/>} label="Modules" value={db.modules.length}/><Stat icon={<Wallet size={20}/>} label="Paiements" value={db.payments.length}/><Stat icon={<Award size={20}/>} label="Certificats" value={db.certificates.length}/></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((r, i) => <Card key={i} className="p-4"><p className="text-xs uppercase tracking-wider text-slate-500">{r.categorie}</p><p className="font-display text-sm font-bold text-white">{r.indicateur}</p><p className="mt-1 text-2xl font-black text-cyan-300">{r.valeur}</p></Card>)}</div>
      <Card className="p-5"><div className="flex items-center gap-2"><FileText size={16} className="text-cyan-300"/><p className="text-sm text-slate-300">Les exports PDF pourront être branchés via Edge Function pour générer des rapports signés.</p></div></Card>
    </div>
  );
}