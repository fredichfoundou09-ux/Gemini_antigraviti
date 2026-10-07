-- ==============================================================================
-- Migration 0065 : N5 Portail Tuteurs + N6 Enquêtes de satisfaction + N7 Compétences
-- Idempotente, RLS activée, Fonctions SECURITY DEFINER avec search_path fixé
-- ==============================================================================

-- 1. N5 — PORTAIL PARENTS / TUTEURS / EMPLOYEURS
CREATE TABLE IF NOT EXISTS public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  type TEXT DEFAULT 'parent' CHECK (type IN ('parent', 'tuteur', 'employeur', 'autre')),
  organisation TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  relationship TEXT DEFAULT 'parent',
  can_view_grades BOOLEAN DEFAULT TRUE,
  can_view_attendance BOOLEAN DEFAULT TRUE,
  can_view_finances BOOLEAN DEFAULT TRUE,
  can_view_messages BOOLEAN DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ DEFAULT now(),
  consent_revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(guardian_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.guardian_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  section TEXT NOT NULL,
  ip_address TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

-- 2. N6 — ENQUÊTES DE SATISFACTION & ÉVALUATION FORMATEURS
CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  module_id TEXT,
  teacher_id TEXT,
  mode TEXT DEFAULT 'hybrid' CHECK (mode IN ('auto', 'manual', 'hybrid')),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  is_anonymous BOOLEAN DEFAULT TRUE,
  min_responses_for_aggregation INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  order_index INT NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'rating_5' CHECK (question_type IN ('rating_5', 'rating_10', 'yes_no', 'text')),
  category TEXT DEFAULT 'pedagogie'
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  respondent_hash TEXT NOT NULL,
  rating_value INT,
  text_value TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, question_id, respondent_hash)
);

-- 3. N7 — RÉFÉRENTIEL DE COMPÉTENCES & LIVRET
CREATE TABLE IF NOT EXISTS public.competencies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  domaine TEXT NOT NULL,
  niveau_requis INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  weight NUMERIC DEFAULT 1.0,
  UNIQUE(module_id, competency_id)
);

CREATE TABLE IF NOT EXISTS public.student_competency_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  competency_id TEXT NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0.0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_acquired', 'in_progress', 'acquired', 'mastered')),
  validated_by TEXT,
  validation_mode TEXT DEFAULT 'auto' CHECK (validation_mode IN ('auto', 'manual')),
  acquired_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, competency_id)
);

-- 4. PERMISSIONS RBAC DANS LE SCHÉMA OFFICIEL
INSERT INTO public.permissions (code, description) VALUES
  ('guardian.view', 'Consulter les tuteurs et liaisons apprenants'),
  ('guardian.manage', 'Gérer les fiches tuteurs et autorisations'),
  ('guardian.portal', 'Accès lecture seule au portail tuteur'),
  ('survey.view', 'Consulter les résultats d''enquêtes de satisfaction'),
  ('survey.manage', 'Créer et lancer des enquêtes d''évaluation'),
  ('survey.respond', 'Répondre aux enquêtes de satisfaction anonymes'),
  ('competency.view', 'Consulter les compétences et livrets'),
  ('competency.manage', 'Gérer le référentiel de compétences'),
  ('competency.evaluate', 'Valider manuellement l''acquisition des compétences')
ON CONFLICT (code) DO NOTHING;

-- Liaison des permissions aux rôles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE (
  (r.code = 'superadmin' AND p.code IN ('guardian.view', 'guardian.manage', 'guardian.portal', 'survey.view', 'survey.manage', 'survey.respond', 'competency.view', 'competency.manage', 'competency.evaluate'))
  OR (r.code = 'admin' AND p.code IN ('guardian.view', 'guardian.manage', 'survey.view', 'survey.manage', 'competency.view', 'competency.manage', 'competency.evaluate'))
  OR (r.code = 'teacher' AND p.code IN ('survey.view', 'competency.view', 'competency.evaluate'))
  OR (r.code = 'student' AND p.code IN ('survey.respond', 'competency.view'))
  OR (r.code = 'partner' AND p.code IN ('competency.view'))
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. SÉCURITÉ RLS
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_competency_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'guardians_authenticated_all' AND tablename = 'guardians') THEN
    CREATE POLICY guardians_authenticated_all ON public.guardians FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_guardians_authenticated_all' AND tablename = 'student_guardians') THEN
    CREATE POLICY student_guardians_authenticated_all ON public.student_guardians FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'guardian_access_logs_authenticated_all' AND tablename = 'guardian_access_logs') THEN
    CREATE POLICY guardian_access_logs_authenticated_all ON public.guardian_access_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'surveys_authenticated_all' AND tablename = 'surveys') THEN
    CREATE POLICY surveys_authenticated_all ON public.surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'survey_questions_authenticated_all' AND tablename = 'survey_questions') THEN
    CREATE POLICY survey_questions_authenticated_all ON public.survey_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'survey_responses_authenticated_all' AND tablename = 'survey_responses') THEN
    CREATE POLICY survey_responses_authenticated_all ON public.survey_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'competencies_authenticated_all' AND tablename = 'competencies') THEN
    CREATE POLICY competencies_authenticated_all ON public.competencies FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'module_competencies_authenticated_all' AND tablename = 'module_competencies') THEN
    CREATE POLICY module_competencies_authenticated_all ON public.module_competencies FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'student_competency_progress_authenticated_all' AND tablename = 'student_competency_progress') THEN
    CREATE POLICY student_competency_progress_authenticated_all ON public.student_competency_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. FONCTION DE CALCUL ET ACQUISITION AUTOMATIQUE DES COMPÉTENCES (N7)
CREATE OR REPLACE FUNCTION public.evaluate_student_competency(
  p_student_id TEXT,
  p_competency_id TEXT,
  p_score NUMERIC,
  p_mode TEXT DEFAULT 'auto'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF p_score >= 80.0 THEN
    v_status := 'mastered';
  ELSIF p_score >= 60.0 THEN
    v_status := 'acquired';
  ELSIF p_score > 0 THEN
    v_status := 'in_progress';
  ELSE
    v_status := 'not_acquired';
  END IF;

  INSERT INTO public.student_competency_progress (
    student_id,
    competency_id,
    score,
    status,
    validation_mode,
    acquired_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_competency_id,
    p_score,
    v_status,
    p_mode,
    CASE WHEN v_status IN ('acquired', 'mastered') THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (student_id, competency_id) DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    validation_mode = EXCLUDED.validation_mode,
    acquired_at = CASE WHEN EXCLUDED.status IN ('acquired', 'mastered') AND student_competency_progress.acquired_at IS NULL THEN now() ELSE student_competency_progress.acquired_at END,
    updated_at = now();

  RETURN jsonb_build_object(
    'student_id', p_student_id,
    'competency_id', p_competency_id,
    'score', p_score,
    'status', v_status
  );
END;
$$;
