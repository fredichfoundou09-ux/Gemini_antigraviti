# Base de données Supabase (PostgreSQL)

## Migrations
- `supabase/migrations/0001_init_schema.sql` : schéma complet + RLS + storage buckets
- `supabase/migrations/0002_has_any_superadmin.sql` : RPC bootstrap
- `supabase/migrations/0003_seed_formations.sql` : formations fixes

## Domaines
- profiles / audit_logs
- formations / modules / chapters
- students / student_modules / registrations
- teachers / teacher_modules / teacher_hours / teacher_payments
- courses / course_files / schedule / attendance / submissions
- tests / questions / results / grades
- invoices / payments
- conversations / messages / notifications
- certificates / scholarships
- enia_* / site_settings

## Commandes
```bash
supabase db push
supabase db reset
```
