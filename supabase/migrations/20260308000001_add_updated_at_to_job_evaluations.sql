-- E6-02: Add updated_at to job_evaluations (CLAUDE.md Rule 6 compliance)
ALTER TABLE public.job_evaluations
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.job_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
