import type { ResumeParsing } from "@/lib/validators/resume-parsing";

/**
 * ResumeContent type — mirrors supabase/functions/_shared/file-generation/types.ts.
 * Defined here so the frontend doesn't import from Deno Edge Function code.
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
  achievements: Array<{ source_id: string; text: string }>;
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

/** Generate a random UUID for source_id. */
function generateId(): string {
  return crypto.randomUUID();
}

/** Format date range for education display. */
function formatDateRange(
  startDate?: string | null,
  endDate?: string | null
): string {
  const start = startDate ?? "";
  const end = endDate ?? "Present";
  if (!start && end === "Present") return "";
  return start ? `${start} - ${end}` : end;
}

/**
 * Convert the output of the parse-resume Edge Function into ResumeContent
 * suitable for storing in user_resumes.content.
 */
export function fromParsedResume(
  parsed: ResumeParsing,
  profileEmail: string
): ResumeContent {
  return {
    header: {
      full_name: parsed.full_name ?? "",
      headline: parsed.headline ?? "",
      email: profileEmail,
      phone: parsed.phone ?? null,
      location: parsed.location ?? null,
      linkedin_url: parsed.linkedin_url ?? null,
      portfolio_url: parsed.portfolio_url ?? null,
    },
    summary: parsed.summary ?? "",
    work_experience: (parsed.work_experiences ?? []).map((exp) => ({
      source_id: generateId(),
      company_name: exp.company_name,
      job_title: exp.job_title,
      location: exp.location ?? "",
      start_date: exp.start_date ?? "",
      end_date: exp.is_current ? "Present" : (exp.end_date ?? ""),
      achievements: (exp.achievements ?? []).map((ach) => ({
        source_id: generateId(),
        text: ach.description,
      })),
    })),
    skills: (parsed.skills ?? []).map((s) => s.name),
    education: (parsed.education ?? []).map((edu) => ({
      source_id: generateId(),
      institution: edu.institution,
      degree: edu.degree ?? "",
      field_of_study: edu.field_of_study ?? "",
      dates: formatDateRange(edu.start_date, edu.end_date),
    })),
    projects: (parsed.projects ?? []).map((proj) => ({
      source_id: generateId(),
      name: proj.name,
      description: proj.description ?? "",
      technologies: proj.technologies ?? [],
    })),
    certifications: (parsed.certifications ?? []).map((cert) => ({
      source_id: generateId(),
      name: cert.name,
      issuer: cert.issuer ?? "",
    })),
  };
}

/**
 * Convert knowledge base data (profile + related tables) into ResumeContent.
 */
export function fromKnowledgeBase(data: {
  profile: {
    email: string;
    full_name: string;
    headline?: string | null;
    summary?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin_url?: string | null;
    portfolio_url?: string | null;
  };
  workExperiences: Array<{
    id: string;
    company_name: string;
    job_title: string;
    location?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
    achievements: Array<{
      id: string;
      description: string;
    }>;
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    field_of_study: string;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  skills: Array<{
    name: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    description?: string | null;
    technologies?: string[] | null;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuing_organization?: string | null;
  }>;
}): ResumeContent {
  return {
    header: {
      full_name: data.profile.full_name,
      headline: data.profile.headline ?? "",
      email: data.profile.email,
      phone: data.profile.phone ?? null,
      location: data.profile.location ?? null,
      linkedin_url: data.profile.linkedin_url ?? null,
      portfolio_url: data.profile.portfolio_url ?? null,
    },
    summary: data.profile.summary ?? "",
    work_experience: data.workExperiences.map((exp) => ({
      source_id: exp.id,
      company_name: exp.company_name,
      job_title: exp.job_title,
      location: exp.location ?? "",
      start_date: exp.start_date ?? "",
      end_date: exp.is_current ? "Present" : (exp.end_date ?? ""),
      achievements: exp.achievements.map((ach) => ({
        source_id: ach.id,
        text: ach.description,
      })),
    })),
    skills: data.skills.map((s) => s.name),
    education: data.education.map((edu) => ({
      source_id: edu.id,
      institution: edu.institution,
      degree: edu.degree,
      field_of_study: edu.field_of_study,
      dates: formatDateRange(edu.start_date, edu.end_date),
    })),
    projects: data.projects.map((proj) => ({
      source_id: proj.id,
      name: proj.name,
      description: proj.description ?? "",
      technologies: proj.technologies ?? [],
    })),
    certifications: data.certifications.map((cert) => ({
      source_id: cert.id,
      name: cert.name,
      issuer: cert.issuing_organization ?? "",
    })),
  };
}
