# Sécurité

## Principes Directeurs
- Mots de passe gérés uniquement par Supabase Auth (jamais en clair, jamais hashés côté client en production).
- Création de comptes via Edge Function `create-user` (clé `service_role` confinée côté serveur uniquement).
- Bootstrap superadmin unique via `promote_first_superadmin()` / `bootstrap-superadmin`.
- RLS PostgreSQL strict sur **100% des tables** (politiques par rôle et propriété, aucune règle ouverte `USING (true)` sur des données sensibles).
- Auto-inscription publique directe désactivée.
- Horodatage certifié sur le fuseau officiel de Brazzaville (`Africa/Brazzaville`, UTC+1).

## État Réel des Protections & Hardening (Phase A & B)
- [x] **RLS Durci (Migration 0068)** : Toutes les politiques permissives `FOR ALL TO authenticated USING (true)` des 20 tables sensibles (`guardians`, `student_guardians`, `guardian_access_logs`, `surveys`, `survey_questions`, `survey_responses`, `competencies`, `module_competencies`, `student_competency_progress`, `alumni_follow_ups`, `job_offers`, `forum_threads`, `forum_posts`, `resources`, `badges`, `student_badges`, `i18n_translations`, `api_keys`, `webhook_endpoints`, `webhook_deliveries`) ont été supprimées et remplacées par un contrôle granulaire par rôle (`is_staff()`, propriétaire, tuteur certifié).
- [x] **Enquêtes Anonymes Protégées** : Interdiction du `SELECT` direct sur `survey_responses`. Soumission via `submit_survey_response` avec hachage cryptographique côté serveur (`respondent_hash`), et consultation agrégée par `get_survey_results` (seuil de k-anonymat de 5 réponses minimum).
- [x] **Isolation des Clés API & Webhooks** : `REVOKE SELECT (secret) ON webhook_endpoints FROM authenticated`. Accès exclusif superadmin/staff.
- [x] **Réponses d'examen protégées (Anti-Triche)** : Vue filtrée `questions_apprenant` et assainissement côté client pour les apprenants (`questions.correct_answer` retiré de la mémoire React). Notation effectuée par les fonctions serveur `grade_test_result` et `submit_assessment_result_safe`.
- [x] **Signature Numérique Serveur des Diplômes (Phase B.5)** : Signature par HMAC-SHA256 (`sign_certificate_server`) avec clé secrète serveur, et vérification officielle côté serveur (`verify_certificate_server`) détectant toute altération, expiration ou révocation académique.
- [x] **Corbeille Sécurisée (Soft-Delete)** : Suppression douce tracée par `soft_delete_item`, filtrage des éléments actifs par `deleted_at IS NULL`, suppression définitive irréversible réservée aux administrateurs.
- [x] **Audit des Notes (Migration 0069)** : Journal d'audit `grade_audit` alimenté automatiquement à chaque modification ou report de note (`upsert_grade_safe`, `grade_test_result`).
- [x] **Gestion des Demandes de Révision (F08)** : Table `regrade_requests` avec traçabilité et validation formateur.
- [x] **Protection Cron** : Edge function `schedule-cron` sécurisée avec clé secrète `CRON_SECRET` et restriction des en-têtes d'origine.

## Authentification Multifacteur (2FA TOTP)
- **Table dédiée** : `public.admin_totp_secrets` (migration `0045_admin_totp_secrets.sql`).
- **Cloisonnement RLS** : un administrateur ne peut lire ou modifier que son propre secret TOTP (`auth.uid() = user_id AND public.is_staff()`).
- **Standard RFC 6238** : implémentation native avec Web Crypto API (`crypto.subtle`).
- **Enrôlement** : génération de clé Base32 de 160 bits, QR Code standard `otpauth://totp/`, vérification obligatoire du premier code à 6 chiffres.

## Sauvegardes Automatisées
1. **GitHub Actions** : Workflow quotidien planifié `.github/workflows/database-backup.yml` (`cron: "0 2 * * *"`).
2. **Point-in-Time Recovery (PITR)** : Prise en charge sur le cluster Supabase.
