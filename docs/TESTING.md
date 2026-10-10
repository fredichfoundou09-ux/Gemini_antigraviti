# Tests

## Auth
- Login bon/mauvais mot de passe.
- Session expirée.
- Changement de mot de passe temporaire.

## RBAC/RLS
- Superadmin → tout.
- Admin → gestion autorisée.
- Partner admin → lecture institutionnelle.
- Partner → lecture autorisée seulement.
- Teacher → ses modules/apprenants.
- Student → ses données personnelles.
- Anonymous → public uniquement.

## Partenaire
- SELECT OK sur vues autorisées.
- INSERT/UPDATE/DELETE refusés.
- Paramètres sensibles refusés.

## Métier
- Pré-inscription → confirmation.
- Création apprenant.
- Affectation module.
- Présence QR.
- Devoir / note.
- Paiement / reçu.
- Certificat / bourse.
