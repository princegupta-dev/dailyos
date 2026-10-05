import { Trophy } from 'lucide-react';
import { summarizeOccurrences, type Occurrence, type OccurrenceStatus } from '@/domain/habit';
import { formatDateKey } from '@/lib/dates';

const RECENT_SHOWN = 7;

const STATUS_TEXT: Record<OccurrenceStatus, string> = {
  completed: 'done',
  skipped: 'skipped',
  missed: 'missed',
  pending: 'not yet',
};

interface HabitInsightsProps {
  /** The habit's occurrences over the recent window, oldest first. */
  recent: readonly Occurrence[];
  weekly: boolean;
  longestStreak: number;
  /** Days the recent window covers, for the rate's label. */
  windowDays: number;
}

/**
 * A compact read of how a habit has been going: its last few occurrences as dots, its
 * completion rate over the recent window, and its best streak. Skipped occurrences never
 * count against the rate.
 */
export function HabitInsights({ recent, weekly, longestStreak, windowDays }: HabitInsightsProps) {
  const shown = recent.slice(-RECENT_SHOWN);
  const { rate } = summarizeOccurrences(recent);
  if (shown.length === 0 && longestStreak === 0) return null;

  const dotLabel = (o: Occurrence) =>
    weekly
      ? `Week of ${formatDateKey(o.start, undefined, { month: 'short', day: 'numeric' })}: ${STATUS_TEXT[o.status]}`
      : `${formatDateKey(o.start, undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${STATUS_TEXT[o.status]}`;

  return (
    <span className="habit-insights">
      {shown.length > 0 && (
        <span
          className="habit-insights__dots"
          role="img"
          aria-label={`Last ${shown.length} ${weekly ? 'weeks' : 'scheduled days'}: ${shown.map((o) => STATUS_TEXT[o.status]).join(', ')}`}
        >
          {shown.map((o) => (
            <span
              key={o.start}
              className={`habit-insights__dot habit-insights__dot--${o.status}`}
              title={dotLabel(o)}
            />
          ))}
        </span>
      )}
      {rate !== null && (
        <span className="habit-insights__rate">
          <strong>{Math.round(rate * 100)}%</strong> · {windowDays} days
        </span>
      )}
      {longestStreak > 1 && (
        <span className="habit-insights__best" title="Longest streak">
          <Trophy size={12} aria-hidden="true" />
          Best {longestStreak}
        </span>
      )}
    </span>
  );
}
