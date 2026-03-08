-- E2-03: Subscriptions, Notifications, Functions & Triggers
-- Creates remaining tables and all database functions/triggers.
-- Masterplan: §7 (Subscriptions, Notifications, Database Functions)

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'premium')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  applications_used INTEGER DEFAULT 0,
  applications_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_subscriptions_profile ON public.subscriptions(profile_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_customer_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'new_matches', 'applications_ready', 'follow_up_reminder',
      'status_stale', 'subscription_warning', 'system'
    )),
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_notifications_profile ON public.notifications(profile_id);
CREATE INDEX idx_notifications_unread ON public.notifications(profile_id, read) WHERE read = FALSE;

-- ============================================================
-- FUNCTION: handle_updated_at()
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at (10 tables)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_experiences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.education
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.search_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tracked_boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Note: pipeline_jobs intentionally has no updated_at trigger —
-- status transitions are tracked via started_at, completed_at, and next_retry_at columns.

-- ============================================================
-- FUNCTION: handle_new_user()
-- Auto-create profile and subscription on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  -- Limits: free=5, pro=50, premium=200
  INSERT INTO public.subscriptions (profile_id, plan, applications_limit)
  VALUES (NEW.id, 'free', 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: handle_application_approved()
-- Increment applications_used when an application is approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_application_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.subscriptions
    SET applications_used = applications_used + 1
    WHERE profile_id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_approved
  AFTER INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_application_approved();

-- ============================================================
-- FUNCTION: claim_pipeline_job()
-- Atomic job claim with SKIP LOCKED + zombie reclaim
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_pipeline_job()
RETURNS SETOF public.pipeline_jobs AS $$
  WITH zombies_reclaimed AS (
    UPDATE public.pipeline_jobs SET
      status = 'pending',
      started_at = NULL
    WHERE status = 'processing'
      AND started_at < now() - interval '5 minutes'
    RETURNING id
  ),
  claimed AS (
    SELECT id FROM public.pipeline_jobs
    WHERE status = 'pending'
      AND attempts < max_attempts
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pipeline_jobs SET
    status = 'processing',
    started_at = now(),
    attempts = attempts + 1
  FROM claimed
  WHERE public.pipeline_jobs.id = claimed.id
  RETURNING public.pipeline_jobs.*;
$$ LANGUAGE sql;

-- ============================================================
-- FUNCTION: fail_pipeline_job(p_job_id, p_error)
-- Mark job as failed with exponential backoff
-- ============================================================
CREATE OR REPLACE FUNCTION public.fail_pipeline_job(
  p_job_id UUID,
  p_error TEXT
)
RETURNS void AS $$
  UPDATE public.pipeline_jobs SET
    status = CASE
      WHEN attempts >= max_attempts THEN 'failed'
      ELSE 'pending'
    END,
    error = p_error,
    next_retry_at = CASE
      WHEN attempts < max_attempts
      THEN now() + (interval '30 seconds' * power(2, attempts))
      ELSE NULL
    END
  WHERE id = p_job_id;
$$ LANGUAGE sql;

-- ============================================================
-- FUNCTION: handle_application_status_change()
-- Log application status changes to application_events
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.application_events (application_id, event_type, description)
    VALUES (NEW.id, 'status_changed', 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_status_change
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_application_status_change();
