import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Users, Search, PlusCircle, Eye, EyeOff, Pencil, UserCircle2, Phone, Mail, MapPin, CalendarDays,
  GraduationCap, ShieldCheck, Trash2, CheckCircle2, XCircle, KeyRound, Clock, Wallet, BadgeDollarSign, Timer, MessageCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/utils/cn";
import {
  Btn, Badge, Card, Empty, Field, Input, Modal, PageHead, Select, Textarea, Stat, uid, today,
  formationLabel, money, moduleIcon, readImage,
} from "@/lib/ui";
import { Student, Formation, User, Role, DB } from "@/lib/types";
import { AppRole } from "@/lib/supabase/auth";
import { PARTNER_SCOPES } from "@/types/rbac";
import { resolveFormationId } from "@/lib/supabase/formations";
import { hashPassword, generateTempPassword, passwordStrong, checkPassword } from "@/lib/auth";
import { toastMsg } from "@/lib/toast";
import { invokeCreateUser } from "@/lib/supabase/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { financialSummary, statusLabel } from "@/lib/finance";
import { teacherFinanceSummary } from "@/lib/teacher";
// lib/access importé via Operations uniquement

/* ---------- helpers ---------- */
function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Génère un compte utilisateur en mode local (fallback sans Supabase).
 * En mode Supabase (isSupabaseConfigured === true), NE PAS appeler cette fonction :
 * utiliser à la place invokeCreateUser() qui stocke les credentials côté serveur.
 */
export async function makeAccount(db: DB, student: Student, role: "student" | "teacher" = "student"): Promise<{ users: User[]; student: Student; tempPassword: string }> {
  const base = `${student.prenom}.${student.nom}`.toLowerCase();
  let username = slugify(base) || `user${Math.floor(Math.random() * 10000)}`;
  let i = 1;
  const taken = new Set(db.users.map((u: User) => u.username));
  while (taken.has(username)) username = `${slugify(base)}${i++}`;
  const userId = `u-${username}`;
  const tempPassword = generateTempPassword();
  // En mode local uniquement : hashage PBKDF2 côté client.
  const hash = await hashPassword(tempPassword);
  const user: User = {
    id: userId, username,
    password: hash, // Stocké uniquement en localStorage (mode local hors Supabase)
    role,
    name: `${student.prenom} ${student.nom}`, email: student.email, phone: student.telephone,
    linkedId: student.id, createdAt: today(), actif: true,
  };
  return { users: [...db.users, user], student: { ...student, userId }, tempPassword };
}

/* ================= STUDENTS ================= */
const emptyStudent = (): Omit<Student, "id"> => ({
  nom: "", prenom: "", dateNaissance: "", sexe: "M", telephone: "", whatsapp: "", email: "",
  adresse: "", niveau: "", formation: "informatique", modules: [], dateInscription: today(),
  statutPaiement: "impaye", statut: "actif",
});

export function StudentsPage() {
  const { db, update, nextStudentId, notify, log, computeAmount } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"tous" | Formation>("tous");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Student | null>(null);
  const [form, setForm] = useState<any>(emptyStudent());
  const [createdCreds, setCreatedCreds] = useState<{ nom: string; identifiant: string; motDePasse: string; phone?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const filtered = db.students.filter((s) => {
    const matchQ = `${s.nom} ${s.prenom} ${s.id}`.toLowerCase().includes(q.toLowerCase());
    const matchT = tab === "tous" || s.formation === tab;
    return matchQ && matchT;
  });

  const save = async () => {
    if (!form.nom || !form.prenom) return;
    if (editing) {
      if (isSupabaseConfigured) {
        try {
          const resolvedFormationId = await resolveFormationId(form.formation);
          await supabase.from("students").update({
            formation_id: resolvedFormationId,
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
            whatsapp: form.whatsapp,
            email: form.email || null,
            adresse: form.adresse || null,
            niveau: form.niveau || null,
            sexe: form.sexe || null,
            photo_url: form.photo || null,
          }).eq("id", editing.id);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          toastMsg.success("Apprenant mis à jour côté serveur ✓");
        } catch (err: any) {
          toastMsg.error("Erreur mise à jour", err.message);
        }
      }
      update((d) => ({ ...d, students: d.students.map((s) => (s.id === editing.id ? { ...s, ...form } : s)) }));
      log(`Apprenant modifié : ${form.nom} ${form.prenom}`);
    } else {
      const montant = computeAmount(form.formation, form.modules.length);
      const insc = db.settings.frais.inscription;
      const baseUname = slugify(`${form.prenom}.${form.nom}`) || `user${Math.floor(Math.random() * 10000)}`;
      let uname = baseUname;
      let i = 1;
      while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
      const tempPassword = generateTempPassword();

      if (isSupabaseConfigured) {
        try {
          const email = form.email || `${uname}@sentinelles.local`;
          const resolvedFormationId = await resolveFormationId(form.formation);
          await invokeCreateUser({
            email,
            password: tempPassword,
            username: uname,
            name: `${form.prenom} ${form.nom}`,
            role: "student",
            student: {
              formation_id: resolvedFormationId,
              nom: form.nom, prenom: form.prenom, telephone: form.telephone, whatsapp: form.whatsapp,
              email, adresse: form.adresse, niveau: form.niveau, sexe: form.sexe,
              photo_url: form.photo || null,
            },
            module_ids: form.modules
          });
          
          setCreatedCreds({
            nom: `${form.prenom} ${form.nom}`,
            identifiant: uname,
            motDePasse: tempPassword,
            phone: form.whatsapp || form.telephone,
          });
          toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
          toastMsg.success("Apprenant inscrit côté serveur ✓");
          log(`Apprenant inscrit (Supabase) : ${form.nom} ${form.prenom} — compte ${uname}`);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          
        } catch (err: any) {
          toastMsg.error("Erreur lors de la création", (err as Error).message);
          return;
        }
      } else {
        const id = nextStudentId();
        const { users, student } = await makeAccount(db, { ...form, id } as Student);
        update((d) => ({
          ...d, users,
          students: [{ ...student, id, statutPaiement: "impaye" as const }, ...d.students],
          invoices: [
            ...(insc > 0 ? [{ id: uid("INV"), studentId: id, type: "inscription" as const, libelle: "Frais d'inscription", montant: insc, date: today() }] : []),
            ...(montant > 0 ? [{ id: uid("INV"), studentId: id, type: "formation" as const, libelle: `Formation — ${form.modules.length} module(s) (${formationLabel(form.formation)})`, montant, date: today() }] : []),
            ...d.invoices,
          ],
          notifications: [{ id: uid("NTF"), toId: student.userId!, title: "Bienvenue !", body: `Votre compte a été créé. Identifiant : ${uname}. Un mot de passe temporaire vous a été communiqué par l'administration.`, date: today(), lu: false, type: "inscription" }, ...d.notifications],
        }));
        notify("all", "Nouvel apprenant inscrit", `${form.nom} ${form.prenom} — ${formationLabel(form.formation)} • À facturer : ${money(montant + insc)}`, "inscription");
        log(`Apprenant inscrit : ${form.nom} ${form.prenom} (${id}) — compte ${uname} — à facturer ${money(montant + insc)}`);
        setCreatedCreds({
          nom: `${form.prenom} ${form.nom}`,
          identifiant: uname,
          motDePasse: tempPassword,
          phone: form.whatsapp || form.telephone,
        });
        toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
        toastMsg.info(`Factures générées : ${money(montant + insc)}`);
      }
    }
    setCreating(false); setEditing(null);
  };

  const confirmRegistration = async (regId: string) => {
    const reg = db.registrations.find((r) => r.id === regId);
    if (!reg) return;

    const baseUname = slugify(`${reg.prenom}.${reg.nom}`) || `user${Math.floor(Math.random() * 10000)}`;
    let uname = baseUname;
    let i = 1;
    while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
    const tempPassword = generateTempPassword();

    const montant = computeAmount(reg.formation, reg.modules.length);
    const insc = db.settings.frais.inscription;

    if (isSupabaseConfigured) {
      try {
        const emailTaken = db.users.some((u) => u.email?.toLowerCase() === (reg.email || "").toLowerCase().trim());
        const email = (!reg.email || emailTaken) ? `${uname}@sentinelles.local` : reg.email.trim();
        const resolvedFormationId = await resolveFormationId(reg.formation);
        await invokeCreateUser({
          email,
          password: tempPassword,
          username: uname,
          name: `${reg.prenom} ${reg.nom}`,
          role: "student",
          student: {
            formation_id: resolvedFormationId,
            nom: reg.nom, prenom: reg.prenom, telephone: reg.telephone, whatsapp: reg.whatsapp,
            email: email, niveau: reg.niveau
          },
          module_ids: reg.modules
        });
        
        await supabase.from("registrations").update({ statut: "confirmee" }).eq("id", regId);

        update((d) => ({
          ...d,
          registrations: d.registrations.map((r) => (r.id === regId ? { ...r, statut: "confirmee" as const } : r))
        }));

        setCreatedCreds({
          nom: `${reg.prenom} ${reg.nom}`,
          identifiant: uname,
          motDePasse: tempPassword,
          phone: reg.whatsapp || reg.telephone,
        });
        toastMsg.credentials({ nom: `${reg.prenom} ${reg.nom}`, identifiant: uname, motDePasse: tempPassword });
        toastMsg.success("Inscription confirmée côté serveur ✓");
        log(`Pré-inscription confirmée (Supabase) : ${reg.nom} ${reg.prenom} — compte ${uname}`);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));

      } catch (err: any) {
        toastMsg.error("Erreur lors de la confirmation", (err as Error).message);
      }
    } else {
      const id = nextStudentId();
      const student: Student = { ...emptyStudent(), id, nom: reg.nom, prenom: reg.prenom, telephone: reg.telephone, whatsapp: reg.whatsapp, email: reg.email, niveau: reg.niveau, formation: reg.formation, modules: reg.modules, dateInscription: today() };
      const { users, student: withUser } = await makeAccount(db, student);
      update((d) => ({
        ...d, users,
        students: [{ ...withUser, statutPaiement: "impaye" as const }, ...d.students],
        registrations: d.registrations.map((r) => (r.id === regId ? { ...r, statut: "confirmee" as const } : r)),
        invoices: [
          ...(insc > 0 ? [{ id: uid("INV"), studentId: id, type: "inscription" as const, libelle: "Frais d'inscription", montant: insc, date: today() }] : []),
          ...(montant > 0 ? [{ id: uid("INV"), studentId: id, type: "formation" as const, libelle: `Formation — ${reg.modules.length} module(s) (${formationLabel(reg.formation)})`, montant, date: today() }] : []),
          ...d.invoices,
        ],
        notifications: [{ id: uid("NTF"), toId: withUser.userId!, title: "Inscription confirmée", body: `Bienvenue ${withUser.prenom} ! Identifiant : ${uname}. Un mot de passe temporaire vous a été communiqué. N° apprenant : ${id}.`, date: today(), lu: false, type: "inscription" }, ...d.notifications],
      }));
      setCreatedCreds({
        nom: `${reg.prenom} ${reg.nom}`,
        identifiant: uname,
        motDePasse: tempPassword,
        phone: reg.whatsapp || reg.telephone,
      });
      toastMsg.credentials({ nom: `${reg.prenom} ${reg.nom}`, identifiant: uname, motDePasse: tempPassword });
      toastMsg.info(`Factures générées : ${money(montant + insc)}`);
      log(`Pré-inscription confirmée : ${reg.nom} ${reg.prenom} (${id}) — compte ${uname} — à facturer ${money(montant + insc)}`);
    }
  };

  const rejectRegistration = async (regId: string) => {
    if (isSupabaseConfigured) {
      try {
        await supabase.from("registrations").update({ statut: "refusee" }).eq("id", regId);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.info("Pré-inscription refusée");
      } catch (err: any) {
        toastMsg.error("Erreur", err.message);
      }
    }
    update((d) => ({
      ...d,
      registrations: d.registrations.map((x) => (x.id === regId ? { ...x, statut: "refusee" as const } : x)),
    }));
  };

  const confirmDeleteStudent = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const userId = deleteTarget.userId;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("students").delete().eq("id", id);
        if (userId) {
          await supabase.from("profiles").delete().eq("id", userId);
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Apprenant et compte supprimés avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({
      ...d,
      students: d.students.filter((s) => s.id !== id),
      users: userId ? d.users.filter((u) => u.id !== userId) : d.users,
    }));
    log(`Apprenant supprimé : ${deleteTarget.prenom} ${deleteTarget.nom} (${id})`);
    setDeleteTarget(null);
  };

  const statusBadge = (s: Student) => {
    const st = financialSummary(db, s.id).statut;
    return st === "paye" ? <Badge color="green">Payé</Badge>
      : st === "partiel" ? <Badge color="gold">Partiel</Badge>
      : st === "retard" ? <Badge color="red">Retard</Badge>
      : <Badge color="red">Impayé</Badge>;
  };

  return (
    <div>
      <PageHead
        title="Gestion des apprenants"
        subtitle={`${db.students.length} apprenants • ${db.registrations.length} pré-inscription(s) en attente`}
        actions={<Btn onClick={() => { setForm(emptyStudent()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Ajouter un apprenant</Btn>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Rechercher par nom, prénom ou n° d'apprenant..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {([["tous", "Tous"], ["informatique", "Génie Info"], ["industriel", "Génie Ind."]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn(
              "rounded-xl border px-4 py-2.5 text-sm font-bold transition-all",
              tab === k ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400 hover:bg-white/5"
            )}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<Users size={40} />} title="Aucun apprenant trouvé" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <th className="px-4 py-3">N° Apprenant</th>
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Formation</th>
                <th className="px-4 py-3">Modules</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-cyan-300">{s.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {s.photo ? <img src={s.photo} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/30"><UserCircle2 size={20} className="text-cyan-300" /></div>}
                      <div>
                        <p className="text-sm font-bold text-white">{s.prenom} {s.nom}</p>
                        <p className="text-[11px] text-slate-500">{s.niveau}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-300">{formationLabel(s.formation)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{s.modules.length} module(s)</td>
                  <td className="px-4 py-3">{statusBadge(s)}</td>
                  <td className="px-4 py-3"><Badge color={s.statut === "actif" ? "cyan" : "gray"}>{s.statut}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setViewing(s)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Voir"><Eye size={15} /></button>
                      <button onClick={() => { setForm(s); setEditing(s); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300" title="Modifier"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(s)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400" title="Supprimer"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* pré-inscriptions */}
      <h3 className="font-display mt-8 mb-3 text-lg font-bold text-white">Pré-inscriptions en ligne</h3>
      {db.registrations.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune pré-inscription en attente.</p>
      ) : (
        <div className="space-y-3">
          {db.registrations.map((r) => (
            <Card key={r.id} className="p-4" glow={r.statut === "en_attente" ? "gold" : "none"}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{r.nom} {r.prenom}</p>
                  <p className="text-xs text-slate-400">{formationLabel(r.formation)} • {r.modules.length} module(s) • {r.niveau}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Phone size={11} /> {r.telephone}</span>
                    <span className="flex items-center gap-1"><Mail size={11} /> {r.email}</span>
                    <span className="flex items-center gap-1"><CalendarDays size={11} /> {r.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={r.statut === "en_attente" ? "gold" : r.statut === "confirmee" ? "green" : "red"}>{r.statut.replace("_", " ")}</Badge>
                  {r.statut === "en_attente" && (
                    <>
                      <Btn variant="green" onClick={() => confirmRegistration(r.id)}><CheckCircle2 size={15} /> Confirmer</Btn>
                      <Btn variant="ghost" onClick={() => rejectRegistration(r.id)}><XCircle size={15} /></Btn>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* add/edit modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Modifier ${editing.id}` : "Nouvel apprenant"} wide>
        <StudentForm form={form} setForm={setForm} />
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
          <Btn onClick={save}>{editing ? "Enregistrer" : "Créer l'apprenant"}</Btn>
        </div>
      </Modal>

      {/* view modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.prenom} ${viewing.nom}` : ""} wide>
        {viewing && <StudentView s={viewing} />}
      </Modal>

      {/* credentials & whatsapp modal */}
      {createdCreds && (
        <Modal open={Boolean(createdCreds)} onClose={() => setCreatedCreds(null)} title="Compte Apprenant Activé" wide={false}>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-400/40 text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">{createdCreds.nom}</h3>
              <p className="text-xs text-slate-400 mt-1">L'inscription a été confirmée et le compte utilisateur est activé.</p>
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left space-y-2 font-mono text-sm">
              <div>
                <span className="text-xs text-slate-400 font-sans block">Identifiant :</span>
                <span className="font-bold text-cyan-300">{createdCreds.identifiant}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-sans block">Mot de passe temporaire :</span>
                <span className="font-bold text-amber-300">{createdCreds.motDePasse}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {createdCreds.phone && (
                <a
                  href={`https://wa.me/242${createdCreds.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Bonjour ${createdCreds.nom},\n\n` +
                    `Votre inscription à SENTINELLES NUMÉRIQUES a été validée avec succès !\n\n` +
                    `Voici vos accès pour vous connecter :\n` +
                    `🌐 Lien : https://code6senti.vercel.app/#/connexion\n` +
                    `👤 Identifiant : ${createdCreds.identifiant}\n` +
                    `🔑 Mot de passe : ${createdCreds.motDePasse}\n\n` +
                    `Veuillez conserver précieusement ces informations pour accéder à votre espace apprenant.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <Btn variant="green" className="w-full justify-center">
                    <MessageCircle size={16} /> Envoyer par WhatsApp
                  </Btn>
                </a>
              )}
              <div className="flex gap-2">
                <Btn
                  variant="outline"
                  className="flex-1 justify-center"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Identifiant : ${createdCreds.identifiant}\nMot de passe : ${createdCreds.motDePasse}\nLien : https://code6senti.vercel.app/#/connexion`
                    );
                    toastMsg.success("Accès copiés dans le presse-papier !");
                  }}
                >
                  Copier les accès
                </Btn>
                <Btn variant="ghost" onClick={() => setCreatedCreds(null)}>
                  Fermer
                </Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmation suppression apprenant */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement l'apprenant{" "}
            <span className="font-bold text-white">{deleteTarget?.prenom} {deleteTarget?.nom}</span> ({deleteTarget?.id}) ainsi que son compte d'accès ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Cette action est irréversible. Les inscriptions associées seront supprimées.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteStudent}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StudentForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const { db } = useStore();
  const avail = db.modules.filter((m) => m.formation === form.formation);
  const toggle = (id: string) =>
    setForm({ ...form, modules: form.modules.includes(id) ? form.modules.filter((x: string) => x !== id) : [...form.modules, id] });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          setForm({ ...form, photo: pub.publicUrl });
          toastMsg.success("Photo téléversée sur le serveur ✓");
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    setForm({ ...form, photo: await readImage(f, 300) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {form.photo ? (
          <img src={form.photo} alt="photo" className="h-20 w-20 rounded-2xl border border-cyan-400/40 object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><UserCircle2 size={36} className="text-slate-500" /></div>
        )}
        <label className="cursor-pointer">
          <span className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">📷 Photo de profil</span>
          <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
        <Field label="Prénom"><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
        <Field label="Date de naissance"><Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} /></Field>
        <Field label="Sexe">
          <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
            <option value="M">Masculin</option><option value="F">Féminin</option>
          </Select>
        </Field>
        <Field label="Téléphone"><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Adresse"><Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
        <Field label="Niveau d'étude"><Input value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })} /></Field>
        <Field label="Statut paiement">
          <Select value={form.statutPaiement} onChange={(e) => setForm({ ...form, statutPaiement: e.target.value })}>
            <option value="paye">Payé</option><option value="partiel">Partiel</option><option value="impaye">Impayé</option>
          </Select>
        </Field>
      </div>
      <Field label="Formation">
        <div className="grid grid-cols-2 gap-3">
          {(["informatique", "industriel"] as Formation[]).map((f) => (
            <button type="button" key={f} onClick={() => setForm({ ...form, formation: f, modules: [] })}
              className={cn("rounded-xl border p-3 text-sm font-bold transition-all",
                form.formation === f ? (f === "informatique" ? "border-red-500/60 bg-red-500/10 text-red-400" : "border-cyan-400/60 bg-cyan-400/10 text-cyan-300") : "border-white/10 text-slate-400")}>
              {formationLabel(f)}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`Modules (${form.modules.length})`}>
        <div className="grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {avail.map((m) => (
            <button type="button" key={m.id} onClick={() => toggle(m.id)}
              className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                form.modules.includes(m.id) ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
              {moduleIcon(m.icon, "h-3.5 w-3.5")} {m.numero}. {m.titre}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StudentView({ s }: { s: Student }) {
  const { db } = useStore();
  const mods = db.modules.filter((m) => s.modules.includes(m.id));
  const teachersAssoc = db.teachers.filter((t) => t.modules.some((mid) => s.modules.includes(mid)));
  const schedule = db.schedule.filter((sc) =>
    sc.formation === s.formation && s.modules.includes(sc.moduleId) &&
    (!sc.studentIds?.length || sc.studentIds.includes(s.id)) &&
    (!sc.groupe || sc.groupe === s.groupe)
  );
  const courses = db.courses.filter((c) => s.modules.includes(c.moduleId) && c.publie !== false &&
    (!c.studentIds?.length || c.studentIds.includes(s.id)) &&
    (!c.groupe || c.groupe === s.groupe));
  const att = db.attendance.filter((a) => a.studentId === s.id);
  const grades = db.grades.filter((g) => g.studentId === s.id);
  const results = db.results.filter((r) => r.studentId === s.id);
  const cert = db.certificates.find((c) => c.studentId === s.id);
  const bourse = db.scholarships.find((b) => b.studentId === s.id);
  const summary = financialSummary(db, s.id);
  const payments = [...summary.payments].sort((a, b) => (b.date + (b.heure ?? "")).localeCompare(a.date + (a.heure ?? "")));

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
      {/* carte numérique */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0A1224] to-[#07152B] p-5">
        <div className="bg-grid-hex pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-cyan-300" />
              <span className="font-display text-xs font-black tracking-wider text-white">SENTINELLES<br />NUMÉRIQUES</span>
            </div>
            <Badge color={s.statut === "actif" ? "green" : "gray"}>{s.statut}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {s.photo ? <img src={s.photo} alt="" className="h-16 w-16 rounded-xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30"><UserCircle2 size={32} className="text-cyan-300" /></div>}
            <div>
              <p className="font-display text-base font-black text-white">{s.prenom} {s.nom}</p>
              <p className="text-[11px] text-slate-400">{formationLabel(s.formation)}</p>
              <p className="font-mono text-[11px] font-bold text-cyan-300">{s.id}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="rounded-lg bg-white p-1.5">
              <QRCodeSVG value={`SN|${s.id}|${s.nom}|${s.prenom}|${s.formation}`} size={84} />
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <p className="flex items-center gap-1.5"><Phone size={11} className="text-emerald-300" /> {s.telephone}</p>
              <p className="flex items-center gap-1.5"><Mail size={11} className="text-cyan-300" /> {s.email}</p>
              <p className="flex items-center gap-1.5"><MapPin size={11} className="text-blue-400" /> {s.adresse || "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[9px] uppercase tracking-[0.3em] text-slate-500">Carte numérique d'apprenant</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-white">{mods.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Modules</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-emerald-300">{att.filter((a) => a.statut === "present").length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Présences</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-amber-300">{grades.length ? (grades.reduce((a, g) => a + g.note, 0) / grades.length).toFixed(1) : "—"}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Moyenne /20</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
            <p className="font-display text-lg font-black text-cyan-300">{results.length}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Tests passés</p>
          </div>
        </div>

        {/* Finance */}
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Finance</p>
            <Badge color={summary.statut === "paye" ? "green" : summary.statut === "partiel" ? "gold" : "red"}>{statusLabel(summary.statut)}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[9px] uppercase text-slate-500">À payer</p><p className="font-mono text-sm font-bold text-white">{money(summary.totalDu)}</p></div>
            <div><p className="text-[9px] uppercase text-slate-500">Payé</p><p className="font-mono text-sm font-bold text-emerald-300">{money(summary.totalPaye)}</p></div>
            <div><p className="text-[9px] uppercase text-slate-500">Solde</p><p className="font-mono text-sm font-bold text-amber-300">{money(summary.solde)}</p></div>
          </div>
          {payments.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-cyan-300">Historique ({payments.length})</summary>
              <div className="mt-1.5 space-y-1">
                {payments.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px]">
                    <span>{p.date}{p.heure ? ` • ${p.heure}` : ""} · {p.mode} · <span className="font-mono text-cyan-300">{p.reference ?? "—"}</span></span>
                    <span className="font-bold text-slate-200">{money(p.montant)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Modules inscrits</p>
          <div className="flex flex-wrap gap-1.5">
            {mods.length === 0 ? <p className="text-xs text-slate-500">Aucun module.</p> :
              mods.map((m) => <span key={m.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300">{m.numero}. {m.titre}</span>)}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Enseignants associés ({teachersAssoc.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {teachersAssoc.length === 0 ? <p className="text-xs text-slate-500">Aucun.</p> :
              teachersAssoc.map((t) => <span key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">{t.prenom} {t.nom}</span>)}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Emploi du temps ({schedule.length})</p>
            {schedule.length === 0 ? <p className="text-xs text-slate-500">Aucun créneau.</p> : (
              <div className="space-y-1">
                {schedule.slice(0, 5).map((sc) => (
                  <div key={sc.id} className="rounded border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300">
                    <b className="text-white">{sc.jour}</b> {sc.heureDebut}–{sc.heureFin} · {db.modules.find((m) => m.id === sc.moduleId)?.titre}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Cours disponibles ({courses.length})</p>
            {courses.length === 0 ? <p className="text-xs text-slate-500">Aucun cours publié.</p> : (
              <div className="space-y-1">
                {courses.slice(0, 5).map((c) => (
                  <div key={c.id} className="truncate rounded border border-white/5 bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-300">
                    <b className="text-white">{c.titre}</b> {(c.files?.length ?? 0) > 0 && <span className="text-cyan-400">📎 {c.files!.length}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {cert && <Badge color="gold">Certificat : {cert.numero}</Badge>}
          {bourse && <Badge color="green">Bourse : {bourse.statut.replace("_", " ")}</Badge>}
        </div>
      </div>
    </div>
  );
}

/* ================= TEACHERS ================= */
export function TeachersPage() {
  const { db, user, update, log } = useStore();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [q, setQ] = useState("");
  const [fFormation, setFFormation] = useState("");
  const [fModule, setFModule] = useState("");
  const [fContrat, setFContrat] = useState("");
  const [fStatut, setFStatut] = useState("");
  const emptyTeacher = () => ({
    nom: "", prenom: "", specialite: "", email: "", phone: "", modules: [], photo: "", infosPro: "", diplomes: "",
    actif: true, typeContrat: "Prestation", tarifHoraire: 0, heuresPrevues: 0, tarifsParModule: {} as Record<string, number>,
  });
  const [form, setForm] = useState<any>(emptyTeacher());

  const confirmDeleteTeacher = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const userId = deleteTarget.userId;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("teachers").delete().eq("id", id);
        if (userId) {
          await supabase.from("profiles").delete().eq("id", userId);
        }
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Enseignant et compte supprimés avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({
      ...d,
      teachers: d.teachers.filter((t) => t.id !== id),
      users: userId ? d.users.filter((u) => u.id !== userId) : d.users,
    }));
    log(`Enseignant supprimé : ${deleteTarget.prenom} ${deleteTarget.nom} (${id})`);
    setDeleteTarget(null);
  };
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isSupabaseConfigured) {
      try {
        const ext = (f.name || "jpg").split(".").pop() || "jpg";
        const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          setForm((p: any) => ({ ...p, photo: pub.publicUrl }));
          toastMsg.success("Photo téléversée sur le serveur ✓");
          return;
        }
      } catch (err) {
        console.warn("Storage upload fallback:", err);
      }
    }
    const img = await readImage(f, 400);
    setForm((p: any) => ({ ...p, photo: img }));
  };

  const canEditRate = user?.role === "superadmin" || user?.role === "admin";

  const filtered = db.teachers.filter((t) => {
    const hay = `${t.nom} ${t.prenom} ${t.id} ${t.specialite} ${t.email ?? ""}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (fFormation && !(t.formations ?? []).includes(fFormation as any)) return false;
    if (fModule && !t.modules.includes(fModule)) return false;
    if (fContrat && (t.typeContrat ?? "") !== fContrat) return false;
    if (fStatut === "actif" && t.actif === false) return false;
    if (fStatut === "inactif" && t.actif !== false) return false;
    return true;
  });

  const save = async () => {
    if (!form.nom) return;
    if (editing) {
      if (isSupabaseConfigured) {
        try {
          await supabase.from("teachers").update({
            nom: form.nom,
            prenom: form.prenom,
            specialite: form.specialite || "Formateur",
            email: form.email || "",
            phone: form.phone || "",
            type_contrat: form.typeContrat || "Prestation",
            tarif_horaire: form.tarifHoraire || 0,
            photo_url: form.photo || null,
          }).eq("id", editing.id);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
          toastMsg.success("Enseignant mis à jour côté serveur ✓");
        } catch (err: any) {
          toastMsg.error("Erreur mise à jour enseignant", err.message);
        }
      }
      update((d) => ({ ...d, teachers: d.teachers.map((t) => (t.id === editing.id ? { ...t, ...form } : t)) }));
      if (editing.tarifHoraire !== form.tarifHoraire || JSON.stringify(editing.tarifsParModule ?? {}) !== JSON.stringify(form.tarifsParModule ?? {})) {
        log(`Tarif horaire modifié pour ${form.nom} ${form.prenom} : ${money(form.tarifHoraire ?? 0)}/h`);
      } else {
        log(`Enseignant modifié : ${form.nom} ${form.prenom}`);
      }
    } else {
      const baseUname = slugify(`${form.prenom}.${form.nom}`) || `teacher${Math.floor(Math.random() * 10000)}`;
      let uname = baseUname;
      let i = 1;
      while (db.users.some(u => u.username === uname)) { uname = `${baseUname}${i++}`; }
      const tempPassword = generateTempPassword();

      if (isSupabaseConfigured) {
        try {
          const email = form.email || `${uname}@sentinelles.local`;
          await invokeCreateUser({
            email,
            password: tempPassword,
            username: uname,
            name: `${form.prenom} ${form.nom}`,
            role: "teacher",
            teacher: {
              nom: form.nom, prenom: form.prenom, specialite: form.specialite,
              email, phone: form.phone, type_contrat: form.typeContrat, tarif_horaire: form.tarifHoraire,
              photo_url: form.photo || null,
            },
            module_ids: form.modules
          });
          
          toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
          toastMsg.success("Formateur créé côté serveur ✓");
          log(`Enseignant ajouté (Supabase) : ${form.nom} ${form.prenom} — compte ${uname}`);
          window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        } catch (err: any) {
          toastMsg.error("Erreur lors de la création", (err as Error).message);
          return;
        }
      } else {
        const id = `ENS-${String(db.teachers.length + 1).padStart(3, "0")}`;
        const teacher = { ...form, id };
        const { users, student } = await makeAccount(db, { ...emptyStudent(), id, nom: form.nom, prenom: form.prenom, email: form.email, phone: form.phone, modules: form.modules } as Student, "teacher");
        update((d) => ({
          ...d, users,
          teachers: [...d.teachers, { ...teacher, userId: student.userId }],
        }));
        log(`Enseignant ajouté : ${form.nom} ${form.prenom} — compte ${uname}`);
        toastMsg.credentials({ nom: `${form.prenom} ${form.nom}`, identifiant: uname, motDePasse: tempPassword });
      }
    }
    setCreating(false); setEditing(null);
  };

  const contractTypes = Array.from(new Set(db.teachers.map((t) => t.typeContrat).filter(Boolean) as string[]));

  return (
    <div>
      <PageHead title="Enseignants" subtitle={`${db.teachers.length} formateurs`}
        actions={<Btn onClick={() => { setForm(emptyTeacher()); setEditing(null); setCreating(true); }}><PlusCircle size={16} /> Ajouter</Btn>} />

      {/* Recherche + filtres */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : nom, prénom, identifiant, spécialité..." className="pl-9" />
          </div>
          <Field label="Formation">
            <Select value={fFormation} onChange={(e) => setFFormation(e.target.value)}>
              <option value="">Toutes</option>
              <option value="informatique">Génie Informatique</option>
              <option value="industriel">Génie Industriel</option>
            </Select>
          </Field>
          <Field label="Module enseigné">
            <Select value={fModule} onChange={(e) => setFModule(e.target.value)}>
              <option value="">Tous</option>
              {db.modules.map((m) => <option key={m.id} value={m.id}>{m.numero}. {m.titre}</option>)}
            </Select>
          </Field>
          <Field label="Type de contrat">
            <Select value={fContrat} onChange={(e) => setFContrat(e.target.value)}>
              <option value="">Tous</option>
              {contractTypes.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Statut :</span>
          {(["", "actif", "inactif"] as const).map((s) => (
            <button key={s} onClick={() => setFStatut(s)} className={cn("rounded-lg border px-3 py-1.5 text-xs font-bold", fStatut === s ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400")}>
              {s === "" ? "Tous" : s === "actif" ? "Actifs" : "Inactifs"}
            </button>
          ))}
          {(q || fFormation || fModule || fContrat || fStatut) && (
            <button onClick={() => { setQ(""); setFFormation(""); setFModule(""); setFContrat(""); setFStatut(""); }} className="ml-auto text-xs font-bold text-red-400 hover:underline">Réinitialiser</button>
          )}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty icon={<GraduationCap size={40} />} title="Aucun enseignant trouvé" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const mods = db.modules.filter((m) => t.modules.includes(m.id));
            const fin = teacherFinanceSummary(db, t.id);
            return (
              <Card key={t.id} className={cn("p-5", t.actif === false && "opacity-60")} glow="cyan">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {t.photo ? (
                      <img src={t.photo} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30">
                        <GraduationCap size={22} className="text-cyan-300" />
                      </div>
                    )}
                    <div>
                      <p className="font-display text-sm font-bold text-white">{t.prenom} {t.nom}</p>
                      <p className="text-[11px] text-slate-400">{t.specialite}</p>
                      <p className="font-mono text-[10px] text-cyan-400/70">{t.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setViewing(t)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300" title="Détails"><Eye size={14} /></button>
                    <button onClick={() => { setForm(t); setEditing(t); setCreating(true); }} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-amber-400/40 hover:text-amber-300"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget(t)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.actif === false && <Badge color="red">Inactif</Badge>}
                  {t.typeContrat && <Badge color="gold">{t.typeContrat}</Badge>}
                  {mods.slice(0, 3).map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">{m.numero}. {m.titre}</span>)}
                  {mods.length > 3 && <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400">+{mods.length - 3}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><Phone size={11} className="text-emerald-300" /> {t.phone || "—"}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-cyan-300"><Timer size={11} /> {fin.heuresValidees} h · {money(fin.solde)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal détails enseignant */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.prenom} ${viewing.nom}` : ""} wide>
        {viewing && <TeacherDetail t={viewing} />}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title={editing ? `Modifier ${editing.id}` : "Nouvel enseignant"} wide>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {form.photo ? <img src={form.photo} alt="" className="h-20 w-20 rounded-2xl border border-cyan-400/40 object-cover" />
              : <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><GraduationCap size={30} className="text-slate-500" /></div>}
            <label className="cursor-pointer">
              <span className="rounded-xl border border-cyan-400/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10">📷 Photo du formateur</span>
              <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
            </label>
            {form.photo && <Btn variant="ghost" onClick={() => setForm({ ...form, photo: "" })}>Supprimer</Btn>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom"><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
            <Field label="Prénom"><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
            <Field label="Spécialité"><Input value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} placeholder="ex: Réseaux & Cybersécurité" /></Field>
            <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Diplômes"><Input value={form.diplomes} onChange={(e) => setForm({ ...form, diplomes: e.target.value })} placeholder="ex: Master Cybersécurité — CEH" /></Field>
          <Field label="Informations professionnelles"><Textarea value={form.infosPro} onChange={(e) => setForm({ ...form, infosPro: e.target.value })} placeholder="Parcours, expérience, expertise..." /></Field>

          {/* Contrat */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Contrat & rémunération</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type de contrat">
                <Select value={form.typeContrat} onChange={(e) => setForm({ ...form, typeContrat: e.target.value })}>
                  <option>CDI</option><option>CDD</option><option>Prestation</option><option>Vacataire</option><option>Stage encadré</option><option>Autre</option>
                </Select>
              </Field>
              <Field label="Tarif horaire (FCFA)">
                <Input type="number" min={0} value={form.tarifHoraire} onChange={(e) => setForm({ ...form, tarifHoraire: +e.target.value })} disabled={!canEditRate} />
              </Field>
              <Field label="Heures prévues (contrat)">
                <Input type="number" min={0} value={form.heuresPrevues} onChange={(e) => setForm({ ...form, heuresPrevues: +e.target.value })} />
              </Field>
            </div>
            {!canEditRate && <p className="mt-2 text-[11px] text-amber-300">Seul l'Admin Sup / responsable financier peut modifier le tarif horaire.</p>}
          </div>

          <Field label="Modules enseignés">
            <div className="grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {db.modules.map((m) => (
                <button type="button" key={m.id} onClick={() => setForm({ ...form, modules: form.modules.includes(m.id) ? form.modules.filter((x: string) => x !== m.id) : [...form.modules, m.id] })}
                  className={cn("rounded-lg border px-3 py-2 text-left text-xs transition-all",
                    form.modules.includes(m.id) ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>
                  {formationLabel(m.formation)} — {m.numero}. {m.titre}
                </button>
              ))}
            </div>
          </Field>
          {canEditRate && form.modules.length > 0 && (
            <Field label="Tarifs spécifiques par module (optionnel, FCFA/h)" hint="Laissez 0 pour utiliser le tarif horaire global">
              <div className="space-y-1.5 rounded-xl border border-white/10 p-3">
                {form.modules.map((mid: string) => (
                  <div key={mid} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs text-slate-300">{db.modules.find((m) => m.id === mid)?.titre}</span>
                    <Input
                      type="number" min={0} className="w-28"
                      value={form.tarifsParModule?.[mid] ?? 0}
                      onChange={(e) => setForm({ ...form, tarifsParModule: { ...form.tarifsParModule, [mid]: +e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setCreating(false)}>Annuler</Btn>
            <Btn onClick={save}>Enregistrer</Btn>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression enseignant */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement l'enseignant{" "}
            <span className="font-bold text-white">{deleteTarget?.prenom} {deleteTarget?.nom}</span> ({deleteTarget?.specialite}) ainsi que son compte ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Cette action retirera également le formateur des modules attribués.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteTeacher}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* Détails enseignant : heures, finance, liens rapides */
function TeacherDetail({ t }: { t: any }) {
  const { db } = useStore();
  const fin = teacherFinanceSummary(db, t.id);
  const mods = db.modules.filter((m) => t.modules.includes(m.id));
  const _ignored = null; void _ignored; // placeholder

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        {t.photo ? <img src={t.photo} alt="" className="h-24 w-24 rounded-2xl border border-cyan-400/40 object-cover" />
          : <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]"><GraduationCap size={44} className="text-cyan-300" /></div>}
        <div className="flex-1">
          <p className="font-display text-xl font-black text-white">{t.prenom} {t.nom}</p>
          <p className="font-mono text-xs text-cyan-300">{t.id} {t.actif === false && <Badge color="red">Inactif</Badge>}</p>
          <p className="mt-1 text-sm text-slate-400">{t.specialite}</p>
          {t.diplomes && <p className="text-xs text-slate-500">{t.diplomes}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
            {t.typeContrat && <Badge color="gold">{t.typeContrat}</Badge>}
            {(t.formations ?? []).map((f: any) => <Badge key={f} color={f === "informatique" ? "red" : "cyan"}>{formationLabel(f)}</Badge>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[9px] uppercase text-slate-500">Tarif/h</p>
            <p className="font-display text-sm font-black text-white">{money(t.tarifHoraire ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[9px] uppercase text-slate-500">Prévues</p>
            <p className="font-display text-sm font-black text-white">{t.heuresPrevues ?? 0} h</p>
          </div>
        </div>
      </div>

      {t.infosPro && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-300">Informations professionnelles</p>
          <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm text-slate-300">{t.infosPro}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Modules enseignés ({mods.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {mods.map((m) => <span key={m.id} className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-300">{m.numero}. {m.titre}</span>)}
        </div>
      </div>

      {/* Finance enseignant */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat icon={<Clock size={20} />} label="Effectuées" value={`${fin.heuresEffectuees} h`} color="blue" />
        <Stat icon={<CheckCircle2 size={20} />} label="Validées" value={`${fin.heuresValidees} h`} color="green" />
        <Stat icon={<Wallet size={20} />} label="Dû" value={money(fin.montantDu)} color="gold" />
        <Stat icon={<BadgeDollarSign size={20} />} label="Payé" value={money(fin.montantPaye)} color="cyan" />
        <Stat icon={<BadgeDollarSign size={20} />} label="Solde" value={money(fin.solde)} color="red" />
      </div>

      {/* Mensuel */}
      {fin.months.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-300">Ventilation mensuelle</p>
          <div className="space-y-2">
            {fin.months.map((m) => (
              <div key={m.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
                <span className="w-40 font-semibold text-slate-200">{m.label}</span>
                <span className="text-xs text-slate-400">{m.effectuees} h effectuées · {m.validees} h validées</span>
                <span className="font-mono text-amber-300">{money(m.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raccourcis */}
      <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <Link to={`/app/modules`}><Btn variant="outline">Modules</Btn></Link>
        <Link to={`/app/cours`}><Btn variant="outline">Cours</Btn></Link>
        <Link to={`/app/emploi-du-temps`}><Btn variant="outline">Emploi du temps</Btn></Link>
        <Link to={`/app/enseignants-heures`}><Btn variant="outline">Heures</Btn></Link>
        <Link to={`/app/paiements`}><Btn variant="outline">Paiements</Btn></Link>
      </div>
    </div>
  );
}

/* ================= USERS ================= */
export function UsersPage() {
  const { db, user, update, log } = useStore();
  const [adding, setAdding] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; username: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPwBusy, setNewPwBusy] = useState(false);
  const [newPwErr, setNewPwErr] = useState("");
  const emptyUserForm = () => ({ username: "", password: "", role: "student", name: "", email: "", phone: "", organizationName: "", poste: "", accessLevel: "viewer", startDate: today(), endDate: "" });
  const [form, setForm] = useState(emptyUserForm());

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    const uid = deleteTarget.id;
    const username = deleteTarget.username;
    if (isSupabaseConfigured) {
      try {
        await supabase.from("profiles").delete().eq("id", uid);
        window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
        toastMsg.success("Compte utilisateur supprimé avec succès ✓");
      } catch (err: any) {
        toastMsg.error("Erreur suppression", err.message);
      }
    }
    update((d) => ({
      ...d,
      users: d.users.filter((u) => u.id !== uid),
      students: d.students.filter((s) => s.userId !== uid),
      teachers: d.teachers.filter((t) => t.userId !== uid),
    }));
    log(`Compte utilisateur supprimé : ${deleteTarget.name} (${username})`);
    setDeleteTarget(null);
  };

  const roleColor = (r: string) => r === "superadmin" ? "red" : r === "admin" ? "gold" : r === "teacher" ? "cyan" : "green";
  const roleLabel = (r: string) => r === "superadmin" ? "Super Admin" : r === "admin" ? "Administration" : r === "partner_admin" ? "Admin partenaire" : r === "teacher" ? "Enseignant" : r === "partner" ? "Partenaire" : "Apprenant";

  return (
    <div>
      <PageHead title="Gestion des utilisateurs" subtitle="Comptes, rôles et permissions"
        actions={<Btn onClick={() => setAdding(true)}><PlusCircle size={16} /> Nouvel utilisateur</Btn>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["superadmin", "admin", "partner_admin", "teacher", "student", "partner"].map((r) => (
          <Badge key={r} color={roleColor(r) as any}>{roleLabel(r)}</Badge>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Identifiant</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-white">{u.name}</p>
                  <p className="text-[11px] text-slate-500">{u.linkedId ? `Lié à ${u.linkedId}` : "—"}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-300">{u.username}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge color={roleColor(u.role) as any}>{roleLabel(u.role)}</Badge>
                    {u.actif === false && <Badge color="red">Désactivé</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.email || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {u.role !== "superadmin" && (
                      <button title={u.actif === false ? "Activer" : "Désactiver"}
                        onClick={() => { update((d) => ({ ...d, users: d.users.map((x) => x.id === u.id ? { ...x, actif: x.actif === false } : x) })); log(`Compte ${u.actif === false ? "activé" : "désactivé"} : ${u.username}`); }}
                        className={cn("rounded-lg border p-2", u.actif === false ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-300 hover:border-amber-400/40 hover:text-amber-300")}>
                        {u.actif === false ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    )}
                    <button title="Réinitialiser le mot de passe"
                      onClick={() => { setResetTarget({ id: u.id, username: u.username }); setNewPw(""); setNewPwErr(""); }}
                      className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300"><KeyRound size={14} /></button>
                    {user?.id !== u.id && (
                      <button
                        title="Supprimer cet utilisateur"
                        onClick={() => setDeleteTarget(u)}
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-red-500/40 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal réinitialisation mot de passe */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Réinitialiser le mot de passe — ${resetTarget?.username}`}>
        <div className="space-y-4">
          <Field label="Nouveau mot de passe" hint="12+ car., MAJ, min, chiffre, spécial">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="••••••••••••" />
          </Field>
          {newPwErr && <p className="text-xs text-red-400">{newPwErr}</p>}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setResetTarget(null)}>Annuler</Btn>
            <Btn disabled={newPwBusy} onClick={async () => {
              if (!passwordStrong(newPw)) { setNewPwErr("Mot de passe trop faible. Respectez les critères de sécurité."); return; }
              setNewPwBusy(true); setNewPwErr("");
              const hash = await hashPassword(newPw);
              update((d) => ({ ...d, users: d.users.map((x) => x.id === resetTarget!.id ? { ...x, password: hash } : x) }));
              log(`Mot de passe réinitialisé pour ${resetTarget!.username}`);
              toastMsg.success(`Mot de passe mis à jour pour ${resetTarget!.username}`);
              setNewPwBusy(false); setResetTarget(null);
            }}>
              <KeyRound size={14} /> {newPwBusy ? "En cours…" : "Mettre à jour"}
            </Btn>
          </div>
        </div>
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Nouvel utilisateur">
        <div className="space-y-4">
          <Field label="Nom complet"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identifiant" hint="Lettres, chiffres, . _ -">
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, "") })} spellCheck={false} />
            </Field>
            <Field label="Mot de passe" hint="12+ car., majuscule, minuscule, chiffre, spécial">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </Field>
          </div>
          {form.password && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-[11px]">
              {(() => {
                const c = checkPassword(form.password);
                const rules: [boolean, string][] = [
                  [c.length, "12 car."], [c.upper, "MAJ"], [c.lower, "min"], [c.digit, "chiffre"], [c.special, "spécial"], [c.notCommon, "non-courant"],
                ];
                return (
                  <div className="flex flex-wrap gap-2">
                    {rules.map(([ok, l]) => (
                      <span key={l} className={cn("rounded-md border px-1.5 py-0.5", ok ? "border-emerald-400/40 text-emerald-300" : "border-white/10 text-slate-500")}>
                        {ok ? "✓" : "✗"} {l}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          <Field label="Rôle">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Apprenant</option>
              <option value="teacher">Enseignant</option>
              <option value="admin">Administration</option>
              <option value="partner_admin">Administration partenaire</option>
              <option value="partner">Partenaire</option>
              <option value="superadmin">Super Admin</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          {(form.role === "partner" || form.role === "partner_admin") && (
            <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-300">Organisation partenaire obligatoire</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organisation"><Input value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="Nom de l'organisation" /></Field>
                <Field label="Poste / fonction"><Input value={form.poste} onChange={(e) => setForm({ ...form, poste: e.target.value })} placeholder="ex: Responsable pédagogique" /></Field>
                <Field label="Périmètre d'accès">
                  <Select value={form.accessLevel} onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}>
                    {Object.entries(PARTNER_SCOPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </Select>
                </Field>
                <Field label="Date de début"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
                <Field label="Date de fin éventuelle"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Un compte partenaire ne peut pas être créé sans organisation. Les droits restent en lecture seule.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setAdding(false)}>Annuler</Btn>
            <Btn onClick={async () => {
              if (!form.username || !form.name) return;
              if (db.users.some((u) => u.username.toLowerCase() === form.username.trim().toLowerCase())) {
                toastMsg.error("Identifiant déjà utilisé", "Choisissez un identifiant différent.");
                return;
              }
              if (!passwordStrong(form.password)) {
                toastMsg.error("Mot de passe trop faible", "12+ car., majuscule, minuscule, chiffre, spécial.");
                return;
              }
              
              if (isSupabaseConfigured) {
                try {
                  const email = form.email || `${form.username}@sentinelles.local`;
                  if ((form.role === "partner" || form.role === "partner_admin") && !form.organizationName.trim()) {
                    toastMsg.warning("Organisation obligatoire pour un compte partenaire.");
                    return;
                  }
                  await invokeCreateUser({
                    email,
                    password: form.password,
                    username: form.username.trim().toLowerCase(),
                    name: form.name,
                    role: form.role as AppRole,
                    partner: form.role === "partner" || form.role === "partner_admin" ? {
                      organization_name: form.organizationName,
                      contact_name: form.name,
                      email,
                      phone: form.phone,
                      poste: form.poste,
                      access_level: form.accessLevel,
                      start_date: form.startDate,
                      end_date: form.endDate || null,
                      scopes: [form.accessLevel],
                    } : undefined,
                  });
                  toastMsg.credentials({ nom: form.name, identifiant: form.username, motDePasse: form.password });
                  toastMsg.success("Utilisateur créé côté serveur ✓");
                  log(`Utilisateur créé (Supabase) : ${form.username} (${form.role})`);
                  window.dispatchEvent(new Event("sentinelles:supabase-refresh"));
                } catch (err: any) {
                  toastMsg.error("Erreur lors de la création", (err as Error).message);
                  return;
                }
              } else {
                const hash = await hashPassword(form.password);
                const nu: User = { id: uid("u"), username: form.username.trim().toLowerCase(), password: hash, role: form.role as Role, name: form.name, email: form.email, createdAt: today(), actif: true };
                update((d) => ({ ...d, users: [...d.users, nu] }));
                log(`Utilisateur créé : ${form.username} (${form.role})`);
              }
              setAdding(false); setForm(emptyUserForm());
            }}>Créer</Btn>
          </div>
        </div>
      </Modal>

      {/* Modal confirmation suppression utilisateur */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmation de suppression">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Voulez-vous vraiment supprimer définitivement le compte de l'utilisateur{" "}
            <span className="font-bold text-white">{deleteTarget?.name}</span> (Identifiant : <span className="font-mono text-cyan-300">{deleteTarget?.username}</span>, Rôle : <span className="text-amber-300">{deleteTarget && roleLabel(deleteTarget.role)}</span>) ?
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            ⚠️ Attention : Cette action est irréversible et révoquera immédiatement tous ses accès au logiciel.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Annuler</Btn>
            <Btn variant="red" onClick={confirmDeleteUser}>
              <Trash2 size={15} /> Supprimer définitivement
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
