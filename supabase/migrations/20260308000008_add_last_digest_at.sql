-- E11-02: Add last_digest_at to profiles to track email digest sends

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_digest_at TIMESTAMPTZ;

-- pg_cron schedule for daily email digest (configure via Dashboard)
-- Runs daily at 8:00 UTC
-- SELECT cron.schedule(
--   'send-email-digest',
--   '0 8 * * *',
--   $$SELECT net.http_post(
--     '<SUPABASE_URL>/functions/v1/send-email-digest',
--     '{}',
--     '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb
--   )$$
-- );
