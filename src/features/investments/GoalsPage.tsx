import { CircleCheckBig, Goal, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { goalProgress, yearOf } from '@/services/finance.service';
import { plural } from '../reviews/format';
import { AddTile, GoalItem } from './FinanceCards';
import { useFinance } from './financeContext';

/** Yearly savings, investment, and spending targets with progress against the calendar. */
export function GoalsPage() {
  const { data, today, open } = useFinance();
  const thisYear = yearOf(today);
  const [year, setYear] = useState(thisYear);
  const years = [
    ...new Set([thisYear - 1, thisYear, thisYear + 1, ...data.goals.map((g) => g.year)]),
  ]
    .sort((a, b) => a - b)
    .filter((y) => y >= thisYear - 1 && y <= thisYear + 1);
  const progress = data.goals
    .filter((g) => g.year === year)
    .map((g) => goalProgress(g, data.entries, today));
  const good = progress.filter((p) => ['done', 'on_track', 'within'].includes(p.state)).length;
  const attention = progress.length - good;

  return (
    <div className="finance-stack">
      <div className="finance-toolbar">
        <SegmentedControl
          label="Year"
          value={String(year)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={(value) => {
            setYear(Number(value));
          }}
        />
        {progress.length > 0 && (
          <p className="finance-toolbar__summary">
            <span>
              <CircleCheckBig size={14} aria-hidden="true" /> {good} on track
            </span>
            {attention > 0 && (
              <span className="finance-toolbar__warn">
                <TriangleAlert size={14} aria-hidden="true" /> {attention} need attention
              </span>
            )}
          </p>
        )}
      </div>

      {progress.length === 0 ? (
        <>
          <EmptyState
            icon={Goal}
            title={`No goals for ${year}`}
            description="Set how much to save or invest this year, or a ceiling on spending. Progress follows what you record, with the amount needed each month."
          />
          <div className="finance-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                open({ type: 'goal', year });
              }}
            >
              Create a goal for {year}
            </button>
          </div>
        </>
      ) : (
        <Section
          title={`${year} goals`}
          icon={Goal}
          description={`${plural(progress.length, 'goal')}. The line on each bar marks how much of the time has passed.`}
          className="finance-card"
        >
          <div className="goal-list goal-list--wide">
            {progress.map((p) => (
              <GoalItem key={p.goal.id} progress={p} open={open} />
            ))}
            <AddTile
              label="Add a goal"
              onClick={() => {
                open({ type: 'goal', year });
              }}
            />
          </div>
        </Section>
      )}
    </div>
  );
}
