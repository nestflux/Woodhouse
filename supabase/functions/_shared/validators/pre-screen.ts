import { z } from "npm:zod@3";
import { ValidationError } from "./errors.ts";

export const PreScreenSchema = z.object({
  pass: z.boolean(),
  reason: z.string(),
  disqualifiers: z.array(z.string()),
});

export type PreScreen = z.infer<typeof PreScreenSchema>;

export function validate(data: unknown): PreScreen {
  const result = PreScreenSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `PreScreen output invalid: ${result.error.message}`
    );
  }
  return result.data;
}
