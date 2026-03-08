-- E9-04: Tailoring Prompt Customization
-- Adds system_config table for admin settings and tailoring_instructions to search_preferences.

-- ============================================================
-- SYSTEM CONFIG (admin key-value store)
-- ============================================================

CREATE TABLE public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read config (needed to check tailoring mode)
CREATE POLICY "Authenticated users can read system config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (admin) can write config — no user-level INSERT/UPDATE/DELETE policy
-- Admin operations go through the admin Supabase client (service role key)

-- Auto-update updated_at on changes
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default tailoring mode
INSERT INTO public.system_config (key, value)
VALUES
  ('tailoring_prompt_mode', 'system_default'),
  ('tailoring_prompt_admin_text', NULL);

-- ============================================================
-- ADD TAILORING INSTRUCTIONS TO SEARCH PREFERENCES
-- ============================================================

ALTER TABLE public.search_preferences
  ADD COLUMN IF NOT EXISTS tailoring_instructions TEXT;
