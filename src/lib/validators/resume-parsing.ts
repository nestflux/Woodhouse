import { z } from "zod";
import { ValidationError } from "./errors";

export const ResumeParsingSchema = z.object({
  full_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  portfolio_url: z.string().nullable().optional(),
  github_url: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  work_experiences: z
    .array(
      z.object({
        company_name: z.string(),
        job_title: z.string(),
        location: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        is_current: z.boolean().nullable().optional(),
        description: z.string().nullable().optional(),
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
        degree: z.string().nullable().optional(),
        field_of_study: z.string().nullable().optional(),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        gpa: z.number().nullable().optional(),
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
          .nullable()
          .optional(),
        years_experience: z.number().nullable().optional(),
      })
    )
    .optional(),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        technologies: z.array(z.string()).nullable().optional(),
      })
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: z.string().nullable().optional(),
        issue_date: z.string().nullable().optional(),
        expiry_date: z.string().nullable().optional(),
        credential_url: z.string().nullable().optional(),
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
