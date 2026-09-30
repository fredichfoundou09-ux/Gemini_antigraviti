-- ============================================================
-- 0057_fix_test_answers_columns.sql
-- Correction de la colonne de réponse dans test_answers :
-- 1. Ajoute la colonne manquante reponse_donnee attendue par les RPC
-- 2. Reprend les données existantes de l'ancienne colonne reponse
-- 3. Rend l'ancienne colonne reponse nullable avec défaut vide
-- ============================================================

ALTER TABLE public.test_answers
  ADD COLUMN IF NOT EXISTS reponse_donnee text;

-- Reprise des éventuelles anciennes réponses
UPDATE public.test_answers
   SET reponse_donnee = reponse
 WHERE reponse_donnee IS NULL AND reponse IS NOT NULL;

-- L'ancienne colonne ne doit plus bloquer les insertions
ALTER TABLE public.test_answers ALTER COLUMN reponse DROP NOT NULL;
ALTER TABLE public.test_answers ALTER COLUMN reponse SET DEFAULT '';
