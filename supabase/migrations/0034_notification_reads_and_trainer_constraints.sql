-- Migration 0034: Notification reads persistence & trainer module relations
-- Fixes notification read status per user so the badge never reappears after refresh.

CREATE TABLE IF NOT EXISTS public.notification_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_notif ON public.notification_reads(notification_id);

-- Enable RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notification reads" ON public.notification_reads;
CREATE POLICY "Users can manage their own notification reads"
  ON public.notification_reads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC to mark notifications as read in bulk or single
CREATE OR REPLACE FUNCTION public.mark_notifications_read_v2(p_notification_ids TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_id IN ARRAY p_notification_ids LOOP
    INSERT INTO public.notification_reads (user_id, notification_id, read_at)
    VALUES (v_user_id, v_id, now())
    ON CONFLICT (user_id, notification_id) DO UPDATE SET read_at = now();
  END LOOP;
END;
$$;

-- Table learner_modules for explicit many-to-many relationship
CREATE TABLE IF NOT EXISTS public.learner_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  formation_id TEXT,
  status TEXT DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(learner_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_modules_learner ON public.learner_modules(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_modules_module ON public.learner_modules(module_id);

-- Table trainer_modules for explicit assignment
CREATE TABLE IF NOT EXISTS public.trainer_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  formation_id TEXT,
  session_rate NUMERIC DEFAULT 2500,
  status TEXT DEFAULT 'active',
  assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(trainer_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_modules_trainer ON public.trainer_modules(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_modules_module ON public.trainer_modules(module_id);
