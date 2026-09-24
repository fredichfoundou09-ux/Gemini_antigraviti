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
- [x] 2FA (TOTP) pour superadmin/admin (table `admin_totp_secrets` isolée avec RLS `is_staff()`, moteur RFC 6238 Web Crypto API, enrôlement QR code et challenge à la connexion)
- [x] Sauvegardes SQL automatisées sur le projet Supabase (workflow GitHub Actions planifié `.github/workflows/database-backup.yml` avec `pg_dump` compressé et documentation PITR Supabase)
- [x] Journal d'audit consultable (hook `useAudit` et table `audit_logs`)

## Authentification Multifacteur (2FA TOTP)
- **Table dédiée** : `public.admin_totp_secrets` (migration `0045_admin_totp_secrets.sql`).
- **Cloisonnement RLS** : un administrateur ne peut lire ou modifier que son propre secret TOTP (`auth.uid() = user_id AND public.is_staff()`).
- **Standard RFC 6238** : implémentation native avec HMAC-SHA1 et Web Crypto API (`crypto.subtle`), sans dépendance tierce à risque.
- **Enrôlement** : génération d'un secret Base32 aléatoire de 160 bits (32 caractères), affichage du QR Code standard `otpauth://totp/` dans le profil administrateur, vérification obligatoire du premier code à 6 chiffres pour activation.
- **Connexion** : challenge dynamique à la connexion uniquement pour les administrateurs ayant activé le 2FA.

## Stratégie de Sauvegardes Automatisées
1. **Sauvegardes quotidiennes externalisées (GitHub Actions)** :
   - Workflow `.github/workflows/database-backup.yml` programmé tous les jours à 02:00 UTC (`cron: "0 2 * * *"`).
   - Export chiffré compressé `pg_dump` (format `.sql.gz`).
   - Secrets nécessaires dans les paramètres GitHub du dépôt (`Settings > Secrets and variables > Actions`) :
     - `DATABASE_URL` (obligatoire) : chaîne de connexion PostgreSQL en mode direct/pooler (ex: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`).
     - `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`, `BACKUP_S3_BUCKET` (optionnels) : cible de stockage cloud chiffré AES-256 (Amazon S3, Backblaze B2, Cloudflare R2).
   - Rétention des artefacts de secours de 30 jours au niveau de GitHub Actions.
2. **Point-in-Time Recovery (PITR) Supabase** :
   - Sur un plan Supabase Pro ou Enterprise, le PITR peut être activé en 1 clic dans le tableau de bord Supabase :
     `Dashboard Supabase > Project Settings > Database > Backups > Enable Point in Time Recovery`.
   - Permet de restaurer la base à n'importe quelle seconde passée sur les 7 derniers jours.

