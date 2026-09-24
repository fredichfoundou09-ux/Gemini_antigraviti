# MATRICE DES OUTILS — SENTINEL'S AI

Cette matrice recense l'ensemble des outils mis à disposition de l'agent, leur niveau de criticité et les rôles autorisés à les invoquer.

## Légende des Niveaux
- **Niveau 1 (Read / Consultation)** : Exécution immédiate automatique si le rôle le permet.
- **Niveau 2 (Preparation / Brouillon)** : Génération d'un objet (message, rapport, exercice, brouillon) sans impact persistant.
- **Niveau 3 (Action sensible / Écriture)** : Nécessite une confirmation explicite via l'interface avant enregistrement en base de données.

---

## Tableau de Référence

| Nom de l'outil | Niveau | Rôles autorisés | Description |
|---|---|---|---|
| `get_dashboard_stats` | N1 | `superadmin`, `admin`, `teacher`, `student`, `partner` | Retourne les statistiques clés contextualisées selon le rôle de l'utilisateur. |
| `search_student` | N1 | `superadmin`, `admin`, `teacher`, `partner_admin` | Recherche d'apprenants (limité aux élèves de ses modules pour les formateurs). |
| `get_student` | N1 | `superadmin`, `admin`, `teacher`, `student` (soi-même uniquement) | Détail d'une fiche apprenant. |
| `search_teacher` | N1 | `superadmin`, `admin`, `partner_admin` | Liste et recherche de formateurs. |
| `get_schedule` | N1 | Tous rôles | Emploi du temps filtré selon le rôle et les modules assignés/inscrits. |
| `get_attendance` | N1 | `superadmin`, `admin`, `teacher`, `student` (soi-même uniquement) | Historique ou relevé de présences du jour. |
| `get_finance_summary` | N1 | `superadmin`, `admin` | Résumé de trésorerie, factures et paiements de l'établissement. |
| `get_student_balance` | N1 | `superadmin`, `admin`, `student` (soi-même uniquement) | Solde financier d'un apprenant. |
| `get_certificates` | N1 | `superadmin`, `admin`, `student` (ses certificats), `partner` | Liste des certificats émis ou obtenus. |
| `search_courses` | N1 | Tous rôles | Recherche de cours, devoirs et supports pédagogiques accessibles. |
| `search_documents` | N1 | Tous rôles | Moteur de recherche RAG dans les documents officiels, FAQ, guides et règlements. |
| `detecter_anomalies` | N1 | `superadmin`, `admin`, `teacher` | Détection des apprenants sans présence depuis plus de X jours. |
| `prepare_message` | N2 | `superadmin`, `admin`, `teacher` | Prépare le brouillon d'un message avec la liste des destinataires ciblés. |
| `prepare_notification` | N2 | `superadmin`, `admin`, `teacher` | Prépare une notification système à diffuser. |
| `generate_report` | N2 | `superadmin`, `admin`, `partner_admin` | Génère une synthèse analytique prête à être consultée ou exportée. |
| `create_learning_exercise` | N2 | `superadmin`, `admin`, `teacher`, `student` | Génère un exercice, quiz ou fiche de révision adaptée au niveau. |
| `create_schedule_draft` | N2 | `superadmin`, `admin` | Prépare une proposition de créneau d'emploi du temps sans conflit. |
| `valider_presence` | N3 | `superadmin`, `admin`, `teacher` | Enregistre formellement des présences/absences/retards en base (confirmation requise). |
| `publier_devoir` | N3 | `superadmin`, `admin`, `teacher` | Publie un devoir ou document officiel dans un module (confirmation requise). |
| `publier_evaluation` | N3 | `superadmin`, `admin`, `teacher` | Crée un test avec ses questions en base de données (confirmation requise). |
| `send_message` | N3 | `superadmin`, `admin`, `teacher` | Envoie effectivement un message préparé aux destinataires (confirmation requise). |
| `create_notification` | N3 | `superadmin`, `admin` | Diffuse une notification en base aux utilisateurs cibles (confirmation requise). |
| `create_invoice_draft` | N3 | `superadmin`, `admin` | Génère une facture en base pour un apprenant (confirmation requise). |
