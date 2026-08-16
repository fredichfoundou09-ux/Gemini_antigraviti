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
- [ ] RLS activé et testé
- [ ] `service_role` absente du frontend
- [ ] `.env` hors Git
- [ ] Auto-inscription publique OFF
- [ ] 2FA (TOTP) pour superadmin/admin
- [ ] Sauvegardes SQL régulières
- [ ] Journal d'audit consultable (hook `useAudit`)
