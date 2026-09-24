import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface UserContext {
  userId: string;
  role: "superadmin" | "admin" | "partner_admin" | "partner" | "teacher" | "student" | string;
  name: string;
  username: string;
  email?: string;
  teacherId?: string | null;
  studentId?: string | null;
  sbUser: any;
}

export async function authenticateRequest(req: Request): Promise<UserContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  // Client utilisant le JWT de l'utilisateur pour respecter scrupuleusement les RLS
  const sbUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) {
    return null;
  }

  // Récupération du profil
  const { data: profile } = await sbUser
    .from("profiles")
    .select("id, username, name, email, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.active === false) {
    return null;
  }

  let teacherId: string | null = null;
  let studentId: string | null = null;

  if (profile.role === "teacher") {
    const { data: t } = await sbUser
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    teacherId = t?.id ?? null;
  } else if (profile.role === "student") {
    const { data: s } = await sbUser
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    studentId = s?.id ?? null;
  }

  return {
    userId: user.id,
    role: profile.role,
    name: profile.name || profile.username,
    username: profile.username,
    email: profile.email || user.email,
    teacherId,
    studentId,
    sbUser,
  };
}
