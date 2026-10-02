import { Repeat } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getHabitsForDay } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useWeekStartsOn } from '@/hooks/useToday';
import { HabitStatusButtons } from './HabitStatusButtons';

export function TodayHabits({ today }: { today: string }) {
  const weekStartsOn = useWeekStartsOn();
  const habits = useLiveData(
    useCallback(() => getHabitsForDay(today, today, weekStartsOn), [today, weekStartsOn]),
  );

  const counted =
    habits.status === 'ready' ? habits.data.filter((h) => h.occurrence.status !== 'skipped') : [];
  const done = counted.filter((h) => h.occurrence.status === 'completed').length;

  return (
    <Section
      title="Habits"
      meta={counted.length > 0 ? `${done} of ${counted.length} done` : undefined}
    >
      <LiveView state={habits}>
        {(items) =>
          items.length === 0 ? (
            <>
              <EmptyState
                icon={Repeat}
                title="No habits for today"
                description="Habits you set up appear here on the days they're scheduled."
              />
              <Link
                to="/settings/habits/new"
                className="button button--secondary button--block section__action"
              >
                Set up a habit
              </Link>
            </>
          ) : (
            <ul className="habit-list">
              {items.map(({ habit, occurrence, entry, streak }) => {
                const doneEarlierThisWeek =
                  habit.frequency === 'weekly' &&
                  occurrence.status === 'completed' &&
                  entry?.status !== 'completed';
                return (
                  <li key={habit.id} className="habit-row">
                    <div className="habit-row__body">
                      <Link to={`/settings/habits/${habit.id}`} className="habit-row__name">
                        {habit.name}
                      </Link>
                      <p className="habit-row__meta">
                        {habit.frequency === 'weekly' ? 'This week' : 'Today'}
                        {doneEarlierThisWeek ? ' · done earlier this week' : ''}
                        {streak > 0
                          ? ` · ${streak} ${habit.frequency === 'weekly' ? 'week' : 'day'}${streak === 1 ? '' : 's'} in a row`
                          : ''}
                      </p>
                    </div>
                    <HabitStatusButtons
                      habitId={habit.id}
                      habitName={habit.name}
                      date={today}
                      current={entry?.status}
                    />
                  </li>
                );
              })}
            </ul>
          )
        }
      </LiveView>
    </Section>
  );
}
