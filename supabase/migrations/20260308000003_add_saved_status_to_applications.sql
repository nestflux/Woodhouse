-- E8-02: Add 'saved' status to applications for "Saved for Later" tab
ALTER TABLE public.applications
  DROP CONSTRAINT applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'draft', 'ready', 'saved', 'approved', 'submitted', 'acknowledged',
    'screening', 'interviewing', 'offer', 'accepted', 'rejected',
    'withdrawn', 'skipped'
  ));
