import { useEffect, useState } from 'react';

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

const RECHECK_INTERVAL_MS = 60_000;

export function dayPartAt(now: Date, timeZone: string): DayPart {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone })
      .formatToParts(now)
      .find((p) => p.type === 'hour')?.value ?? now.getHours(),
  );
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** The part of the day in `timeZone`, rechecked every minute while the page is open. */
export function useDayPart(timeZone: string): DayPart {
  const [part, setPart] = useState(() => dayPartAt(new Date(), timeZone));
  useEffect(() => {
    const refresh = () => {
      setPart(dayPartAt(new Date(), timeZone));
    };
    refresh();
    const interval = window.setInterval(refresh, RECHECK_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [timeZone]);
  return part;
}
