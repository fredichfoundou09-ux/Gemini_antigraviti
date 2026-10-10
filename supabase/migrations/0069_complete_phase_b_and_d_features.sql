-- Migration 0069: Phase B & D - Clôture des fonctionnalités, Heure officielle Brazzaville,
-- Audit des notes, Demandes de révision, Grilles critériées, Séances en ligne et Signature serveur de diplômes.
-- Idempotente et sécurisée avec search_path strict.

-- ========================================================
-- 1. HEURE OFFICIELLE DE BRAZZAVILLE (sql-harness proposition)
-- ========================================================
CREATE OR REPLACE FUNCTION public.brazzaville_now()
RETURNS timestamp
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Africa/Brazzaville');
$$;

CREATE OR REPLACE FUNCTION public.brazzaville_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Africa/Brazzaville')::date;
$$;

CREATE OR REPLACE FUNCTION public.server_time()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'utc',         to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'brazzaville', to_char(now() AT TIME ZONE 'Africa/Brazzaville', 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"'),
    'date',        (now() AT TIME ZONE 'Africa/Brazzaville')::date,
    'year',        extract(year from now() AT TIME ZONE 'Africa/Brazzaville')::int,
    'timezone',    'Africa/Brazzaville',
    'abbr',        'WAT'
  );
$$;

GRANT EXECUTE ON FUNCTION public.brazzaville_now(), public.brazzaville_today(), public.server_time() TO anon, authenticated, service_role;

-- Valeurs par défaut des dates de factures et paiements calées sur Brazzaville
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices ALTER COLUMN date SET DEFAULT public.brazzaville_today();
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    ALTER TABLE public.payments ALTER COLUMN date SET DEFAULT public.brazzaville_today();
  END IF;
END $$;


-- ========================================================
-- 2. HISTORIQUE DES NOTES & AUDIT (Phase D.3 - F12)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.grade_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  item_type text NOT NULL, -- 'test_result', 'assignment_submission', 'bulletin_grade', 'paper_result'
  item_id text NOT NULL,
  old_grade numeric,
  new_grade numeric NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grade_audit_student ON public.grade_audit(student_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_module ON public.grade_audit(module_id);
CREATE INDEX IF NOT EXISTS idx_grade_audit_created ON public.grade_audit(created_at DESC);

ALTER TABLE public.grade_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grade_audit_staff_select" ON public.grade_audit;
CREATE POLICY "grade_audit_staff_select" ON public.grade_audit
  FOR SELECT TO authenticated
  USING (public.is_staff() OR public.is_teacher());

DROP POLICY IF EXISTS "grade_audit_student_select" ON public.grade_audit;
CREATE POLICY "grade_audit_student_select" ON public.grade_audit
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

DROP POLICY IF EXISTS "grade_audit_staff_insert" ON public.grade_audit;
CREATE POLICY "grade_audit_staff_insert" ON public.grade_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR public.is_teacher());


-- ========================================================
-- 3. PROCÉDURES SÉCURISÉES : UPSERT_GRADE_SAFE, GRADE_TEST_RESULT, SAVE_PAPER_RESULTS
--    Correction des références vers profiles.role & audit automatique
-- ========================================================
CREATE OR REPLACE FUNCTION public.upsert_grade_safe(
  p_student_id text,
  p_module_id uuid,
  p_note numeric,
  p_appreciation text DEFAULT '',
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role text;
  v_grade_id uuid;
  v_old_note numeric := NULL;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_caller_uid;
  IF v_role NOT IN ('admin', 'superadmin', 'teacher', 'formateur') AND NOT public.is_staff() AND NOT public.is_teacher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès réservé au corps enseignant et administratif');
  END IF;

  -- Vérifier si une note existe déjà pour cet apprenant sur ce module
  SELECT id, note INTO v_grade_id, v_old_note
  FROM public.grades
  WHERE student_id = p_student_id AND module_id = p_module_id
  LIMIT 1;

  IF v_grade_id IS NOT NULL THEN
    UPDATE public.grades
    SET note = p_note,
        appreciation = COALESCE(p_appreciation, appreciation),
        date = COALESCE(p_date, CURRENT_DATE),
        created_by = v_caller_uid
    WHERE id = v_grade_id;
  ELSE
    INSERT INTO public.grades (student_id, module_id, note, appreciation, date, created_by)
    VALUES (
      p_student_id,
      p_module_id,
      p_note,
      COALESCE(p_appreciation, ''),
      COALESCE(p_date, CURRENT_DATE),
      v_caller_uid
    )
    RETURNING id INTO v_grade_id;
  END IF;

  -- Enregistrement automatique dans l'historique d'audit des notes
  INSERT INTO public.grade_audit (
    student_id,
    module_id,
    item_type,
    item_id,
    old_grade,
    new_grade,
    changed_by,
    reason
  ) VALUES (
    p_student_id,
    p_module_id,
    'bulletin_grade',
    v_grade_id::text,
    v_old_note,
    p_note,
    v_caller_uid,
    COALESCE(p_appreciation, 'Mise à jour bulletin officielle')
  );

  RETURN jsonb_build_object('success', true, 'grade_id', v_grade_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_grade_safe(text, uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_grade_safe(text, uuid, numeric, text, date) TO authenticated, service_role;


-- Révision robuste de grade_test_result avec teacher_id TEXT et log audit
CREATE OR REPLACE FUNCTION public.grade_test_result(
  p_result_id uuid,
  p_grades jsonb DEFAULT '{}'::jsonb,
  p_comments jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_test_id uuid;
  v_teacher_id text; -- text pour correspondre à public.teachers(id)
  v_test_owner_uid uuid;
  v_bareme numeric;
  v_seuil numeric;
  v_total_points numeric := 0;
  v_total_max numeric := 0;
  v_pourcentage numeric := 0;
  v_statut text;
  v_q_id text;
  v_q_val text;
  v_comm text;
  v_num_note numeric;
  v_student_id text;
  v_old_score numeric;
  v_module_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  -- Récupérer le résultat et les paramètres de l'évaluation
  SELECT tr.test_id, tr.student_id, tr.note
  INTO v_test_id, v_student_id, v_old_score
  FROM public.test_results tr
  WHERE tr.id = p_result_id;

  IF v_test_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Résultat introuvable');
  END IF;

  SELECT t.teacher_id, t.bareme, t.seuil_reussite, t.module_id
  INTO v_teacher_id, v_bareme, v_seuil, v_module_id
  FROM public.tests t
  WHERE t.id = v_test_id;

  IF v_teacher_id IS NOT NULL THEN
    SELECT te.user_id INTO v_test_owner_uid
    FROM public.teachers te
    WHERE te.id = v_teacher_id;
  END IF;

  -- Vérifier l'autorisation : formateur titulaire ou staff
  IF NOT public.is_staff() AND (v_test_owner_uid IS NULL OR v_test_owner_uid <> v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé : vous devez être le formateur titulaire de cette épreuve.');
  END IF;

  -- Mettre à jour chaque réponse individuelle notée
  FOR v_q_id, v_q_val IN SELECT * FROM jsonb_each_text(p_grades)
  LOOP
    BEGIN
      v_num_note := v_q_val::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_num_note := 0;
    END;

    v_comm := p_comments->>v_q_id;

    UPDATE public.test_answers
    SET note_manuelle = v_num_note,
        commentaire_formateur = v_comm,
        statut_correction = 'corrige'
    WHERE result_id = p_result_id
      AND question_id = v_q_id::uuid;
  END LOOP;

  -- Recalculer le total des points obtenus sur l'épreuve
  SELECT COALESCE(SUM(COALESCE(ta.note_manuelle, ta.points_obtenus, 0)), 0),
         COALESCE(SUM(COALESCE(q.points, 1)), 0)
  INTO v_total_points, v_total_max
  FROM public.test_answers ta
  JOIN public.questions q ON q.id = ta.question_id
  WHERE ta.result_id = p_result_id;

  IF v_total_max = 0 THEN
    v_total_max := COALESCE(v_bareme, 20);
  END IF;

  v_pourcentage := ROUND(((v_total_points / v_total_max) * 100)::numeric, 0);

  IF v_seuil IS NOT NULL AND v_seuil > 0 THEN
    IF v_pourcentage >= v_seuil THEN
      v_statut := 'reussi';
    ELSE
      v_statut := 'echoue';
    END IF;
  ELSE
    IF v_pourcentage >= 50 THEN
      v_statut := 'reussi';
    ELSE
      v_statut := 'echoue';
    END IF;
  END IF;

  -- Valider définitivement le résultat
  UPDATE public.test_results
  SET note = v_total_points,
      pourcentage = v_pourcentage,
      statut = v_statut,
      valide = true
  WHERE id = p_result_id;

  -- Audit
  IF v_student_id IS NOT NULL THEN
    INSERT INTO public.grade_audit (
      student_id,
      module_id,
      item_type,
      item_id,
      old_grade,
      new_grade,
      changed_by,
      reason
    ) VALUES (
      v_student_id,
      v_module_id,
      'test_result',
      p_result_id::text,
      v_old_score,
      v_total_points,
      v_user_id,
      'Correction manuelle enregistrée'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'note', v_total_points,
    'total_max', v_total_max,
    'pourcentage', v_pourcentage,
    'statut', v_statut,
    'valide', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grade_test_result(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_test_result(uuid, jsonb, jsonb) TO authenticated, service_role;


-- Révision de save_paper_results avec teacher_id TEXT et log audit
CREATE OR REPLACE FUNCTION public.save_paper_results(
  p_test_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := auth.uid();
  v_role text;
  v_test RECORD;
  v_owner_uid uuid;
  v_row jsonb;
  v_student_id text;
  v_note numeric;
  v_bareme numeric;
  v_pourcentage numeric;
  v_statut text;
  v_appreciation text;
  v_result_id uuid;
  v_saved_count int := 0;
BEGIN
  IF v_caller_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
  IF v_test.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Évaluation introuvable');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_caller_uid;
  IF v_test.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_owner_uid FROM public.teachers WHERE id = v_test.teacher_id;
  END IF;

  IF NOT public.is_staff() AND (v_owner_uid IS NULL OR v_owner_uid <> v_caller_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Droits formateur titulaire ou administration requis');
  END IF;

  v_bareme := COALESCE(v_test.bareme, 20);
  IF v_bareme <= 0 THEN v_bareme := 20; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_student_id := v_row->>'student_id';
    BEGIN
      v_note := (v_row->>'note')::numeric;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF v_student_id IS NULL OR v_note IS NULL THEN
      CONTINUE;
    END IF;

    v_appreciation := COALESCE(v_row->>'appreciation', 'Examen papier validé');
    v_pourcentage := ROUND(((v_note / v_bareme) * 100)::numeric, 0);
    IF v_note >= (v_bareme / 2) THEN
      v_statut := 'reussi';
    ELSE
      v_statut := 'echoue';
    END IF;

    SELECT id INTO v_result_id
    FROM public.test_results
    WHERE test_id = p_test_id AND student_id = v_student_id;

    IF v_result_id IS NOT NULL THEN
      UPDATE public.test_results
      SET note = v_note,
          pourcentage = v_pourcentage,
          statut = v_statut,
          valide = true
      WHERE id = v_result_id;
    ELSE
      INSERT INTO public.test_results (
        test_id, student_id, note, pourcentage, statut, valide, date_passage
      ) VALUES (
        p_test_id, v_student_id, v_note, v_pourcentage, v_statut, true, now()
      )
      RETURNING id INTO v_result_id;
    END IF;

    -- Reporter également au bulletin
    PERFORM public.upsert_grade_safe(
      v_student_id,
      v_test.module_id,
      ROUND(((v_note / v_bareme) * 20)::numeric, 2),
      v_appreciation
    );

    v_saved_count := v_saved_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved_count', v_saved_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_paper_results(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_paper_results(uuid, jsonb) TO authenticated, service_role;


-- ========================================================
-- 4. DEMANDES DE RÉVISION DE NOTES (Phase D.1 - F08)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.regrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('test_result', 'assignment_submission', 'grade')),
  target_id text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
  teacher_feedback text DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regrade_student ON public.regrade_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_regrade_status ON public.regrade_requests(status);

ALTER TABLE public.regrade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regrade_student_read" ON public.regrade_requests;
CREATE POLICY "regrade_student_read" ON public.regrade_requests
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id() OR public.is_staff() OR public.is_teacher());

DROP POLICY IF EXISTS "regrade_student_insert" ON public.regrade_requests;
CREATE POLICY "regrade_student_insert" ON public.regrade_requests
  FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id());

DROP POLICY IF EXISTS "regrade_staff_update" ON public.regrade_requests;
CREATE POLICY "regrade_staff_update" ON public.regrade_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());


-- ========================================================
-- 5. GRILLES CRITÉRIÉES & BANQUE DE COMMENTAIRES (Phase D.2 - F10)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  teacher_id text REFERENCES public.teachers(id) ON DELETE SET NULL,
  total_points numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  weight numeric NOT NULL DEFAULT 1,
  max_points numeric NOT NULL DEFAULT 5,
  ordre int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.rubric_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterion_id uuid NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
  title text NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  ordre int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.grading_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text REFERENCES public.teachers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Général',
  shortcut text NOT NULL,
  comment_text text NOT NULL,
  is_shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rubrics_read" ON public.rubrics;
CREATE POLICY "rubrics_read" ON public.rubrics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rubrics_write" ON public.rubrics;
CREATE POLICY "rubrics_write" ON public.rubrics FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());

DROP POLICY IF EXISTS "rubric_criteria_read" ON public.rubric_criteria;
CREATE POLICY "rubric_criteria_read" ON public.rubric_criteria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rubric_criteria_write" ON public.rubric_criteria;
CREATE POLICY "rubric_criteria_write" ON public.rubric_criteria FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());

DROP POLICY IF EXISTS "rubric_levels_read" ON public.rubric_levels;
CREATE POLICY "rubric_levels_read" ON public.rubric_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rubric_levels_write" ON public.rubric_levels;
CREATE POLICY "rubric_levels_write" ON public.rubric_levels FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());

DROP POLICY IF EXISTS "grading_comments_read" ON public.grading_comments;
CREATE POLICY "grading_comments_read" ON public.grading_comments FOR SELECT TO authenticated
  USING (is_shared OR teacher_id = public.current_teacher_id() OR public.is_staff());
DROP POLICY IF EXISTS "grading_comments_write" ON public.grading_comments;
CREATE POLICY "grading_comments_write" ON public.grading_comments FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_teacher())
  WITH CHECK (public.is_staff() OR public.is_teacher());


-- ========================================================
-- 6. SÉANCES EN LIGNE (Phase D.4 - N11)
-- ========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule') THEN
    ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS meeting_url text;
    ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
    ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS online_attendance_mode text NOT NULL DEFAULT 'auto';
  END IF;
END $$;


-- ========================================================
-- 7. SIGNATURE NUMÉRIQUE SERVEUR DE DIPLÔMES (Phase B.5 - S2 / N8)
-- ========================================================
-- Calcule un HMAC-SHA256 sécurisé côté serveur avec clé secrète
CREATE OR REPLACE FUNCTION public.sign_certificate_server(
  p_cert_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cert record;
  v_payload text;
  v_signature text;
  v_secret text := 'sn_cert_signing_key_2026_brazzaville_sec';
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Action réservée à l''administration');
  END IF;

  SELECT * INTO v_cert FROM public.certificates WHERE id = p_cert_id;
  IF v_cert.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Certificat introuvable');
  END IF;

  -- Construction du payload canonique
  v_payload := concat_ws('|',
    v_cert.id,
    COALESCE(v_cert.numero, ''),
    COALESCE(v_cert.student_id, ''),
    COALESCE(v_cert.titre, ''),
    COALESCE(v_cert.mention, ''),
    v_cert.date_emission::text
  );

  -- Empreinte HMAC-SHA256 via pgcrypto
  v_signature := extensions.encode(extensions.hmac(v_payload::bytea, v_secret::bytea, 'sha256'), 'hex');

  UPDATE public.certificates
  SET signature = v_signature,
      signature_version = 'v2-server-hmac',
      signed_at = now()
  WHERE id = p_cert_id;

  RETURN jsonb_build_object('success', true, 'signature', v_signature, 'signature_version', 'v2-server-hmac');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_certificate_server(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_certificate_server(uuid) TO authenticated, service_role;


-- Vérification côté serveur d'un certificat (page publique de vérification)
CREATE OR REPLACE FUNCTION public.verify_certificate_server(
  p_cert_number text,
  p_signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cert record;
  v_student record;
  v_payload text;
  v_expected_sig text;
  v_secret text := 'sn_cert_signing_key_2026_brazzaville_sec';
  v_status text := 'valid';
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE numero = p_cert_number;
  IF v_cert.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'not_found', 'error', 'Certificat introuvable');
  END IF;

  IF v_cert.is_revoked THEN
    RETURN jsonb_build_object(
      'valid', false,
      'status', 'revoked',
      'revocation_reason', v_cert.revocation_reason,
      'revoked_at', v_cert.revoked_at
    );
  END IF;

  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'status', 'expired', 'expires_at', v_cert.expires_at);
  END IF;

  v_payload := concat_ws('|',
    v_cert.id,
    COALESCE(v_cert.numero, ''),
    COALESCE(v_cert.student_id, ''),
    COALESCE(v_cert.titre, ''),
    COALESCE(v_cert.mention, ''),
    v_cert.date_emission::text
  );

  v_expected_sig := extensions.encode(extensions.hmac(v_payload::bytea, v_secret::bytea, 'sha256'), 'hex');

  -- Vérification de correspondance de signature si fournie
  IF p_signature IS NOT NULL AND p_signature <> '' AND v_expected_sig <> p_signature AND COALESCE(v_cert.signature, '') <> p_signature THEN
    RETURN jsonb_build_object('valid', false, 'status', 'signature_mismatch', 'error', 'Empreinte numérique falsifiée');
  END IF;

  SELECT nom, prenom, matricule INTO v_student FROM public.students WHERE id = v_cert.student_id;

  RETURN jsonb_build_object(
    'valid', true,
    'status', 'valid',
    'certificate', jsonb_build_object(
      'id', v_cert.id,
      'numero', v_cert.numero,
      'titre', v_cert.titre,
      'mention', v_cert.mention,
      'date_emission', v_cert.date_emission,
      'signature', COALESCE(v_cert.signature, v_expected_sig),
      'signature_version', COALESCE(v_cert.signature_version, 'v2-server-hmac'),
      'student_nom', v_student.nom,
      'student_prenom', v_student.prenom,
      'student_matricule', v_student.matricule
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate_server(text, text) TO anon, authenticated, service_role;


-- ========================================================
-- 8. GESTION DES NOTIFICATIONS MULTICANAL SÉCURISÉE (Phase B.3)
-- ========================================================
CREATE OR REPLACE FUNCTION public.mark_notification_outbox_sent(
  p_outbox_id uuid,
  p_status text DEFAULT 'sent',
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès réservé au système/administration');
  END IF;

  UPDATE public.notification_outbox
  SET status = p_status,
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
      error = p_error
  WHERE id = p_outbox_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_outbox_sent(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_outbox_sent(uuid, text, text) TO authenticated, service_role;


-- ========================================================
-- 9. GESTION DES INTERRUPTEURS DE MODULES (Phase B.4)
-- ========================================================
CREATE OR REPLACE FUNCTION public.set_module_feature_flag(
  p_feature text,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès réservé aux administrateurs');
  END IF;

  UPDATE public.site_settings
  SET data = jsonb_set(
    COALESCE(data, '{}'::jsonb),
    ARRAY['feature_flags', p_feature],
    to_jsonb(p_enabled),
    true
  )
  WHERE id = 'default';

  RETURN jsonb_build_object('success', true, 'feature', p_feature, 'enabled', p_enabled);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_module_feature_flag(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_module_feature_flag(text, boolean) TO authenticated, service_role;
