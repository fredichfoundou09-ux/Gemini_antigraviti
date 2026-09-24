# Prompt 2/6 — Rangement du dépôt (fins de ligne & thèmes dupliqués)

```
Contexte : projet React 19 + TypeScript + Vite 7 + Tailwind 4 + Supabase,
application "Sentinelles Numériques". Le code fonctionne déjà (0 erreur
typecheck, build OK, tests verts) — il s'agit ici de rangement et de
robustesse, pas de bugs bloquants. Vérifie après CHAQUE étape que
`npm run typecheck`, `npm run build` et `npm test` restent au vert.

1. Fins de ligne incohérentes (CRLF vs LF) :
   - Crée un fichier .gitattributes à la racine du dépôt avec le contenu :
     `* text=auto eol=lf`
   - Renormalise le dépôt : `git add --renormalize .`
   - Vérifie avec `git diff --stat` que les fichiers non réellement
     modifiés n'apparaissent plus comme changés.

2. Composants de thème dupliqués :
   - src/components/ThemeToggle.tsx ne contient plus qu'un ré-export :
     `export { UiThemeToggle, ThemeToggle } from "./UiThemeToggle";`
   - Choisis UN seul nom de fichier/composant (garde de préférence
     `ThemeToggle.tsx` puisque c'est celui importé dans
     src/layouts/DashboardLayout.tsx) : déplace tout le contenu réel de
     UiThemeToggle.tsx dans ThemeToggle.tsx, supprime UiThemeToggle.tsx,
     et corrige tous les imports dans le projet en conséquence
     (`grep -rn "UiThemeToggle" src` pour les retrouver tous).

3. Duplication des sélecteurs CSS de thème (src/index.css) :
   Chaque règle de thème est dupliquée entre `[data-theme="..."]` et
   `[data-ui-theme="..."]` pour compatibilité historique. Conserve
   uniquement `data-theme` (le plus court), supprime les sélecteurs
   `data-ui-theme` redondants, et adapte src/lib/uiTheme.ts (fonction qui
   applique l'attribut sur <html>) pour n'écrire plus que `data-theme`.
   Vérifie ensuite manuellement (ou via les tests existants
   src/__tests__/ui_theme_and_contact.test.ts) que le changement de thème
   fonctionne toujours visuellement.

4. Image non optimisée : convertis public/sentinel-symbol.png (702 Ko) en
   WebP, mets à jour toutes ses références dans le code (favicon,
   manifest PWA, logo), et vérifie qu'aucune image ne casse visuellement.

Contraintes :
- Ne change AUCUN comportement visuel du thème "classic" (thème par
  défaut) : toute modification doit rester strictement additive pour ce
  thème-là.
- Committe chaque étape séparément avec un message clair en français.

Livraison attendue : résumé des fichiers modifiés/supprimés/renommés pour
chaque étape, et résultat de `npm run typecheck` / `build` / `test`.
```
