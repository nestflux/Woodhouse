import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

export const JobParsingSchema = z.object({
  company_name: z.string(),
  job_title: z.string(),
  location: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  is_remote: z.boolean().optional(),
  job_type: z
    .enum(["full_time", "part_time", "contract", "freelance", "internship"])
    .optional()
    .nullable(),
  experience_level: z
    .enum(["entry", "mid", "senior", "lead", "director", "executive"])
    .optional()
    .nullable(),
  salary_min: z.number().int().optional().nullable(),
  salary_max: z.number().int().optional().nullable(),
  salary_currency: z.string().optional().nullable(),
  description_raw: z.string(),
  description_structured: z
    .object({
      about: z.string().optional(),
      responsibilities: z.array(z.string()).optional(),
      requirements: z.array(z.string()).optional(),
      preferred: z.array(z.string()).optional(),
      benefits: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
  required_skills: z.array(z.string()).optional(),
  preferred_skills: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  application_url: z.string().optional().nullable(),
  posted_date: z.string().optional().nullable(),
  expires_date: z.string().optional().nullable(),
});

export type JobParsing = z.infer<typeof JobParsingSchema>;

export function validate(data: unknown): JobParsing {
  const result = JobParsingSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `JobParsing output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
