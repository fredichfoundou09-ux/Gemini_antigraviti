# RAPPORT GLOBAL D'ANALYSE ET D'ÉVOLUTION ARCHITECTURALE
## PROJET SENTINEL’S — SENTINEL AI : AGENT COGNITIF INTELLIGENT, CONNECTÉ ET SÉCURISÉ

---

### Informations Générales
- **Projet** : SENTINEL’S (Sentinelles Numériques / ENIA 2.0)
- **Environnement** : React 19 • Vite • TypeScript • Tailwind CSS • Supabase (PostgreSQL + pgvector) • Supabase Edge Functions (Deno) • NVIDIA Nemotron • Vercel
- **Statut de déploiement** : Synchronisé sur GitHub `origin/main` • Migration Supabase appliquée • Edge Function déployée • Déploiement Vercel automatique actif
- **Résultats des tests** : **17 suites de tests passées avec succès • 165 tests validés sur 165 (100%)**

---

## 1. Contexte et Objectifs de la Transformation

La version précédente de **Sentinel AI** reposait sur des interactions conversationnelles d'assistance directe. L'objectif fixé par le prompt maître était de transformer Sentinel AI en un **véritable agent cognitif et apprenant**, connecté aux données réelles de l'établissement sans jamais dégrader les fonctionnalités existantes, ni contourner la sécurité, le système de rôles (RBAC) ou les politiques d'accès aux lignes de Supabase (RLS).

### Principes Directeurs Respectés :
1. **Zéro régression** : Préservation intégrale des modules métier (Apprenants, Formateurs, Évaluations unifiées, Emploi du temps, Trésorerie, Messagerie).
2. **Rejet des chatbots à réponses statiques** : Passage à une boucle agentique dynamique :
   $$\text{Perception} \longrightarrow \text{Compréhension} \longrightarrow \text{Sélection d'Outils} \longrightarrow \text{Retrieval / Actions} \longrightarrow \text{Raisonnement} \longrightarrow \text{Réponse sourcée}$$
3. **Sécurité et Contrôle Humain (Human-in-the-Loop)** : Les actions modifiant les données (Niveau 3) demeurent des propositions structurées nécessitant une validation manuelle.
4. **Traçabilité stricte des sources** : Aucune invention de source. Distinction explicite entre sources encyclopédiques, standards officiels, documents de cours et données de base.

---

## 2. Architecture Technique Cible

```mermaid
graph TD
    User([Utilisateur : Apprenant / Formateur / Admin]) --> UI[Interface SentinelAIChat HUD]
    UI --> Router{Routeur d'Intention}
    
    subgraph Sécurité & Permissions
        Auth[Supabase Auth JWT]
        RBAC[Contrôle d'accès par rôle]
        AntiInj[Sanitizer Anti-Prompt Injection]
    end
    
    Router --> Auth
    Auth --> RBAC
    
    subgraph Agent Loop (MAX_STEPS = 5)
        Planner[Agent Planner & Context Engine]
        ToolRegistry[Registre d'Outils Multi-Rôles]
    end
    
    RBAC --> Planner
    Planner --> ToolRegistry
    
    subgraph Sources de Données & Outils
        DB[(Supabase DB - Données Officielles)]
        RAG[(pgvector / ai_document_chunks)]
        Web[ClientWikipediaProvider & DocumentationProvider RFC]
        Memory[(ai_memories - Connaissances Candidates)]
    end
    
    ToolRegistry --> DB
    ToolRegistry --> RAG
    ToolRegistry --> Web
    ToolRegistry --> Memory
    
    subgraph Raisonnement & Synthèse
        LLM[NVIDIA Nemotron / Moteur Local Intelligent]
    end
    
    DB --> LLM
    RAG --> LLM
    Web --> LLM
    Memory --> LLM
    
    LLM --> Response[Réponse enrichie + Badges de Sources]
    LLM --> PendingAction[Action Sensible Niveau 3 : Carte Interactive]
    
    PendingAction -->|Validation Humaine| DBWrite[(Écriture Finale Sécurisée)]
```

---

## 3. Fonctionnalités Majeures Ajoutées

### A. Registre d'Outils Multi-Rôles Dynamique (`Tool Registry`)
Chaque utilisateur dispose d'un catalogue d'outils strictement restreint selon son rôle authentifié :

| Rôle | Outils Disponibles | Utilité Métier |
| :--- | :--- | :--- |
| **Apprenant** | `get_my_profile`, `get_my_schedule`, `get_my_next_course`, `get_my_courses`, `get_my_modules`, `get_my_attendance`, `get_my_grades`, `search_my_documents`, `search_course_knowledge`, `create_practice_exercise`, `explain_course` | Tuteur pédagogique personnalisé, consultation des notes, absences, révisions et prochains créneaux. |
| **Formateur** | `get_my_schedule`, `get_my_courses`, `get_assigned_students`, `get_attendance`, `get_grades`, `search_course_documents`, `create_exercise`, `create_quiz`, `generate_lesson_plan` | Ingénierie pédagogique, préparation de devoirs TP, QCM barémés et suivi des promotions. |
| **Administrateur** | `search_students`, `search_teachers`, `search_courses`, `get_dashboard_stats`, `get_attendance_stats`, `get_finance_summary`, `generate_report`, `manage_notifications`, `prepare_message` | Pilotage global, détection des étudiants inactifs, suivi financier et diffusion d'annonces. |
| **Web & Documents** | `search_wikipedia`, `search_web`, `fetch_web_page`, `remember_information`, `search_document` | Recherche de documentation externe, consultation encyclopédique et mémorisation contrôlée. |

### B. Moteur de Recherche Web & Documentation Technique Réel
- **WikipediaProvider** : Interrogation en temps réel de l'API MediaWiki CORS-friendly (`fr.wikipedia.org/w/api.php`) permettant de citer fidèlement les dates, fondateurs, concepts et URL d'articles sans aucune clé d'API requise.
- **DocumentationProvider** : Intégration de standards et RFC officiels (RFC 2328 OSPF, RFC 4271 BGP, RFC 8446 TLS 1.3, RFC 8017 RSA, OWASP Top 10) pour répondre aux questions techniques approfondies avec rigueur académique.
- **Gestion des pannes** : Fallback gracieux en cas de coupure réseau sans blocage de l'interface utilisateur.

### C. Pipeline d'Ingestion RAG avec Protection Anti-Prompt Injection
- **Neutralisation des injections** ([documentIngestion.ts](file:///c:/Users/Dell/Downloads/code_6_senti/src/lib/ai/documentIngestion.ts)) : Tout document téléversé (PDF, DOCX, TXT, CSV, MD, JSON) passe par `sanitizeExtractedText()`. Les directives pernicieuses (`"ignore all previous instructions"`, `"you are now an admin"`, etc.) sont neutralisées textuellement et marquées sans supprimer le contenu légitime du document.
- **Découpage intelligent** : Algorithme `chunkText()` découpant les textes à 750 caractères avec 100 caractères de chevauchement sur des frontières de phrases pour maintenir la cohérence sémantique.
- **Déduplication & Versionnage** : Calcul d'empreinte SHA-256 cryptographique (`computeSha256`). Si un document est ré-uploadé à l'identique, il n'est pas dupliqué. Si une nouvelle version est émise, les fragments précédents sont archivés (`active = false`).

### D. Hiérarchie des Connaissances & Apprentissage Continu Contrôlé
- Les informations partagées par les utilisateurs ne deviennent jamais des vérités absolues sans vérification.
- Toute affirmation nouvelle est classée en **connaissance candidate** avec le statut `unverified_information` et un score de confiance modéré dans la table `ai_memories`.
- Seules les données validées par l'administration ou confirmées par les données officielles de Sentinelles Numériques accèdent au statut `validated_knowledge`.

### E. Carte de Confirmation Interactive pour Actions Sensibles (Niveau 3)
- Toute opération ayant un impact en base (`valider_presence`, `publier_evaluation`, `publier_devoir`, `send_message`, `create_notification`, `create_invoice_draft`) est interceptée.
- Une carte d'action dédiée s'affiche dans le chat avec :
  - Visualisation détaillée des questions, barèmes, durées ou montants.
  - Boutons d'export direct en **DOCX Épreuve**, **DOCX Corrigé enseignant** et **PDF Officiel**.
  - Boutons explicites : **[Confirmer l'action]** ou **[Ignorer]**.

---

## 4. Fonctionnalités Améliorées

1. **Expérience Utilisateur & Badges de Sources Typées** ([SentinelAIChat.tsx](file:///c:/Users/Dell/Downloads/code_6_senti/src/components/ai/SentinelAIChat.tsx)) :
   - Affichage dynamique de l'état HUD de l'agent (*"Recherche dans les connaissances...", "Consultation de Wikipédia..."*).
   - Code couleur distinctif pour les sources vérifiées :
     - 🔵 **Wikipédia** (Bleu nuit)
     - 🟣 **Standards & RFC** (Pourpre)
     - 🟢 **Documents Indexés & Supports** (Émeraude)
     - 🟡 **Base de données & Registres de l'école** (Ambre)
2. **Double Moteur Hybride Edge / Local** ([sentinelAiService.ts](file:///c:/Users/Dell/Downloads/code_6_senti/src/lib/ai/sentinelAiService.ts)) :
   - Fonctionnement prioritaire via l'Edge Function Deno Supabase (`ai-agent`) avec modèle NVIDIA Nemotron.
   - Bascule transparente sur le moteur local intelligent en cas d'absence de connexion ou d'exécution en environnement de test, sans interruption de service pour l'utilisateur.
3. **Schéma de Données Supabase** ([0050_sentinel_ai_full_agent_engine.sql](file:///c:/Users/Dell/Downloads/code_6_senti/supabase/migrations/0050_sentinel_ai_full_agent_engine.sql)) :
   - Ajout des colonnes de statut et de niveau hiérarchique (`status`, `hierarchy_level`) sur `ai_memories`.
   - Ajout du drapeau `is_official` sur `ai_knowledge_docs`.
   - Création de la table `ai_external_sources` avec politiques RLS restrictives.

---

## 5. Bilan Complet de la Suite de Tests (16 Scénarios)

Une suite complète de 16 tests a été développée dans [sentinel_ai_agent_suite.test.ts](file:///c:/Users/Dell/Downloads/code_6_senti/src/__tests__/sentinel_ai_agent_suite.test.ts) conformément à la section 46 du prompt maître :

```
✓ Test 1  : Question simple — Réponse pédagogique dynamique et naturelle
✓ Test 2  : Question nécessitant la base Sentinel'S — Données d'effectifs et finances
✓ Test 3  : Question nécessitant la mémoire — Enregistrement en connaissance candidate non vérifiée
✓ Test 4  : Question nécessitant un document — Retrieval RAG sur les fragments indexés
✓ Test 5  : Question nécessitant Wikipédia — Consultation encyclopédique avec citation de source
✓ Test 6  : Question nécessitant plusieurs sources Web — Combiner Wikipédia et documentation RFC
✓ Test 7  : Question nécessitant plusieurs outils — Diagnostic assiduité et détection d'anomalies
✓ Test 8  : Demande d'action sensible — Soumission Level 3 sans exécution prématurée
✓ Test 9  : Tentative d'accès interdit — Interception de tentative d'élévation de privilèges
✓ Test 10 : Document avec prompt injection — Neutralisation stricte lors de l'extraction
✓ Test 11 : Document contradictoire — Déduplication et gestion de version par SHA-256
✓ Test 12 : Conversation longue — Préservation du flux sur plusieurs tours
✓ Test 13 : Apprenant — Consultation de son planning de cours officiel
✓ Test 14 : Formateur — Préparation d'un projet de devoir pratique
✓ Test 15 : Administrateur — Synthèse financière globale et impayés
✓ Test 16 : Test de latence — Traitement local ultra-rapide (< 1000 ms)
```

**Bilan d'exécution général de Vitest** :
- **17 fichiers de tests exécutés**
- **165 tests validés sur 165**
- **Durée totale d'exécution** : 8.28 secondes
- **Erreurs de compilation TypeScript** : 0 (`tsc --noEmit`)

---

## 6. État des Déploiements

1. **Supabase Database** :
   - Migration `0050_sentinel_ai_full_agent_engine.sql` appliquée avec succès via `npx supabase db push`.
   - Base de données distante synchronisée et intègre.
2. **Supabase Edge Functions** :
   - Déploiement de la fonction `ai-agent` sur le projet distant `tvcuwhgqhrcvdgwlviju`.
   - Tous les composants (`index`, `tools`, `webSearch`, `router`, `permissions`, `prompts`, `rag`, `memory`, `audit`) sont actifs en production.
3. **GitHub & Vercel** :
   - Commit `dc4c08d` poussé sur la branche principale `main` de `https://github.com/fredichfoundou09-ux/Gemini_antigraviti.git`.
   - Déclenchement automatique de la compilation et du déploiement en production sur Vercel.
   - Build Vite validé en local en 28.98s (PWA fonctionnelle, chunks de production optimisés).

---

## 7. Recommandations Poursuite

1. **Enrichissement de la base vectorielle** : Téléverser progressivement les règlements officiels et syllabi de cours au format PDF/DOCX via le bouton trombone du chat pour alimenter la recherche vectorielle pgvector.
2. **Tableau de bord de modération des connaissances** : Offrir aux super-administrateurs un écran pour valider d'un clic les connaissances candidates (`unverified_information` $\to$ `validated_knowledge`).
3. **Observabilité des tokens** : Suivre la consommation des tokens NVIDIA Nemotron via les journaux de la table `ai_audit_logs`.
