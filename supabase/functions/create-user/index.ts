// Edge Function: création administrative d'un utilisateur Auth + profil + fiche métier.
// Nécessite SUPABASE_SERVICE_ROLE_KEY (jamais exposée au frontend).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Vérification de l'appelant (staff) via token Bearer
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let callerUserId: string | null = null;
    let callerProfile: { role: string; active: boolean } | null = null;

    if (token) {
      const { data: userData } = await admin.auth.getUser(token);
      if (userData?.user) {
        callerUserId = userData.user.id;
      }
    }

    if (!callerUserId) {
      // Cas bootstrap initial : vérifier s'il existe déjà un Super Admin
      const { data: hasAdmin } = await admin.rpc("has_any_superadmin");
      const bodyPreview = await req.clone().json().catch(() => ({}));
      if (!hasAdmin && bodyPreview?.role === "superadmin") {
        // Autoriser la création initiale du superadmin (callerProfile reste null)
      } else {
        return new Response(JSON.stringify({ error: "Session expirée ou non authentifié" }), { status: 401, headers: corsHeaders });
      }
    } else {
      const { data: profile } = await admin.from("profiles").select("role,active").eq("id", callerUserId).maybeSingle();
      if (!profile?.active || !["superadmin", "admin"].includes(profile.role)) {
        return new Response(JSON.stringify({ error: "Permissions insuffisantes (réservé au personnel administratif)" }), { status: 403, headers: corsHeaders });
      }
      callerProfile = profile;
    }

    const {
      email, password, username, name, role,
      // optionnels métier
      student, teacher, partner, module_ids = [], frais,
    } = body;
    let studentIdCreated: string | null = null;

    if (!email || !password || !username || !name || !role) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: corsHeaders });
    }
    const allowedRoles = ["admin", "partner_admin", "teacher", "student", "partner"];
    const callerRole = callerProfile?.role ?? "superadmin"; // bootstrap = superadmin implicite
    if (!allowedRoles.includes(role) && !(callerRole === "superadmin" && role === "superadmin")) {
      return new Response(JSON.stringify({ error: "Rôle non autorisé" }), { status: 400, headers: corsHeaders });
    }
    if ((role === "admin" || role === "superadmin") && callerRole !== "superadmin") {
      return new Response(JSON.stringify({ error: "Seul un Super Admin peut créer un administrateur." }), { status: 403, headers: corsHeaders });
    }
    if ((role === "partner" || role === "partner_admin") && !partner?.organization_name && !partner?.organization_id) {
      return new Response(JSON.stringify({ error: "Une organisation partenaire est obligatoire." }), { status: 400, headers: corsHeaders });
    }

    const cleanEmail = email.trim().toLowerCase();
    let userId: string;
    let finalUsername = String(username).toLowerCase().trim();
    let isExistingAccount = false;

    // A. Vérifier si un compte existe déjà pour cet email (idempotence)
    const { data: existingProfileByEmail } = await admin
      .from("profiles")
      .select("id, role, username, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfileByEmail) {
      userId = existingProfileByEmail.id;
      finalUsername = existingProfileByEmail.username;
      isExistingAccount = true;
      if (password) {
        try {
          await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
        } catch { /* ignore update password */ }
      }
    } else {
      // B. Résolution automatique d'un username unique garanti disponible
      const baseUsername = finalUsername;
      let counter = 1;
      while (true) {
        const { data: clash } = await admin
          .from("profiles")
          .select("id")
          .eq("username", finalUsername)
          .maybeSingle();
        if (!clash) break;
        finalUsername = `${baseUsername}${counter++}`;
      }

      // C. Création de l'utilisateur Auth avec auto-confirmation
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { username: finalUsername, name, role },
      });

      if (createErr || !created.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message || "Création du compte impossible." }),
          { status: 400, headers: corsHeaders }
        );
      }
      userId = created.user.id;
    }

    // 2) Profile (upsert idempotent pour éliminer tout conflit avec le trigger SQL)
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      username: finalUsername,
      name,
      email: cleanEmail,
      role,
      active: true,
      updated_at: new Date().toISOString(),
    });
    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: corsHeaders });
    }

    // 3) Fiche métier
    if (role === "student" && student) {
      const { data: existingStudent } = await admin.from("students").select("id").eq("user_id", userId).maybeSingle();
      let sid = existingStudent?.id;
      if (!sid) {
        const { data: newSid, error: sidErr } = await admin.rpc("generate_student_id");
        if (sidErr) {
          return new Response(JSON.stringify({ error: sidErr.message }), { status: 400, headers: corsHeaders });
        }
        sid = newSid;
        const { error: stErr } = await admin.from("students").insert({
          id: sid,
          user_id: userId,
          formation_id: student.formation_id,
          nom: student.nom,
          prenom: student.prenom,
          telephone: student.telephone,
          whatsapp: student.whatsapp,
          email: student.email ?? email,
          adresse: student.adresse ?? null,
          niveau: student.niveau ?? null,
          sexe: student.sexe ?? null,
          photo_url: student.photo_url ?? student.photo ?? null,
          statut: "actif",
        });
        if (stErr) {
          return new Response(JSON.stringify({ error: stErr.message }), { status: 400, headers: corsHeaders });
        }
      }

      if (Array.isArray(module_ids) && module_ids.length) {
        const validUuids = module_ids.filter((id: string) =>
          typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
        if (validUuids.length) {
          const { data: existingMods } = await admin.from("modules").select("id").in("id", validUuids);
          const existingIds = (existingMods || []).map((m: any) => m.id);
          if (existingIds.length) {
            await admin.from("student_modules").insert(
              existingIds.map((module_id: string) => ({ student_id: sid, module_id }))
            );
          }
        }
      }
      studentIdCreated = sid;

      if (frais && sid) {
        const invList: any[] = [];
        if (frais.inscription && Number(frais.inscription) > 0) {
          invList.push({
            student_id: sid,
            type: "inscription",
            libelle: "Frais d'inscription",
            montant: Number(frais.inscription),
            date: new Date().toISOString().slice(0, 10),
            created_by: callerUserId,
          });
        }
        if (frais.formation && Number(frais.formation) > 0) {
          invList.push({
            student_id: sid,
            type: "formation",
            libelle: frais.libelle || `Formation (${(module_ids || []).length} modules)`,
            montant: Number(frais.formation),
            date: new Date().toISOString().slice(0, 10),
            created_by: callerUserId,
          });
        }
        if (invList.length) {
          const { data: existingInvs } = await admin.from("invoices").select("type").eq("student_id", sid);
          const hasInsc = (existingInvs || []).some((i: any) => i.type === "inscription");
          const hasForm = (existingInvs || []).some((i: any) => i.type === "formation");
          const toInsert = invList.filter((i) => (i.type === "inscription" && !hasInsc) || (i.type === "formation" && !hasForm));
          if (toInsert.length) {
            await admin.from("invoices").insert(toInsert);
          }
        }
      }
    }

    if (role === "teacher" && teacher) {
      const count = (await admin.from("teachers").select("id", { count: "exact", head: true })).count || 0;
      let tid = `ENS-${String(count + 1).padStart(3, "0")}`;
      const { data: existingTeachers } = await admin.from("teachers").select("id");
      const existingIds = new Set((existingTeachers || []).map((t: any) => t.id));
      let c = count + 1;
      while (existingIds.has(tid)) {
        c++;
        tid = `ENS-${String(c).padStart(3, "0")}`;
      }
      const { error: tErr } = await admin.from("teachers").insert({
        id: tid,
        user_id: userId,
        nom: teacher.nom,
        prenom: teacher.prenom,
        specialite: teacher.specialite || "Formateur",
        email: teacher.email || email,
        phone: teacher.phone || "",
        type_contrat: teacher.type_contrat || "Prestation",
        tarif_horaire: teacher.tarif_horaire || 0,
        photo_url: teacher.photo_url ?? teacher.photo ?? null,
        actif: true,
      });
      if (tErr) {
        return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: corsHeaders });
      }
      if (Array.isArray(module_ids) && module_ids.length) {
        const validUuids = module_ids.filter((id: string) =>
          typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
        if (validUuids.length) {
          const { data: existingMods } = await admin.from("modules").select("id").in("id", validUuids);
          const existingIds = (existingMods || []).map((m: any) => m.id);
          if (existingIds.length) {
            await admin.from("teacher_modules").insert(
              existingIds.map((module_id: string) => ({ teacher_id: tid, module_id }))
            );
          }
        }
      }
    }

    if ((role === "partner" || role === "partner_admin") && partner) {
      let organizationId = partner.organization_id;
      if (!organizationId) {
        const { data: org, error: orgErr } = await admin.from("partner_organizations").insert({
          organization_name: partner.organization_name,
          contact_name: partner.contact_name || name,
          email: partner.email || email,
          phone: partner.phone || null,
          status: partner.status || "active",
        }).select("id").single();
        if (orgErr || !org?.id) {
          await admin.auth.admin.deleteUser(userId);
          return new Response(JSON.stringify({ error: orgErr?.message || "Création organisation partenaire échouée" }), { status: 400, headers: corsHeaders });
        }
        organizationId = org.id;
      }
      const { error: memberErr } = await admin.from("partner_members").insert({
        organization_id: organizationId,
        user_id: userId,
        poste: partner.poste || null,
        contact: partner.contact || partner.phone || null,
        access_level: partner.access_level || "viewer",
        status: partner.member_status || "active",
        start_date: partner.start_date || new Date().toISOString().slice(0, 10),
        end_date: partner.end_date || null,
      });
      if (memberErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: corsHeaders });
      }
      if (Array.isArray(partner.scopes) && partner.scopes.length) {
        const { error: scopeErr } = await admin.from("partner_access_scopes").insert(
          partner.scopes.map((scope: string) => ({ organization_id: organizationId, scope, active: true }))
        );
        if (scopeErr) {
          await admin.auth.admin.deleteUser(userId);
          return new Response(JSON.stringify({ error: scopeErr.message }), { status: 400, headers: corsHeaders });
        }
      }
    }

    // Force le changement de mot de passe à la première connexion (mot de passe temporaire).
    await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

    if (callerUserId) {
      await admin.from("audit_logs").insert({
        user_id: callerUserId,
        action: isExistingAccount ? "UPDATE" : "CREATE",
        entity_type: "profiles",
        entity_id: userId,
        description: `${isExistingAccount ? "Association" : "Création"} utilisateur ${finalUsername} (${role})`,
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      user_id: userId,
      username: finalUsername,
      is_existing: isExistingAccount,
      student_id: studentIdCreated || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
