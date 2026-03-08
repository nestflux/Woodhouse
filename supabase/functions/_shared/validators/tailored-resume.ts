import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

const AchievementSchema = z.object({
  source_id: z.string().uuid(),
  text: z.string(),
});

const WorkExperienceSchema = z.object({
  source_id: z.string().uuid(),
  company_name: z.string(),
  job_title: z.string(),
  location: z.string().optional(),
  start_date: z.string(),
  end_date: z.string().optional(),
  achievements: z.array(AchievementSchema),
});

const HeaderSchema = z.object({
  full_name: z.string(),
  headline: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
});

const EducationSchema = z.object({
  source_id: z.string().uuid(),
  institution: z.string(),
  degree: z.string(),
  field_of_study: z.string().optional(),
  dates: z.string().optional(),
});

const ProjectSchema = z.object({
  source_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()).optional(),
});

const CertificationSchema = z.object({
  source_id: z.string().uuid(),
  name: z.string(),
  issuer: z.string(),
});

const ResumeContentSchema = z.object({
  header: HeaderSchema,
  summary: z.string(),
  work_experience: z.array(WorkExperienceSchema),
  skills: z.array(z.string()),
  education: z.array(EducationSchema),
  projects: z.array(ProjectSchema).optional(),
  certifications: z.array(CertificationSchema).optional(),
});

export const TailoredResumeSchema = z.object({
  resume_content: ResumeContentSchema,
  tailoring_notes: z.string(),
  content_markdown: z.string(),
});

export type TailoredResume = z.infer<typeof TailoredResumeSchema>;

export function validate(data: unknown): TailoredResume {
  const result = TailoredResumeSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `TailoredResume output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
