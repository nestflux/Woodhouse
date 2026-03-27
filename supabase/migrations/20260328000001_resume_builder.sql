-- E16-01: Resume Builder Schema
-- Creates the user_resumes table for the Resume Builder feature.
-- Separate from resume_versions (which stores job-tailored versions linked to applications).

-- ============================================================
-- USER RESUMES
-- ============================================================
CREATE TABLE public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  raw_markdown TEXT,
  source_file_path TEXT,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  scoring_breakdown JSONB,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'uploading', 'parsing', 'scored', 'error')),
  is_active BOOLEAN DEFAULT FALSE,
  file_url_pdf TEXT,
  file_url_docx TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_resumes"
  ON public.user_resumes FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can insert own user_resumes"
  ON public.user_resumes FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can update own user_resumes"
  ON public.user_resumes FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Users can delete own user_resumes"
  ON public.user_resumes FOR DELETE USING (profile_id = auth.uid());

CREATE INDEX idx_user_resumes_profile ON public.user_resumes(profile_id);
CREATE UNIQUE INDEX idx_user_resumes_active
  ON public.user_resumes(profile_id) WHERE is_active = TRUE;

-- Auto-update updated_at (reuses existing handle_updated_at function from E2-03)
CREATE TRIGGER set_user_resumes_updated_at
  BEFORE UPDATE ON public.user_resumes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ENFORCE SINGLE ACTIVE RESUME PER USER
-- ============================================================
-- Uses a unique partial index (above) to enforce at the DB level.
-- The trigger below deactivates other resumes when one is set active,
-- preventing the unique index violation on concurrent updates.
CREATE OR REPLACE FUNCTION public.enforce_single_active_resume()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.user_resumes
    SET is_active = FALSE
    WHERE profile_id = NEW.profile_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_single_active_resume
  BEFORE INSERT OR UPDATE ON public.user_resumes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_resume();

-- ============================================================
-- SYNC RESUME TO PROFILE (transactional RPC)
-- ============================================================
-- Atomically replaces profile + knowledge base data from a user_resumes row.
-- Called via supabase.rpc('sync_resume_to_profile', { resume_id, user_id }).
CREATE OR REPLACE FUNCTION public.sync_resume_to_profile(
  resume_id UUID,
  user_id UUID
)
RETURNS VOID AS $$
DECLARE
  resume_content JSONB;
  header_data JSONB;
  exp_record JSONB;
  edu_record JSONB;
  proj_record JSONB;
  cert_record JSONB;
  skill_name TEXT;
  inserted_exp_id UUID;
  ach_record JSONB;
  i INTEGER;
  j INTEGER;
BEGIN
  -- Load resume content
  SELECT content INTO resume_content
  FROM public.user_resumes
  WHERE id = resume_id AND profile_id = user_id;

  IF resume_content IS NULL THEN
    RAISE EXCEPTION 'Resume not found or not owned by user';
  END IF;

  header_data := resume_content->'header';

  -- 1. Update profile
  UPDATE public.profiles SET
    full_name = COALESCE(header_data->>'full_name', full_name),
    headline = NULLIF(header_data->>'headline', ''),
    summary = NULLIF(resume_content->>'summary', ''),
    phone = NULLIF(header_data->>'phone', ''),
    location = NULLIF(header_data->>'location', ''),
    linkedin_url = NULLIF(header_data->>'linkedin_url', ''),
    portfolio_url = NULLIF(header_data->>'portfolio_url', '')
  WHERE id = user_id;

  -- 2. Delete existing knowledge base (achievements cascade from work_experiences)
  DELETE FROM public.work_experiences WHERE profile_id = user_id;
  DELETE FROM public.education WHERE profile_id = user_id;
  DELETE FROM public.skills WHERE profile_id = user_id;
  DELETE FROM public.projects WHERE profile_id = user_id;
  DELETE FROM public.certifications WHERE profile_id = user_id;

  -- 3. Insert work experiences + achievements
  FOR i IN 0..jsonb_array_length(COALESCE(resume_content->'work_experience', '[]'::jsonb)) - 1 LOOP
    exp_record := resume_content->'work_experience'->i;

    INSERT INTO public.work_experiences (
      profile_id, company_name, job_title, location,
      start_date, end_date, is_current, sort_order
    ) VALUES (
      user_id,
      exp_record->>'company_name',
      exp_record->>'job_title',
      NULLIF(exp_record->>'location', ''),
      CASE
        WHEN exp_record->>'start_date' = '' OR exp_record->>'start_date' IS NULL
        THEN '1900-01-01'::DATE
        ELSE (exp_record->>'start_date')::DATE
      END,
      CASE
        WHEN exp_record->>'end_date' IN ('', 'Present') OR exp_record->>'end_date' IS NULL
        THEN NULL
        ELSE (exp_record->>'end_date')::DATE
      END,
      COALESCE(exp_record->>'end_date', '') IN ('', 'Present'),
      i
    ) RETURNING id INTO inserted_exp_id;

    -- Insert achievements for this experience
    FOR j IN 0..jsonb_array_length(COALESCE(exp_record->'achievements', '[]'::jsonb)) - 1 LOOP
      ach_record := exp_record->'achievements'->j;
      INSERT INTO public.achievements (work_experience_id, description, sort_order)
      VALUES (inserted_exp_id, ach_record->>'text', j);
    END LOOP;
  END LOOP;

  -- 4. Insert education
  FOR i IN 0..jsonb_array_length(COALESCE(resume_content->'education', '[]'::jsonb)) - 1 LOOP
    edu_record := resume_content->'education'->i;
    INSERT INTO public.education (
      profile_id, institution, degree, field_of_study, sort_order
    ) VALUES (
      user_id,
      edu_record->>'institution',
      edu_record->>'degree',
      COALESCE(NULLIF(edu_record->>'field_of_study', ''), 'General'),
      i
    );
  END LOOP;

  -- 5. Insert skills
  FOR skill_name IN SELECT jsonb_array_elements_text(COALESCE(resume_content->'skills', '[]'::jsonb)) LOOP
    INSERT INTO public.skills (profile_id, name, category, proficiency)
    VALUES (user_id, skill_name, 'other', 'intermediate');
  END LOOP;

  -- 6. Insert projects
  FOR i IN 0..jsonb_array_length(COALESCE(resume_content->'projects', '[]'::jsonb)) - 1 LOOP
    proj_record := resume_content->'projects'->i;
    INSERT INTO public.projects (
      profile_id, name, description, technologies, sort_order
    ) VALUES (
      user_id,
      proj_record->>'name',
      NULLIF(proj_record->>'description', ''),
      COALESCE(
        (SELECT array_agg(elem) FROM jsonb_array_elements_text(proj_record->'technologies') AS elem),
        '{}'::TEXT[]
      ),
      i
    );
  END LOOP;

  -- 7. Insert certifications
  FOR i IN 0..jsonb_array_length(COALESCE(resume_content->'certifications', '[]'::jsonb)) - 1 LOOP
    cert_record := resume_content->'certifications'->i;
    INSERT INTO public.certifications (profile_id, name, issuing_organization)
    VALUES (
      user_id,
      cert_record->>'name',
      NULLIF(cert_record->>'issuer', '')
    );
  END LOOP;

  -- 8. Mark this resume as active
  UPDATE public.user_resumes
  SET is_active = TRUE
  WHERE id = resume_id AND profile_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
