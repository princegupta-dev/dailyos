import { getSettings } from '@/db/repositories/settings';
import { DEFAULT_WEEK_STARTS_ON, type Settings } from '@/domain/settings';
import { getDeviceTimeZone } from '@/lib/dates';
import { useLiveData } from './useLiveData';
import { useLocalDateKey } from './useLocalDateKey';

/** Saved settings, or undefined while loading. */
export function useSettings(): Settings | undefined {
  const settings = useLiveData(getSettings);
  return settings.status === 'ready' ? settings.data : undefined;
}

/** The active time zone: the saved preference, or the device zone until settings load. */
export function useTimeZone(): string {
  return useSettings()?.timeZone ?? getDeviceTimeZone();
}

export function useWeekStartsOn(): 0 | 1 {
  return useSettings()?.weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
}

/** Today's local date key in the active time zone, kept fresh across midnight. */
export function useToday(): string {
  return useLocalDateKey(useTimeZone());
}
