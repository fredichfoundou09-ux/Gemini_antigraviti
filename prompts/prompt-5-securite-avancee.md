# Prompt 5/6 — Sécurité avancée (2FA admin + sauvegardes automatisées)

```
Contexte : projet React 19 + TypeScript + Vite 7 + Supabase, application
"Sentinelles Numériques". SECURITY.md liste déjà l'essentiel des mesures
en place (RLS complète, clés secrètes hors bundle, etc.). Deux points
restent ouverts. Vérifie après CHAQUE étape que `npm run typecheck`,
`npm run build` et `npm test` restent au vert. C'est le chantier le plus
sensible : avance prudemment, étape par étape, sans jamais désactiver ou
affaiblir une policy RLS existante.

1. 2FA (TOTP) pour les comptes admin/superadmin :
   - Crée une table `admin_totp_secrets` (migration SQL dans
     supabase/migrations/) : id, user_id (référence profiles), secret
     (chiffré si possible, sinon clairement documenté comme sensible),
     enabled boolean, created_at. Protège-la avec une policy RLS stricte :
     un utilisateur ne peut lire/écrire que sa propre ligne, ET seuls les
     comptes admin/superadmin peuvent en créer une (vérifier via la
     fonction `is_staff()` déjà existante dans le schéma).
   - Ajoute un flux d'activation du 2FA dans le profil admin (génération
     d'un secret TOTP, affichage d'un QR code avec une librairie légère
     type `otpauth` ou équivalent déjà compatible avec l'environnement
     Vite du projet, saisie du code de vérification à 6 chiffres pour
     confirmer l'activation).
   - Ajoute la vérification du code TOTP à la connexion, uniquement pour
     les comptes ayant activé le 2FA (ne change rien pour les autres).
   - Documente ce nouveau mécanisme dans SECURITY.md et coche la case
     correspondante.

2. Sauvegardes automatisées :
   - Si le projet a accès à un plan Supabase avec Point-in-Time Recovery,
     documente dans SECURITY.md comment l'activer (c'est une option du
     tableau de bord Supabase, pas du code).
   - Sinon, ajoute un workflow GitHub Actions planifié (cron quotidien)
     qui exécute un export `pg_dump` de la base vers un stockage externe
     chiffré (ex. un bucket S3/Backblaze via un secret GitHub dédié,
     jamais commité en clair). Documente les secrets nécessaires
     (`DATABASE_URL`, identifiants du stockage) sans jamais les écrire
     dans le code ou les logs.
   - Coche la case correspondante dans SECURITY.md une fois en place.

Contraintes :
- Aucun secret ne doit jamais être commité en clair dans le dépôt.
- Ne modifie aucune policy RLS existante en dehors de l'ajout de la
  nouvelle table `admin_totp_secrets`.
- Si une étape nécessite un accès que tu n'as pas (ex. configuration du
  tableau de bord Supabase, création d'un bucket de stockage externe),
  documente précisément l'action manuelle restante pour l'utilisateur
  plutôt que de l'improviser.

Livraison attendue : liste des fichiers ajoutés/modifiés, la migration
SQL complète, et une liste claire des actions manuelles restantes côté
tableau de bord Supabase/GitHub que l'utilisateur doit effectuer
lui-même.
```
