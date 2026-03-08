-- E2-01: Core Profile Schema
-- Creates the 7 user profile and knowledge base tables.
-- Masterplan: §7 (Profiles, Work Experiences, Achievements, Education, Skills, Projects, Certifications)

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  country TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  headline TEXT,
  summary TEXT,
  target_roles TEXT[] DEFAULT '{}',
  target_locations TEXT[] DEFAULT '{}',
  target_countries TEXT[] DEFAULT '{}',
  remote_preference TEXT DEFAULT 'flexible'
    CHECK (remote_preference IN ('remote_only', 'hybrid', 'onsite', 'flexible')),
  min_salary INTEGER,
  max_salary INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  experience_years INTEGER,
  work_authorization TEXT,
  match_threshold INTEGER DEFAULT 70 CHECK (match_threshold BETWEEN 0 AND 100),
  cover_letter_enabled BOOLEAN DEFAULT TRUE,
  email_digest TEXT DEFAULT 'daily'
    CHECK (email_digest IN ('none', 'daily', 'weekly')),
  forwarding_address TEXT UNIQUE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- WORK EXPERIENCES
-- ============================================================
CREATE TABLE public.work_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT,
  country TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own work experiences"
  ON public.work_experiences FOR ALL USING (
    profile_id = auth.uid()
  );

CREATE INDEX idx_work_experiences_profile ON public.work_experiences(profile_id);

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_experience_id UUID NOT NULL REFERENCES public.work_experiences(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  metrics TEXT,
  skills TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own achievements"
  ON public.achievements FOR ALL USING (
    work_experience_id IN (
      SELECT id FROM public.work_experiences WHERE profile_id = auth.uid()
    )
  );

CREATE INDEX idx_achievements_work_experience ON public.achievements(work_experience_id);

-- ============================================================
-- EDUCATION
-- ============================================================
CREATE TABLE public.education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  gpa NUMERIC(3,2),
  achievements TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own education"
  ON public.education FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_education_profile ON public.education(profile_id);

-- ============================================================
-- SKILLS
-- ============================================================
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other'
    CHECK (category IN ('technical', 'soft', 'language', 'certification', 'tool', 'framework', 'other')),
  proficiency TEXT DEFAULT 'intermediate'
    CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  years_experience INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own skills"
  ON public.skills FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_skills_profile ON public.skills(profile_id);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  technologies TEXT[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  highlights TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON public.projects FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_projects_profile ON public.projects(profile_id);

-- ============================================================
-- CERTIFICATIONS
-- ============================================================
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuing_organization TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own certifications"
  ON public.certifications FOR ALL USING (profile_id = auth.uid());

CREATE INDEX idx_certifications_profile ON public.certifications(profile_id);
