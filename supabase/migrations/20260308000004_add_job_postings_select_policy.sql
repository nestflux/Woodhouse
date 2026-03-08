-- E9-02: Allow authenticated users to read job_postings (shared resource)
-- job_postings have RLS enabled but no restrictive per-user policies.
-- All authenticated users can read all job postings.
CREATE POLICY "Authenticated users can read job postings"
  ON public.job_postings
  FOR SELECT
  TO authenticated
  USING (true);
