import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/database';
import {
  exportBackup,
  previewMerge,
  readBackupText,
  restoreBackup,
} from '@/db/repositories/backup';
import { createHabit, setHabitStatus } from '@/db/repositories/habits';
import { createLearningEntry } from '@/db/repositories/learning';
import { planTask, updatePlanDetails } from '@/db/repositories/plans';
import { saveItemReflection } from '@/db/repositories/reflections';
import { saveReview } from '@/db/repositories/reviews';
import { createTask } from '@/db/repositories/tasks';
import { CURRENT_SCHEMA_VERSION } from '@/db/schema';
import { BACKUP_TABLES, type BackupFile } from '@/domain/backup';
import { periodContaining } from '@/domain/review';
import { resetDatabase, setNow } from '../helpers/db';

const TODAY = '2026-10-02';

beforeEach(async () => {
  await resetDatabase('UTC');
  setNow(`${TODAY}T09:00:00Z`);
});

afterEach(() => {
  vi.useRealTimers();
});

/** One record in every table. */
async function seed(prefix = '') {
  const task = await createTask({ title: `${prefix}Write report` });
  await planTask(task.id, TODAY);
  await updatePlanDetails(TODAY, { intention: `${prefix}Calm focus` });
  const habit = await createHabit({
    name: `${prefix}Read`,
    category: 'reading',
    frequency: 'daily',
  });
  await setHabitStatus(habit.id, TODAY, 'completed', { amount: 20, tags: ['Books'] });
  await createLearningEntry({ title: `${prefix}Indexes`, content: 'B-trees', tags: ['MySQL'] });
  await saveReview(periodContaining('daily', TODAY, 1), {
    wins: `${prefix}Shipped`,
    actions: [{ title: `${prefix}Plan tomorrow` }],
  });
  await saveItemReflection({ type: 'habit', id: habit.id }, TODAY, {
    rating: 4,
    wentWell: `${prefix}Read before bed`,
  });
  await saveItemReflection({ type: 'task', id: task.id }, TODAY, {
    gotInTheWay: `${prefix}Meetings`,
  });
  return { task, habit };
}

/** Every table's records, sorted by id, for exact comparisons. */
async function snapshot() {
  const tables = await Promise.all(
    BACKUP_TABLES.map(async (t) => {
      const rows = (await db.table(t).toArray()) as { id: string }[];
      return [t, rows.sort((a, b) => a.id.localeCompare(b.id))] as const;
    }),
  );
  return Object.fromEntries(tables);
}

/** Exports and reads the file back exactly as the UI does. */
async function exportAndRead(): Promise<BackupFile> {
  const check = readBackupText(JSON.stringify(await exportBackup()));
  if (!check.ok) throw new Error(check.message);
  return check.backup;
}

describe('export', () => {
  it('includes every table and the current schema version', async () => {
    await seed();
    const backup = await exportBackup();

    expect(backup).toMatchObject({
      format: 'dailyos-backup',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-10-02T09:00:00.000Z',
    });
    for (const table of BACKUP_TABLES) {
      expect(backup.data[table].length, table).toBeGreaterThan(0);
    }
  });
});

describe('replace', () => {
  it('restores the device exactly as it was when the backup was made', async () => {
    await seed();
    const before = await snapshot();
    const backup = await exportAndRead();

    await seed('Later ');
    await restoreBackup(backup, 'replace');

    expect(await snapshot()).toEqual(before);
  });

  it('works on an empty device', async () => {
    await seed();
    const before = await snapshot();
    const backup = await exportAndRead();
    await resetDatabase('Asia/Kolkata');

    const result = await restoreBackup(backup, 'replace');
    expect(await snapshot()).toEqual(before);
    expect(result.added.habits).toBe(1);
  });

  it('changes nothing if writing fails partway', async () => {
    await seed();
    const before = await snapshot();
    const backup = await exportAndRead();
    // Bypass the file check to force a constraint error during the write.
    const broken: BackupFile = {
      ...backup,
      data: { ...backup.data, habits: [...backup.data.habits, ...backup.data.habits] },
    };

    await expect(restoreBackup(broken, 'replace')).rejects.toMatchObject({ kind: 'conflict' });
    expect(await snapshot()).toEqual(before);
  });
});

describe('merge', () => {
  it('keeps everything on this device and adds only what is new', async () => {
    const { habit } = await seed('Old ');
    const backup = await exportAndRead();
    await resetDatabase('UTC');

    // This device has its own records, including its own plan, check-in and review for today.
    const local = await seed('Mine ');
    const localSnapshot = await snapshot();

    const preview = await previewMerge(backup);
    const result = await restoreBackup(backup, 'merge');
    expect(result.added).toEqual(preview.added);

    const after = await snapshot();
    // Nothing that was already here changed.
    for (const table of BACKUP_TABLES) {
      for (const row of localSnapshot[table] ?? []) {
        expect(after[table]).toContainEqual(row);
      }
    }
    // New habits, tasks, notes and the old habit's check-in are added…
    expect(await db.habits.get(habit.id)).toBeDefined();
    expect(await db.habits.get(local.habit.id)).toBeDefined();
    expect(await db.habitEntries.count()).toBe(2);
    expect(await db.tasks.count()).toBe(2);
    expect(await db.learningEntries.count()).toBe(2);
    // Reflections are on different habits and tasks, so both devices' are kept.
    expect(await db.itemReflections.count()).toBe(4);
    // …but today's plan and review on this device win, and their children aren't orphaned.
    expect(result.added.dailyPlans).toBe(0);
    expect(result.added.planItems).toBe(0);
    expect(result.added.reviews).toBe(0);
    expect(result.added.reviewActions).toBe(0);
    expect(preview.kept.dailyPlans).toBe(1);
    expect((await db.dailyPlans.toArray())[0]?.intention).toBe('Mine Calm focus');
  });

  it('keeps this device’s reflection when the backup has one for the same habit and day', async () => {
    const { habit } = await seed();
    const backup = await exportAndRead();
    // Same habit and day, written again here under a new id.
    await saveItemReflection({ type: 'habit', id: habit.id }, TODAY, {});
    await saveItemReflection({ type: 'habit', id: habit.id }, TODAY, { wentWell: 'Mine' });
    backup.data.itemReflections = backup.data.itemReflections.filter(
      (r) => r.subjectType === 'habit',
    );

    const result = await restoreBackup(backup, 'merge');
    expect(result.added.itemReflections).toBe(0);
    const stored = await db.itemReflections.toArray();
    expect(stored.filter((r) => r.subjectId === habit.id).map((r) => r.wentWell)).toEqual(['Mine']);
  });

  it('adds nothing when restoring a backup of this same device', async () => {
    await seed();
    const before = await snapshot();
    const backup = await exportAndRead();

    const result = await restoreBackup(backup, 'merge');
    expect(Object.values(result.added).every((n) => n === 0)).toBe(true);
    expect(await snapshot()).toEqual(before);
  });
});

describe('checking a backup file', () => {
  const valid = async () => JSON.parse(JSON.stringify(await exportBackup())) as BackupFile;

  it('rejects files that are not DailyOS backups', () => {
    expect(readBackupText('not json')).toMatchObject({ ok: false, message: /valid JSON/ });
    expect(readBackupText('{"format":"other"}')).toMatchObject({
      ok: false,
      message: 'This isn’t a DailyOS backup file.',
    });
  });

  it('rejects backups from a newer version of the app', async () => {
    const file = await valid();
    file.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
    expect(readBackupText(JSON.stringify(file))).toMatchObject({
      ok: false,
      message: /newer version/,
    });
  });

  it('reports invalid records with their location', async () => {
    await seed();
    const file = await valid();
    (file.data.habits[0] as { name: string }).name = '';
    const check = readBackupText(JSON.stringify(file));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.issues[0]?.path).toBe('data.habits.0.name');
  });

  it('rejects duplicates and references to missing records', async () => {
    await seed();
    const file = await valid();
    file.data.habits = [];
    const orphan = readBackupText(JSON.stringify(file));
    expect(orphan).toMatchObject({ ok: false, message: /don’t fit together/ });
    if (!orphan.ok) expect(orphan.issues[0]?.path).toBe('data.habitEntries.0.habitId');

    const dup = await valid();
    dup.data.tasks.push(dup.data.tasks[0]!);
    expect(readBackupText(JSON.stringify(dup))).toMatchObject({ ok: false });
  });

  it('never writes when a file is rejected', async () => {
    await seed();
    const before = await snapshot();
    readBackupText('{"format":"dailyos-backup","schemaVersion":5}');
    expect(await snapshot()).toEqual(before);
  });

  it('upgrades a backup made before habit categories and tags existed', async () => {
    await seed();
    const file = await valid();
    file.schemaVersion = 4;
    for (const h of file.data.habits) delete (h as Partial<typeof h>).category;
    for (const e of file.data.habitEntries) delete (e as Partial<typeof e>).tags;
    delete (file.data as Partial<typeof file.data>).learningEntries;

    const check = readBackupText(JSON.stringify(file));
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.backup.data.habits[0]?.category).toBe('other');
      expect(check.backup.data.habitEntries[0]?.tags).toEqual([]);
      expect(check.backup.data.learningEntries).toEqual([]);
    }
  });
});
