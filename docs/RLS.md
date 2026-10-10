# Row Level Security (RLS)

Toutes les tables métier ont RLS activé (`0001_init_schema.sql`).

## Fonctions utilitaires
- `public.current_role()` — rôle du profil courant
- `public.is_staff()` — admin ou superadmin
- `public.is_superadmin()`

## Règles clés
| Domaine | Apprenant | Formateur | Admin/Superadmin |
|---|---|---|---|
| profiles | son profil | son profil | tous |
| students | sa fiche | apprenants de ses modules | gestion complète |
| courses | cours de ses modules publiés | ses cours | tous |
| grades | ses notes | ses modules | tous |
| payments/invoices | les siens | — | gestion |
| messages | ses conversations | ses conversations | staff |
| notifications | les siennes | les siennes | staff |
| audit_logs | — | — | staff (lecture) |

## Tests recommandés
- Student A ne peut pas lire Student B (SELECT refusé)
- Seul un superadmin peut créer un admin (via `create-user`)
- Anonyme ne lit aucune donnée privée
