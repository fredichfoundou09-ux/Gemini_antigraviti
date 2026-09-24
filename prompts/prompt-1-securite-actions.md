# Prompt 1/6 — Sécurité des actions (confirmations & double-soumission)

```
Contexte : projet React 19 + TypeScript + Vite 7 + Supabase, application de
gestion scolaire "Sentinelles Numériques". Le projet compile et fonctionne
(0 erreur typecheck, build OK, 58/58 tests passent). Vérifie après CHAQUE
étape que `npm run typecheck`, `npm run build` et `npm test` restent tous
au vert avant de passer à la suivante. Ne casse aucun comportement existant.

1. Confirmations de suppression manquantes (src/pages/shared/Enia.tsx) :
   Plusieurs boutons de suppression (bourses "bourseAvantages", frais de
   scolarité "fraisScolaires", pièces à fournir "pieces", partenaires
   "partenaires") suppriment l'élément au premier clic, sans confirmation :
     onClick={() => setEnia({ ...enia, bourseAvantages: enia.bourseAvantages.filter((x) => x.id !== a.id) })}
   Ajoute une modale de confirmation avant chacune de ces suppressions,
   sur le même modèle que le pattern `deleteTarget` déjà utilisé dans
   src/pages/admin/People.tsx (état local `deleteTarget`, modale "Voulez-
   vous vraiment supprimer...", boutons Annuler/Supprimer). Réutilise ce
   pattern existant, n'en invente pas un nouveau.

2. Protection anti double-clic sur la création/édition d'apprenant
   (src/pages/admin/People.tsx) :
   Le bouton de création d'apprenant n'a aucune protection :
     <Btn onClick={save}>{editing ? "Enregistrer" : "Créer l'apprenant"}</Btn>
   alors que le formulaire formateur, juste plus bas dans le même fichier,
   a bien `disabled={savingTeacher}` sur son bouton équivalent.
   - Ajoute un état `const [savingStudent, setSavingStudent] = useState(false);`
   - Au tout début de la fonction `save` (celle du formulaire apprenant,
     vers la ligne 160), ajoute une garde `if (savingStudent) return;`
     suivie de `setSavingStudent(true);`, et remets-le à `false` dans un
     bloc `finally` à la fin de la fonction.
   - Ajoute `disabled={savingStudent}` sur le bouton
     "Créer l'apprenant"/"Enregistrer" ET sur le bouton "Annuler" associé,
     exactement comme c'est déjà fait pour `savingTeacher`.

3. Recherche apprenant trop limitée (src/pages/admin/People.tsx, ~ligne 103) :
   Le prédicat de recherche `matchQ` ne cherche que sur nom/prénom/id.
   Étends-le pour inclure aussi `telephone` et `email` de l'apprenant,
   avec la même logique insensible à la casse déjà utilisée pour les
   autres champs.

Contraintes :
- N'ajoute aucune dépendance externe.
- Ne modifie aucune policy RLS ni aucun schéma Supabase.
- Garde le style visuel cohérent (mêmes composants Card/Btn/Modal déjà
  utilisés dans ces fichiers).

Livraison attendue : liste des fichiers modifiés, résultat de
`npm run typecheck`, `npm run build`, `npm test`.
```
