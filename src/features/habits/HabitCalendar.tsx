import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
  isActiveOn,
  isScheduledOn,
  WEEKDAY_SHORT,
  type Habit,
  type HabitEntry,
} from '@/domain/habit';
import {
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatDateKey,
  startOfMonth,
  startOfWeek,
} from '@/lib/dates';

type DayState =
  'completed' | 'skipped' | 'missed' | 'pending' | 'unscheduled' | 'future' | 'outside';

const STATE_LABEL: Record<DayState, string> = {
  completed: 'done',
  skipped: 'skipped',
  missed: 'missed',
  pending: 'not logged yet',
  unscheduled: 'not scheduled',
  future: 'upcoming',
  outside: '',
};

interface HabitCalendarProps {
  habit: Habit;
  entries: readonly HabitEntry[];
  today: string;
  weekStartsOn: number;
  /** Called for a scheduled day on or before today, to log or correct it. */
  onSelectDay?: ((date: string) => void) | undefined;
}

function dayState(
  habit: Habit,
  entry: HabitEntry | undefined,
  date: string,
  today: string,
): DayState {
  if (entry) return entry.status;
  if (date > today) return isScheduledOn(habit, date) ? 'future' : 'unscheduled';
  if (!isActiveOn(habit, date)) return 'unscheduled';
  // Weekly habits are judged per week, so an individual day without an entry isn't a miss.
  if (habit.frequency === 'weekly') return 'unscheduled';
  if (!isScheduledOn(habit, date)) return 'unscheduled';
  return date === today ? 'pending' : 'missed';
}

/** Month view. Unscheduled days are visually neutral so they never read as failures. */
export function HabitCalendar({
  habit,
  entries,
  today,
  weekStartsOn,
  onSelectDay,
}: HabitCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const first = startOfWeek(month, weekStartsOn);
  const last = addDays(startOfWeek(endOfMonth(month), weekStartsOn), 6);
  const days = eachDay(first, last);
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(weekStartsOn + i) % 7] ?? '');
  const canGoForward = addMonths(month, 1) <= startOfMonth(today);

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button
          type="button"
          className="icon-button icon-button--plain"
          aria-label="Previous month"
          onClick={() => {
            setMonth(addMonths(month, -1));
          }}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="calendar__title" aria-live="polite">
          {formatDateKey(month, undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <button
          type="button"
          className="icon-button icon-button--plain"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => {
            setMonth(addMonths(month, 1));
          }}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="calendar__grid" role="grid" aria-label="Habit calendar">
        <div className="calendar__row" role="row">
          {headers.map((h) => (
            <span key={h} className="calendar__weekday" role="columnheader">
              {h.slice(0, 2)}
            </span>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, week) => (
          <div key={week} className="calendar__row" role="row">
            {days.slice(week * 7, week * 7 + 7).map((date) => {
              const inMonth = date.slice(0, 7) === month.slice(0, 7);
              const state: DayState = inMonth
                ? dayState(habit, byDate.get(date), date, today)
                : 'outside';
              const selectable =
                inMonth && onSelectDay !== undefined && date <= today && isScheduledOn(habit, date);
              const label = `${formatDateKey(date)}${STATE_LABEL[state] ? `, ${STATE_LABEL[state]}` : ''}`;
              return (
                <span key={date} role="gridcell" className="calendar__cell">
                  {selectable ? (
                    <button
                      type="button"
                      className={`calendar__day calendar__day--${state}${date === today ? ' calendar__day--today' : ''}`}
                      aria-label={label}
                      onClick={() => {
                        onSelectDay(date);
                      }}
                    >
                      {Number(date.slice(8))}
                    </button>
                  ) : (
                    <span
                      className={`calendar__day calendar__day--${state}${date === today ? ' calendar__day--today' : ''}`}
                      aria-label={inMonth ? label : undefined}
                      aria-hidden={inMonth ? undefined : true}
                    >
                      {inMonth ? Number(date.slice(8)) : ''}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="calendar__legend" aria-label="Legend">
        <li>
          <span className="calendar__swatch calendar__day--completed" /> Done
        </li>
        <li>
          <span className="calendar__swatch calendar__day--skipped" /> Skipped
        </li>
        <li>
          <span className="calendar__swatch calendar__day--missed" /> Missed
        </li>
        <li>
          <span className="calendar__swatch calendar__day--unscheduled" /> Not scheduled
        </li>
      </ul>
      {onSelectDay && <p className="muted small">Tap a scheduled day to log or correct it.</p>}
    </div>
  );
}
