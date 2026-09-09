-- ============================================================
-- Migration 0037 : Correction définitive de la génération de l'identifiant apprenant
-- Évite tout conflit d'unicité sur students_pkey (SN-YYYY-XXXXX)
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  y text := extract(year from now())::text;
  v_max int := 0;
  v_candidate text;
BEGIN
  -- 1. Trouver le plus grand numéro séquentiel numérique existant pour l'année en cours
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(id, '^SN-[0-9]{4}-0*([0-9]+)$', '\1'), id)::int
  ), 0)
  INTO v_max
  FROM public.students
  WHERE id LIKE 'SN-' || y || '-%';

  -- 2. Incrémenter et boucler pour garantir mathématiquement qu'aucune clé en double n'est retournée
  LOOP
    v_max := v_max + 1;
    v_candidate := 'SN-' || y || '-' || lpad(v_max::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_candidate);
  END LOOP;

  RETURN v_candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_student_id() TO anon, authenticated, service_role;
