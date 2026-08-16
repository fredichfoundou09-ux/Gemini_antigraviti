# Architecture SENTINELLES NUMÉRIQUES (Supabase-first)

## Principe

- Le frontend existant (pages, design, parcours) est **conservé à 100%**.
- Supabase devient la source de vérité : Auth, PostgreSQL, Storage, Realtime.
- `localStorage` est un **fallback de développement/offline uniquement**, jamais source de vérité en production.

## Décision — mode local vs Supabase

| Situation | Mode utilisé |
|---|---|
| `VITE_USE_SUPABASE=true` et clés renseignées | Supabase (production) |
| Clés absentes ou `VITE_USE_SUPABASE=false` | localStorage (dev/offline) |
| Supabase en maintenance temporaire | localStorage (fallback) |

**Objectif final :** retirer le mode local une fois Supabase stable en production et remplacer `store.tsx` par un store purement Supabase.

## Flux Auth (Supabase)

```text
Login.tsx
  → AuthContext.login() / store.login()
  → supabase.auth.signInWithPassword()
  → profiles.role (lu en base, jamais fourni par le client)
  → Redirection vers l'espace du rôle réel
```

## Bootstrap premier superadmin

```text
Vérification serveur has_any_superadmin()
  → false → bouton "Créer le premier compte" visible
  → Formulaire → bootstrapFirstSuperadmin()
  → auth.signUp() + promote_first_superadmin() (RPC SQL)
  → Aucune Edge Function requise pour cette étape
  → true → bouton masqué définitivement
```

## Création des autres comptes

```text
Admin connecté → formulaire People.tsx
  → invokeCreateUser() (Edge Function create-user)
  → service_role côté serveur → auth.admin.createUser()
  → profiles + students/teachers/partners
  → Mot de passe temporaire affiché UNE FOIS → toast credentials
```

## Couches frontend

```text
Page UI
  → Hook (useStudents/useFormations/useEnia/useAuth)
    → Service (src/lib/supabase/*)
      → Supabase JS
        → Auth / Postgres RLS / Storage
```

## Migrations

| Fichier | Rôle |
|---|---|
| `0001_init_schema.sql` | Schéma complet + RLS + Storage |
| `0002_has_any_superadmin.sql` | Grant manquant sur le RPC |
| `0003_seed_formations.sql` | Formations informatique/industriel |
| `0004_must_change_password.sql` | Flag changement mot de passe forcé |
| `0005_partner_role.sql` | RBAC partenaire + vues + politiques |

## CI/CD

```text
Push main → GitHub Actions
  ├── ci.yml          : build TypeScript + Vite
  └── supabase-deploy.yml : db push + functions deploy create-user
```

## Déploiement

- **Frontend** → Vercel (build Vite automatique à chaque push)
- **Backend** → Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Variables Vercel** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_USE_SUPABASE=true`
