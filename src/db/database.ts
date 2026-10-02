import Dexie, { type Table } from 'dexie';
import type { Habit, HabitEntry } from '@/domain/habit';
import type { DailyPlan, PlanItem } from '@/domain/plan';
import type { Settings } from '@/domain/settings';
import type { Task, TaskEvent } from '@/domain/task';
import { AppError } from './errors';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS, type SchemaVersion } from './schema';

export const DATABASE_NAME = 'dailyos';

export class DailyOSDatabase extends Dexie {
  tasks!: Table<Task, string>;
  taskEvents!: Table<TaskEvent, string>;
  dailyPlans!: Table<DailyPlan, string>;
  planItems!: Table<PlanItem, string>;
  settings!: Table<Settings, string>;
  habits!: Table<Habit, string>;
  habitEntries!: Table<HabitEntry, string>;

  constructor(name = DATABASE_NAME, versions: readonly SchemaVersion[] = SCHEMA_VERSIONS) {
    super(name);
    for (const { version, stores, upgrade } of versions) {
      const declared = this.version(version).stores(stores);
      if (upgrade) declared.upgrade(upgrade);
    }
  }
}

export const db = new DailyOSDatabase();

/**
 * Opens the database and refuses to continue if it was created by a newer app version.
 * Dexie 4 would otherwise open it with the newer, unknown schema. The connection is closed
 * and nothing is modified, so the newer app's data stays intact until this app updates.
 */
export async function openWithVersionCheck(database: DailyOSDatabase = db): Promise<void> {
  await database.open();
  // Dexie stores schema version × 10 as the native IndexedDB version.
  const installed = database.backendDB().version / 10;
  if (installed > CURRENT_SCHEMA_VERSION) {
    database.close();
    throw new AppError(
      'version',
      'Your saved data was created by a newer version of DailyOS. Reload to update the app.',
    );
  }
}
