import { authenticateRequest } from "./auth.ts";
import { isToolAllowedForRole, validateAccessScope } from "./permissions.ts";
import { NvidiaNimProvider, ChatMessage } from "./provider.ts";
import { WRITE_TOOLS, executeTool } from "./tools.ts";
import { getSystemPrompt } from "./prompts.ts";
import { checkPromptInjection, sanitizeOutput } from "./validation.ts";
import { logAgentAction, updateAgentActionStatus } from "./audit.ts";
import { getOptimizedTools, classifyIntent } from "./router.ts";
import { getRelevantMemories, captureCandidateMemory } from "./memory.ts";

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
      // BRANCHE 1 : Enregistrement de Feedback utilisateur (👍 / 👎)
      // =========================================================================
      if (body.feedback) {
        const { message_id, rating, comment } = body.feedback;
        if (message_id && (rating === "positive" || rating === "negative")) {
          await user.sbUser.from("ai_feedback").insert({
            user_id: user.userId,
            message_id,
            rating,
            comment: comment || null,
          });
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // =========================================================================
      // BRANCHE 2 : Confirmation explicite d'une action sensible (Niveau 3)
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
      // BRANCHE 3 : Conversation intelligente avec Context Engine & Mémoire
      // =========================================================================
      const startTime = performance.now();
      const incomingMessages = body.messages || [];
      const isStreaming = Boolean(body.stream);
      const conversationId = body.conversation_id || null;
      const lastUserMsg = incomingMessages.filter((m: any) => m.role === "user").pop()?.content || "";

      // Vérification de sécurité anti-injection
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

      // Apprentissage automatique passif : détection de mémoires candidates
      await captureCandidateMemory(user, lastUserMsg);

      // Récupération des mémoires actives
      const memories = await getRelevantMemories(user);

      // Routeur de contexte : sélection prédictive des 2 à 4 outils optimaux
      const intent = classifyIntent(lastUserMsg);
      const optimizedTools = getOptimizedTools(user.role, lastUserMsg);

      const conversation: ChatMessage[] = [
        { role: "system", content: getSystemPrompt(user, memories) },
        ...incomingMessages,
      ];

      const provider = new NvidiaNimProvider();
      const pendingActions: any[] = [];
      const sourcesUsed: string[] = [];
      let finalReply = "";
      const MAX_AGENT_STEPS = 5;

      for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const { message: aiMessage } = await provider.createCompletion({
          messages: conversation,
          tools: optimizedTools.length > 0 ? optimizedTools : undefined,
          temperature: 0.25,
          max_tokens: 1024,
        });

        conversation.push(aiMessage);

        const calls = aiMessage.tool_calls || [];
        if (calls.length === 0) {
          finalReply = aiMessage.content || "";
          break;
        }

        // Exécution PARALLÈLE de tous les outils appelés par le modèle
        const toolExecutionPromises = calls.map(async (call: any) => {
          const toolName = call.function.name;
          let args: any = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }

          // Vérification du scope d'accès aux arguments
          const scope = validateAccessScope(user, toolName, args);
          if (!scope.ok) {
            return {
              role: "tool" as const,
              tool_call_id: call.id,
              content: JSON.stringify({ error: scope.reason || "Accès restreint aux données spécifiées." }),
              sources: [] as string[],
              pendingAction: null,
            };
          }

          if (WRITE_TOOLS.has(toolName)) {
            // Action de Niveau 3 : enregistrement d'une proposition soumise à confirmation
            const actionId = await logAgentAction(user, {
              tool_name: toolName,
              arguments: args,
              status: "proposed",
            });

            return {
              role: "tool" as const,
              tool_call_id: call.id,
              content: JSON.stringify({
                status: "proposition_enregistree",
                message: "Cette action sensible requiert la validation explicite de l'utilisateur par carte interactive.",
              }),
              sources: [] as string[],
              pendingAction: {
                action_id: actionId,
                tool_name: toolName,
                arguments: args,
              },
            };
          }

          // Action de lecture, web ou RAG : exécution directe et traçabilité des sources
          try {
            const res = await executeTool(user, toolName, args);
            const discoveredSources: string[] = [];

            if ((toolName === "search_documents" || toolName === "search_course_knowledge" || toolName === "search_my_documents") && res?.results) {
              for (const r of res.results) {
                if (r.title && !discoveredSources.includes(r.title)) discoveredSources.push(r.title);
              }
            } else if ((toolName === "search_wikipedia" || toolName === "search_web") && res?.results) {
              for (const r of res.results) {
                if (r.title && !discoveredSources.includes(r.title)) discoveredSources.push(r.title);
              }
            } else if (toolName === "get_my_next_course" || toolName === "get_schedule" || toolName === "get_my_schedule") {
              discoveredSources.push("Emploi du temps officiel");
            } else if (toolName === "get_attendance" || toolName === "get_my_attendance" || toolName === "detecter_anomalies") {
              discoveredSources.push("Registre d'assiduité Sentinel'S");
            } else if (toolName === "get_finance_summary" || toolName === "get_student_balance") {
              discoveredSources.push("Registre de trésorerie");
            }

            return {
              role: "tool" as const,
              tool_call_id: call.id,
              content: JSON.stringify(res),
              sources: discoveredSources,
              pendingAction: null,
            };
          } catch (err: any) {
            return {
              role: "tool" as const,
              tool_call_id: call.id,
              content: JSON.stringify({ error: String(err.message || err) }),
              sources: [] as string[],
              pendingAction: null,
            };
          }
        });

        const resolvedResults = await Promise.all(toolExecutionPromises);
        for (const item of resolvedResults) {
          conversation.push({
            role: "tool",
            tool_call_id: item.tool_call_id,
            content: item.content,
          });
          if (item.pendingAction) pendingActions.push(item.pendingAction);
          for (const s of item.sources) {
            if (!sourcesUsed.includes(s)) sourcesUsed.push(s);
          }
        }
      }

      const latencyMs = Math.round(performance.now() - startTime);
      const estPromptTokens = Math.round(incomingMessages.reduce((acc: number, m: any) => acc + (m.content?.length || 0), 0) / 4);
      const estCompletionTokens = Math.round(finalReply.length / 4);
      const estTotalTokens = estPromptTokens + estCompletionTokens;

      try {
        await user.sbUser.from("ai_audit_logs").insert({
          user_id: user.userId,
          role: user.role,
          intent,
          tool_name: pendingActions[0]?.tool_name || (sourcesUsed.length > 0 ? "rag_sources" : null),
          prompt_tokens: estPromptTokens,
          completion_tokens: estCompletionTokens,
          total_tokens: estTotalTokens,
          latency_ms: latencyMs,
          sources: sourcesUsed,
          status: "success",
        });
      } catch (auditErr) {
        console.warn("Échec log télémétrie ai_audit_logs:", auditErr);
      }

      const sanitizedReply = sanitizeOutput(finalReply);

      // Si l'utilisateur a demandé un flux SSE en streaming
      if (isStreaming) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            // 1. Envoi préalable des sources et propositions d'action
            if (pendingActions.length > 0) {
              controller.enqueue(encoder.encode(`event: actions\ndata: ${JSON.stringify(pendingActions)}\n\n`));
            }
            if (sourcesUsed.length > 0) {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(sourcesUsed)}\n\n`));
            }

            // 2. Découpage et streaming progressif des tokens
            const words = sanitizedReply.split(/(\s+)/);
            for (const chunk of words) {
              controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ token: chunk })}\n\n`));
              await new Promise((r) => setTimeout(r, 12));
            }

            // 3. Clôture avec métriques et intention
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                  reply: sanitizedReply,
                  pending_actions: pendingActions,
                  intent,
                  sources: sourcesUsed,
                  latency_ms: latencyMs,
                  usage: {
                    prompt_tokens: estPromptTokens,
                    completion_tokens: estCompletionTokens,
                    total_tokens: estTotalTokens,
                  },
                })}\n\n`
              )
            );
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      return new Response(
        JSON.stringify({
          reply: sanitizedReply,
          pending_actions: pendingActions,
          intent,
          sources: sourcesUsed,
          memories_count: memories.length,
          usage: {
            prompt_tokens: estPromptTokens,
            completion_tokens: estCompletionTokens,
            total_tokens: estTotalTokens,
          },
          latency_ms: latencyMs,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      return new Response(
        JSON.stringify({
          error: "Le service IA est temporairement indisponible. Veuillez réessayer dans un instant.",
          details: String(e.message || e).replace(/nvapi-[a-zA-Z0-9_-]+/g, "[REDACTED]"),
        }),
        { status: 500, headers: getCorsHeaders(req) }
      );
    }
  });
}
