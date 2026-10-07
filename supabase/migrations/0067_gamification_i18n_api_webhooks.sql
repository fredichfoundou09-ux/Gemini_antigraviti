-- ==============================================================================
-- Migration 0067 : N13 Gamification + N14 Multilingue + N15 API Publique & Webhooks
-- Idempotente, RLS activée, Fonctions SECURITY DEFINER
-- ==============================================================================

-- 1. N13 — GAMIFICATION LÉGÈRE ET OPTIONNELLE
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  points INT DEFAULT 10,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  badge_id TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  UNIQUE(student_id, badge_id)
);

-- Insertion de badges de base
INSERT INTO public.badges (id, name, description, icon, points) VALUES
  ('BADGE_ASSIDUITE_OR', 'Assiduité Exemplaire', '100% de présence sans retard sur un module', 'Award', 50),
  ('BADGE_PREMIER_DEVOIR', 'Pionnier Pédagogique', 'Premier devoir remis en avance', 'Sparkles', 20),
  ('BADGE_MAJOR_PROMO', 'Excellence Académique', 'Moyenne supérieure à 18/20', 'Crown', 100),
  ('BADGE_ENTRAIDE', 'Sentinelle Solidaire', 'Réponse validée comme solution sur le forum', 'HeartHandshake', 30)
ON CONFLICT (id) DO NOTHING;

-- 2. N14 — MULTILINGUE & DICTIONNAIRES EXTENSIBLES (FR par défaut, LN, EN...)
CREATE TABLE IF NOT EXISTS public.i18n_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL CHECK (locale IN ('fr', 'en', 'es', 'ln', 'kg')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(locale, key)
);

-- 3. N15 — API PUBLIQUE & WEBHOOKS
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{"read"}',
  revoked BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{"grade.published"}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  status_code INT,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PERMISSIONS RBAC OFFICIELLES
INSERT INTO public.permissions (code, description) VALUES
  ('gamification.manage', 'Gérer les badges et règles de récompense'),
  ('api.manage', 'Générer et révoquer des clés d''API'),
  ('webhooks.manage', 'Configurer les endpoints et webhooks sortants')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE (
  (r.code = 'superadmin' AND p.code IN ('gamification.manage', 'api.manage', 'webhooks.manage'))
  OR (r.code = 'admin' AND p.code IN ('gamification.manage', 'api.manage', 'webhooks.manage'))
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.i18n_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'badges_auth_all' AND tablename = 'badges') THEN
    CREATE POLICY badges_auth_all ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_badges_auth_all' AND tablename = 'student_badges') THEN
    CREATE POLICY student_badges_auth_all ON public.student_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'i18n_translations_auth_all' AND tablename = 'i18n_translations') THEN
    CREATE POLICY i18n_translations_auth_all ON public.i18n_translations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'api_keys_auth_all' AND tablename = 'api_keys') THEN
    CREATE POLICY api_keys_auth_all ON public.api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'webhook_endpoints_auth_all' AND tablename = 'webhook_endpoints') THEN
    CREATE POLICY webhook_endpoints_auth_all ON public.webhook_endpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'webhook_deliveries_auth_all' AND tablename = 'webhook_deliveries') THEN
    CREATE POLICY webhook_deliveries_auth_all ON public.webhook_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
