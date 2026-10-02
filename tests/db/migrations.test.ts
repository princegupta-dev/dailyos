import { afterEach, describe, expect, it } from 'vitest';
import { DailyOSDatabase, openWithVersionCheck } from '@/db/database';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSIONS } from '@/db/schema';

const NAME = 'dailyos-migration-test';
const T = '2026-10-01T00:00:00.000Z';

afterEach(async () => {
  await new DailyOSDatabase(NAME).delete();
});

describe('schema migrations', () => {
  it('declares strictly increasing versions', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(CURRENT_SCHEMA_VERSION).toBe(versions.at(-1));
  });

  it.each(SCHEMA_VERSIONS.slice(0, -1).map((v) => v.version))(
    'upgrades from version %i to the current version without losing data',
    async (fromVersion) => {
      const old = new DailyOSDatabase(
        NAME,
        SCHEMA_VERSIONS.filter((v) => v.version <= fromVersion),
      );
      await old.open();
      await old.tasks.add({
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Written before the upgrade',
        description: '',
        status: 'todo',
        priority: 'medium',
        createdAt: T,
        updatedAt: T,
      });
      await old.settings.put({
        id: 'app',
        weekStartsOn: 0,
        timeZone: 'Europe/Berlin',
        updatedAt: T,
      });
      old.close();

      const current = new DailyOSDatabase(NAME);
      await current.open();
      expect(current.verno).toBe(CURRENT_SCHEMA_VERSION);
      expect((await current.tasks.toArray()).map((t) => t.title)).toEqual([
        'Written before the upgrade',
      ]);
      expect(await current.settings.get('app')).toMatchObject({
        weekStartsOn: 0,
        timeZone: 'Europe/Berlin',
      });
      // Stores added later exist and are usable.
      expect(await current.habits.count()).toBe(0);
      current.close();
    },
  );

  it('refuses to open a database created by a newer app version instead of resetting it', async () => {
    const future = new DailyOSDatabase(NAME, [
      ...SCHEMA_VERSIONS,
      { version: CURRENT_SCHEMA_VERSION + 1, stores: { futureStore: 'id' } },
    ]);
    await future.open();
    future.close();

    const current = new DailyOSDatabase(NAME);
    await expect(openWithVersionCheck(current)).rejects.toMatchObject({ kind: 'version' });
    expect(current.isOpen()).toBe(false);

    // The newer data is untouched.
    const check = new DailyOSDatabase(NAME, [
      ...SCHEMA_VERSIONS,
      { version: CURRENT_SCHEMA_VERSION + 1, stores: { futureStore: 'id' } },
    ]);
    await check.open();
    expect(check.tables.map((t) => t.name)).toContain('futureStore');
    check.close();
  });
});
