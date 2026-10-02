import Dexie, { type Table } from 'dexie';
import type { DailyPlan, PlanItem } from '@/domain/plan';
import type { Settings } from '@/domain/settings';
import type { Task, TaskEvent } from '@/domain/task';
import { SCHEMA_VERSIONS, type SchemaVersion } from './schema';

export const DATABASE_NAME = 'dailyos';

export class DailyOSDatabase extends Dexie {
  tasks!: Table<Task, string>;
  taskEvents!: Table<TaskEvent, string>;
  dailyPlans!: Table<DailyPlan, string>;
  planItems!: Table<PlanItem, string>;
  settings!: Table<Settings, string>;

  constructor(name = DATABASE_NAME, versions: readonly SchemaVersion[] = SCHEMA_VERSIONS) {
    super(name);
    for (const { version, stores, upgrade } of versions) {
      const declared = this.version(version).stores(stores);
      if (upgrade) declared.upgrade(upgrade);
    }
  }
}

export const db = new DailyOSDatabase();
