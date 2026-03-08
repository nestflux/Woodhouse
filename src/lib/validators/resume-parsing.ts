import { z } from "zod";
import { ValidationError } from "./errors";

export const ResumeParsingSchema = z.object({
  full_name: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  github_url: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  work_experiences: z
    .array(
      z.object({
        company_name: z.string(),
        job_title: z.string(),
        location: z.string().optional(),
        country: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        is_current: z.boolean().optional(),
        description: z.string().optional(),
        achievements: z
          .array(
            z.object({
              description: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        field_of_study: z.string(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        gpa: z.number().optional(),
      })
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        category: z
          .enum([
            "technical",
            "soft",
            "language",
            "certification",
            "tool",
            "framework",
            "other",
          ])
          .optional(),
        proficiency: z
          .enum(["beginner", "intermediate", "advanced", "expert"])
          .optional(),
        years_experience: z.number().optional(),
      })
    )
    .optional(),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        url: z.string().optional(),
        technologies: z.array(z.string()).optional(),
      })
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().optional(),
        issue_date: z.string().optional(),
        expiry_date: z.string().optional(),
        credential_url: z.string().optional(),
      })
    )
    .optional(),
});

export type ResumeParsing = z.infer<typeof ResumeParsingSchema>;

export function validate(data: unknown): ResumeParsing {
  const result = ResumeParsingSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Resume parsing output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
