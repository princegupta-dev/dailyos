import type { Transaction } from 'dexie';
import type { Account, FinanceEntry } from '@/domain/finance';
import {
  holdingToAccount,
  upgradeEntry,
  upgradeExpenseCategory,
  type LegacyEntry,
  type LegacyHolding,
} from '@/domain/financeMigration';

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
  {
    // Per-habit and per-task reflections in the daily review. New store only.
    version: 6,
    stores: {
      // Unique compound index: one reflection per habit or task per date.
      itemReflections: 'id, &[subjectType+subjectId+date], date',
    },
  },
  {
    // Personal finance: money movements, investment holdings, yearly goals, budgets, salary
    // history, and custom categories. New stores only.
    version: 7,
    stores: {
      financeEntries: 'id, date, kind, holdingId',
      holdings: 'id, type',
      financeGoals: 'id, year',
      // Unique compound index: one budget per period and category.
      budgets: 'id, &[period+category]',
      // Unique: one salary revision per start date.
      salaryRecords: 'id, &effectiveFrom',
      financeCategories: 'id, kind',
    },
  },
  {
    // Accounts & assets replace holdings; entries link to accounts; expense categories gain
    // groups; recurring payments. Holdings become investment accounts with the same ids, so
    // nothing is lost (see domain/financeMigration.ts). The old store is dropped in v9.
    version: 8,
    stores: {
      accounts: 'id, type',
      recurringRules: 'id, nextDue',
      financeEntries: 'id, date, kind, accountId, toAccountId, recurringId',
    },
    upgrade: async (tx) => {
      const holdings = await tx.table<LegacyHolding>('holdings').toArray();
      const entries = await tx.table<LegacyEntry>('financeEntries').toArray();
      await tx
        .table<Account>('accounts')
        .bulkAdd(holdings.map((h) => holdingToAccount(h, entries)));
      await tx.table<FinanceEntry>('financeEntries').bulkPut(entries.map(upgradeEntry));
      await tx
        .table<{ category: string }>('budgets')
        .toCollection()
        .modify((budget) => {
          budget.category = upgradeExpenseCategory(budget.category);
        });
    },
  },
  {
    version: 9,
    stores: { holdings: null },
  },
];

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.at(-1)?.version ?? 0;
