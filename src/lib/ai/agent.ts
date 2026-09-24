/**
 * Point d'entrée pour la compatibilité avec l'ancien prototype de l'assistant IA
 * Redirige vers la couche complète SENTINEL'S AI (sentinelAiService.ts & types.ts)
 */
export * from "./types";
export {
  askSentinelAi as askAgent,
  confirmSentinelAiAction as confirmAgentAction,
  localAgentProcess,
  localAgentExecute,
} from "./sentinelAiService";
