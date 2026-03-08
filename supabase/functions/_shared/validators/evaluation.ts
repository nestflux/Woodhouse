import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

export const EvaluationSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  skill_score: z.number().int().min(0).max(100),
  experience_score: z.number().int().min(0).max(100),
  seniority_score: z.number().int().min(0).max(100),
  location_score: z.number().int().min(0).max(100),
  technology_score: z.number().int().min(0).max(100),
  recommendation: z.enum([
    "strong_match",
    "good_match",
    "possible_match",
    "weak_match",
    "no_match",
  ]),
  reasoning: z.string().min(50),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export function validate(data: unknown): Evaluation {
  const result = EvaluationSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Evaluation output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
