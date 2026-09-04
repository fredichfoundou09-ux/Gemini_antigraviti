-- =========================================================================
-- 0028_security_p0_fixes.sql
-- Correctifs de sécurité critiques (Priorité P0)
-- 1. Activation et durcissement RLS pour pricing_rules et pricing_packages
-- 2. Protection stricte des bonnes réponses d'examen (questions.bonne_reponse)
-- 3. Sécurisation de l'adhésion et suppression des conversations privées
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. Sécurisation des grilles tarifaires (pricing_rules & pricing_packages)
-- =========================================================================

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Lecture des règles tarifaires : visible par tous pour les règles actives, ou par le staff
DROP POLICY IF EXISTS "pricing_rules_read_active" ON public.pricing_rules;
CREATE POLICY "pricing_rules_read_active" ON public.pricing_rules
  FOR SELECT TO authenticated, anon
  USING (active = true OR public.is_staff());

-- Modification des règles tarifaires : réservée exclusivement au personnel administratif
DROP POLICY IF EXISTS "pricing_rules_write_staff" ON public.pricing_rules;
CREATE POLICY "pricing_rules_write_staff" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Lecture des forfaits tarifaires : visible par tous pour les forfaits actifs, ou par le staff
DROP POLICY IF EXISTS "pricing_packages_read_active" ON public.pricing_packages;
CREATE POLICY "pricing_packages_read_active" ON public.pricing_packages
  FOR SELECT TO authenticated, anon
  USING (active = true OR public.is_staff());

-- Modification des forfaits tarifaires : réservée exclusivement au personnel administratif
DROP POLICY IF EXISTS "pricing_packages_write_staff" ON public.pricing_packages;
CREATE POLICY "pricing_packages_write_staff" ON public.pricing_packages
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- =========================================================================
-- 2. Protection des bonnes réponses d'examens (questions.bonne_reponse)
-- =========================================================================

-- Suppression de la politique trop permissive 'using (true)'
DROP POLICY IF EXISTS "questions_read_auth" ON public.questions;

-- Politique de lecture restreinte : seul le staff ou l'enseignant assigné au test peut lire directement
CREATE POLICY "questions_read_staff_or_teacher" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.tests te
      JOIN public.teachers t ON t.id = te.teacher_id
      WHERE te.id = questions.test_id AND t.user_id = auth.uid()
    )
  );

-- Vue publique sécurisée pour les étudiants : exclut la bonne réponse et l'explication avant validation
CREATE OR REPLACE VIEW public.student_questions WITH (security_invoker = false) AS
SELECT
  id,
  test_id,
  question,
  type,
  points,
  ordre
FROM public.questions;

GRANT SELECT ON public.student_questions TO authenticated;
GRANT SELECT ON public.student_questions TO anon;

-- RPC Sécurisée pour soumettre un examen et évaluer côté serveur
CREATE OR REPLACE FUNCTION public.submit_test_answers(
  p_test_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_test RECORD;
  v_student RECORD;
  v_q RECORD;
  v_total_points NUMERIC := 0;
  v_earned_points NUMERIC := 0;
  v_bareme NUMERIC := 20;
  v_note NUMERIC;
  v_pct NUMERIC;
  v_seuil NUMERIC;
  v_statut TEXT;
  v_valide BOOLEAN;
  v_result_id UUID;
  v_given_ans TEXT;
  v_is_correct BOOLEAN;
  v_existing_attempts INT;
BEGIN
  -- Vérifier authentification
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié.';
  END IF;

  -- Identifier l'étudiant associé au compte
  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Profil étudiant introuvable pour ce compte.';
  END IF;

  -- Charger le test
  SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
  IF v_test.id IS NULL THEN
    RAISE EXCEPTION 'Test introuvable.';
  END IF;

  -- Vérifier le nombre de tentatives autorisées
  SELECT count(*) INTO v_existing_attempts
  FROM public.test_results
  WHERE test_id = p_test_id AND student_id = v_student.id;

  IF v_existing_attempts >= COALESCE(v_test.tentatives, 1) THEN
    RAISE EXCEPTION 'Nombre maximum de tentatives atteint (% sur %).', v_existing_attempts, COALESCE(v_test.tentatives, 1);
  END IF;

  IF v_test.bareme IS NOT NULL AND v_test.bareme > 0 THEN
    v_bareme := v_test.bareme;
  END IF;

  -- Calculer les scores question par question côté serveur
  FOR v_q IN
    SELECT id, question, type, bonne_reponse, points
    FROM public.questions
    WHERE test_id = p_test_id
    ORDER BY ordre
  LOOP
    v_total_points := v_total_points + COALESCE(v_q.points, 1);
    v_given_ans := trim(lower(COALESCE(p_answers->>v_q.id::text, '')));

    IF v_given_ans <> '' THEN
      IF v_q.type IN ('qcm', 'vf') THEN
        v_is_correct := (v_given_ans = trim(lower(v_q.bonne_reponse)));
      ELSE
        -- Type réponse courte
        v_is_correct := (
          v_given_ans = trim(lower(v_q.bonne_reponse))
          OR position(v_given_ans IN trim(lower(v_q.bonne_reponse))) > 0
          OR position(trim(lower(v_q.bonne_reponse)) IN v_given_ans) > 0
        );
      END IF;

      IF v_is_correct THEN
        v_earned_points := v_earned_points + COALESCE(v_q.points, 1);
      END IF;
    END IF;
  END LOOP;

  IF v_total_points <= 0 THEN
    v_total_points := 1;
  END IF;

  v_note := round((v_earned_points / v_total_points) * v_bareme, 1);
  v_pct := round((v_earned_points / v_total_points) * 100);
  v_seuil := v_bareme / 2.0;
  v_statut := CASE WHEN v_note >= v_seuil THEN 'reussi' ELSE 'echoue' END;
  v_valide := NOT COALESCE(v_test.validation_requise, false);

  -- Créer l'enregistrement de résultat
  INSERT INTO public.test_results (
    test_id,
    student_id,
    note,
    pourcentage,
    date,
    heure,
    valide,
    statut
  ) VALUES (
    p_test_id,
    v_student.id,
    v_note,
    v_pct,
    now(),
    to_char(now(), 'HH24:MI'),
    v_valide,
    v_statut
  )
  RETURNING id INTO v_result_id;

  -- Enregistrer le détail des réponses
  FOR v_q IN
    SELECT id, bonne_reponse, points
    FROM public.questions
    WHERE test_id = p_test_id
  LOOP
    v_given_ans := COALESCE(p_answers->>v_q.id::text, '');
    v_is_correct := (trim(lower(v_given_ans)) = trim(lower(v_q.bonne_reponse)));

    INSERT INTO public.test_answers (
      result_id,
      question_id,
      reponse_donnee,
      correct,
      points_obtenus
    ) VALUES (
      v_result_id,
      v_q.id,
      v_given_ans,
      v_is_correct,
      CASE WHEN v_is_correct THEN COALESCE(v_q.points, 1) ELSE 0 END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'result_id', v_result_id,
    'note', v_note,
    'bareme', v_bareme,
    'pourcentage', v_pct,
    'statut', v_statut,
    'valide', v_valide
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_test_answers(UUID, JSONB) TO authenticated;


-- =========================================================================
-- 3. Sécurisation de la messagerie interne (conversation_members & delete)
-- =========================================================================

-- Ajout de la colonne created_by sur conversations si inexistante
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Initialisation de created_by pour les conversations existantes (premier expéditeur)
UPDATE public.conversations c
SET created_by = (
  SELECT sender_id FROM public.messages m
  WHERE m.conversation_id = c.id
  ORDER BY created_at ASC LIMIT 1
)
WHERE created_by IS NULL;

-- Mise à jour de create_conversation pour assigner created_by
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_subject text,
  p_member_ids uuid[],
  p_initial_message text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_conv_id uuid;
  v_member_id uuid;
  v_sender_id uuid := auth.uid();
BEGIN
  IF v_sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- 1. Créer la conversation avec traçabilité du créateur
  INSERT INTO public.conversations (subject, created_by)
  VALUES (coalesce(trim(p_subject), 'Discussion'), v_sender_id)
  RETURNING id INTO v_conv_id;

  -- 2. Ajouter le créateur comme premier membre
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_sender_id)
  ON CONFLICT DO NOTHING;

  -- 3. Ajouter les destinataires et notifier
  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY p_member_ids LOOP
      IF v_member_id IS NOT NULL AND v_member_id <> v_sender_id THEN
        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES (v_conv_id, v_member_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.notifications (user_id, title, body, type, read)
        VALUES (
          v_member_id,
          'Nouveau message : ' || coalesce(trim(p_subject), 'Discussion'),
          coalesce(p_initial_message, 'Vous avez reçu un nouveau message.'),
          'message',
          false
        );
      END IF;
    END LOOP;
  END IF;

  -- 4. Insérer le message initial si fourni
  IF p_initial_message IS NOT NULL AND trim(p_initial_message) <> '' THEN
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (v_conv_id, v_sender_id, trim(p_initial_message));
  END IF;

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conv_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_conversation(text, uuid[], text) TO authenticated;

-- Sécurisation de l'ajout de membres dans conversation_members :
-- Un utilisateur ne peut s'ajouter que lui-même ou doit être du personnel administratif
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
CREATE POLICY "conversation_members_insert" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR public.is_staff()
  );

-- Sécurisation de la suppression directe via RLS de conversations
DROP POLICY IF EXISTS "conversations_member_delete" ON public.conversations;
CREATE POLICY "conversations_creator_or_staff_delete" ON public.conversations
  FOR DELETE TO authenticated
  USING (
    public.is_staff() OR created_by = auth.uid()
  );

-- Durcissement de la RPC delete_conversation : seul le créateur ou le staff peut détruire la conversation
CREATE OR REPLACE FUNCTION public.delete_conversation(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_conv RECORD;
  v_is_staff BOOLEAN;
BEGIN
  SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Conversation introuvable.');
  END IF;

  v_is_staff := public.is_staff();

  -- Seul le créateur de la conversation ou un membre du personnel administratif peut la supprimer
  IF v_conv.created_by <> auth.uid() AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Seul l''administrateur ou le créateur de cette discussion peut la supprimer.';
  END IF;

  -- Suppression en cascade (messages et members sont liés avec ON DELETE CASCADE)
  DELETE FROM public.conversations WHERE id = p_conversation_id;

  RETURN jsonb_build_object('success', true, 'message', 'Conversation supprimée avec succès.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_conversation(UUID) TO authenticated;

COMMIT;
