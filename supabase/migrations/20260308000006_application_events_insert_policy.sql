-- E10-02: Allow users to insert application events (notes) for their own applications

CREATE POLICY "Users can insert own application events"
  ON public.application_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    application_id IN (
      SELECT id FROM public.applications WHERE profile_id = auth.uid()
    )
  );
