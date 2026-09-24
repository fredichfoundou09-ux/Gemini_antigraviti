import { authenticateRequest } from "./auth.ts";
import { isToolAllowedForRole, validateAccessScope } from "./permissions.ts";
import { NvidiaNimProvider, ChatMessage } from "./provider.ts";
import { TOOLS, WRITE_TOOLS, executeTool } from "./tools.ts";
import { getSystemPrompt } from "./prompts.ts";
import { checkPromptInjection, sanitizeOutput } from "./validation.ts";
import { logAgentAction, updateAgentActionStatus } from "./audit.ts";

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

if (typeof Deno !== "undefined" && typeof (Deno as any).serve === "function") {
  (Deno as any).serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
      // 1. Authentification stricte via le JWT Supabase
      const user = await authenticateRequest(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Session invalide ou non authentifié." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => ({}));

      // =========================================================================
      // BRANCHE 1 : Confirmation explicite d'une action d'écriture sensible
      // =========================================================================
      if (body.confirm_action) {
        const { tool_name, arguments: args, action_id } = body.confirm_action;

        if (!WRITE_TOOLS.has(tool_name)) {
          return new Response(JSON.stringify({ error: "Cet outil ne requiert pas de confirmation." }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        if (!isToolAllowedForRole(user.role, tool_name)) {
          return new Response(JSON.stringify({ error: "Permissions insuffisantes pour exécuter cette action." }), {
            status: 403,
            headers: corsHeaders,
          });
        }

        const scope = validateAccessScope(user, tool_name, args);
        if (!scope.ok) {
          return new Response(JSON.stringify({ error: scope.reason }), { status: 403, headers: corsHeaders });
        }

        try {
          const result = await executeTool(user, tool_name, args);
          if (action_id) {
            await updateAgentActionStatus(user, action_id, "executed", result);
          }
          return new Response(JSON.stringify({ ok: true, result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e: any) {
          if (action_id) {
            await updateAgentActionStatus(user, action_id, "failed", null, String(e.message || e));
          }
          return new Response(JSON.stringify({ error: String(e.message || e) }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // =========================================================================
      // BRANCHE 2 : Conversation normale avec boucle d'outils
      // =========================================================================
      const incomingMessages = body.messages || [];
      const lastUserMsg = incomingMessages.filter((m: any) => m.role === "user").pop()?.content || "";

      // Vérification préventive anti-injection
      const injectionCheck = checkPromptInjection(lastUserMsg);
      if (injectionCheck.isSuspicious) {
        return new Response(
          JSON.stringify({
            reply: "Votre demande contient des instructions incompatibles avec la politique de sécurité de SENTINEL'S AI.",
            pending_actions: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filtrage des outils selon le rôle de l'utilisateur
      const allowedTools = TOOLS.filter((t) => isToolAllowedForRole(user.role, t.function.name));

      const conversation: ChatMessage[] = [
        { role: "system", content: getSystemPrompt(user) },
        ...incomingMessages,
      ];

      const provider = new NvidiaNimProvider();
      const pendingActions: any[] = [];
      let finalReply = "";

      for (let step = 0; step < 4; step++) {
        const { message: aiMessage } = await provider.createCompletion({
          messages: conversation,
          tools: allowedTools,
          temperature: 0.2,
          max_tokens: 1024,
        });

        conversation.push(aiMessage);

        const calls = aiMessage.tool_calls || [];
        if (calls.length === 0) {
          finalReply = aiMessage.content || "";
          break;
        }

        for (const call of calls) {
          const toolName = call.function.name;
          const args = JSON.parse(call.function.arguments || "{}");

          // Vérification de sécurité du scope d'arguments
          const scope = validateAccessScope(user, toolName, args);
          if (!scope.ok) {
            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: scope.reason || "Accès restreint aux données spécifiées." }),
            });
            continue;
          }

          if (WRITE_TOOLS.has(toolName)) {
            // Action sensible d'écriture : NE PAS exécuter immédiatement.
            // Journalisation de la proposition et renvoi au client pour confirmation.
            const actionId = await logAgentAction(user, {
              tool_name: toolName,
              arguments: args,
              status: "proposed",
            });

            pendingActions.push({
              action_id: actionId,
              tool_name: toolName,
              arguments: args,
            });

            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({
                status: "proposition_enregistree",
                message: "Cette action requiert la confirmation explicite de l'utilisateur.",
              }),
            });
          } else {
            // Action de lecture ou préparation : exécution directe
            try {
              const res = await executeTool(user, toolName, args);
              conversation.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(res),
              });
            } catch (err: any) {
              conversation.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: String(err.message || err) }),
              });
            }
          }
        }
      }

      if (!finalReply) {
        finalReply = "J'ai traité votre demande et préparé les éléments nécessaires.";
      }

      return new Response(
        JSON.stringify({
          reply: sanitizeOutput(finalReply),
          pending_actions: pendingActions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      return new Response(
        JSON.stringify({
          error: "Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.",
          details: String(e.message || e).replace(/nvapi-[a-zA-Z0-9_-]+/g, "[REDACTED]"),
        }),
        { status: 500, headers: getCorsHeaders(req) }
      );
    }
  });
}
