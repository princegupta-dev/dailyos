import { z } from 'zod';
import { timestampSchema, toValidationIssues, type ValidationIssue } from '@/lib/validation';
import { habitEntrySchema, habitSchema } from './habit';
import { learningEntrySchema } from './learning';
import { dailyPlanSchema, planItemSchema } from './plan';
import { reviewActionSchema, reviewSchema } from './review';
import { settingsSchema } from './settings';
import { taskEventSchema, taskSchema } from './task';

export const BACKUP_FORMAT = 'dailyos-backup';

/** Every stored table, parents before children (the order records are written in). */
export const BACKUP_TABLES = [
  'settings',
  'tasks',
  'taskEvents',
  'dailyPlans',
  'planItems',
  'habits',
  'habitEntries',
  'learningEntries',
  'reviews',
  'reviewActions',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_TABLE_LABELS: Record<BackupTable, string> = {
  settings: 'Settings',
  tasks: 'Tasks',
  taskEvents: 'Task history events',
  dailyPlans: 'Daily plans',
  planItems: 'Planned tasks',
  habits: 'Habits',
  habitEntries: 'Habit check-ins',
  learningEntries: 'Notes',
  reviews: 'Reviews',
  reviewActions: 'Review actions',
};

/** Tables can be missing from older backups (written before they existed); they default to empty. */
const backupDataSchema = z.object({
  settings: z.array(settingsSchema).max(1).default([]),
  tasks: z.array(taskSchema).default([]),
  taskEvents: z.array(taskEventSchema).default([]),
  dailyPlans: z.array(dailyPlanSchema).default([]),
  planItems: z.array(planItemSchema).default([]),
  habits: z.array(habitSchema).default([]),
  habitEntries: z.array(habitEntrySchema).default([]),
  learningEntries: z.array(learningEntrySchema).default([]),
  reviews: z.array(reviewSchema).default([]),
  reviewActions: z.array(reviewActionSchema).default([]),
});
export type BackupData = z.output<typeof backupDataSchema>;

const envelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { error: 'This isn’t a DailyOS backup file.' }),
  schemaVersion: z.number().int().min(1),
  exportedAt: timestampSchema,
  data: z.record(z.string(), z.unknown()),
});

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  /** Database schema version the data was exported from. */
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export type BackupCounts = Record<BackupTable, number>;

export function countRecords(data: BackupData): BackupCounts {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, data[t].length])) as BackupCounts;
}

export type BackupCheck =
  | { ok: true; backup: BackupFile; counts: BackupCounts }
  | { ok: false; message: string; issues: ValidationIssue[] };

/** Validation stops listing problems after this many; one is enough to reject the file. */
const MAX_ISSUES = 20;

function fail(message: string, issues: ValidationIssue[] = []): BackupCheck {
  return { ok: false, message, issues: issues.slice(0, MAX_ISSUES) };
}

/**
 * Brings records from an older schema version up to the current shape, mirroring the
 * database migrations (see db/schema.ts). Works on a copy; the input is never modified.
 */
function upgradeData(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  if (fromVersion >= 5) return data;
  // v5 added habit categories and tags on check-ins and notes, with these defaults.
  const withDefaults = (table: string, defaults: Record<string, unknown>) => {
    const rows: unknown = data[table];
    if (!Array.isArray(rows)) return rows;
    return rows.map((row: unknown) =>
      typeof row === 'object' && row !== null ? { ...defaults, ...row } : row,
    );
  };
  return {
    ...data,
    habits: withDefaults('habits', { category: 'other' }),
    habitEntries: withDefaults('habitEntries', { tags: [] }),
    learningEntries: withDefaults('learningEntries', { tags: [] }),
  };
}

/** Duplicate ids, duplicate natural keys, and references to records missing from the backup. */
function integrityIssues(data: BackupData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const unique = <T>(
    table: BackupTable,
    rows: readonly T[],
    key: (row: T) => string,
    what: string,
  ) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const k = key(row);
      if (seen.has(k))
        issues.push({ path: `data.${table}.${index}`, message: `Duplicate ${what}` });
      seen.add(k);
    });
  };
  for (const table of BACKUP_TABLES) {
    unique(table, data[table] as readonly { id: string }[], (r) => r.id, 'id');
  }
  unique('dailyPlans', data.dailyPlans, (p) => p.date, 'plan for the same date');
  unique(
    'habitEntries',
    data.habitEntries,
    (e) => `${e.habitId}|${e.date}`,
    'check-in for the same habit and date',
  );
  unique(
    'reviews',
    data.reviews,
    (r) => `${r.periodType}|${r.periodStart}`,
    'review for the same period',
  );

  const ids = (table: BackupTable) =>
    new Set((data[table] as readonly { id: string }[]).map((r) => r.id));
  const refs = <T>(
    table: BackupTable,
    rows: readonly T[],
    field: string,
    value: (row: T) => string | undefined,
    target: Set<string>,
    what: string,
  ) => {
    rows.forEach((row, index) => {
      const ref = value(row);
      if (ref !== undefined && !target.has(ref)) {
        issues.push({
          path: `data.${table}.${index}.${field}`,
          message: `Refers to a ${what} that isn’t in the backup`,
        });
      }
    });
  };
  const tasks = ids('tasks');
  refs('taskEvents', data.taskEvents, 'taskId', (e) => e.taskId, tasks, 'task');
  refs('planItems', data.planItems, 'planId', (i) => i.planId, ids('dailyPlans'), 'daily plan');
  refs('planItems', data.planItems, 'taskId', (i) => i.taskId, tasks, 'task');
  refs('habitEntries', data.habitEntries, 'habitId', (e) => e.habitId, ids('habits'), 'habit');
  refs(
    'reviewActions',
    data.reviewActions,
    'reviewId',
    (a) => a.reviewId,
    ids('reviews'),
    'review',
  );
  return issues;
}

/**
 * Checks a parsed backup file completely before anything is written: the envelope, the schema
 * version, every record against the same rules the app uses, and that records fit together.
 * A file with any problem is rejected as a whole.
 */
export function checkBackup(raw: unknown, currentSchemaVersion: number): BackupCheck {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) {
    const formatIssue = envelope.error.issues.find((i) => i.path[0] === 'format');
    return fail(
      formatIssue ? formatIssue.message : 'The backup file is incomplete or damaged.',
      toValidationIssues(envelope.error),
    );
  }
  const { schemaVersion, exportedAt } = envelope.data;
  if (schemaVersion > currentSchemaVersion) {
    return fail(
      'This backup was made by a newer version of DailyOS. Reload the app to update it, then try again.',
    );
  }
  const data = backupDataSchema.safeParse(upgradeData(envelope.data.data, schemaVersion));
  if (!data.success) {
    const issues = toValidationIssues(data.error).map((i) => ({ ...i, path: `data.${i.path}` }));
    return fail('Some records in the backup are invalid, so nothing was restored.', issues);
  }
  const integrity = integrityIssues(data.data);
  if (integrity.length > 0) {
    return fail(
      'Some records in the backup don’t fit together, so nothing was restored.',
      integrity,
    );
  }
  return {
    ok: true,
    backup: { format: BACKUP_FORMAT, schemaVersion, exportedAt, data: data.data },
    counts: countRecords(data.data),
  };
}

/** Parses the text of a backup file. Never throws: problems are returned as a failed check. */
export function parseBackupText(text: string, currentSchemaVersion: number): BackupCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('This file isn’t valid JSON. Choose a backup file exported from DailyOS.');
  }
  return checkBackup(raw, currentSchemaVersion);
}
