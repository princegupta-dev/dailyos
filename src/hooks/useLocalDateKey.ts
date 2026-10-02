import { useEffect, useState } from 'react';
import { toLocalDateKey } from '@/lib/dates';

const RECHECK_INTERVAL_MS = 60_000;
const systemNow = () => new Date();

/**
 * The current local date key in `timeZone`, kept fresh while the app stays open across
 * midnight. Installed PWAs are often resumed rather than reloaded, so the key is also
 * recomputed whenever the page becomes visible again.
 */
export function useLocalDateKey(timeZone: string, now: () => Date = systemNow): string {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(now(), timeZone));

  useEffect(() => {
    const refresh = () => {
      setDateKey(toLocalDateKey(now(), timeZone));
    };
    refresh();
    const interval = window.setInterval(refresh, RECHECK_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [timeZone, now]);

  return dateKey;
}
