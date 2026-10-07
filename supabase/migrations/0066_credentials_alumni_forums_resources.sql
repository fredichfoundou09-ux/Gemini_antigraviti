-- ==============================================================================
-- Migration 0066 : N8 Diplômes vérifiables + N9 Insertion & Stages + N10 Forum + N11 Visio + N12 Ressources
-- Idempotente, RLS activée, Fonctions SECURITY DEFINER
-- ==============================================================================

-- 1. N8 — DIPLÔMES NUMÉRIQUES VÉRIFIABLES & OPEN BADGES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certificates' AND column_name = 'status') THEN
    ALTER TABLE public.certificates ADD COLUMN status TEXT DEFAULT 'valide' CHECK (status IN ('valide', 'revoque', 'expire'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certificates' AND column_name = 'digital_signature') THEN
    ALTER TABLE public.certificates ADD COLUMN digital_signature TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certificates' AND column_name = 'revocation_reason') THEN
    ALTER TABLE public.certificates ADD COLUMN revocation_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certificates' AND column_name = 'revoked_at') THEN
    ALTER TABLE public.certificates ADD COLUMN revoked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'certificates' AND column_name = 'expires_at') THEN
    ALTER TABLE public.certificates ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. N9 — SUIVI D'INSERTION, ANCIENS APPRENANTS (ALUMNI) & OFFRES DE STAGES
CREATE TABLE IF NOT EXISTS public.alumni_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  milestone TEXT NOT NULL CHECK (milestone IN ('3_months', '6_months', '12_months')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'employed', 'seeking', 'further_study')),
  employer_name TEXT,
  job_title TEXT,
  salary_range TEXT,
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  type TEXT DEFAULT 'stage' CHECK (type IN ('stage', 'cdd', 'cdi', 'freelance')),
  description TEXT,
  location TEXT,
  contact_email TEXT,
  deadline DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. N10 — FORUM / QUESTIONS-RÉPONSES PAR MODULE
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned_solution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. N11 — SÉANCES EN LIGNE (CLASSE VIRTUELLE SUR SCHEDULE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule' AND column_name = 'lien_visio') THEN
    ALTER TABLE public.schedule ADD COLUMN lien_visio TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule' AND column_name = 'visio_provider') THEN
    ALTER TABLE public.schedule ADD COLUMN visio_provider TEXT DEFAULT 'custom';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule' AND column_name = 'join_logged_at') THEN
    ALTER TABLE public.schedule ADD COLUMN join_logged_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule' AND column_name = 'auto_attendance_on_join') THEN
    ALTER TABLE public.schedule ADD COLUMN auto_attendance_on_join BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 5. N12 — BIBLIOTHÈQUE DE RESSOURCES DOCUMENTAIRES
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  module_id TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INT,
  tags TEXT[] DEFAULT '{}',
  downloads_count INT DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PERMISSIONS RBAC OFFICIELLES
INSERT INTO public.permissions (code, description) VALUES
  ('alumni.view', 'Consulter le suivi d''insertion des diplômés et stages'),
  ('alumni.manage', 'Gérer les relances alumni et offres de stages'),
  ('forum.participate', 'Participer aux forums et poser des questions'),
  ('forum.moderate', 'Modérer les sujets et épingler les réponses du forum'),
  ('resources.view', 'Consulter et télécharger les ressources pédagogiques'),
  ('resources.manage', 'Gérer le catalogue documentaire des ressources'),
  ('certificate.revoke', 'Révoquer un diplôme ou certificat'),
  ('certificate.verify', 'Vérifier l''intégrité de signature d''un certificat')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE (
  (r.code = 'superadmin' AND p.code IN ('alumni.view', 'alumni.manage', 'forum.participate', 'forum.moderate', 'resources.view', 'resources.manage', 'certificate.revoke', 'certificate.verify'))
  OR (r.code = 'admin' AND p.code IN ('alumni.view', 'alumni.manage', 'forum.participate', 'forum.moderate', 'resources.view', 'resources.manage', 'certificate.revoke', 'certificate.verify'))
  OR (r.code = 'teacher' AND p.code IN ('forum.participate', 'forum.moderate', 'resources.view', 'resources.manage', 'certificate.verify'))
  OR (r.code = 'student' AND p.code IN ('forum.participate', 'resources.view', 'certificate.verify'))
  OR (r.code = 'partner' AND p.code IN ('alumni.view', 'resources.view'))
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 7. RLS
ALTER TABLE public.alumni_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'alumni_follow_ups_auth_all' AND tablename = 'alumni_follow_ups') THEN
    CREATE POLICY alumni_follow_ups_auth_all ON public.alumni_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'job_offers_auth_all' AND tablename = 'job_offers') THEN
    CREATE POLICY job_offers_auth_all ON public.job_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'forum_threads_auth_all' AND tablename = 'forum_threads') THEN
    CREATE POLICY forum_threads_auth_all ON public.forum_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'forum_posts_auth_all' AND tablename = 'forum_posts') THEN
    CREATE POLICY forum_posts_auth_all ON public.forum_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'resources_auth_all' AND tablename = 'resources') THEN
    CREATE POLICY resources_auth_all ON public.resources FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
