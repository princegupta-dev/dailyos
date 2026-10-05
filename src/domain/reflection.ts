import { z } from 'zod';
import { dateKeySchema, idSchema, optionalText, timestampSchema } from '@/lib/validation';

/** What a reflection is about. Each habit and each task gets its own, per date. */
export const REFLECTION_SUBJECT_TYPES = ['habit', 'task'] as const;
export type ReflectionSubjectType = (typeof REFLECTION_SUBJECT_TYPES)[number];

export interface ReflectionSubject {
  type: ReflectionSubjectType;
  id: string;
}

/**
 * A reflection on one habit or task for one date, written in the daily review. There is at
 * most one per subject and date; editing it updates that record in place.
 */
export const itemReflectionSchema = z.object({
  id: idSchema,
  subjectType: z.enum(REFLECTION_SUBJECT_TYPES),
  subjectId: idSchema,
  date: dateKeySchema,
  rating: z.number().int().min(1).max(5).optional(),
  /** "What went well today?" Absent means not answered. */
  wentWell: optionalText(2000),
  /** "What got in the way?" One per line feeds recurring blockers in weekly reviews. */
  gotInTheWay: optionalText(2000),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type ItemReflection = z.infer<typeof itemReflectionSchema>;

export const itemReflectionDraftSchema = z.object({
  rating: z.number().int().min(1, 'Rate from 1 to 5').max(5, 'Rate from 1 to 5').optional(),
  wentWell: optionalText(2000),
  gotInTheWay: optionalText(2000),
});
export type ItemReflectionDraft = z.input<typeof itemReflectionDraftSchema>;

/** True when a draft has nothing in it, so saving it means clearing the reflection. */
export function isEmptyReflection(draft: z.output<typeof itemReflectionDraftSchema>): boolean {
  return (
    draft.rating === undefined && draft.wentWell === undefined && draft.gotInTheWay === undefined
  );
}

/** Stable key for a subject on a date, e.g. for maps and React keys. */
export function reflectionKey(subject: ReflectionSubject): string {
  return `${subject.type}:${subject.id}`;
}
