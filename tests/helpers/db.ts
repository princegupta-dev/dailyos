import { vi } from 'vitest';
import { db } from '@/db/database';
import { updateSettings } from '@/db/repositories/settings';

/** Fresh, empty database for each test. Only the fake (in-memory) IndexedDB is ever deleted. */
export async function resetDatabase(timeZone = 'UTC'): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
  await updateSettings({ timeZone });
}

/** Freezes `Date` only, leaving timers real so IndexedDB callbacks still run. */
export function setNow(iso: string): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}
