import { z } from 'zod';
import { isDateKey } from './dates';

export const idSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const dateKeySchema = z
  .string()
  .refine(isDateKey, { message: 'Expected a YYYY-MM-DD date' });

/** Optional free-text field: trims, and treats an empty string as "not provided". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export interface ValidationIssue {
  path: string;
  message: string;
}

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** First validation message per field path, for inline display. */
export function issuesByField(issues: readonly ValidationIssue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    result[issue.path] ??= issue.message;
  }
  return result;
}
