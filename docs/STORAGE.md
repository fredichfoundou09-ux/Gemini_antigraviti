# Supabase Storage

## Buckets (créés par migration 0001)
| Bucket | Public | Usage |
|---|---|---|
| avatars | oui | photos de profil |
| course-files | non | supports de cours |
| submission-files | non | devoirs remis |
| certificates | non | certificats générés |
| enia-media | oui | affiches ENIA publiques |
| public-media | oui | médias marketing |

## Règles
- Fichiers privés : accès via URL signée temporaire (`createSignedUrl`)
- Upload avatar limité au dossier `{userId}/`
- Écriture course-files réservée staff/formateur
- Aucun gros fichier en base64 dans PostgreSQL (uniquement `storage_key`)

## Service front
`src/lib/supabase/storage.ts` : `uploadFile`, `getPublicUrl`, `createSignedUrl`, `removeFile`.
