import { getSettings } from '@/db/repositories/settings';
import { getDeviceTimeZone } from '@/lib/dates';
import { useLiveData } from './useLiveData';
import { useLocalDateKey } from './useLocalDateKey';

/** The active time zone: the saved preference, or the device zone until settings load. */
export function useTimeZone(): string {
  const settings = useLiveData(getSettings);
  return (settings.status === 'ready' ? settings.data.timeZone : undefined) ?? getDeviceTimeZone();
}

/** Today's local date key in the active time zone, kept fresh across midnight. */
export function useToday(): string {
  return useLocalDateKey(useTimeZone());
}
