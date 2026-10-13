import { addDays, formatDateKey, startOfWeek } from '@/lib/dates';

export interface WeekDay {
  date: string;
  /** Column fill, 0 to 1. */
  fraction: number;
  /** Spoken and hover description for the day, e.g. "Monday: 2 of 3 habits". */
  description: string;
  full?: boolean;
}

interface WeekStripProps {
  today: string;
  weekStartsOn: 0 | 1;
  /** Days up to today; later days render as empty, still-ahead columns. */
  days: readonly WeekDay[];
  label: string;
  tone?: 'primary' | 'warm';
}

/** Seven small columns, Monday (or Sunday) to Sunday, each filled by its day's share. */
export function WeekStrip({ today, weekStartsOn, days, label, tone = 'primary' }: WeekStripProps) {
  const start = startOfWeek(today, weekStartsOn);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <ol className={`week-strip week-strip--${tone}`} aria-label={label}>
      {week.map((date) => {
        const day = byDate.get(date);
        const future = date > today;
        const description =
          day?.description ?? `${formatDateKey(date, undefined, { weekday: 'long' })}: still ahead`;
        return (
          <li
            key={date}
            className={`week-strip__day${date === today ? ' week-strip__day--today' : ''}${future ? ' week-strip__day--future' : ''}${day?.full ? ' week-strip__day--full' : ''}`}
            aria-label={description}
            title={description}
          >
            <span className="week-strip__bar" aria-hidden="true">
              <span style={{ blockSize: `${Math.round((day?.fraction ?? 0) * 100)}%` }} />
            </span>
            <span className="week-strip__label" aria-hidden="true">
              {formatDateKey(date, undefined, { weekday: 'narrow' })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
