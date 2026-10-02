import { Check, ChevronRight, ListChecks } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { listOpenActions, listReviews, reviewedPeriods } from '@/db/repositories/reviews';
import {
  PERIOD_NOUN,
  periodContaining,
  periodLabel,
  shiftPeriod,
  type Period,
} from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { OpenActionsList } from './OpenActionsList';
import { reviewPath } from './format';

const RECENT_LIMIT = 12;
const listRecentReviews = () => listReviews(RECENT_LIMIT);
const listAllOpenActions = () => listOpenActions();

export function ReviewPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();

  const shortcuts = useMemo(() => {
    const day = periodContaining('daily', today, weekStartsOn);
    const week = periodContaining('weekly', today, weekStartsOn);
    const month = periodContaining('monthly', today, weekStartsOn);
    return [
      { label: 'Today', period: day },
      { label: 'Yesterday', period: shiftPeriod(day, -1, weekStartsOn) },
      { label: 'This week', period: week },
      { label: 'Last week', period: shiftPeriod(week, -1, weekStartsOn) },
      { label: 'This month', period: month },
      { label: 'Last month', period: shiftPeriod(month, -1, weekStartsOn) },
    ];
  }, [today, weekStartsOn]);

  const done = useLiveData(
    useCallback(() => reviewedPeriods(shortcuts.map((s) => s.period)), [shortcuts]),
  );
  const open = useLiveData(listAllOpenActions);
  const recent = useLiveData(listRecentReviews);
  const isDone = (p: Period) => done.status === 'ready' && done.data.has(`${p.type}:${p.start}`);

  return (
    <>
      <PageHeader
        title="Review"
        description="Compare what you planned with what happened, then decide what’s next."
      />

      <Section title="Reflect">
        <ul className="nav-list nav-list--grid">
          {shortcuts.map(({ label, period }) => (
            <li key={label}>
              <Link to={reviewPath(period)} className="nav-list__link">
                <span>
                  <span className="nav-list__label">{label}</span>
                  <span className="nav-list__meta">
                    {isDone(period) ? (
                      <>
                        <Check size={12} aria-hidden="true" /> Reviewed
                      </>
                    ) : (
                      'Not reviewed'
                    )}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Open actions"
        meta={open.status === 'ready' && open.data.length > 0 ? `${open.data.length}` : undefined}
      >
        <LiveView state={open}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No open actions"
                description="Next actions from your reviews stay here until you mark them done."
              />
            ) : (
              <OpenActionsList items={items} today={today} />
            )
          }
        </LiveView>
      </Section>

      <Section title="Past reviews">
        <LiveView state={recent}>
          {(reviews) =>
            reviews.length === 0 ? (
              <p className="muted small">Saved reviews will be listed here.</p>
            ) : (
              <ul className="nav-list">
                {reviews.map((r) => {
                  const period: Period = {
                    type: r.periodType,
                    start: r.periodStart,
                    end: r.periodEnd,
                  };
                  return (
                    <li key={r.id}>
                      <Link to={reviewPath(period)} className="nav-list__link">
                        <span>
                          <span className="nav-list__label">{periodLabel(period)}</span>
                          <span className="nav-list__meta">
                            {PERIOD_NOUN[r.periodType]}
                            {r.rating !== undefined ? ` · ${r.rating}/5` : ''}
                          </span>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </LiveView>
      </Section>
    </>
  );
}
