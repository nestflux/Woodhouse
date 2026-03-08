import { z } from "zod";
import { ValidationError } from "./errors";

const ApplicationAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  source: z.string(),
});

export const MaterialsSchema = z.object({
  cover_letter: z.string().min(1).nullable().optional(),
  why_interested: z.string().min(1),
  application_answers: z.array(ApplicationAnswerSchema).min(1),
});

export type Materials = z.infer<typeof MaterialsSchema>;

export function validate(data: unknown): Materials {
  const result = MaterialsSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `Materials output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
