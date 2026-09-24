// Edge Function: assistant IA "agent" — discute et propose/exécute des actions
// précises (outils prédéfinis) avec les droits RLS de l'utilisateur connecté.
// AUCUNE clé service_role ici : toutes les requêtes passent par le token JWT
// de l'utilisateur, donc les policies RLS existantes s'appliquent normalement.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "https://tvcuwhgqhrcvdgwlviju.supabase.co",
  ];
  const appOrigin = Deno.env.get("APP_ORIGIN");
  if (appOrigin) allowedOrigins.push(appOrigin);

  const isAllowed = !origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  const allowOrigin = isAllowed ? (origin || "*") : (allowedOrigins[0] || "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const SYSTEM_PROMPT = `Tu es l'assistant IA interne de "Sentinelles Numériques", une plateforme de
gestion scolaire. Tu aides le formateur ou l'administrateur connecté à gagner
du temps sur des tâches répétitives : consulter les absences du jour,
valider des présences, publier des devoirs, publier des évaluations, repérer des anomalies.

Règles strictes :
- Tu n'agis QUE via les outils fournis. Tu n'inventes jamais de données
  (élèves, modules, dates) qui ne proviennent pas d'un appel d'outil.
- Pour toute action qui écrit en base (valider_presence, publier_devoir, publier_evaluation),
  appelle l'outil correspondant : le système affichera une carte de
  confirmation à l'utilisateur avant toute exécution réelle. Tu ne dois
  jamais prétendre qu'une action a été faite si l'outil ne l'a pas
  confirmée.
- Réponds en français, de façon claire et concise.
- Si une demande sort de ton périmètre (aucun outil ne correspond), dis-le
  clairement et propose ce que tu peux faire à la place.`;

// --- Définition des outils exposés au modèle (format compatible OpenAI/NIM) ---
export const TOOLS = [
  {
    type: "function",
    function: {
      name: "lister_mes_modules",
      description: "Liste les modules enseignés par le formateur connecté, avec le nombre d'apprenants inscrits dans chacun.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "lister_absences_du_jour",
      description: "Liste les apprenants non pointés (aucune présence enregistrée) aujourd'hui, pour un module donné du formateur connecté.",
      parameters: {
        type: "object",
        properties: { module_id: { type: "string", description: "Identifiant du module (obtenu via lister_mes_modules)." } },
        required: ["module_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "valider_presence",
      description: "Prépare l'enregistrement d'une présence/absence/retard pour un ou plusieurs apprenants sur un module. N'exécute PAS directement : renvoie une action à confirmer par l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          student_ids: { type: "array", items: { type: "string" }, description: "Identifiants des apprenants concernés." },
          statut: { type: "string", enum: ["present", "absent", "retard"] },
          date: { type: "string", description: "Date au format AAAA-MM-JJ. Par défaut aujourd'hui si omis." },
          salle: { type: "string" },
        },
        required: ["module_id", "student_ids", "statut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publier_devoir",
      description: "Prépare la publication d'un devoir ou document pour un module. N'exécute PAS directement : renvoie une action à confirmer par l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string" },
          titre: { type: "string" },
          description: { type: "string" },
          contenu: { type: "string", description: "Énoncé complet du devoir." },
          type: { type: "string", enum: ["devoir", "document"] },
        },
        required: ["module_id", "titre", "contenu"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "publier_evaluation",
      description: "Prépare la publication d'une évaluation complète (QCM, V/F ou courte) pour un module. N'exécute PAS directement : renvoie une action à confirmer par l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          module_id: { type: "string", description: "Identifiant UUID du module." },
          titre: { type: "string", description: "Titre de l'évaluation." },
          duree: { type: "number", description: "Durée en minutes (ex: 45)." },
          bareme: { type: "number", description: "Total des points (barème, ex: 20)." },
          questions: {
            type: "array",
            description: "Questions de l'évaluation.",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["qcm", "vf", "courte"], description: "Type de question" },
                enonce: { type: "string", description: "Énoncé de la question" },
                options: {
                  type: "array",
                  items: { type: "string" },
                  description: "Liste des choix possibles pour un QCM",
                },
                bonne_reponse: { type: "string", description: "Bonne réponse attendue" },
                points: { type: "number", description: "Points attribués à cette question" },
              },
              required: ["type", "enonce", "bonne_reponse", "points"],
            },
          },
        },
        required: ["module_id", "titre", "questions", "duree", "bareme"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detecter_anomalies",
      description: "Repère les apprenants du formateur connecté sans aucune présence enregistrée depuis un nombre de jours donné (par défaut 14).",
      parameters: {
        type: "object",
        properties: { jours: { type: "number", description: "Nombre de jours sans présence à considérer comme anomalie (défaut 14)." } },
        required: [],
      },
    },
  },
];

// Outils qui écrivent réellement en base : toujours exécutés en deux temps
// (proposition -> confirmation explicite du client avant exécution réelle).
export const WRITE_TOOLS = new Set(["valider_presence", "publier_devoir", "publier_evaluation"]);

async function getTeacherId(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("teachers").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function runTool(sb: any, userId: string, name: string, args: any) {
  const teacherId = await getTeacherId(sb, userId);
  if (!teacherId) throw new Error("Aucune fiche formateur associée à ce compte.");

  switch (name) {
    case "lister_mes_modules": {
      const { data: mods, error } = await sb
        .from("teacher_modules")
        .select("module_id, modules(id, titre), student_modules:module_id(count)")
        .eq("teacher_id", teacherId);
      if (error) throw error;
      return { modules: mods };
    }

    case "lister_absences_du_jour": {
      const today = new Date().toISOString().slice(0, 10);
      const { data: inscrits, error: e1 } = await sb
        .from("student_modules")
        .select("student_id, students(id, nom, prenom)")
        .eq("module_id", args.module_id);
      if (e1) throw e1;
      const { data: pointes, error: e2 } = await sb
        .from("attendance")
        .select("student_id")
        .eq("module_id", args.module_id)
        .eq("date", today);
      if (e2) throw e2;
      const pointesIds = new Set((pointes || []).map((p: any) => p.student_id));
      const absents = (inscrits || [])
        .filter((i: any) => !pointesIds.has(i.student_id))
        .map((i: any) => i.students);
      return { date: today, non_pointes: absents, total: absents.length };
    }

    case "detecter_anomalies": {
      const jours = args.jours ?? 14;
      const seuil = new Date(Date.now() - jours * 86400000).toISOString().slice(0, 10);
      const { data: mods } = await sb.from("teacher_modules").select("module_id").eq("teacher_id", teacherId);
      const moduleIds = (mods || []).map((m: any) => m.module_id);
      if (moduleIds.length === 0) return { anomalies: [] };
      const { data: inscrits } = await sb
        .from("student_modules")
        .select("student_id, students(id, nom, prenom)")
        .in("module_id", moduleIds);
      const { data: recentes } = await sb
        .from("attendance")
        .select("student_id")
        .in("module_id", moduleIds)
        .gte("date", seuil);
      const actifs = new Set((recentes || []).map((r: any) => r.student_id));
      const seen = new Set<string>();
      const anomalies = (inscrits || [])
        .filter((i: any) => !actifs.has(i.student_id) && !seen.has(i.student_id) && seen.add(i.student_id))
        .map((i: any) => ({ ...i.students, raison: `Aucune présence depuis plus de ${jours} jours` }));
      return { anomalies, seuil_jours: jours };
    }

    // valider_presence, publier_devoir et publier_evaluation : uniquement appelés ici APRÈS
    // confirmation explicite du client (voir logique dans Deno.serve ci-dessous).
    case "valider_presence": {
      const date = args.date || new Date().toISOString().slice(0, 10);
      const rows = (args.student_ids as string[]).map((sid) => ({
        student_id: sid,
        module_id: args.module_id,
        teacher_id: teacherId,
        date,
        heure: new Date().toTimeString().slice(0, 5),
        salle: args.salle || "",
        statut: args.statut,
      }));
      const { data, error } = await sb.from("attendance").upsert(rows, { onConflict: "student_id,schedule_id,date" }).select();
      if (error) throw error;
      return { inserted: data?.length ?? 0 };
    }

    case "publier_devoir": {
      const { data, error } = await sb
        .from("courses")
        .insert({
          titre: args.titre,
          description: args.description || "",
          module_id: args.module_id,
          teacher_id: teacherId,
          type: args.type || "devoir",
          content: args.contenu,
          publie: true,
        })
        .select()
        .single();
      if (error) throw error;
      return { course_id: data.id, titre: data.titre };
    }

    case "publier_evaluation": {
      if (!args.module_id || !args.titre || !Array.isArray(args.questions)) {
        throw new Error("Paramètres invalides pour la publication de l'évaluation.");
      }
      const duree = Number(args.duree) || 45;
      const bareme = Number(args.bareme) || 20;

      // 1. Insertion du test avec teacher_id résolu côté serveur
      const { data: test, error: testErr } = await sb
        .from("tests")
        .insert({
          titre: args.titre,
          module_id: args.module_id,
          teacher_id: teacherId,
          duree,
          bareme,
          statut: "publie",
          date_publication: new Date().toISOString(),
          difficulte: "moyen",
          tentatives: 1,
          mode_securise: false,
        })
        .select()
        .single();

      if (testErr) throw testErr;

      // 2. Insertion des questions associées
      const questionsToInsert = args.questions.map((q: any, idx: number) => ({
        test_id: test.id,
        question: q.enonce || q.question || `Question ${idx + 1}`,
        type: q.type || "qcm",
        bonne_reponse: String(q.bonne_reponse ?? ""),
        points: Number(q.points) || 1,
        ordre: idx + 1,
        options_json: Array.isArray(q.options) ? q.options : [],
      }));

      const { data: insertedQuestions, error: qErr } = await sb
        .from("questions")
        .insert(questionsToInsert)
        .select();

      if (qErr) throw qErr;

      // 3. Insertion dans question_options si options présentes (pour rétrocompatibilité)
      if (insertedQuestions && insertedQuestions.length > 0) {
        const optionRows: any[] = [];
        insertedQuestions.forEach((qCreated: any, idx: number) => {
          const original = args.questions[idx];
          if (Array.isArray(original?.options)) {
            original.options.forEach((optText: string, oIdx: number) => {
              optionRows.push({
                question_id: qCreated.id,
                option_text: String(optText),
                ordre: oIdx + 1,
              });
            });
          }
        });
        if (optionRows.length > 0) {
          try {
            await sb.from("question_options").insert(optionRows);
          } catch {
            // Ignorer si question_options non requise
          }
        }
      }

      return {
        test_id: test.id,
        titre: test.titre,
        questions_count: questionsToInsert.length,
        bareme,
        duree,
      };
    }

    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

// Handler HTTP principal Deno (si exécuté via Deno.serve dans Edge Runtime)
if (typeof Deno !== "undefined" && typeof (Deno as any).serve === "function") {
  (Deno as any).serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const sb = createClient(
        (Deno.env.get("SUPABASE_URL") as string) || "",
        (Deno.env.get("SUPABASE_ANON_KEY") as string) || "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: corsHeaders });
      }

      const body = await req.json();

      // --- Chemin 1 : confirmation explicite d'une action déjà proposée (écriture réelle) ---
      if (body.confirm_action) {
        const { tool_name, arguments: args, action_id } = body.confirm_action;
        if (!WRITE_TOOLS.has(tool_name)) {
          return new Response(JSON.stringify({ error: "Outil non confirmable" }), { status: 400, headers: corsHeaders });
        }
        try {
          const result = await runTool(sb, user.id, tool_name, args);
          await sb.from("ai_agent_actions").update({ status: "executed", result }).eq("id", action_id).eq("user_id", user.id);
          return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e: any) {
          await sb.from("ai_agent_actions").update({ status: "failed", error: String(e.message || e) }).eq("id", action_id).eq("user_id", user.id);
          return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: corsHeaders });
        }
      }

      // --- Chemin 2 : conversation normale, avec boucle d'appel d'outils ---
      const { messages } = body;
      const conversation = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
      const pendingActions: any[] = [];

      for (let step = 0; step < 4; step++) {
        const res = await fetch(NVIDIA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("NVIDIA_API_KEY")}` },
          body: JSON.stringify({ model: NVIDIA_MODEL, messages: conversation, tools: TOOLS, tool_choice: "auto", temperature: 0.3, max_tokens: 900 }),
        });
        if (!res.ok) {
          const errText = await res.text();
          return new Response(JSON.stringify({ error: errText }), { status: res.status, headers: corsHeaders });
        }
        const data = await res.json();
        const choice = data.choices?.[0]?.message;
        if (!choice) break;
        conversation.push(choice);

        const calls = choice.tool_calls || [];
        if (calls.length === 0) {
          // Réponse texte finale du modèle
          return new Response(JSON.stringify({ reply: choice.content, pending_actions: pendingActions }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const call of calls) {
          const toolName = call.function.name;
          const args = JSON.parse(call.function.arguments || "{}");

          if (WRITE_TOOLS.has(toolName)) {
            // Action d'écriture : ne PAS exécuter maintenant. On journalise une
            // proposition et on la renvoie au client pour confirmation explicite.
            const { data: logged } = await sb
              .from("ai_agent_actions")
              .insert({ user_id: user.id, tool_name: toolName, arguments: args, status: "proposed" })
              .select()
              .single();
            pendingActions.push({ action_id: logged?.id, tool_name: toolName, arguments: args });
            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ status: "en_attente_de_confirmation_utilisateur" }),
            });
          } else {
            try {
              const result = await runTool(sb, user.id, toolName, args);
              conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
            } catch (e: any) {
              conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: String(e.message || e) }) });
            }
          }
        }
      }

      return new Response(JSON.stringify({ reply: "Je n'ai pas pu terminer cette demande, pouvez-vous reformuler ?", pending_actions: pendingActions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: getCorsHeaders(req) });
    }
  });
}
