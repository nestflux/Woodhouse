/**
 * Shared types for resume file generation (PDF + DOCX).
 * Mirrors the TailoredResume.resume_content structure from the tailoring agent.
 */

export interface ResumeHeader {
  full_name: string;
  headline: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
}

export interface ResumeExperience {
  source_id: string;
  company_name: string;
  job_title: string;
  location: string;
  start_date: string;
  end_date: string;
  achievements: Array<{
    source_id: string;
    text: string;
  }>;
}

export interface ResumeEducation {
  source_id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  dates: string;
}

export interface ResumeProject {
  source_id: string;
  name: string;
  description: string;
  technologies: string[];
}

export interface ResumeCertification {
  source_id: string;
  name: string;
  issuer: string;
}

export interface ResumeContent {
  header: ResumeHeader;
  summary: string;
  work_experience: ResumeExperience[];
  skills: string[];
  education: ResumeEducation[];
  projects?: ResumeProject[];
  certifications?: ResumeCertification[];
}
