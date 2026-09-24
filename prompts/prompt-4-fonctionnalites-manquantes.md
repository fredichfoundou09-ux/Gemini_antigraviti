# Prompt 4/6 — Fonctionnalités manquantes (messagerie, documents, partenaire)

```
Contexte : projet React 19 + TypeScript + Vite 7 + Supabase, application
"Sentinelles Numériques". Vérifie après CHAQUE étape que
`npm run typecheck`, `npm run build` et `npm test` restent au vert.

1. Filtres manquants dans la messagerie (src/pages/shared/Communication.tsx) :
   Le composant MessageCenter a déjà un filtre `recipientRoleFilter` +
   `recipientSearch`, mais UNIQUEMENT pour choisir un destinataire en mode
   "new" (nouveau message). La boîte de réception (mode "inbox") n'a
   aucun filtre. Ajoute, au-dessus de la liste de conversations en mode
   "inbox" :
   - Un champ de recherche texte qui filtre les conversations par nom
     d'interlocuteur ou contenu du dernier message (insensible à la
     casse, filtrage 100% côté client sur les données déjà chargées,
     aucune requête serveur supplémentaire).
   - Un filtre "Toutes / Non lues".

2. Actions "Lire"/"Télécharger" manquantes sur le champ "Supports" d'un
   module (src/pages/student/StudentPages.tsx, fonctions MyModules et
   MyFormation) :
   Le champ `Module.supports` (chaîne de texte libre, voir
   src/lib/types.ts) est affiché en texte brut :
     {preview.supports && <p><b>Supports :</b> {preview.supports}</p>}
   - Détecte si la valeur est une URL valide (commence par http:// ou
     https://). Si oui, affiche un bouton "Lire" qui l'ouvre dans un
     nouvel onglet (target="_blank" rel="noreferrer"), avec le même style
     visuel que les boutons "Voir"/"Télécharger" déjà utilisés dans les
     fonctions MyCourses et MyDocuments du même fichier (réutilise ce
     pattern existant, ne recrée pas un style différent).
   - Si ce n'est pas une URL, garde l'affichage en texte brut actuel.
   - Applique la même vérification de cohérence aux fichiers de cours
     (`course.files`) déjà listés côté apprenant.

3. Boutons de contact manquants côté Partenaire :
   Le composant `src/components/ContactButtons.tsx` (WhatsApp/appel/
   messagerie) est déjà utilisé dans les espaces Formateur et Apprenant,
   mais pas encore dans `src/pages/partner/PartnerPages.tsx`. Intègre-le
   dans les listes d'apprenants/formateurs affichées côté partenaire,
   pour la cohérence des 4 rôles (admin, formateur, apprenant, partenaire).

Contraintes :
- N'ajoute aucune dépendance externe.
- Garde le style visuel cohérent avec les composants Card/Badge/Btn déjà
  utilisés (mêmes classes Tailwind, mêmes couleurs par contexte : cyan
  pour "Mes cours", vert/émeraude pour "Mes documents").
- Ne modifie aucune policy RLS ni schéma Supabase.
- Ne touche à aucun filtre ou action déjà fonctionnel ailleurs (recherche
  et filtres de src/pages/admin/People.tsx, déjà vérifiés opérationnels,
  ne doivent pas être modifiés par cette tâche).

Livraison attendue : liste des fichiers modifiés, résultat de
`npm run typecheck` / `build` / `test`, et confirmation manuelle que les
filtres messagerie et les actions Lire/Télécharger fonctionnent en
conditions réelles.
```
