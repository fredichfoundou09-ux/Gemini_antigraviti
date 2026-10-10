# Authentification Supabase

## Comptes
- Mots de passe gérés uniquement par Supabase Auth (`auth.users`)
- Profil métier dans `public.profiles` (`id = auth.users.id`)

## Bootstrap superadmin
1. `has_any_superadmin()` (RPC)
2. Si `false` → formulaire première configuration
3. `signUp` + `promote_first_superadmin()`
4. Ensuite le bootstrap disparaît définitivement

## Login
- Le sélecteur Admin/Formateur/Apprenant ne donne aucun droit
- Le rôle réel vient de `profiles.role`
- Refus si groupe UI ≠ rôle réel

## Création d’utilisateurs
- Edge Function `create-user` (service role côté serveur)
- Crée Auth + profile + fiche student/teacher
