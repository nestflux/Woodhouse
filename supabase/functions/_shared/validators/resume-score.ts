import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

const DimensionSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
});

const SuggestionSchema = z.object({
  section: z.enum([
    "work_experience",
    "summary",
    "skills",
    "education",
    "projects",
    "certifications",
    "header",
  ]),
  experience_index: z.number().nullable(),
  bullet_index: z.number().nullable(),
  original: z.string(),
  suggested: z.string(),
  reason: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});

export const ResumeScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  dimensions: z.object({
    ats_compatibility: DimensionSchema,
    content_quality: DimensionSchema,
    impact_metrics: DimensionSchema,
    brevity_clarity: DimensionSchema,
    keyword_optimization: DimensionSchema,
    section_completeness: DimensionSchema,
  }),
  suggestions: z.array(SuggestionSchema),
  general_feedback: z.array(z.string()),
});

export type ResumeScore = z.infer<typeof ResumeScoreSchema>;

export function validate(data: unknown): ResumeScore {
  const result = ResumeScoreSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Resume score output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
