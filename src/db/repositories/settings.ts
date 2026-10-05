import { DEFAULT_WEEK_STARTS_ON, SETTINGS_ID, type Settings } from '@/domain/settings';
import { getDeviceTimeZone } from '@/lib/dates';
import { db } from '../database';
import { AppError, toAppError } from '../errors';

function defaults(): Settings {
  return {
    id: SETTINGS_ID,
    weekStartsOn: DEFAULT_WEEK_STARTS_ON,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Saved settings, or defaults before anything is saved. Read directly so live queries track it. */
export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(SETTINGS_ID)) ?? defaults();
}

export async function getActiveTimeZone(): Promise<string> {
  return (await getSettings()).timeZone ?? getDeviceTimeZone();
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface SettingsPatch {
  /** `null` returns to following the device time zone. */
  timeZone?: string | null;
  weekStartsOn?: 0 | 1;
  lastBackupAt?: string;
  /** Empty or `null` removes the name. */
  displayName?: string | null;
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  if (typeof patch.timeZone === 'string' && !isSupportedTimeZone(patch.timeZone)) {
    throw new AppError('validation', `Unknown time zone: ${patch.timeZone}`, {
      issues: [{ path: 'timeZone', message: 'Unknown time zone' }],
    });
  }
  const name = typeof patch.displayName === 'string' ? patch.displayName.trim() : undefined;
  if (name !== undefined && name.length > 40) {
    throw new AppError('validation', 'Use 40 characters or fewer', {
      issues: [{ path: 'displayName', message: 'Use 40 characters or fewer' }],
    });
  }
  try {
    return await db.transaction('rw', db.settings, async () => {
      const current = await getSettings();
      const next: Settings = { ...current, updatedAt: new Date().toISOString() };
      if (patch.timeZone === null) delete next.timeZone;
      else if (patch.timeZone !== undefined) next.timeZone = patch.timeZone;
      if (patch.weekStartsOn !== undefined) next.weekStartsOn = patch.weekStartsOn;
      if (patch.lastBackupAt !== undefined) next.lastBackupAt = patch.lastBackupAt;
      if (patch.displayName === null || name === '') delete next.displayName;
      else if (name !== undefined) next.displayName = name;
      await db.settings.put(next);
      return next;
    });
  } catch (error) {
    throw toAppError(error);
  }
}
