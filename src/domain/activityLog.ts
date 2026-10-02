import { z } from 'zod';
import type { HabitCategory } from './categories';

/**
 * Optional details a person can attach when completing a habit. Every field is optional;
 * completing a habit never requires opening this form.
 */
export interface LogField {
  key: string;
  label: string;
  kind: 'text' | 'longtext' | 'number' | 'select';
  unit?: string;
  options?: readonly string[];
  placeholder?: string;
}

const duration: LogField = { key: 'durationMin', label: 'Duration', kind: 'number', unit: 'min' };

export const LOG_FIELDS: Record<HabitCategory, readonly LogField[]> = {
  fitness: [
    {
      key: 'workout',
      label: 'Workout or muscle group',
      kind: 'text',
      placeholder: 'Push day, legs, 5 km run…',
    },
    duration,
    {
      key: 'details',
      label: 'Exercises, sets, reps',
      kind: 'longtext',
      placeholder: 'Bench 3×8 @ 60 kg…',
    },
  ],
  reading: [
    { key: 'book', label: 'Book', kind: 'text' },
    { key: 'pages', label: 'Pages read', kind: 'number', unit: 'pages' },
    duration,
    { key: 'idea', label: 'Interesting idea', kind: 'longtext' },
  ],
  engineering: [
    duration,
    { key: 'workedOn', label: 'What I worked on', kind: 'longtext' },
    { key: 'learned', label: 'What I learned', kind: 'longtext' },
    { key: 'built', label: 'What I built', kind: 'longtext' },
    { key: 'deep', label: 'What I understood deeply', kind: 'longtext' },
  ],
  dsa: [
    {
      key: 'problem',
      label: 'Problem',
      kind: 'text',
      placeholder: 'e.g. Binary Tree Level Order Traversal',
    },
    { key: 'topic', label: 'Topic', kind: 'text', placeholder: 'Trees, DP, graphs…' },
    { key: 'attempted', label: 'Approach attempted', kind: 'longtext' },
    { key: 'final', label: 'Final approach', kind: 'longtext' },
    { key: 'complexity', label: 'Complexity', kind: 'text', placeholder: 'O(n) time, O(h) space' },
    { key: 'explain', label: 'What I’d explain in an interview', kind: 'longtext' },
  ],
  career: [
    {
      key: 'kind',
      label: 'Type',
      kind: 'select',
      options: ['Application', 'Referral', 'Interview', 'Resume', 'Networking', 'Other'],
    },
    { key: 'outcome', label: 'Concrete outcome', kind: 'text' },
    { key: 'next', label: 'Next action', kind: 'text' },
  ],
  attention: [
    { key: 'screenMin', label: 'Screen or scrolling time', kind: 'number', unit: 'min' },
    {
      key: 'trigger',
      label: 'Trigger',
      kind: 'text',
      placeholder: 'Bored after lunch, phone on desk…',
    },
    { key: 'change', label: 'Environment change to try', kind: 'text' },
  ],
  other: [{ key: 'notes', label: 'Notes', kind: 'longtext' }],
};

/**
 * Stored log values. Keys aren't restricted to the current category's fields, so changing a
 * habit's category never invalidates or drops older logs.
 */
export const activityLogSchema = z
  .record(
    z.string().min(1).max(40),
    z.union([z.string().trim().max(5000), z.number().min(0).max(100_000)]),
  )
  .transform((log) =>
    Object.fromEntries(Object.entries(log).filter(([, v]) => !(typeof v === 'string' && v === ''))),
  );
export type ActivityLog = z.infer<typeof activityLogSchema>;

/** Label for a stored key, falling back to the key itself for fields from another category. */
export function logFieldLabel(key: string): string {
  for (const fields of Object.values(LOG_FIELDS)) {
    const field = fields.find((f) => f.key === key);
    if (field) return field.label;
  }
  return key;
}

export function logFieldUnit(key: string): string | undefined {
  for (const fields of Object.values(LOG_FIELDS)) {
    const field = fields.find((f) => f.key === key);
    if (field) return field.unit;
  }
  return undefined;
}

/** Concatenated text of a log, used for keyword suggestions and search. */
export function logText(log: ActivityLog | undefined): string {
  return Object.values(log ?? {})
    .filter((v): v is string => typeof v === 'string')
    .join('\n');
}
