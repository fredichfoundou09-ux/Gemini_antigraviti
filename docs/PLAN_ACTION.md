# PLAN D'ACTION — SENTINELLES NUMÉRIQUES
### Checklist complète, du début à la fin (analyse confirmée sur le zip réel `Full_Sent_numerique.zip`)

> Ce document est la feuille de route de travail. Chaque case à cocher `[ ]` sera cochée `[x]` au fur et à mesure de l'avancement dans les prochaines sessions. Les bugs listés ci-dessous ont été **confirmés directement dans le code source réel** (pas seulement déduits) le 15 août 2026.

---

## PHASE 0 — Clarifications préalables (bloquant, à faire en premier)

Rien de technique ne doit être exécuté tant que ces points ne sont pas tranchés avec l'utilisateur.

- [ ] **Choix du projet Supabase définitif** : « Sentinelle » (créé le 11 août 2026) ou « CZX » (ref `tvcuwhgqhrcvdgwlviju`, région eu-west-1, créé le 15 août 2026) ?
  - Vérifier si l'un des deux contient déjà des données réelles (apprenants, paiements...) à ne pas perdre.
  - Vérifier si l'un des deux a déjà les migrations appliquées (`supabase migration list` côté CLI ou via Studio → Database → Migrations).
  - Décision → noter ici le nom + `project_ref` retenu : `______________________`
- [ ] **Confirmer le nom du projet Vercel** à créer/lier (ex: `sentinelles-numeriques`) et l'organisation/équipe Vercel cible.
- [ ] **Confirmer le repo GitHub** exact et la branche de déploiement (`main` d'après le workflow existant).
- [ ] Décider du sort de **`backend/`** (Express/Prisma legacy, non utilisé en prod) : supprimer, archiver dans une branche séparée, ou laisser tel quel avec un avertissement README renforcé ?
- [ ] Décider si l'on garde le **mode local (`localStorage`)** comme filet de secours indéfiniment, ou si l'objectif final est de basculer 100% Supabase et retirer `src/lib/store.tsx` (double source de vérité) à terme.

---

## PHASE 1 — Corrections de bugs confirmés

### 🔴 Bug 1 — Edge Function fantôme dans la CI (confirmé)
Fichier : `.github/workflows/supabase-deploy.yml`, job `Deploy Edge Functions` :
```yaml
run: |
  supabase functions deploy bootstrap-superadmin   # ❌ n'existe pas dans supabase/functions/
  supabase functions deploy create-user            # ✅ existe
```
- [ ] Supprimer la ligne `supabase functions deploy bootstrap-superadmin`.
- [ ] Vérifier qu'aucun autre fichier ne référence cette fonction fantôme (`grep -rn "bootstrap-superadmin"` sur tout le repo — trouvé aussi dans `LOCAL_DEV.md`, voir Phase 5 Documentation).
- [ ] Confirmer que le bootstrap du 1er superadmin passe bien uniquement par le RPC SQL `promote_first_superadmin()` (`supabase/migrations/0001_init_schema.sql`), appelé depuis `bootstrapFirstSuperadmin()` (`src/lib/supabase/auth.ts`) — aucune Edge Function requise pour cette étape.

### 🟡 Bug 2 — RPC `has_any_superadmin()` définie deux fois
- `0001_init_schema.sql` (ligne ~716) la définit **sans** `grant execute to anon, authenticated`.
- `0002_has_any_superadmin.sql` la redéfinit **avec** le grant manquant.
- [ ] Statut : **non bloquant** (le `create or replace` de 0002 corrige silencieusement l'oubli de grant de 0001) mais **à nettoyer** : soit ajouter le grant directement dans 0001 et supprimer 0002, soit documenter clairement que 0002 est un correctif de grant et pas un doublon inutile (renommer le commentaire en tête de fichier).
- [ ] Vérifier qu'aucune autre fonction RPC n'a le même problème de grant manquant pour `anon`/`authenticated` (audit rapide de toutes les `create or replace function` dans les 5 migrations).

### 🟡 Bug 3 — Contrainte de rôle `profiles.role` incomplète dans la migration initiale
- `0001_init_schema.sql` : `check (role in ('superadmin','admin','teacher','student'))` — ne contient pas `partner`/`partner_admin`.
- Corrigé dynamiquement par `0005_partner_role.sql` (drop + recreate de la contrainte).
- [ ] **Risque identifié** : si les migrations sont appliquées dans le désordre, ou si `0005` échoue silencieusement, la création d'un compte partenaire échouera avec une erreur de contrainte peu explicite.
- [ ] Vérifier après `supabase db push` que la contrainte finale sur `profiles.role` inclut bien les 6 rôles (`\d profiles` dans le SQL editor Supabase, ou requête sur `pg_constraint`).
- [ ] (Optionnel, propre) Corriger directement `0001` pour inclure les 6 rôles dès le départ, si le projet Supabase choisi n'a pas encore reçu de données (migration pas encore appliquée en prod).

### 🟡 Bug 4 — Deux systèmes de permissions qui se chevauchent
4 mécanismes distincts et non synchronisés :
1. `Gate({ roles })` par route dans `src/App.tsx` (roles en dur)
2. `src/types/rbac.ts` (`PERMISSIONS` — liste de ~40 permissions, non branchée nulle part de façon systématique)
3. `src/lib/supabase/permissions.ts` (`hasPermission()` — matrice codée en dur, redondante avec 1)
4. Table Postgres RBAC data-driven (`roles`/`permissions`/`role_permissions`/`user_permissions`, migration `0005`) — existe en base mais n'est **pas consommée par le frontend**
- [ ] Décider d'une source de vérité unique pour le RBAC (recommandation : garder RLS Postgres comme rempart de sécurité réel + simplifier le front à `Gate` par route seulement, retirer `hasPermission()`/`rbac.ts` si non utilisés, ou au contraire les brancher réellement sur la table `role_permissions`).
- [ ] Auditer chaque usage de `hasPermission()` dans le code pour voir s'il est réellement appelé quelque part (`grep -rn "hasPermission("` src/).

### 🟡 Bug 5 — Double source de vérité (store local vs Supabase)
- `src/lib/store.tsx` : logique complète localStorage/sessionStorage (hash PBKDF2 client, anti brute-force, session TTL 2h) qui tourne en parallèle du mode Supabase.
- Activation conditionnelle par `VITE_USE_SUPABASE === "true" && isSupabaseConfigured`.
- [ ] Vérifier qu'aucun écran ne mélange les deux sources en même temps (audit des composants qui utilisent `useStore()` alors qu'ils devraient utiliser les hooks Supabase dédiés, ex. `useStudents`, `useFormations`, etc.).
- [ ] Décider clairement : le mode local est-il seulement pour le développement offline, ou doit-il rester un vrai fallback de prod si Supabase est indisponible ? Documenter la décision dans `ARCHITECTURE.md`.

### 🟡 Bug 6 — Code legacy Express/Prisma non utilisé (`backend/`)
- `backend/prisma/schema.prisma` (schéma dupliqué avec des conventions différentes du schéma Postgres réel), `backend/src/server.ts`, `backend/src/auth/session.ts` (JWT avec secret par défaut en dur `"sentinelles_secret_key_2026_super_secure"` — **mauvaise pratique même en legacy**).
- [ ] Trancher (voir Phase 0) : suppression recommandée si vraiment non utilisé, pour éviter toute confusion future et tout risque (le secret JWT en dur ne doit jamais être copié dans un contexte actif).

### ⚪ Bug 7 (mineur) — `.env.example` : nom de variable clé anonyme
- `.env.example` utilise `VITE_SUPABASE_PUBLISHABLE_KEY` en variable principale, avec fallback `VITE_SUPABASE_ANON_KEY` géré côté code (`src/lib/supabase/client.ts`) — cohérent, mais à bien communiquer côté Vercel (utiliser le même nom que dans `.env.example` pour éviter toute confusion au moment de configurer les variables d'environnement Vercel).
- [ ] Confirmer quel nom de clé est réellement fourni par le dashboard Supabase du projet retenu (l'appellation a changé chez Supabase entre "anon key" et "publishable key" selon les générations de projets) et aligner.

### ⚪ Bug 8 (mineur) — Secret JWT en dur (legacy uniquement)
- `backend/src/auth/session.ts` : `const JWT_SECRET = process.env.JWT_SECRET || "sentinelles_secret_key_2026_super_secure";`
- [ ] Si `backend/` est conservé pour une raison quelconque, ce secret par défaut doit être supprimé (forcer la présence de `process.env.JWT_SECRET`, sinon `throw`). Si `backend/` est supprimé (recommandé), ce point disparaît de lui-même.

---

## PHASE 2 — Vérification et mise à jour des packages

- [ ] `lucide-react` : version actuelle `^1.30.0` → **confirmée légitime** (la librairie est passée en v1.x, dernière version publique `1.31.0` au moment de l'analyse). Recommandation : mettre à jour vers `^1.31.0` par confort, non urgent.
- [ ] `@supabase/supabase-js` : actuellement `^2.109.0` — vérifier qu'il n'y a pas de breaking change à anticiper avant de fixer la version finale de déploiement.
- [ ] `react` / `react-dom` : `19.2.6` — vérifier compatibilité avec toutes les libs utilisées (`qrcode.react@4.2.0`, `react-router-dom@7.18.2`, autres si ajoutées plus tard).
- [ ] `vite@7.3.2` + `vite-plugin-singlefile@2.3.0` : vérifier que le plugin singlefile reste compatible avec Vite 7 (peer dependency `^5.4.11 || ^6.0.0 || ^7.0.0` — OK a priori).
- [ ] `tailwindcss@4.1.17` + `@tailwindcss/vite@4.1.17` : versions cohérentes entre elles, à garder synchronisées lors de toute mise à jour.
- [ ] Après toute mise à jour de dépendances : lancer `npm install` puis `npm run build` en local pour vérifier l'absence de régression (le projet utilise `tsconfig.json` en mode `strict` avec `noUnusedLocals`/`noUnusedParameters` — sensible aux erreurs de build).
- [ ] Vérifier l'absence de vulnérabilités connues (`npm audit`) une fois `npm install` exécutable (pas de réseau disponible dans cet environnement d'analyse — à faire en local ou via CI).

---

## PHASE 3 — Récupération des données/URLs via les connecteurs (Vercel, Supabase, GitHub)

- [ ] Utiliser le connecteur **Supabase** pour lister les projets disponibles et confirmer lequel des deux (Sentinelle / CZX) correspond à la décision de la Phase 0.
- [ ] Récupérer via le connecteur Supabase, pour le projet retenu :
  - [ ] l'URL du projet (`https://<ref>.supabase.co`)
  - [ ] la clé publique (anon/publishable key)
  - [ ] la liste des migrations déjà appliquées (pour ne pas rejouer un `db push` qui casserait quelque chose)
  - [ ] la présence ou non de l'Edge Function `create-user` déjà déployée
- [ ] Utiliser le connecteur **Vercel** pour :
  - [ ] vérifier si un projet Vercel est déjà lié au repo GitHub (le premier essai avait été annulé par l'utilisateur)
  - [ ] lister les projets Vercel existants pour éviter les doublons
  - [ ] préparer la configuration des variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_ANON_KEY`, `VITE_USE_SUPABASE=true`)
- [ ] Concernant **GitHub** : l'accès direct en lecture au repo via `web_fetch` a échoué précédemment (accès automatisé bloqué). Le déploiement Vercel via l'URL du dépôt git reste possible (Vercel peut cloner directement sans passer par un fetch web classique). À utiliser en priorité plutôt que de relire le contenu du repo depuis GitHub.
- [ ] Une fois les deux connecteurs alignés : créer/lier le projet Vercel → repo GitHub → renseigner les variables d'environnement → **ne pas encore déclencher de build de prod tant que la Phase 4 (migration DB) n'est pas terminée**, pour éviter un premier déploiement pointant vers une base vide/non initialisée.

---

## PHASE 4 — Migration de la base de données vers Supabase

- [ ] Confirmer l'accès CLI/API au projet Supabase retenu (`supabase link --project-ref <ref>`), ou passer entièrement par le connecteur si le CLI n'est pas disponible dans l'environnement d'exécution.
- [ ] Appliquer les migrations **dans l'ordre strict** :
  1. `0001_init_schema.sql` (schéma complet, RLS, storage buckets)
  2. `0002_has_any_superadmin.sql` (correctif de grant)
  3. `0003_seed_formations.sql` (formations fixes informatique/industriel)
  4. `0004_must_change_password.sql` (colonne + RPC changement mot de passe forcé)
  5. `0005_partner_role.sql` (RBAC data-driven, rôles partenaires, vues `partner_*_view`)
- [ ] Vérifier après application : `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.profiles'::regclass;` → doit inclure les 6 rôles.
- [ ] Vérifier la création des 6 buckets Storage (`avatars`, `course-files`, `submission-files`, `certificates`, `enia-media`, `public-media`) et leurs policies.
- [ ] Déployer l'Edge Function `create-user` (`supabase functions deploy create-user`) — **sans** la ligne fantôme `bootstrap-superadmin` (voir Bug 1).
- [ ] Configurer les secrets nécessaires à l'Edge Function côté Supabase (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` — normalement déjà injectés automatiquement par l'environnement Edge Functions Supabase, à vérifier).
- [ ] Dans le dashboard Supabase (Auth → Settings) : désactiver **manuellement** `Allow new users to sign up` (le `enable_signup = false` de `supabase/config.toml` ne s'applique qu'en local, pas en prod cloud).
- [ ] Configurer les URLs Auth (Auth → URL Configuration) :
  - Site URL = URL de production Vercel finale
  - Redirect URLs = local (`http://localhost:5173`) + preview Vercel + prod Vercel
- [ ] Si le projet Supabase choisi contient déjà des données (à vérifier Phase 0), **prévoir une stratégie de migration/fusion** plutôt qu'un simple `db push` qui pourrait échouer sur des tables déjà existantes avec des données incompatibles.
- [ ] Une fois la base prête : exécuter le scénario de test documenté dans `LOCAL_DEV.md` (adapté à la prod) :
  1. Bootstrap du premier Admin Sup via l'écran "Première configuration"
  2. Vérifier `profiles.role = superadmin` dans Supabase Studio
  3. Créer un formateur puis un apprenant via `create-user`
  4. Se connecter avec le compte apprenant → vérifier qu'il ne voit que ses propres données (test RLS)
- [ ] Envisager d'implémenter des **sauvegardes automatiques** de la base (checklist SECURITY.md — actuellement non cochée).

---

## PHASE 5 — Documentation à mettre à jour en parallèle des corrections

- [ ] `LOCAL_DEV.md` : retirer la mention `supabase functions serve # sert bootstrap-superadmin + create-user` → remplacer par `# sert create-user`.
- [ ] `ARCHITECTURE.md` : documenter explicitement le statut du mode local (fallback temporaire vs permanent, décision Phase 0).
- [ ] `SECURITY.md` : mettre à jour la checklist mise en production au fur et à mesure des cases cochées (auto-inscription OFF, `.env` hors Git, 2FA, sauvegardes).
- [ ] `README.md` : si `backend/` est supprimé, retirer la ligne qui le mentionne dans la structure du projet.
- [ ] Ajouter un `CHANGELOG.md` (optionnel mais recommandé) pour tracer les corrections appliquées lors de cette phase.

---

## PHASE 6 — Déploiement final

- [ ] Vérifier que toutes les Phases 1 à 4 sont cochées avant de déclencher le premier build Vercel réel.
- [ ] Lier le repo GitHub au projet Vercel (ou confirmer la liaison existante).
- [ ] Renseigner les 3 variables d'environnement Vercel (Production **et** Preview, pour pouvoir tester les Pull Requests) :
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY` selon Phase 1 / Bug 7)
  - `VITE_USE_SUPABASE=true`
- [ ] Déclencher le déploiement (push sur `main` ou déploiement manuel depuis Vercel).
- [ ] Vérifier que `vercel.json` (rewrite SPA) fonctionne correctement sur les routes `#/app/...` (HashRouter — normalement aucun souci car le hash n'est jamais envoyé au serveur, mais à confirmer visuellement après déploiement).
- [ ] Tester en production : accès page publique, pré-inscription, connexion, bootstrap admin (si pas déjà fait), création apprenant/formateur, accès QR scanner (nécessite HTTPS pour la caméra — Vercel fournit HTTPS par défaut, donc OK).
- [ ] Vérifier le comportement du service worker (`public/sw.js`) en prod (cache offline, pas de conflit avec les mises à jour de déploiement).
- [ ] Confirmer que la CI GitHub Actions (`supabase-deploy.yml`, une fois le Bug 1 corrigé) se déclenche bien sur les futurs push touchant `supabase/**` et déploie correctement.

---

## Résumé exécutif — ordre d'exécution recommandé

```
Phase 0  -> Clarifications (choix projet Supabase, sort de backend/, strategie mode local)
Phase 1  -> Corriger les bugs confirmes (CI, grants RPC, contrainte role, RBAC duplique, secret JWT)
Phase 2  -> Verifier/mettre a jour les packages (lucide-react, supabase-js, etc.)
Phase 3  -> Recuperer les infos exactes via connecteurs Vercel + Supabase
Phase 4  -> Appliquer les migrations et configurer Supabase en profondeur (Auth, Storage, Edge Function)
Phase 5  -> Mettre a jour la documentation en parallele
Phase 6  -> Deploiement final sur Vercel + tests de bout en bout
```

---

*Document vivant — à cocher progressivement au fil des sessions de travail. Prochaine étape immédiate : trancher les points de la Phase 0 avec l'utilisateur.*
