-- E2-02: Application & Pipeline Schema
-- Creates the 9 job discovery, evaluation, application pipeline, and queue tables.
-- Masterplan: §7 (Search Preferences, Tracked Boards, Job Postings, Job Evaluations,
--   Applications, Resume Versions, Application Events, Pipeline Jobs, Discovery Runs)

-- ============================================================
-- SEARCH PREFERENCES
-- ============================================================
CREATE TABLE public.search_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  excluded_keywords TEXT[] DEFAULT '{}',
  excluded_companies TEXT[] DEFAULT '{}',
  preferred_company_sizes TEXT[] DEFAULT '{}',
  preferred_industries TEXT[] DEFAULT '{}',
  min_salary INTEGER,
  max_salary INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  job_types TEXT[] DEFAULT ARRAY['full_time'],
  is_active BOOLEAN DEFAULT TRUE,
  next_discovery_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

ALTER TABLE public.search_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own search preferences"
  ON public.search_preferences FOR ALL USING (profile_id = auth.uid());

-- ============================================================
-- TRACKED BOARDS
-- ============================================================
CREATE TABLE public.tracked_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('greenhouse', 'lever')),
  board_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, board_url)
);

ALTER TABLE public.tracked_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tracked boards"
  ON public.tracked_boards FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_tracked_boards_profile ON public.tracked_boards(profile_id);
CREATE INDEX idx_tracked_boards_active ON public.tracked_boards(is_active) WHERE is_active = TRUE;

-- ============================================================
-- JOB POSTINGS (no restrictive RLS — shared across users)
-- ============================================================
CREATE TABLE public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('google_jobs', 'jsearch', 'greenhouse', 'lever', 'workday', 'manual', 'email', 'linkedin', 'indeed', 'other')),
  source_url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_logo_url TEXT,
  job_title TEXT NOT NULL,
  location TEXT,
  country TEXT,
  is_remote BOOLEAN DEFAULT FALSE,
  job_type TEXT
    CHECK (job_type IN ('full_time', 'part_time', 'contract', 'freelance', 'internship')),
  experience_level TEXT
    CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead', 'director', 'executive')),
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  description_raw TEXT NOT NULL,
  description_structured JSONB,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  responsibilities TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  application_url TEXT,
  application_method TEXT DEFAULT 'url'
    CHECK (application_method IN ('url', 'email', 'api', 'unknown')),
  posted_date TIMESTAMPTZ,
  expires_date TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'filled', 'removed')),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(source, external_id)
);

-- RLS enabled but no restrictive policies — shared across users.
-- Edge Functions write with service role key.
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_job_postings_source ON public.job_postings(source);
CREATE INDEX idx_job_postings_status ON public.job_postings(status);
CREATE INDEX idx_job_postings_company ON public.job_postings(company_name);
CREATE INDEX idx_job_postings_discovered ON public.job_postings(discovered_at DESC);

-- ============================================================
-- JOB EVALUATIONS
-- ============================================================
CREATE TABLE public.job_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  skill_score INTEGER CHECK (skill_score BETWEEN 0 AND 100),
  experience_score INTEGER CHECK (experience_score BETWEEN 0 AND 100),
  seniority_score INTEGER CHECK (seniority_score BETWEEN 0 AND 100),
  location_score INTEGER CHECK (location_score BETWEEN 0 AND 100),
  technology_score INTEGER CHECK (technology_score BETWEEN 0 AND 100),
  reasoning TEXT,
  strengths TEXT[] DEFAULT '{}',
  gaps TEXT[] DEFAULT '{}',
  recommendation TEXT
    CHECK (recommendation IN ('strong_match', 'good_match', 'possible_match', 'weak_match', 'no_match')),
  passes_threshold BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, job_posting_id)
);

ALTER TABLE public.job_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evaluations"
  ON public.job_evaluations FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_evaluations_profile ON public.job_evaluations(profile_id);
CREATE INDEX idx_evaluations_job ON public.job_evaluations(job_posting_id);
CREATE INDEX idx_evaluations_score ON public.job_evaluations(overall_score DESC);

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_evaluation_id UUID REFERENCES public.job_evaluations(id),
  status TEXT DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'ready', 'approved', 'submitted', 'acknowledged',
      'screening', 'interviewing', 'offer', 'accepted', 'rejected',
      'withdrawn', 'skipped'
    )),
  cover_letter TEXT,
  application_answers JSONB DEFAULT '[]',
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  next_step TEXT,
  next_step_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(profile_id, job_posting_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own applications"
  ON public.applications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_applications_profile ON public.applications(profile_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_applications_job ON public.applications(job_posting_id);

-- ============================================================
-- RESUME VERSIONS
-- ============================================================
CREATE TABLE public.resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  job_posting_id UUID REFERENCES public.job_postings(id),
  content_json JSONB NOT NULL,
  content_markdown TEXT,
  file_url_pdf TEXT,
  file_url_docx TEXT,
  tailoring_notes TEXT,
  is_base BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own resume versions"
  ON public.resume_versions FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_resume_versions_profile ON public.resume_versions(profile_id);
CREATE INDEX idx_resume_versions_application ON public.resume_versions(application_id);

-- ============================================================
-- APPLICATION EVENTS
-- ============================================================
CREATE TABLE public.application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'materials_generated', 'approved', 'submitted',
      'response_received', 'interview_scheduled', 'interview_completed',
      'offer_received', 'accepted', 'rejected', 'withdrawn',
      'note_added', 'follow_up_sent', 'status_changed'
    )),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own application events"
  ON public.application_events FOR SELECT USING (
    application_id IN (
      SELECT id FROM public.applications WHERE profile_id = auth.uid()
    )
  );

CREATE INDEX idx_events_application ON public.application_events(application_id);
CREATE INDEX idx_events_created ON public.application_events(created_at DESC);

-- ============================================================
-- DISCOVERY RUNS (must come before pipeline_jobs due to FK)
-- ============================================================
CREATE TABLE public.discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  sources_scanned TEXT[] DEFAULT '{}',
  jobs_found INTEGER DEFAULT 0,
  jobs_new INTEGER DEFAULT 0,
  jobs_matched INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own discovery runs"
  ON public.discovery_runs FOR SELECT USING (profile_id = auth.uid());

CREATE INDEX idx_discovery_runs_profile ON public.discovery_runs(profile_id);
CREATE INDEX idx_discovery_runs_status ON public.discovery_runs(status);

-- ============================================================
-- PIPELINE JOBS (no restrictive RLS — managed by Edge Functions)
-- ============================================================
CREATE TABLE public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  discovery_run_id UUID REFERENCES public.discovery_runs(id) ON DELETE SET NULL,
  step TEXT NOT NULL
    CHECK (step IN ('pre_screen', 'evaluate', 'tailor', 'generate_materials', 'generate_files')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS enabled but no restrictive policies — managed by Edge Functions with service role key.
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pipeline_jobs_queue
  ON public.pipeline_jobs(status, next_retry_at, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_pipeline_jobs_profile ON public.pipeline_jobs(profile_id);
CREATE INDEX idx_pipeline_jobs_posting ON public.pipeline_jobs(job_posting_id);
CREATE INDEX idx_pipeline_jobs_status ON public.pipeline_jobs(status);

CREATE INDEX idx_pipeline_jobs_zombie
  ON public.pipeline_jobs(status, started_at)
  WHERE status = 'processing';
