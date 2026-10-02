import { z } from 'zod';
import { addDays } from '@/lib/dates';
import { dateKeySchema, idSchema, optionalText, timestampSchema } from '@/lib/validation';

export const LEARNING_FORMATS = ['quick', 'structured'] as const;
export type LearningFormat = (typeof LEARNING_FORMATS)[number];

export const reviewDateSchema = z.object({
  date: dateKeySchema,
  completedAt: timestampSchema.optional(),
});
export type ReviewDate = z.infer<typeof reviewDateSchema>;

/** Optional structured fields; filling any of them makes an entry "structured". */
export const STRUCTURED_FIELDS = [
  'explanation',
  'example',
  'questions',
  'application',
  'source',
] as const;
export type StructuredField = (typeof STRUCTURED_FIELDS)[number];

export const STRUCTURED_LABELS: Record<StructuredField, string> = {
  explanation: 'Explanation',
  example: 'Example',
  questions: 'Open questions',
  application: 'How I’ll apply it',
  source: 'Source',
};

const topicSchema = z
  .string()
  .trim()
  .max(60, 'Keep the topic under 60 characters')
  .transform((t) => t.replace(/\s+/g, ' '))
  .transform((t) => (t === '' ? undefined : t))
  .optional();

export const learningEntrySchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  format: z.enum(LEARNING_FORMATS),
  content: z.string().max(20_000),
  topic: topicSchema,
  explanation: optionalText(20_000),
  example: optionalText(20_000),
  questions: optionalText(5_000),
  application: optionalText(5_000),
  source: optionalText(500),
  relatedTaskIds: z.array(idSchema),
  capturedAt: timestampSchema,
  /** Local date of capture, for date filters that match the calendar the person saw. */
  capturedDate: dateKeySchema,
  updatedAt: timestampSchema,
  reviewDates: z.array(reviewDateSchema),
  archivedAt: timestampSchema.optional(),
});
export type LearningEntry = z.infer<typeof learningEntrySchema>;

const TITLE_FROM_CONTENT_MAX = 80;

/** First non-empty line of `content`, shortened, used when no title is given. */
export function titleFromContent(content: string): string {
  const line =
    content
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '') ?? '';
  return line.length > TITLE_FROM_CONTENT_MAX
    ? `${line.slice(0, TITLE_FROM_CONTENT_MAX - 1).trimEnd()}…`
    : line;
}

export const learningDraftSchema = z
  .object({
    title: z.string().trim().max(200, 'Keep the title under 200 characters').default(''),
    content: z.string().trim().max(20_000).default(''),
    topic: topicSchema,
    explanation: optionalText(20_000),
    example: optionalText(20_000),
    questions: optionalText(5_000),
    application: optionalText(5_000),
    source: optionalText(500),
    relatedTaskIds: z.array(idSchema).default([]),
    reviewDates: z
      .array(dateKeySchema)
      .default([])
      .refine((dates) => new Set(dates).size === dates.length, 'Review dates must be unique'),
  })
  .refine((d) => d.title !== '' || d.content !== '', {
    path: ['content'],
    message: 'Write something to capture',
  })
  .transform((d) => {
    const format: LearningFormat = STRUCTURED_FIELDS.some((f) => d[f] !== undefined)
      ? 'structured'
      : 'quick';
    return {
      ...d,
      title: d.title !== '' ? d.title : titleFromContent(d.content),
      relatedTaskIds: [...new Set(d.relatedTaskIds)],
      reviewDates: [...d.reviewDates].sort(),
      format,
    };
  });
export type LearningDraft = z.input<typeof learningDraftSchema>;

/** Spaced-repetition style suggestion: revisit after 1, 7, and 30 days. */
export function suggestReviewDates(from: string): string[] {
  return [1, 7, 30].map((days) => addDays(from, days));
}

/** Earliest incomplete review date that is due on or before `today`, if any. */
export function nextDueReview(
  entry: Pick<LearningEntry, 'reviewDates'>,
  today: string,
): string | undefined {
  return entry.reviewDates.find((r) => r.completedAt === undefined && r.date <= today)?.date;
}

export interface LearningFilter {
  text?: string | undefined;
  topic?: string | undefined;
  format?: LearningFormat | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

/** Case- and accent-insensitive form for matching ("Café" matches "cafe"). */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

const SEARCH_FIELDS = ['title', 'content', 'topic', ...STRUCTURED_FIELDS] as const;

/**
 * Filters entries in memory. A personal journal stays small enough (thousands of entries)
 * that scanning beats maintaining a full-text index in IndexedDB. Every search term must
 * appear somewhere in the entry. Results are newest first.
 */
export function filterLearning(
  entries: readonly LearningEntry[],
  filter: LearningFilter,
): LearningEntry[] {
  const terms = normalizeForSearch(filter.text ?? '')
    .split(/\s+/)
    .filter((t) => t !== '');
  const topic = filter.topic ? normalizeForSearch(filter.topic) : undefined;

  return entries
    .filter((entry) => {
      if (filter.format && entry.format !== filter.format) return false;
      if (filter.from && entry.capturedDate < filter.from) return false;
      if (filter.to && entry.capturedDate > filter.to) return false;
      if (topic !== undefined && normalizeForSearch(entry.topic ?? '') !== topic) return false;
      if (terms.length === 0) return true;
      const haystack = normalizeForSearch(SEARCH_FIELDS.map((f) => entry[f] ?? '').join('\n'));
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/** Distinct topics, merged case-insensitively, keeping the most recent spelling, A–Z. */
export function distinctTopics(entries: readonly LearningEntry[]): string[] {
  const byKey = new Map<string, { topic: string; at: string }>();
  for (const entry of entries) {
    if (!entry.topic) continue;
    const key = normalizeForSearch(entry.topic);
    const existing = byKey.get(key);
    if (!existing || entry.capturedAt > existing.at)
      byKey.set(key, { topic: entry.topic, at: entry.capturedAt });
  }
  return [...byKey.values()].map((t) => t.topic).sort((a, b) => a.localeCompare(b));
}
