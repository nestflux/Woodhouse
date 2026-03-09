import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

export const DiscoveryPostingSchema = z.object({
  external_id: z.string(),
  source: z.enum([
    "google_jobs",
    "jsearch",
    "jsearch_v2",
    "greenhouse",
    "lever",
    "workday",
    "manual",
    "email",
    "linkedin",
    "indeed",
    "other",
  ]),
  source_url: z.string().url(),
  company_name: z.string(),
  company_logo_url: z.string().url().optional().nullable(),
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
  description_structured: z.record(z.string(), z.unknown()).optional().nullable(),
  required_skills: z.array(z.string()).optional(),
  preferred_skills: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  application_url: z.string().optional().nullable(),
  application_method: z
    .enum(["url", "email", "api", "unknown"])
    .optional()
    .nullable(),
  posted_date: z.string().optional().nullable(),
  expires_date: z.string().optional().nullable(),
});

export const DiscoveryPostingsSchema = z.array(DiscoveryPostingSchema);

export type DiscoveryPosting = z.infer<typeof DiscoveryPostingSchema>;
export type DiscoveryPostings = z.infer<typeof DiscoveryPostingsSchema>;

export function validate(data: unknown): DiscoveryPostings {
  const result = DiscoveryPostingsSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `DiscoveryPostings output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
