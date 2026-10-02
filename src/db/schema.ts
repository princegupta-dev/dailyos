import type { Transaction } from 'dexie';

export interface SchemaVersion {
  version: number;
  /** Dexie store definitions. `null` deletes a store. Only changed stores need listing. */
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void>;
}

/**
 * Every IndexedDB schema version DailyOS has shipped. Versions are append-only: never edit a
 * released entry, add a new one instead, so existing installs migrate forward in order.
 *
 * Index syntax: first key is the primary key, `&` = unique, `[a+b]` = compound, `*` = multi-entry.
 */
export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      tasks: 'id, status, updatedAt, dueDate',
      taskEvents: 'id, taskId, localDate, type',
      dailyPlans: 'id, &date',
      planItems: 'id, planId, taskId, date, [taskId+date]',
      settings: 'id',
    },
  },
  {
    version: 2,
    stores: {
      habits: 'id, archivedAt',
      // Unique compound index: at most one entry per habit per date.
      habitEntries: 'id, &[habitId+date], habitId, date',
    },
  },
  {
    version: 3,
    stores: {
      // Multi-entry index lets a task find the learning entries that reference it.
      learningEntries: 'id, capturedAt, capturedDate, *relatedTaskIds',
    },
  },
  {
    version: 4,
    stores: {
      // Unique compound index: one review per period.
      reviews: 'id, &[periodType+periodStart], periodType, periodStart',
      reviewActions: 'id, reviewId, status',
    },
  },
  {
    // Habit-first redesign: categories, targets, activity logs, and tags. Additive only:
    // existing records gain defaults and nothing is removed or rewritten.
    version: 5,
    stores: {
      habitEntries: 'id, &[habitId+date], habitId, date, *tags',
      learningEntries: 'id, capturedAt, capturedDate, *relatedTaskIds, *tags',
    },
    upgrade: async (tx) => {
      await tx
        .table<{ category?: string }>('habits')
        .toCollection()
        .modify((habit) => {
          habit.category ??= 'other';
        });
      await tx
        .table<{ tags?: string[] }>('habitEntries')
        .toCollection()
        .modify((entry) => {
          entry.tags ??= [];
        });
      await tx
        .table<{ tags?: string[] }>('learningEntries')
        .toCollection()
        .modify((entry) => {
          entry.tags ??= [];
        });
    },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.at(-1)?.version ?? 0;
