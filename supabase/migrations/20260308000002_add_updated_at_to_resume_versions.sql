-- E7-01: Add updated_at to resume_versions (CLAUDE.md Rule 6 compliance)
ALTER TABLE public.resume_versions
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.resume_versions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
