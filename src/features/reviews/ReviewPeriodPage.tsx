import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Compass,
  Hourglass,
  ListTodo,
  PenLine,
  Sparkles,
  Sunrise,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import {
  getReviewForPeriod,
  listOpenActions,
  type ReviewWithActions,
} from '@/db/repositories/reviews';
import {
  NEXT_PERIOD_NAME,
  parsePeriod,
  PERIOD_NOUN,
  PERIOD_TYPES,
  periodContaining,
  periodLabel,
  shiftPeriod,
  type Period,
  type PeriodType,
} from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { getDailySummary, getRangeReport } from '@/services/analytics.service';
import { PERIOD_BADGE, reviewPath } from './format';
import { ItemReflections } from './ItemReflections';
import { OpenActionsList } from './OpenActionsList';
import { ReviewForm } from './ReviewForm';
import { DailySummaryView, RangeSummaryView } from './SummaryViews';

export function ReviewPeriodPage() {
  const { periodType, start } = useParams();
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();
  const resolvedStart = start === 'today' ? today : start;
  const period = useMemo(
    () => parsePeriod(periodType, resolvedStart, weekStartsOn),
    [periodType, resolvedStart, weekStartsOn],
  );

  if (!period) {
    return (
      <>
        <PageHeader title="Review not found" description="That review period isn’t valid." />
        <Link to="/review">Back to reviews</Link>
      </>
    );
  }
  if (period.start !== start) return <Navigate to={reviewPath(period)} replace />;
  return (
    <ReviewPeriodView
      key={`${period.type}:${period.start}`}
      period={period}
      today={today}
      weekStartsOn={weekStartsOn}
    />
  );
}

const RELATIVE: Record<PeriodType, readonly [string, string]> = {
  daily: ['Today', 'Yesterday'],
  weekly: ['This week', 'Last week'],
  monthly: ['This month', 'Last month'],
};

/** "Today", "Last week", and so on, when the period is the current or previous one. */
function relativeName(period: Period, today: string, weekStartsOn: number): string | undefined {
  const current = periodContaining(period.type, today, weekStartsOn);
  if (current.start === period.start) return RELATIVE[period.type][0];
  if (shiftPeriod(current, -1, weekStartsOn).start === period.start) {
    return RELATIVE[period.type][1];
  }
  return undefined;
}

function ReviewPeriodView({
  period,
  today,
  weekStartsOn,
}: {
  period: Period;
  today: string;
  weekStartsOn: 0 | 1;
}) {
  const previous = shiftPeriod(period, -1, weekStartsOn);
  const next = shiftPeriod(period, 1, weekStartsOn);
  const started = period.start <= today;
  const relative = relativeName(period, today, weekStartsOn);
  const short = { month: 'short', day: 'numeric' } as const;

  const existing = useLiveData(
    useCallback(() => getReviewForPeriod(period.type, period.start), [period]),
  );
  const previousReview = useLiveData(
    useCallback(
      () => getReviewForPeriod(previous.type, previous.start),
      [previous.type, previous.start],
    ),
  );
  const carried = useLiveData(useCallback(() => listOpenActions(period.start), [period.start]));

  return (
    <div className={`review-period review-period--${period.type}`}>
      <header className="review-hero">
        <div className="review-hero__bar">
          <Link to="/review" className="review-hero__icon-link" aria-label="All reviews">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <nav className="review-hero__switch" aria-label="Kind of review">
            {PERIOD_TYPES.map((type) => {
              const target = periodContaining(type, period.start, weekStartsOn);
              return (
                <Link
                  key={type}
                  to={reviewPath(target)}
                  className="review-hero__switch-link"
                  aria-current={type === period.type ? 'page' : undefined}
                >
                  {PERIOD_BADGE[type]}
                </Link>
              );
            })}
          </nav>
        </div>

        <p className="review-hero__eyebrow">
          {PERIOD_NOUN[period.type]}
          {relative && <span className="review-hero__relative">{relative}</span>}
        </p>
        <div className="review-hero__title-row">
          <h1 className="review-hero__title">{periodLabel(period)}</h1>
          <div className="pager review-hero__pager">
            <Link
              to={reviewPath(previous)}
              className="review-hero__icon-link"
              aria-label={`Previous: ${periodLabel(previous)}`}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
            {next.start <= today ? (
              <Link
                to={reviewPath(next)}
                className="review-hero__icon-link"
                aria-label={`Next: ${periodLabel(next)}`}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            ) : (
              <span
                className="review-hero__icon-link review-hero__icon-link--disabled"
                aria-hidden="true"
              >
                <ChevronRight size={20} />
              </span>
            )}
          </div>
        </div>
        {period.type !== 'daily' && (
          <p className="review-hero__range">
            {formatDateKey(period.start, undefined, short)} –{' '}
            {formatDateKey(period.end, undefined, short)}
            {started && today < period.end && (
              <span className="review-hero__live">
                <span className="review-hero__live-dot" aria-hidden="true" /> In progress
              </span>
            )}
          </p>
        )}
      </header>

      {!started ? (
        <EmptyState
          icon={Hourglass}
          title="Not here yet"
          description="This period hasn’t started yet."
        />
      ) : (
        <>
          {previousReview.status === 'ready' && previousReview.data.review?.focus && (
            <aside className="focus-card" aria-label="Your focus">
              <span className="focus-card__icon" aria-hidden="true">
                <Compass size={18} />
              </span>
              <div>
                <p className="focus-card__label">
                  Your focus for{' '}
                  {period.type === 'daily'
                    ? 'today'
                    : `this ${period.type === 'weekly' ? 'week' : 'month'}`}
                </p>
                <p className="focus-card__text preserve-lines">
                  {previousReview.data.review.focus}
                </p>
              </div>
            </aside>
          )}

          {period.type === 'daily' ? (
            <DailySummary date={period.start} today={today} weekStartsOn={weekStartsOn} />
          ) : (
            <RangeReportSection period={period} today={today} weekStartsOn={weekStartsOn} />
          )}

          {carried.status === 'ready' && carried.data.length > 0 && (
            <Section
              title="Still open from earlier"
              icon={ListTodo}
              meta={`${carried.data.length}`}
              description="Finish them, or turn them into tasks."
            >
              <OpenActionsList items={carried.data} today={today} />
            </Section>
          )}

          <Section
            title={period.type === 'daily' ? 'Plan for tomorrow' : 'Reflection'}
            icon={period.type === 'daily' ? Sunrise : PenLine}
            description={
              period.type === 'daily'
                ? 'One focus and a few next steps.'
                : 'Take a moment. Short answers are enough.'
            }
            className="section--plan"
          >
            <LiveView state={existing}>
              {/* Remount whenever the saved review or its actions change, so the draft always
                  starts from stored ids and statuses (e.g. after saving, or ticking an action
                  off elsewhere) and a later save can't resurrect stale values. */}
              {(data) => <ReviewForm key={versionKey(data)} period={period} existing={data} />}
            </LiveView>
          </Section>
          <p className="review-period__footnote">
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Your focus for {NEXT_PERIOD_NAME[period.type]} will appear at the top of the next{' '}
              {PERIOD_NOUN[period.type].toLowerCase()}.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function versionKey({ review, actions }: ReviewWithActions): string {
  return [review?.updatedAt ?? 'new', ...actions.map((a) => a.updatedAt)].join('|');
}

function DailySummary({
  date,
  today,
  weekStartsOn,
}: {
  date: string;
  today: string;
  weekStartsOn: number;
}) {
  const summary = useLiveData(
    useCallback(() => getDailySummary(date, today, weekStartsOn), [date, today, weekStartsOn]),
  );
  return (
    <LiveView state={summary}>
      {(data) => (
        <>
          <DailySummaryView summary={data} />
          <ItemReflections date={date} today={today} summary={data} />
        </>
      )}
    </LiveView>
  );
}

function RangeReportSection({
  period,
  today,
  weekStartsOn,
}: {
  period: Period;
  today: string;
  weekStartsOn: number;
}) {
  const report = useLiveData(
    useCallback(
      () =>
        getRangeReport(period.start, period.end, today, weekStartsOn, period.type === 'monthly'),
      [period, today, weekStartsOn],
    ),
  );
  return (
    <LiveView state={report}>{(data) => <RangeSummaryView report={data} today={today} />}</LiveView>
  );
}
