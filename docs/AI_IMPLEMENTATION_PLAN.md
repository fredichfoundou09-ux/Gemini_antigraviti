# PLAN D'IMPLÉMENTATION — SENTINEL'S AI

## Calendrier des phases et statut

### Phase 0 : Sauvegarde et initialisation Git
- [x] Vérification de l'état du dépôt.
- [x] Création de la branche isolée `feature/sentinel-ai`.
- [x] Vérification de la suite de tests existante (128 tests au vert).
- [x] Vérification de la compilation TypeScript (`tsc --noEmit`).

### Phase 1 : Analyse d'architecture et matrice de sécurité
- [x] Analyse complète du modèle de données et des tables Supabase (`profiles`, `students`, `teachers`, `attendance`, `courses`, `tests`, `ai_agent_actions`, etc.).
- [x] Rédaction de `ARCHITECTURE_AI.md`.
- [x] Rédaction de `AI_SECURITY_AUDIT.md`.
- [x] Rédaction de `AI_TOOL_MATRIX.md`.
- [x] Rédaction de `AI_IMPLEMENTATION_PLAN.md`.

### Phase 2 : Configuration du fournisseur IA (NVIDIA NIM)
- Base URL configurable : `https://integrate.api.nvidia.com/v1`.
- Modèle par défaut : `nvidia/nemotron-3.5-lightning-30b-a3b` (ou `meta/llama-3.3-70b-instruct` selon configuration de la variable d'environnement `NVIDIA_MODEL`).
- Abstraction `AIProvider` pour permettre le fallback automatique ou le changement de modèle sans modifier le code applicatif.
- Clé `NVIDIA_API_KEY` isolée dans les variables serveur Supabase.

### Phase 3 : Refactorisation modulaire de l'Edge Function (`supabase/functions/ai-agent/`)
- Découpage en modules clairs :
  - `provider.ts` : Communication avec NVIDIA NIM, gestion du streaming, erreurs 429, timeouts et fallback.
  - `auth.ts` : Extraction du token, vérification d'identité, extraction du profil et rôle.
  - `permissions.ts` : Contrôle RBAC dynamique par outil et par rôle.
  - `tools.ts` : Implémentation complète des outils de Niveau 1, 2 et 3.
  - `rag.ts` : Recherche sémantique et textuelle dans les ressources pédagogiques et documents de l'école.
  - `prompts.ts` : Prompts système contextualisés par rôle, consignes anti-injection, limitation de tokens.
  - `validation.ts` : Validation des entrées d'outils et sanitisation des retours.
  - `audit.ts` : Enregistrement des actions dans `ai_agent_actions`.
  - `index.ts` : Routeur principal compatible Deno Runtime.

### Phase 4 : Migration base de données Supabase
- Création de la migration `supabase/migrations/0047_sentinel_ai_rag_and_memory.sql` :
  - Table `ai_conversations` (historique par utilisateur avec RLS).
  - Table `ai_messages` (messages échangés et appels d'outils associés).
  - Table `ai_knowledge_docs` (documents de référence pour le RAG).
  - Index PostgreSQL sur `(user_id, created_at)` pour des temps de réponse rapides.

### Phase 5 : Frontend Service et Hook
- Création de `src/lib/ai/sentinelAiService.ts` avec support complet :
  - Authentification Supabase automatique.
  - Streaming et non-streaming.
  - Fallback local résilient en mode hors-ligne ou si l'Edge Function n'est pas encore déployée.
  - Confirmation d'actions en deux temps.
- Création de `src/hooks/useSentinelAi.ts` pour une intégration simple et réactive dans les composants React.

### Phase 6 : Interface Utilisateur (UI Chat & Cartes d'Actions)
- Création de `src/components/ai/SentinelAIChat.tsx` :
  - Design cyberpunk HUD sombre, aligné sur l'identité visuelle de SENTINEL'S (`#060b12`, cyan `#00E5FF`, bordures fines, typographie moderne).
  - Affichage des étapes de réflexion de l'IA (Tool badges).
  - Cartes de confirmation interactives pour les actions de niveau 3 (Présences, Devoirs, Évaluations, Messages).
  - Historique de discussion, régénération, copie des réponses.
  - Compatible Mobile & Desktop via le FAB flottant existant.

### Phase 7 : Tests unitaires et d'intégration
- Ajout de la suite de tests `src/__tests__/sentinel_ai.test.ts` validant :
  - Le contrôle des permissions par rôle (étudiant, formateur, admin).
  - Le blocage des tentatives de prompt injection.
  - La gestion des actions sensibles avec statut `proposed` puis `executed`.
  - Le comportement de secours en cas d'indisponibilité réseau ou erreur 429.

### Phase 8 : Validation et préparation au déploiement Vercel / Supabase
- Validation `npm test`.
- Validation `npm run typecheck`.
- Validation `npm run build`.
