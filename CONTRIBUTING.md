# Contribuer à SENTINELLES NUMÉRIQUES

## Workflow Git
- `main` : production
- `develop` : intégration
- `feature/*` : une fonctionnalité par branche

```
feature/* → develop → tests → pull request → main
```

## Convention de commits
```
feat(students): connect students module to Supabase
fix(attendance): correct RLS permissions
security(rls): restrict student data access
refactor(store): remove local fallback
docs(readme): add local dev guide
```

## Règle d'or
Pour toute nouvelle fonctionnalité, respecter l'ordre :
1. Interface → 2. Hook → 3. Service `lib/supabase` → 4. Table + RLS → 5. Test par rôle → 6. Audit.

Ne jamais : UI → localStorage → terminé.
Toujours : UI → Hook → Service → Supabase Auth → RLS → PostgreSQL/Storage.

## Avant une PR
- [ ] `npm run build` passe
- [ ] Aucune clé secrète committée
- [ ] RLS respectée (test par rôle)
- [ ] Documentation à jour si nécessaire
