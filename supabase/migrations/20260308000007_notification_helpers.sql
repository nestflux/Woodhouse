-- E11-01: Notification helpers — creation function, pipeline trigger, cron checks

-- ============================================================
-- HELPER: create_notification()
-- Used by triggers, cron jobs, and Edge Functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_profile_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (profile_id, type, title, body, metadata)
  VALUES (p_profile_id, p_type, p_title, p_body, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: Notify user when application becomes 'ready'
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_application_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ready' THEN
    SELECT jp.job_title, jp.company_name
    INTO v_job_title, v_company
    FROM public.job_postings jp
    WHERE jp.id = NEW.job_posting_id;

    PERFORM public.create_notification(
      NEW.profile_id,
      'applications_ready',
      'Application ready for review',
      format('%s at %s is ready — review and approve it.', v_job_title, v_company),
      jsonb_build_object('application_id', NEW.id, 'job_posting_id', NEW.job_posting_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_application_ready
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_application_ready();

-- ============================================================
-- CRON: Check follow-up reminders
-- Finds applications with next_step_date <= now() that haven't
-- already been notified. Stores application_id in metadata
-- to prevent duplicates.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_follow_up_reminders()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_app RECORD;
BEGIN
  FOR v_app IN
    SELECT a.id, a.profile_id, a.next_step_date,
           jp.job_title, jp.company_name
    FROM public.applications a
    JOIN public.job_postings jp ON jp.id = a.job_posting_id
    WHERE a.next_step_date IS NOT NULL
      AND a.next_step_date <= now()
      AND a.status NOT IN ('accepted', 'rejected', 'withdrawn')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.profile_id = a.profile_id
          AND n.type = 'follow_up_reminder'
          AND n.metadata->>'application_id' = a.id::text
          AND n.created_at > a.next_step_date - interval '1 day'
      )
  LOOP
    PERFORM public.create_notification(
      v_app.profile_id,
      'follow_up_reminder',
      'Follow-up reminder',
      format('Time to follow up on your %s application at %s.', v_app.job_title, v_app.company_name),
      jsonb_build_object('application_id', v_app.id)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CRON: Check stale applications
-- Finds 'submitted' applications with no update in 14 days.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_stale_applications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_app RECORD;
BEGIN
  FOR v_app IN
    SELECT a.id, a.profile_id, a.updated_at,
           jp.job_title, jp.company_name
    FROM public.applications a
    JOIN public.job_postings jp ON jp.id = a.job_posting_id
    WHERE a.status = 'submitted'
      AND a.updated_at < now() - interval '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.profile_id = a.profile_id
          AND n.type = 'status_stale'
          AND n.metadata->>'application_id' = a.id::text
          AND n.created_at > now() - interval '14 days'
      )
  LOOP
    PERFORM public.create_notification(
      v_app.profile_id,
      'status_stale',
      'No response in 14 days',
      format('Your application for %s at %s has had no updates in 14 days. Consider following up.', v_app.job_title, v_app.company_name),
      jsonb_build_object('application_id', v_app.id)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- pg_cron schedules (documentation — configure via Dashboard)
-- ============================================================

-- Daily at 8:00 UTC: check follow-up reminders
-- SELECT cron.schedule(
--   'check-follow-up-reminders',
--   '0 8 * * *',
--   $$SELECT public.check_follow_up_reminders()$$
-- );

-- Daily at 8:15 UTC: check stale applications
-- SELECT cron.schedule(
--   'check-stale-applications',
--   '15 8 * * *',
--   $$SELECT public.check_stale_applications()$$
-- );
