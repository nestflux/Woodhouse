import { z } from "zod";
import { ValidationError } from "./errors";

const ChangeSchema = z.object({
  section: z.string(),
  experience_index: z.number().nullable().optional(),
  bullet_index: z.number().nullable().optional(),
  field: z.string(),
  original: z.string(),
  improved: z.string(),
});

const ResumeContentSchema = z.object({
  header: z.object({
    full_name: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    linkedin_url: z.string().nullable().optional(),
    portfolio_url: z.string().nullable().optional(),
  }),
  summary: z.string(),
  work_experience: z.array(
    z.object({
      source_id: z.string().optional(),
      company_name: z.string(),
      job_title: z.string(),
      location: z.string().optional(),
      start_date: z.string(),
      end_date: z.string().optional(),
      achievements: z.array(
        z.object({
          source_id: z.string().optional(),
          text: z.string(),
        })
      ),
    })
  ),
  skills: z.array(z.string()),
  education: z.array(
    z.object({
      source_id: z.string().optional(),
      institution: z.string(),
      degree: z.string(),
      field_of_study: z.string().optional(),
      dates: z.string().optional(),
    })
  ),
  projects: z
    .array(
      z.object({
        source_id: z.string().optional(),
        name: z.string(),
        description: z.string(),
        technologies: z.array(z.string()).optional(),
      })
    )
    .optional(),
  certifications: z
    .array(
      z.object({
        source_id: z.string().optional(),
        name: z.string(),
        issuer: z.string(),
      })
    )
    .optional(),
});

export const ResumeImprovementSchema = z.object({
  improved_content: ResumeContentSchema,
  changes: z.array(ChangeSchema),
  change_summary: z.string(),
});

export type ResumeImprovement = z.infer<typeof ResumeImprovementSchema>;

export function validate(data: unknown): ResumeImprovement {
  const result = ResumeImprovementSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Resume improvement output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
