# Lancer SENTINELLES NUMÉRIQUES en local (tests)

## Prérequis
| Outil | Rôle | Vérifier |
|---|---|---|
| Node.js 20+ | Frontend Vite | `node -v` |
| Docker Desktop | Requis par la CLI Supabase | `docker -v` |
| CLI Supabase | Postgres/Auth/Storage/Realtime local | `npm i -g supabase && supabase -v` |
| Git | Versionnement | `git -v` |

## 1) Démarrer Supabase en local
```bash
supabase start
```
Notez à la fin : `API URL`, `anon key`, `service_role key` (jamais dans le front), `Studio URL`.

## 2) Appliquer schéma + fonctions
```bash
supabase db reset                                  # applique 0001..0005 + seed.sql
supabase functions serve                           # sert create-user (bootstrap via RPC SQL, pas d'Edge Function)
```

## 3) Configurer le frontend
```bash
cp .env.example .env.local
```
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_USE_SUPABASE=true
```
```bash
npm install
npm run dev
```
App : http://localhost:5173

## 4) Scénario de test
1. Connexion → « Première configuration » → créer l'Admin Sup. Vérifier `profiles.role = superadmin` dans Studio.
2. Rafraîchir : le bloc de bootstrap disparaît (`has_any_superadmin()` = true).
3. Se connecter en Admin Sup.
4. Créer un enseignant puis un apprenant → vérifier les tables `teachers`/`students`/`auth.users` (jamais localStorage).
5. Se connecter avec l'apprenant → il ne voit que ses données (RLS).
6. `supabase db reset` pour repartir propre entre deux tests.

## 5) Désactiver l'auto-inscription publique
Supabase Dashboard → Authentication → Settings → « Allow new users to sign up » = OFF.
Seules les 2 portes officielles restent : bootstrap unique + `create-user`.
