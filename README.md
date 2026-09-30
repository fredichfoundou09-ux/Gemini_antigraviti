# SENTINELLES NUMÉRIQUES

Plateforme de gestion de centre de formation (Génie Informatique & Génie Industriel) + module ENIA 2.0.

## Architecture cible

```text
React/Vite (Vercel)
   └── Supabase
        ├── Auth
        ├── PostgreSQL (+ RLS)
        ├── Storage
        └── Realtime / Edge Functions
```

## Démarrage local

1. Copier `.env.example` vers `.env.local`
2. Renseigner :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Installer et lancer le frontend :
   ```bash
   npm install
   npm run dev
   ```
4. Appliquer les migrations Supabase :
   ```bash
   supabase db push
   ```

## Structure importante

- `src/` : frontend React (UI conservée)
- `src/lib/supabase/` : client + services Supabase
- `src/contexts/AuthContext.tsx` : session Supabase Auth
- `src/hooks/` : hooks de données
- `supabase/migrations/` : schéma PostgreSQL + RLS + Storage
- `supabase/functions/create-user/` : création admin d’utilisateurs via Edge Function Deno
- `supabase/functions/ai-agent/` : orchestration sécurisée de l'agent Sentinel AI v2
- Architecture 100% serverless & cloud-native (l'ancien serveur Express a été intégralement migré et retiré)

## Déploiement

- Frontend : Vercel (`vercel.json` SPA rewrite inclus)
- Backend data/auth/storage : Supabase
- Code : GitHub

## Sécurité

- Mots de passe gérés uniquement par Supabase Auth
- RLS activé sur les tables métier
- `service_role` jamais exposé au frontend
- Bootstrap superadmin unique via RPC `promote_first_superadmin`
