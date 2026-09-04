-- =========================================================================
-- 0029_security_p1_fixes.sql
-- Correctifs de sécurité et durcissement (Priorité P1)
-- 1. Intégrité du journal d'audit (audit_logs)
-- 2. Confidentialité des rémunérations des formateurs (tarif_horaire)
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Sécurisation du journal d'audit (audit_logs)
-- =========================================================================

-- Suppression de la politique permissive d'insertion libre 'with check (true)'
DROP POLICY IF EXISTS "audit_insert_auth" ON public.audit_logs;

-- Nouvelle politique : un utilisateur ne peut consigner des logs qu'avec son propre user_id,
-- sauf le personnel administratif habilité (staff)
CREATE POLICY "audit_insert_auth" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_staff()
  );


-- =========================================================================
-- 2. Protection de la confidentialité des salaires des formateurs
-- =========================================================================

-- Vue publique sécurisée des formateurs (exclut tarif_horaire, type_contrat, etc.)
CREATE OR REPLACE VIEW public.public_teachers WITH (security_invoker = false) AS
SELECT
  id,
  user_id,
  nom,
  prenom,
  specialite,
  email,
  phone,
  photo_url,
  actif,
  formations,
  diplomes,
  infos_pro,
  created_at
FROM public.teachers;

GRANT SELECT ON public.public_teachers TO authenticated;
GRANT SELECT ON public.public_teachers TO anon;

-- RPC sécurisée pour récupérer la liste des formateurs avec masquage automatique du tarif horaire
CREATE OR REPLACE FUNCTION public.get_teachers_safe()
RETURNS TABLE (
  id text,
  user_id uuid,
  nom text,
  prenom text,
  specialite text,
  email text,
  phone text,
  photo_url text,
  actif boolean,
  formations text[],
  diplomes text,
  infos_pro text,
  tarif_horaire numeric,
  heures_prevues numeric,
  type_contrat text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_staff BOOLEAN := public.is_staff();
  v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.nom,
    t.prenom,
    t.specialite,
    t.email,
    t.phone,
    t.photo_url,
    t.actif,
    t.formations,
    t.diplomes,
    t.infos_pro,
    -- Le tarif horaire n'est retourné qu'au staff administratif ou au formateur lui-même
    CASE
      WHEN v_is_staff OR (t.user_id IS NOT NULL AND t.user_id = v_uid)
      THEN t.tarif_horaire
      ELSE NULL
    END AS tarif_horaire,
    -- Idem pour les heures prévues et le type de contrat confidentiel
    CASE
      WHEN v_is_staff OR (t.user_id IS NOT NULL AND t.user_id = v_uid)
      THEN t.heures_prevues
      ELSE NULL
    END AS heures_prevues,
    CASE
      WHEN v_is_staff OR (t.user_id IS NOT NULL AND t.user_id = v_uid)
      THEN t.type_contrat
      ELSE NULL
    END AS type_contrat,
    t.created_at
  FROM public.teachers t
  ORDER BY t.nom, t.prenom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teachers_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teachers_safe() TO anon;

COMMIT;
