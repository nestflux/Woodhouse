-- E3-03: pg_cron schedule for process-pipeline worker
-- Invokes the process-pipeline Edge Function every 30 seconds.
-- Masterplan: §5 Orchestrator, §8 pg_cron schedule configuration
--
-- NOTE: pg_cron requires the cron and pg_net extensions.
-- Supabase Cloud has these enabled by default.
-- The service_role_key and project URL must be substituted with real values
-- before running this migration in production.
--
-- This migration is provided as documentation. On Supabase Cloud,
-- pg_cron schedules are typically configured via the Dashboard or
-- by running the SQL directly with actual credentials.

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: process-pipeline every 30 seconds
-- Replace <SUPABASE_URL> and <SERVICE_ROLE_KEY> with actual values.
-- SELECT cron.schedule(
--   'process-pipeline',
--   '30 seconds',
--   $$SELECT net.http_post(
--     '<SUPABASE_URL>/functions/v1/process-pipeline',
--     '{}',
--     '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb
--   )$$
-- );

-- Schedule: trigger-discoveries every hour (for E5+)
-- SELECT cron.schedule(
--   'trigger-discoveries',
--   '0 * * * *',
--   $$SELECT net.http_post(
--     '<SUPABASE_URL>/functions/v1/trigger-discoveries',
--     '{}',
--     '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb
--   )$$
-- );
