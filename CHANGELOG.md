# Changelog — SENTINELLES NUMÉRIQUES

## [Unreleased] — Août 2026

### Ajouté
- Système de toast (Sonner) — remplace tous les `alert()` natifs
- Validation Zod sur les formulaires critiques (apprenants, paiements, inscription)
- Calendrier visuel de l'emploi du temps (vue mensuelle/hebdomadaire)
- Suivi de progression détaillé par module (chapitres, devoirs, tests)
- Génération de bulletins de notes PDF
- Import CSV/Excel d'apprenants en masse
- Vérification publique de certificat par QR
- Hook générique `useSupabaseQuery` (loading/error/refresh unifié)
- Hook `usePermissions` pour RBAC unifié côté frontend
- CI GitHub Actions (build + typecheck sur chaque PR)
- `CHANGELOG.md`, `LICENSE`, `robots.txt`
- ESLint + Prettier configuration

### Corrigé
- Bug CI : `bootstrap-superadmin` référencé mais inexistant → retiré
- Types TypeScript centralisés (source unique `lib/types.ts`)
- `migrateDB` complet pour tous les nouveaux champs
- Sync Supabase : mapping `formation` pour `schedule` et `students`
- `cert.modules` optionnel (`?? []`)
- Dashboard : calcul revenus sans `p.statut` obsolète
- `makeAccount` sécurisée (commentaire explicite : Supabase uniquement)
- `resolveFormationId` utilisé dans `People.tsx` pour `formation_id` UUID

### Retiré
- `src/lib/api/*` (couche HTTP Express legacy)
- Données de démonstration et bouton "Charger la démo"
- `backend/` (archivé, Express/Prisma legacy)

---

## Format

Ce fichier suit [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).
Versionnage : [SemVer](https://semver.org/).
