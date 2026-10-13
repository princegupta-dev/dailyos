import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  HeartHandshake,
  Minus,
  Percent,
  PiggyBank,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { formatDateKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { GroupChange } from '@/services/finance.service';
import { MoneyKpi } from '../investments/FinanceCards';
import { Meter } from '../investments/FinanceCharts';
import { percent } from '../reviews/format';
import type { InsightPeriod } from './insightsModel';
import {
  habitsAndMoneyStory,
  relativeChange,
  type HabitMoneyComparison,
  type MoneyPeriod,
} from './moneyInsights';

const short = { month: 'short', day: 'numeric' } as const;

/** "▲ 12% vs last week", worded so the good direction reads as good. */
function Change({
  now,
  before,
  name,
  lowerIsBetter = false,
}: {
  now: number;
  before: number;
  name: string;
  lowerIsBetter?: boolean;
}) {
  const change = relativeChange(now, before);
  if (change === null) return <>{now === 0 ? `None ${name}` : `New since ${name}`}</>;
  if (Math.abs(change) < 0.005) return <>Same as {name}</>;
  const up = change > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={`change change--${good ? 'good' : 'bad'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="visually-hidden">{up ? 'Up' : 'Down'}</span> {percent(Math.abs(change))} vs{' '}
      {name}
    </span>
  );
}

/** The period's money in four numbers, each compared with the period before. */
export function MoneyKpis({ money, period }: { money: MoneyPeriod; period: InsightPeriod }) {
  const { current, previous } = money;
  return (
    <section className="money-insights" aria-label={`Money, ${period.name}`}>
      <p className="finance-eyebrow">
        <Wallet size={13} aria-hidden="true" /> Money {period.name}
      </p>
      <dl className="kpis">
        <MoneyKpi
          icon={ShoppingBag}
          label="Spent"
          value={formatINR(current.expenses, { compact: true })}
          foot={
            <Change
              now={current.expenses}
              before={previous.expenses}
              name={period.prevName}
              lowerIsBetter
            />
          }
        />
        <MoneyKpi
          icon={ArrowDownLeft}
          label="Earned"
          value={formatINR(current.income, { compact: true })}
          foot={<Change now={current.income} before={previous.income} name={period.prevName} />}
        />
        <MoneyKpi
          icon={PiggyBank}
          label="Saved & invested"
          value={formatINR(current.saved + current.invested, { compact: true })}
          foot={
            <Change
              now={current.saved + current.invested}
              before={previous.saved + previous.invested}
              name={period.prevName}
            />
          }
        />
        <MoneyKpi
          icon={Percent}
          label="Savings rate"
          value={percent(current.savingsRate)}
          alert={current.savingsRate !== null && current.savingsRate < 0}
          foot={`${percent(previous.savingsRate)} ${period.prevName}`}
        />
      </dl>
    </section>
  );
}

/** Which spending groups grew or shrank compared with the period before. */
export function SpendingPatternCard({
  changes,
  period,
}: {
  changes: readonly GroupChange[];
  period: InsightPeriod;
}) {
  const rows = changes.slice(0, 6);
  return (
    <Section
      title="Spending patterns"
      icon={ShoppingBag}
      description={`By group, ${period.name} against ${period.prevName}.`}
      className="insights-card insights-spending"
      meta={<Link to="/investments/analysis">Analysis</Link>}
    >
      {rows.length === 0 ? (
        <p className="quiet-note">Record a few expenses to see where your money goes.</p>
      ) : (
        <ul className="spending-changes">
          {rows.map((c) => {
            const change = relativeChange(c.current, c.previous);
            // Under half a percent reads as no change, not as "+0%".
            const direction =
              change !== null && Math.abs(change) < 0.005
                ? 'flat'
                : c.change > 0
                  ? 'up'
                  : c.change < 0
                    ? 'down'
                    : 'flat';
            const Icon =
              direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
            return (
              <li key={c.category} className="spending-changes__row">
                <span className="spending-changes__label">{c.label}</span>
                <span className="spending-changes__amount">{formatINR(c.current)}</span>
                <span className={`spending-changes__delta spending-changes__delta--${direction}`}>
                  <Icon size={14} aria-hidden="true" />
                  {change === null
                    ? 'New'
                    : direction === 'flat'
                      ? 'Same'
                      : `${direction === 'up' ? '+' : '−'}${percent(Math.abs(change))}`}
                  <span className="visually-hidden">
                    {' '}
                    ({formatINR(c.previous)} {period.prevName})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/**
 * Habit consistency and spending, side by side for recent weeks, as two separate columns
 * (they're different measures, so they never share an axis).
 */
export function HabitsMoneyCard({ comparison }: { comparison: HabitMoneyComparison }) {
  const story = habitsAndMoneyStory(comparison);
  const weeks = comparison.weeks.slice(-8);
  const hasData = weeks.some((w) => w.habitRate !== null) && weeks.some((w) => w.spent > 0);
  return (
    <Section
      title="Habits & money"
      icon={HeartHandshake}
      description="Your two trackers, week by week."
      className="insights-card insights-habits-money"
    >
      {!hasData ? (
        <p className="quiet-note">
          With a few weeks of habits and spending recorded, you’ll see them side by side here.
        </p>
      ) : (
        <>
          <table className="habits-money">
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Habits</th>
                <th scope="col">Spent</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.from}>
                  <th scope="row">{formatDateKey(w.from, undefined, short)}</th>
                  <td>
                    <span className="habits-money__habit">
                      <Meter fraction={w.habitRate ?? 0} label={`Habits ${percent(w.habitRate)}`} />
                      <span>{percent(w.habitRate)}</span>
                    </span>
                  </td>
                  <td className="habits-money__spent">{formatINR(w.spent, { compact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {story && <p className="insights-note">{story}</p>}
        </>
      )}
    </Section>
  );
}
