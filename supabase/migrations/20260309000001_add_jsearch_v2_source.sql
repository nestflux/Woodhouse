-- Add jsearch_v2 (JSearch Cheaper Version) as a valid job posting source
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_source_check;

ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_source_check
  CHECK (source IN ('google_jobs', 'jsearch', 'jsearch_v2', 'greenhouse', 'lever', 'workday', 'manual', 'email', 'linkedin', 'indeed', 'other'));
