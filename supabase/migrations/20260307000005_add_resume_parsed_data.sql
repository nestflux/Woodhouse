-- E4-01: Add resume_parsed_data column to profiles
-- Stores parsed resume data (JSON) from Step 1 of onboarding to pre-fill subsequent steps.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_parsed_data JSONB;

-- Create resumes storage bucket for resume file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own resumes
CREATE POLICY "Users can upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own resumes
CREATE POLICY "Users can read own resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (upsert) their own resumes
CREATE POLICY "Users can update own resumes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
