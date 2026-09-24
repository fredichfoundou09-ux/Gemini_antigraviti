# ARCHITECTURE TECHNIQUE — SENTINEL'S AI (code6senti)

## 1. Vue d'ensemble du système

SENTINEL'S AI est l'agent intelligent intégré au sein de la plateforme **Sentinelles Numériques v2 (code6senti)**.
Il assiste les administrateurs, formateurs, étudiants et partenaires selon des règles strictes de contrôle d'accès basé sur les rôles (RBAC) et d'isolation de données (RLS).

```
                      +-----------------------------+
                      |   Utilisateur (Navigateur)  |
                      |   React 19 / Vite / PWA     |
                      +--------------+--------------+
                                     |
                       (JWT Supabase via Authorization)
                                     v
                      +-----------------------------+
                      | Supabase Edge Function      |
                      | /functions/v1/ai-agent      |
                      +--------------+--------------+
                                     |
           +-------------------------+-------------------------+
           |                         |                         |
           v                         v                         v
+--------------------+    +--------------------+    +--------------------+
| Auth & RBAC        |    | Tool Engine        |    | RAG Knowledge      |
| Role & UID check   |    | Registry L1, L2, L3|    | Hybrid & vector    |
+----------+---------+    +----------+---------+    +----------+---------+
           |                         |                         |
           |   (Requêtes avec        |   (Actions & Audit      |
           |    droits de l'user)    |    en DB)               |
           +-------------------------+-------------------------+
                                     |
                                     v
                      +-----------------------------+
                      | PostgreSQL / Supabase RLS   |
                      | profiles, students, courses |
                      | ai_agent_actions, etc.      |
                      +--------------+--------------+
                                     |
                        (NVIDIA_API_KEY secrète)
                                     v
                      +-----------------------------+
                      | NVIDIA NIM Gateway          |
                      | https://integrate.api.../v1 |
                      | Nemotron / Llama / Qwen     |
                      +-----------------------------+
```

---

## 2. Principes Fondamentaux de Sécurité

1. **Zéro exposition de clé API côté client** : La variable `NVIDIA_API_KEY` réside exclusivement dans les secrets serveur Supabase (`supabase secrets set`).
2. **Pas d'accès Super-Admin direct par l'IA** : L'Edge Function utilise le token de l'utilisateur (`auth.uid()`) pour exécuter les outils, ce qui garantit que les politiques RLS existantes sont infranchissables.
3. **Approche 3 Niveaux d'Action** :
   - **Niveau 1 (Lecture)** : Exécution directe après validation RBAC (ex: `get_dashboard_stats`, `search_courses`, `get_attendance`).
   - **Niveau 2 (Préparation / Brouillon)** : L'IA prépare la charge utile (ex: `prepare_message`, `create_learning_exercise`) sans modifier l'état persistant final.
   - **Niveau 3 (Écriture sensible)** : Proposition en attente, enregistrement dans `ai_agent_actions` avec statut `proposed`, demande de confirmation explicite avec modal/carte interactive UI, validation cryptographique / de session lors de l'exécution.
4. **Audit complet** : Toute action sensible est consignée avec `user_id`, `role`, `tool_name`, `arguments`, `status` et `timestamp`.

---

## 3. Décomposition Modulaire de l'Edge Function (`supabase/functions/ai-agent/`)

- `index.ts` : Point d'entrée HTTP Deno, filtrage CORS, gestion des requêtes POST / OPTIONS, aiguillage vers conversation ou confirmation.
- `provider.ts` : Abstraction `AIProvider` et implémentation `NvidiaNimProvider` avec gestion du streaming, timeouts, retries et gestion des erreurs 429 / 503.
- `auth.ts` : Validation de l'en-tête `Authorization`, récupération de la session et du profil Supabase.
- `permissions.ts` : Matrice RBAC validant l'éligibilité du rôle pour chaque outil.
- `tools.ts` : Implémentation des outils (Read, Prep, Action).
- `rag.ts` : Moteur de recherche sémantique et textuelle dans les cours, documents, règlements et FAQ.
- `validation.ts` : Vérification des types de paramètres et détection de tentatives d'injection de prompt.
- `prompts.ts` : System prompts adaptés au rôle (`admin`, `teacher`, `student`, `partner`).
- `audit.ts` : Enregistrement structuré dans `ai_agent_actions`.

---

## 4. Intégration Frontend (`src/`)

- `src/lib/ai/types.ts` : Typages TypeScript stricts pour messages, outils, statuts et réponses.
- `src/lib/ai/sentinelAiService.ts` : Client avec support du streaming, session Supabase, gestion des erreurs réseau et fallback local intelligent pour le développement hors-ligne.
- `src/hooks/useSentinelAi.ts` : Hook React personnalisé fournissant l'historique, l'envoi de messages, la confirmation/rejet d'actions et les indicateurs d'état.
- `src/components/ai/SentinelAIChat.tsx` : Interface de chat moderne, respectant la charte HUD sombre (cyan/rouge/noir) de SENTINEL'S, intégrée au FAB du tableau de bord.
