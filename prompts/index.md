# Index — 6 prompts pour Gemini

À donner un par un, dans cet ordre (chaque prompt vérifie
typecheck/build/test avant de passer au suivant — respecter l'ordre évite
que deux chantiers se marchent dessus) :

| # | Fichier | Contenu | Risque |
|---|---|---|---|
| 1 | `prompt-1-securite-actions.md` | Confirmations de suppression (Enia), anti double-clic création apprenant, recherche étendue | Faible |
| 2 | `prompt-2-rangement-repo.md` | `.gitattributes`, fusion ThemeToggle/UiThemeToggle, CSS dupliqué, image non optimisée | Faible |
| 3 | `prompt-3-qualite-eslint-ci.md` | ESLint + étape CI bloquante | Faible |
| 4 | `prompt-4-fonctionnalites-manquantes.md` | Filtres messagerie, actions Lire/Télécharger modules, ContactButtons partenaire | Moyen |
| 5 | `prompt-5-securite-avancee.md` | 2FA admin, sauvegardes automatisées | Élevé — le plus sensible, à faire en dernier et avec attention |
| 6 | `prompt-6-agent-ia-deploiement.md` | Déploiement de l'assistant IA agent déjà codé + ajout de l'outil "publier une évaluation" | Moyen |

**Avant de commencer** : donnez à Gemini l'accès au dépôt complet
(`code_6_senti_agent-ia.zip`, déjà fourni), pas seulement ces prompts —
ils font référence à des fichiers précis qui doivent exister.

**Après chaque prompt** : redéployez et videz le cache navigateur avant de
tester, comme d'habitude sur ce projet (Service Worker PWA actif).
