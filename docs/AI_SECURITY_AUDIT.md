# AUDIT DE SÉCURITÉ — COUCHE SENTINEL'S AI

## 1. Modèle de Menace (Threat Model)

| Menace | Vecteur d'attaque | Risque | Contre-mesure appliquée |
|---|---|---|---|
| **Fuite de clé API** | Accès au code client JS ou repo Git | Critique | Clé NVIDIA stockée exclusivement dans les secrets Supabase Edge Functions. Absente du frontend. |
| **Élévation de privilèges (RBAC)** | Un étudiant appelle un outil réservé à l'administrateur | Critique | Vérification côté serveur dans l'Edge Function (`permissions.ts`) avant tout appel d'outil. |
| **Contournement RLS** | Injection SQL ou requête directe sans filtre d'identité | Majeur | Requêtes de l'Edge Function exécutées sous le JWT de l'utilisateur (`Authorization: Bearer <jwt>`), appliquant le RLS natif. |
| **Prompt Injection** | Texte malveillant dans un document ou message élève ("Ignore instructions...") | Majeur | Délimitation stricte du contexte dans le prompt système, filtrage d'entrées (`validation.ts`), séparation données / instructions. |
| **Action destructrice accidentelle** | L'IA exécute une suppression ou publication sans accord | Majeur | Protocole en deux temps (L1/L2/L3) : toute écriture en base nécessite une confirmation explicite du client avec trace d'audit. |
| **Déni de Service / Coût (DDoS/Token drain)** | Boucle infinie d'appels d'outils ou requêtes massives | Moyen | Limite stricte de récursivité (`maxSteps = 4`), timeouts de 30s et gestion des retries avec backoff exponentiel. |
| **Fuite de données sensibles (PII / Secrets)** | L'IA résume ou expose des mots de passe, clés ou tokens | Critique | Consigne stricte dans le System Prompt interdisant la révélation de tokens/clés + blocage en sortie des patterns de clés. |

---

## 2. Matrice d'Isolation par Rôle

- **`superadmin` & `admin`** :
  - Consultation globale des apprenants, statistiques de présences, notes, enseignants, finances de l'école.
  - Préparation et envoi de notifications, rapports d'activité, actions sur les emplois du temps.
  - Validation explicite exigée pour les modifications d'état ou communications massives.

- **`teacher`** :
  - Isolation stricte : accès exclusif aux modules assignés (`teacher_modules`), apprenants inscrits à ces modules (`student_modules`), présences du jour de ses cours.
  - Préparation d'évaluations (QCM, devoirs) et proposition de saisie de présences.
  - Refus catégorique des données financières globales ou modules d'autres formateurs.

- **`student`** :
  - Accès exclusif à ses propres notes (`grades`), présences (`attendance`), cours/devoirs publiés de sa formation.
  - Recherche dans la base de connaissances documentaire (RAG sur les cours et FAQ).
  - Refus d'accès aux notes ou dossiers des autres étudiants.

- **`partner` & `partner_admin`** :
  - Accès restreint aux cohortes et programmes associés au partenaire.

---

## 3. Conformité et RGPD

1. **Minimisation des données** : Les outils ne renvoient que les champs strictement nécessaires à la question posée (ex: prénom, nom, titre du module, statut) au lieu de l'intégralité des tables.
2. **Journalisation** : Table `ai_agent_actions` enregistrant chaque action proposée, acceptée ou rejetée, avec l'identifiant de l'utilisateur et le résultat obtenu.
3. **Droit à l'oubli** : Suppression en cascade liée à l'utilisateur (`on delete cascade`).
