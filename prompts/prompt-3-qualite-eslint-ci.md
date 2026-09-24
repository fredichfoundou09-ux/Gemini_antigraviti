# Prompt 3/6 — Qualité de code (ESLint + CI bloquante)

```
Contexte : projet React 19 + TypeScript + Vite 7, application "Sentinelles
Numériques". Aucun ESLint n'est configuré actuellement — seul
`tsc --noEmit` tourne en CI (.github/workflows/ci.yml). C'est cette
absence de lint qui a laissé passer plusieurs bugs par le passé
(identifiants non importés notamment). Vérifie après CHAQUE étape que
`npm run typecheck` et `npm run build` restent au vert.

1. Installe ESLint pour ce projet :
   npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks eslint-plugin-react-refresh

2. Crée une configuration ESLint (format plat eslint.config.js, compatible
   avec ESLint 9+, cohérent avec Vite 7/React 19) avec au minimum :
   - "no-undef": "error" (ou l'équivalent TypeScript qui détecte les
     identifiants non importés — c'est la règle qui aurait empêché le bug
     historique "useEffect is not defined")
   - "@typescript-eslint/no-unused-vars": "warn"
   - "react-hooks/rules-of-hooks": "error"
   - "react-hooks/exhaustive-deps": "warn"

3. Ajoute le script `"lint": "eslint ."` dans package.json.

4. Lance `npm run lint` une première fois sur tout le projet. Pour les
   erreurs remontées :
   - Corrige immédiatement toute variable/import réellement non utilisé
     ou non défini.
   - Pour tout ce qui nécessiterait une refonte plus large et risquée,
     liste-les dans le résumé final au lieu de les corriger à l'aveugle.

5. Ajoute une étape "Lint" dans .github/workflows/ci.yml, juste après
   l'étape "Typecheck" existante, qui exécute `npm run lint` et fait
   échouer le build en cas d'erreur (pas seulement warning).

6. Vérifie que la protection de branche GitHub sur `main` (paramètres du
   dépôt, pas du code) exige bien que la CI soit verte avant tout merge —
   si tu n'as pas accès à cette configuration, indique-le clairement dans
   le résumé final comme action manuelle restante pour l'utilisateur.

Livraison attendue : liste des fichiers ajoutés/modifiés, nombre
d'erreurs/warnings ESLint restants après correction, et confirmation que
typecheck + build restent au vert.
```
