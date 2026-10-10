# Offline-first

Le mode offline-first est prévu principalement pour le scanner QR.

## Stratégie
1. Action hors ligne.
2. File locale (localStorage actuellement, IndexedDB recommandé ensuite).
3. Reconnexion.
4. Synchronisation.
5. Confirmation serveur.

## À faire ensuite
- Remplacer localStorage par IndexedDB.
- Ajouter idempotency key serveur.
- Résoudre les conflits.
- Tester doublons et délais.
