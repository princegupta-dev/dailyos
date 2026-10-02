import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
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
  periodLabel,
  shiftPeriod,
  type Period,
} from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { getDailySummary, getRangeReport } from '@/services/analytics.service';
import { reviewPath } from './format';
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
    <>
      <PageHeader
        eyebrow={PERIOD_NOUN[period.type]}
        title={periodLabel(period)}
        actions={
          <div className="pager">
            <Link
              to={reviewPath(previous)}
              className="icon-button"
              aria-label={`Previous: ${periodLabel(previous)}`}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
            {next.start <= today ? (
              <Link
                to={reviewPath(next)}
                className="icon-button"
                aria-label={`Next: ${periodLabel(next)}`}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            ) : (
              <span className="icon-button icon-button--disabled" aria-hidden="true">
                <ChevronRight size={20} />
              </span>
            )}
          </div>
        }
      />

      {!started ? (
        <p className="muted">This period hasn’t started yet.</p>
      ) : (
        <>
          {previousReview.status === 'ready' && previousReview.data.review?.focus && (
            <div className="focus-callout">
              <p className="focus-callout__label">
                Your focus for{' '}
                {period.type === 'daily'
                  ? 'today'
                  : `this ${period.type === 'weekly' ? 'week' : 'month'}`}
              </p>
              <p className="preserve-lines">{previousReview.data.review.focus}</p>
            </div>
          )}

          {period.type === 'daily' ? (
            <DailySummary date={period.start} today={today} weekStartsOn={weekStartsOn} />
          ) : (
            <RangeReportSection period={period} today={today} weekStartsOn={weekStartsOn} />
          )}

          {carried.status === 'ready' && carried.data.length > 0 && (
            <Section title="Still open from earlier" meta={`${carried.data.length}`}>
              <OpenActionsList items={carried.data} today={today} />
            </Section>
          )}

          <Section title="Reflection">
            <LiveView state={existing}>
              {/* Remount whenever the saved review or its actions change, so the draft always
                  starts from stored ids and statuses (e.g. after saving, or ticking an action
                  off elsewhere) and a later save can't resurrect stale values. */}
              {(data) => <ReviewForm key={versionKey(data)} period={period} existing={data} />}
            </LiveView>
          </Section>
          <p className="muted small">
            Your focus for {NEXT_PERIOD_NAME[period.type]} will appear at the top of the next{' '}
            {PERIOD_NOUN[period.type].toLowerCase()}.
          </p>
        </>
      )}
    </>
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
      {(data) => <DailySummaryView summary={data} today={today} />}
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
