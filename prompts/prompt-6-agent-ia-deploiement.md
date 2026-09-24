# Prompt 6/6 — Déploiement & extension de l'assistant IA agent

```
Contexte : un assistant IA "agent" vient d'être ajouté au projet React 19
+ TypeScript + Vite 7 + Supabase "Sentinelles Numériques" :
- supabase/migrations/0040_ai_agent_audit.sql (table d'audit)
- supabase/functions/ai-agent/index.ts (Edge Function, appelle l'API
  gratuite NVIDIA NIM avec 5 outils : lister_mes_modules,
  lister_absences_du_jour, valider_presence, publier_devoir,
  detecter_anomalies)
- src/lib/ai/agent.ts, src/hooks/useAiAgent.ts, src/components/AiAgentPanel.tsx
- Bouton d'accès dans src/layouts/DashboardLayout.tsx (icône Bot, visible
  formateur/admin/superadmin uniquement)

Le code compile et passe déjà tous les tests (0 erreur typecheck, build
OK, 58/58 tests). Vérifie après CHAQUE étape que `npm run typecheck`,
`npm run build` et `npm test` restent au vert.

1. Déploiement (étapes à documenter clairement dans le résumé final, à
   exécuter avec les identifiants Supabase du projet) :
   supabase functions deploy ai-agent
   supabase secrets set NVIDIA_API_KEY=nvapi-xxxxxxxx
   (la clé s'obtient gratuitement sur build.nvidia.com, voir le fichier
   guide-integration-nvidia-nim.md déjà fourni précédemment pour le détail
   de la procédure).

2. Ajoute un nouvel outil `publier_evaluation` dans
   supabase/functions/ai-agent/index.ts, sur le modèle exact de l'outil
   `publier_devoir` déjà présent (même principe : outil d'écriture, donc
   ajouté à l'ensemble WRITE_TOOLS, proposé puis confirmé avant exécution
   réelle, jamais exécuté directement par le modèle). Cet outil doit :
   - Accepter : module_id, titre, une liste de questions (chacune avec
     type "qcm"/"vf"/"courte", l'énoncé, les options si qcm/vf, la bonne
     réponse, les points), une durée en minutes, un barème.
   - Insérer une ligne dans la table `tests` (voir le schéma dans
     supabase/migrations/0001_init_schema.sql, table `tests` puis
     `questions`) puis les questions associées, avec `teacher_id` toujours
     égal à l'ID du formateur connecté (jamais fourni par le modèle IA,
     toujours recalculé côté serveur comme les autres outils existants).
   - Respecte la policy RLS existante sur `tests`/`questions` (vérifie son
     nom exact dans les migrations avant d'écrire le code, ne suppose
     rien).

3. Ajoute la carte de confirmation correspondante dans
   src/components/AiAgentPanel.tsx (la fonction `toolLabel` dans
   src/lib/ai/agent.ts doit aussi être étendue pour ce nouvel outil).

4. Écris un test dans src/__tests__/ qui vérifie, au niveau des types et
   de la logique métier réutilisable (pas besoin de simuler l'appel réseau
   à NVIDIA), que la structure de données envoyée à l'outil
   `publier_evaluation` correspond bien au schéma attendu par la table
   `tests`/`questions`.

Contraintes :
- Ne donne jamais à l'Edge Function une clé Supabase `service_role` : elle
  doit continuer à n'utiliser que le token JWT de l'utilisateur connecté,
  exactement comme les outils déjà en place.
- Ne modifie aucune policy RLS existante.
- Garde le principe "proposer, jamais décider seule" pour toute action qui
  écrit en base.

Livraison attendue : fichiers modifiés, extrait du nouvel outil ajouté,
résultat de typecheck/build/test, et confirmation manuelle du
fonctionnement (formateur demandant "prépare une évaluation de 5
questions sur X" → carte de confirmation → clic Confirmer → test bien créé
et visible côté apprenant concerné).
```
