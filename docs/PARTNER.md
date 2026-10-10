# Rôle Partenaire

Le rôle `partner` est strictement en lecture seule. Le rôle `partner_admin` donne une consultation institutionnelle plus large, sans droits d'écriture métier.

## Pages
- `/app/partner/dashboard`
- `/app/partner/apprenants`
- `/app/partner/enseignants`
- `/app/partner/formations`
- `/app/partner/modules`
- `/app/partner/emploi-du-temps`
- `/app/partner/presences`
- `/app/partner/cours`
- `/app/partner/supports`
- `/app/partner/tests`
- `/app/partner/notes`
- `/app/partner/certificats`
- `/app/partner/bourses`
- `/app/partner/rapports`
- `/app/partner/enya`
- `/app/partner/profil`

## Sécurité
La lecture seule est appliquée à 3 niveaux :
1. UI : aucun bouton d'écriture.
2. Edge Function : `create-user` exige une organisation partenaire.
3. PostgreSQL : RLS dédiée dans `0005_partner_role.sql`.

## Organisation obligatoire
Un compte `partner` / `partner_admin` doit être lié à `partner_organizations` via `partner_members`.

## Périmètres
- `viewer` : formations/modules.
- `academic` : données pédagogiques autorisées.
- `finance` : données financières agrégées autorisées.
- `institutional` : rapports institutionnels plus larges.
