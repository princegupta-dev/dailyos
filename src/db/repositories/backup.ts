import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  countRecords,
  parseBackupText,
  type BackupCheck,
  type BackupCounts,
  type BackupData,
  type BackupFile,
} from '@/domain/backup';
import { db } from '../database';
import { AppError } from '../errors';
import { CURRENT_SCHEMA_VERSION } from '../schema';
import { guard } from './internal';
import { updateSettings } from './settings';

/** Larger files are refused before parsing; a years-long history is a few megabytes. */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

const allTables = () => BACKUP_TABLES.map((t) => db.table(t));

/** Everything stored on this device, read in one consistent snapshot. */
export async function exportBackup(): Promise<BackupFile> {
  return guard(() =>
    db.transaction('r', allTables(), async () => {
      const entries = await Promise.all(
        BACKUP_TABLES.map(async (t) => [t, await db.table(t).toArray()] as const),
      );
      return {
        format: BACKUP_FORMAT,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: Object.fromEntries(entries) as BackupData,
      };
    }),
  );
}

/** Records the moment a backup was saved, shown in Settings as a reminder. */
export async function markBackupSaved(exportedAt: string): Promise<void> {
  await updateSettings({ lastBackupAt: exportedAt });
}

/** Validates a backup file's text. Never writes anything. */
export function readBackupText(text: string): BackupCheck {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, message: 'This file is too large to be a DailyOS backup.', issues: [] };
  }
  return parseBackupText(text, CURRENT_SCHEMA_VERSION);
}

export type RestoreMode = 'merge' | 'replace';

export interface MergePlan {
  /** Records from the backup that will be added. */
  add: BackupData;
  added: BackupCounts;
  /** Records already on this device (same id, or same day/period), which are kept as they are. */
  kept: BackupCounts;
}

/**
 * Merge keeps everything already on this device and adds only what's new. A record is "already
 * here" when its id exists, or when this device has its own plan for that date, check-in for
 * that habit and date, or review for that period. Children of a record that wasn't added
 * (plan items, review actions) are left out too, so nothing points at a missing parent.
 */
async function planMerge(data: BackupData): Promise<MergePlan> {
  const has = async (table: string) =>
    new Set((await db.table(table).toCollection().primaryKeys()) as string[]);
  const [localIds, planDates, entryKeys, reviewKeys] = await Promise.all([
    Promise.all(BACKUP_TABLES.map(async (t) => [t, await has(t)] as const)).then(
      (pairs) => new Map(pairs),
    ),
    db.dailyPlans.toArray().then((rows) => new Set(rows.map((p) => p.date))),
    db.habitEntries.toArray().then((rows) => new Set(rows.map((e) => `${e.habitId}|${e.date}`))),
    db.reviews
      .toArray()
      .then((rows) => new Set(rows.map((r) => `${r.periodType}|${r.periodStart}`))),
  ]);
  const isNew = (table: (typeof BACKUP_TABLES)[number], id: string) =>
    !(localIds.get(table)?.has(id) ?? false);

  const dailyPlans = data.dailyPlans.filter(
    (p) => isNew('dailyPlans', p.id) && !planDates.has(p.date),
  );
  const reviews = data.reviews.filter(
    (r) => isNew('reviews', r.id) && !reviewKeys.has(`${r.periodType}|${r.periodStart}`),
  );
  // A plan or review that already exists here under the same id still accepts its children.
  const planIds = new Set([...(localIds.get('dailyPlans') ?? []), ...dailyPlans.map((p) => p.id)]);
  const reviewIds = new Set([...(localIds.get('reviews') ?? []), ...reviews.map((r) => r.id)]);

  const add: BackupData = {
    settings: data.settings.filter((s) => isNew('settings', s.id)),
    tasks: data.tasks.filter((t) => isNew('tasks', t.id)),
    taskEvents: data.taskEvents.filter((e) => isNew('taskEvents', e.id)),
    dailyPlans,
    planItems: data.planItems.filter((i) => isNew('planItems', i.id) && planIds.has(i.planId)),
    habits: data.habits.filter((h) => isNew('habits', h.id)),
    habitEntries: data.habitEntries.filter(
      (e) => isNew('habitEntries', e.id) && !entryKeys.has(`${e.habitId}|${e.date}`),
    ),
    learningEntries: data.learningEntries.filter((e) => isNew('learningEntries', e.id)),
    reviews,
    reviewActions: data.reviewActions.filter(
      (a) => isNew('reviewActions', a.id) && reviewIds.has(a.reviewId),
    ),
  };
  const total = countRecords(data);
  const added = countRecords(add);
  const kept = Object.fromEntries(
    BACKUP_TABLES.map((t) => [t, total[t] - added[t]]),
  ) as BackupCounts;
  return { add, added, kept };
}

/** What a merge would add and keep, without writing anything. */
export async function previewMerge(backup: BackupFile): Promise<MergePlan> {
  return guard(() => db.transaction('r', allTables(), () => planMerge(backup.data)));
}

export interface RestoreResult {
  mode: RestoreMode;
  added: BackupCounts;
}

/**
 * Restores a checked backup in a single transaction: if anything fails, nothing on this device
 * changes. `replace` deletes everything first; `merge` only adds what's new (see planMerge).
 */
export async function restoreBackup(backup: BackupFile, mode: RestoreMode): Promise<RestoreResult> {
  if (backup.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new AppError('version', 'This backup was made by a newer version of DailyOS.');
  }
  return guard(() =>
    db.transaction('rw', allTables(), async () => {
      let records = backup.data;
      if (mode === 'replace') {
        await Promise.all(BACKUP_TABLES.map((t) => db.table(t).clear()));
      } else {
        records = (await planMerge(backup.data)).add;
      }
      for (const table of BACKUP_TABLES) {
        if (records[table].length > 0) await db.table(table).bulkAdd(records[table]);
      }
      return { mode, added: countRecords(records) };
    }),
  );
}
