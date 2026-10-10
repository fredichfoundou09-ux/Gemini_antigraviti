# Banc d'essai SQL (reproductible)
Objectif : prouver qu'une base reconstruite UNIQUEMENT à partir de supabase/migrations fonctionne.
1. Fichiers : 00 (simulation Supabase), 10 (jeu de données), 20 (test des droits), 30 (parcours d'évaluation),
   40 (vérification statique de toutes les fonctions), 50 (proposition : heure officielle de Brazzaville), run.sh.
2. Lancer : MIGRATIONS_DIR=../supabase/migrations PGUSER=postgres ./run.sh
   (PostgreSQL 15+, extensions pgvector et plpgsql_check).
3. Sur la v8 : 0 migration en erreur, 57 erreurs de fonctions (22 fonctions) -> le script sort en code 1.
4. À brancher en CI : le job doit échouer tant que ce code n'est pas 0.
Remarque : 00_stubs_supabase.sql imite auth.users, auth.uid(), les rôles anon/authenticated et le stockage ;
l'extension pgcrypto est supposée sous le schéma 'extensions' dans le vrai Supabase.
