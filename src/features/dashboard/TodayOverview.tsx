import { Repeat, Wallet, type LucideIcon } from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { getFinanceData } from '@/db/repositories/finance';
import { getHabitsForDay } from '@/db/repositories/habits';
import { useLiveData } from '@/hooks/useLiveData';
import { useWeekStartsOn } from '@/hooks/useToday';
import { addDays, formatDateKey, startOfWeek } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { liabilityIds, totalsOf, type FinanceData } from '@/services/finance.service';
import { WeekStrip, type WeekDay } from './WeekStrip';

/** This week's days so far, `weekStartsOn` to today. */
function daysSoFar(today: string, weekStartsOn: 0 | 1): string[] {
  const start = startOfWeek(today, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today);
}

const weekday = (date: string) => formatDateKey(date, undefined, { weekday: 'long' });

interface HabitWeek {
  /** Today's habits, weekly ones included. Skipped habits don't count. */
  done: number;
  total: number;
  days: WeekDay[];
}

/**
 * Today's habit tally plus each day of the week so far. Weekly habits are left out of the
 * day columns: they span the whole week, so counting them per day would repeat them.
 */
async function loadHabitWeek(today: string, weekStartsOn: 0 | 1): Promise<HabitWeek> {
  const counted = (date: string) =>
    getHabitsForDay(date, today, weekStartsOn).then((habits) =>
      habits.filter((h) => h.occurrence.status !== 'skipped'),
    );
  const dates = daysSoFar(today, weekStartsOn);
  const [todays, ...week] = await Promise.all([counted(today), ...dates.map(counted)]);
  const days = dates.map((date, i): WeekDay => {
    const daily = (week[i] ?? []).filter((h) => h.habit.frequency !== 'weekly');
    const done = daily.filter((h) => h.occurrence.status === 'completed').length;
    return {
      date,
      fraction: daily.length === 0 ? 0 : done / daily.length,
      full: daily.length > 0 && done === daily.length,
      description:
        daily.length === 0
          ? `${weekday(date)}: no habits scheduled`
          : `${weekday(date)}: ${done} of ${daily.length} habits`,
    };
  });
  return {
    done: todays.filter((h) => h.occurrence.status === 'completed').length,
    total: todays.length,
    days,
  };
}

/** Spending per day this week so far, scaled against the week's biggest day. */
function spendingWeek(data: FinanceData, today: string, weekStartsOn: 0 | 1) {
  const liabilities = liabilityIds(data.accounts);
  const spent = daysSoFar(today, weekStartsOn).map((date) => ({
    date,
    amount: totalsOf(
      data.entries.filter((e) => e.date === date),
      liabilities,
    ).expenses,
  }));
  const max = Math.max(0, ...spent.map((d) => d.amount));
  const days = spent.map(({ date, amount }): WeekDay => ({
    date,
    fraction: max === 0 ? 0 : amount / max,
    description: `${weekday(date)}: ${formatINR(amount)} spent`,
  }));
  return { total: spent.reduce((sum, d) => sum + d.amount, 0), days };
}

/** The day at a glance: habits and spending, each with this week day by day. */
export function TodayOverview({ today }: { today: string }) {
  const weekStartsOn = useWeekStartsOn();
  const habits = useLiveData(
    useCallback(() => loadHabitWeek(today, weekStartsOn), [today, weekStartsOn]),
  );
  const finance = useLiveData(getFinanceData);

  return (
    <section className="glance" aria-label="Today at a glance">
      <Tile icon={Repeat} title="Habits" tone="primary">
        {habits.status === 'ready' ? (
          <>
            <p className="glance__value">
              {habits.data.total === 0 ? (
                <span className="glance__muted">None today</span>
              ) : (
                <span
                  role="img"
                  aria-label={`${habits.data.done} of ${habits.data.total} habits done today`}
                >
                  {habits.data.done}
                  <span className="glance__muted">/{habits.data.total}</span>
                </span>
              )}
              <span className="glance__unit">today</span>
            </p>
            <WeekStrip
              today={today}
              weekStartsOn={weekStartsOn}
              days={habits.data.days}
              label="Habits this week, day by day"
            />
          </>
        ) : (
          <TileSkeleton failed={habits.status === 'error'} />
        )}
      </Tile>

      <Tile icon={Wallet} title="Money" tone="warm">
        {finance.status === 'ready' ? (
          <MoneyGlance data={finance.data} today={today} weekStartsOn={weekStartsOn} />
        ) : (
          <TileSkeleton failed={finance.status === 'error'} />
        )}
      </Tile>
    </section>
  );
}

function MoneyGlance({
  data,
  today,
  weekStartsOn,
}: {
  data: FinanceData;
  today: string;
  weekStartsOn: 0 | 1;
}) {
  const week = spendingWeek(data, today, weekStartsOn);
  return (
    <>
      <p className="glance__value">
        {formatINR(week.total, { compact: true })}
        <span className="glance__unit">spent this week</span>
      </p>
      <WeekStrip
        today={today}
        weekStartsOn={weekStartsOn}
        days={week.days}
        label="Spending this week, day by day"
        tone="warm"
      />
    </>
  );
}

interface TileProps {
  icon: LucideIcon;
  title: string;
  tone: 'primary' | 'warm';
  children: ReactNode;
}

function Tile({ icon: Icon, title, tone, children }: TileProps) {
  return (
    <div className={`glance__tile glance__tile--${tone}`}>
      <p className="glance__title">
        <Icon size={14} aria-hidden="true" />
        {title}
      </p>
      {children}
    </div>
  );
}

function TileSkeleton({ failed }: { failed: boolean }) {
  if (failed) return <p className="glance__muted">Couldn’t load this right now.</p>;
  return (
    <>
      <span className="visually-hidden" role="status">
        Loading…
      </span>
      <div className="skeleton skeleton--line" aria-hidden="true" />
      <div className="skeleton glance__skeleton-chart" aria-hidden="true" />
    </>
  );
}
