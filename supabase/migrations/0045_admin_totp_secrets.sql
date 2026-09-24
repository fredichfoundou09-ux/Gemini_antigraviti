-- ============================================================
-- SENTINELLES NUMÉRIQUES — Migration 0045: 2FA TOTP Admin Secrets
-- Table sécurisée pour l'authentification multifacteur (TOTP)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_totp_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_admin_totp_user UNIQUE (user_id)
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_admin_totp_updated_at ON public.admin_totp_secrets;
CREATE TRIGGER trg_admin_totp_updated_at
BEFORE UPDATE ON public.admin_totp_secrets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_admin_totp_user_id ON public.admin_totp_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_totp_enabled ON public.admin_totp_secrets(enabled);

-- ============================================================
-- RLS STRICTE
-- Seuls les administrateurs/superadmins (public.is_staff()) peuvent interagir,
-- et chaque utilisateur ne peut voir/modifier QUE son propre secret.
-- ============================================================
ALTER TABLE public.admin_totp_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_totp_select_own" ON public.admin_totp_secrets;
CREATE POLICY "admin_totp_select_own"
ON public.admin_totp_secrets
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_staff()
);

DROP POLICY IF EXISTS "admin_totp_insert_own" ON public.admin_totp_secrets;
CREATE POLICY "admin_totp_insert_own"
ON public.admin_totp_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_staff()
);

DROP POLICY IF EXISTS "admin_totp_update_own" ON public.admin_totp_secrets;
CREATE POLICY "admin_totp_update_own"
ON public.admin_totp_secrets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_staff()
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_staff()
);

DROP POLICY IF EXISTS "admin_totp_delete_own" ON public.admin_totp_secrets;
CREATE POLICY "admin_totp_delete_own"
ON public.admin_totp_secrets
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.is_staff()
);

-- ============================================================
-- RPC Helper: Vérifier si un utilisateur requiert le 2FA
-- Utilisable avant finalisation de session
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_user_2fa_status(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_totp_secrets
    WHERE user_id = p_user_id AND enabled = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_user_2fa_status(UUID) TO anon, authenticated;
