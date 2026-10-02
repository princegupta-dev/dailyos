import { db } from '@/db/database';
import { toAppError } from '@/db/errors';

/**
 * Opens IndexedDB and applies any pending schema migrations. Failing here (private browsing
 * restrictions, a newer schema from a future app version, a failed migration) is reported
 * to the caller; data is never deleted or reset to recover.
 */
export async function openDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    throw toAppError({ name: 'MissingAPIError' });
  }
  try {
    await db.open();
  } catch (error) {
    throw toAppError(error);
  }
}

/** Called when another tab upgrades the schema; this tab's connection is then closed. */
export function onDatabaseVersionChange(listener: () => void): () => void {
  const handler = () => {
    db.close();
    listener();
  };
  db.on('versionchange', handler);
  return () => {
    db.on('versionchange').unsubscribe(handler);
  };
}
