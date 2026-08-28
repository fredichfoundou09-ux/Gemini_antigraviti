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

    // Vérifie l'appelant (staff)
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerUser } = await caller.auth.getUser();
    if (!callerUser.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("role,active").eq("id", callerUser.user.id).maybeSingle();
    if (!profile?.active || !["superadmin", "admin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Permissions insuffisantes" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      email, password, username, name, role,
      // optionnels métier
      student, teacher, partner, module_ids = [],
    } = body;

    if (!email || !password || !username || !name || !role) {
      return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400, headers: corsHeaders });
    }
    const allowedRoles = ["admin", "partner_admin", "teacher", "student", "partner"];
    if (!allowedRoles.includes(role) && !(profile.role === "superadmin" && role === "superadmin")) {
      return new Response(JSON.stringify({ error: "Rôle non autorisé" }), { status: 400, headers: corsHeaders });
    }
    if ((role === "admin" || role === "superadmin") && profile.role !== "superadmin") {
      return new Response(JSON.stringify({ error: "Seul un Super Admin peut créer un administrateur." }), { status: 403, headers: corsHeaders });
    }
    if ((role === "partner" || role === "partner_admin") && !partner?.organization_name && !partner?.organization_id) {
      return new Response(JSON.stringify({ error: "Une organisation partenaire est obligatoire." }), { status: 400, headers: corsHeaders });
    }

    // 1) Auth user
    let userId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, name, role },
    });
    if (createErr || !created?.user) {
      if (createErr?.message?.includes("already been registered")) {
        const { data: { users } } = await admin.auth.admin.listUsers();
        const existing = (users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          const { data: existingProfile } = await admin.from("profiles").select("role").eq("id", existing.id).maybeSingle();
          if (existingProfile && existingProfile.role === role) {
            return new Response(JSON.stringify({ error: `Un compte ${role} existe déjà pour cette adresse (${email}).` }), { status: 400, headers: corsHeaders });
          }
          await admin.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: { username, name, role },
          });
          userId = existing.id;
        } else {
          return new Response(JSON.stringify({ error: "Cette adresse email est déjà enregistrée." }), { status: 400, headers: corsHeaders });
        }
      } else {
        return new Response(JSON.stringify({ error: createErr?.message || "Création Auth échouée" }), { status: 400, headers: corsHeaders });
      }
    } else {
      userId = created.user.id;
    }

    // 2) Profile
    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId,
      username: String(username).toLowerCase(),
      name,
      email,
      role,
      active: true,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: corsHeaders });
    }

    // 3) Fiche métier
    if (role === "student" && student) {
      const { data: sid, error: sidErr } = await admin.rpc("generate_student_id");
      if (sidErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: sidErr.message }), { status: 400, headers: corsHeaders });
      }
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
        statut: "actif",
      });
      if (stErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: stErr.message }), { status: 400, headers: corsHeaders });
      }
      if (module_ids.length) {
        const { error: smErr } = await admin.from("student_modules").insert(module_ids.map((module_id: string) => ({ student_id: sid, module_id })));
        if (smErr) {
          await admin.auth.admin.deleteUser(userId);
          return new Response(JSON.stringify({ error: smErr.message }), { status: 400, headers: corsHeaders });
        }
      }
    }

    if (role === "teacher" && teacher) {
      const count = (await admin.from("teachers").select("id", { count: "exact", head: true })).count || 0;
      const tid = `ENS-${String(count + 1).padStart(3, "0")}`;
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
        actif: true,
      });
      if (tErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: corsHeaders });
      }
      if (module_ids.length) {
        const { error: tmErr } = await admin.from("teacher_modules").insert(module_ids.map((module_id: string) => ({ teacher_id: tid, module_id })));
        if (tmErr) {
          await admin.auth.admin.deleteUser(userId);
          return new Response(JSON.stringify({ error: tmErr.message }), { status: 400, headers: corsHeaders });
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

    await admin.from("audit_logs").insert({
      user_id: callerUser.user.id,
      action: "CREATE",
      entity_type: "profiles",
      entity_id: userId,
      description: `Création utilisateur ${username} (${role})`,
    });

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
