# Sécurité

## Principes
- Mots de passe gérés uniquement par Supabase Auth (jamais en clair, jamais hashés côté client en prod).
- Création de comptes via Edge Function `create-user` (clé `service_role` côté serveur uniquement).
- Bootstrap superadmin unique via `promote_first_superadmin()` / `bootstrap-superadmin`.
- RLS PostgreSQL sur toutes les tables (voir RLS.md).
- Auto-inscription publique désactivée dans le dashboard Supabase.

## Comptes créés par l'admin
- Mot de passe temporaire communiqué manuellement.
- Flag `must_change_password` posé → changement forcé à la 1re connexion (`mustChangePassword()` + `updatePassword()`).

## Checklist mise en production
- [x] RLS activé et audité sur toutes les tables (migrations `0001` à `0029`, pricing, questions, messages, presence)
- [x] `service_role` absente du frontend et confinée aux Edge Functions
- [x] Clés de secours de production hardcodées éliminées du bundle client (`src/lib/supabase/client.ts`)
- [x] Validation de mot de passe stricte côté serveur dans `create-user` et `config.toml` (>= 8 car., min/maj/chiffre)
- [x] Réponses aux examens protégées contre la lecture directe côté client (`student_questions` + RPC `submit_test_answers`)
- [x] Messagerie interne verrouillée contre l'auto-inscription abusive et la suppression non autorisée
- [x] Journal d'audit `audit_logs` sécurisé contre l'usurpation d'identité
- [x] Confidentialité des taux horaires formateurs (`get_teachers_safe()` / `public_teachers`)
- [x] Fallback d'authentification local PBKDF2 désactivé lorsque Supabase est connecté
- [x] `.env` et `.env.local` exclus du versioning Git
- [x] Auto-inscription publique directe désactivée (passage par RPC d'inscription contrôlée)
- [ ] 2FA (TOTP) pour superadmin/admin
- [ ] Sauvegardes SQL automatisées sur le projet Supabase
- [x] Journal d'audit consultable (hook `useAudit` et table `audit_logs`)
