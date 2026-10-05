import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  History,
  ListChecks,
  Moon,
  NotebookPen,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  listOpenActions,
  listReviews,
  reviewedPeriods,
  type PastReview,
} from '@/db/repositories/reviews';
import {
  PERIOD_NOUN,
  periodContaining,
  periodLabel,
  shiftPeriod,
  type Period,
  type PeriodType,
} from '@/domain/review';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { OpenActionsList } from './OpenActionsList';
import { RatingPips } from './RatingPips';
import { formatRating, PERIOD_BADGE, plural, reviewPath } from './format';

const RECENT_LIMIT = 12;
const RHYTHM_DAYS = 7;
const listRecentReviews = () => listReviews(RECENT_LIMIT);
const listAllOpenActions = () => listOpenActions();

const PERIOD_ICON: Record<PeriodType, LucideIcon> = {
  daily: Sun,
  weekly: CalendarRange,
  monthly: CalendarDays,
};

const key = (p: Pick<Period, 'type' | 'start'>) => `${p.type}:${p.start}`;

type Filter = 'all' | PeriodType;
const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'daily', label: 'Days' },
  { value: 'weekly', label: 'Weeks' },
  { value: 'monthly', label: 'Months' },
];

export function ReviewPage() {
  const today = useToday();
  const weekStartsOn = useWeekStartsOn();

  const groups = useMemo(() => {
    const day = periodContaining('daily', today, weekStartsOn);
    const week = periodContaining('weekly', today, weekStartsOn);
    const month = periodContaining('monthly', today, weekStartsOn);
    return [
      {
        type: 'daily' as const,
        title: 'Days',
        hint: 'Each habit and task',
        items: [
          { label: 'Today', period: day },
          { label: 'Yesterday', period: shiftPeriod(day, -1, weekStartsOn) },
        ],
      },
      {
        type: 'weekly' as const,
        title: 'Weeks',
        hint: 'Wins, blockers, lessons',
        items: [
          { label: 'This week', period: week },
          { label: 'Last week', period: shiftPeriod(week, -1, weekStartsOn) },
        ],
      },
      {
        type: 'monthly' as const,
        title: 'Months',
        hint: 'The bigger picture',
        items: [
          { label: 'This month', period: month },
          { label: 'Last month', period: shiftPeriod(month, -1, weekStartsOn) },
        ],
      },
    ];
  }, [today, weekStartsOn]);

  // The last seven days, oldest first, for the rhythm strip.
  const rhythm = useMemo(() => {
    const day = periodContaining('daily', today, weekStartsOn);
    return Array.from({ length: RHYTHM_DAYS }, (_, i) =>
      shiftPeriod(day, i - (RHYTHM_DAYS - 1), weekStartsOn),
    );
  }, [today, weekStartsOn]);

  const done = useLiveData(
    useCallback(
      () => reviewedPeriods([...groups.flatMap((g) => g.items.map((i) => i.period)), ...rhythm]),
      [groups, rhythm],
    ),
  );
  const open = useLiveData(listAllOpenActions);
  const recent = useLiveData(listRecentReviews);
  const isDone = (p: Period) => done.status === 'ready' && done.data.has(key(p));

  return (
    <div className="reviews-page">
      <PageHero
        eyebrow={formatDateKey(today, undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title="Review"
        subtitle={
          <>
            Look back <em>kindly</em>, then decide what’s next.
          </>
        }
      />

      <div className="reviews-page__layout">
        <div className="reviews-page__main">
          <TonightCard
            today={today}
            rhythm={rhythm}
            ready={done.status === 'ready'}
            isDone={isDone}
          />

          <Section
            title="Reflect"
            icon={NotebookPen}
            description="Pick a period to look back on."
            className="reviews-page__reflect"
          >
            <div className="period-groups">
              {groups.map((group) => {
                const Icon = PERIOD_ICON[group.type];
                return (
                  <div key={group.type} className={`period-group period-group--${group.type}`}>
                    <div className="period-group__head">
                      <span className="period-group__icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span>
                        <span className="period-group__title">{group.title}</span>
                        <span className="period-group__hint">{group.hint}</span>
                      </span>
                    </div>
                    <ul className="period-group__list">
                      {group.items.map(({ label, period }) => {
                        const reviewed = isDone(period);
                        return (
                          <li key={label}>
                            <Link
                              to={reviewPath(period)}
                              className={`period-link${reviewed ? ' period-link--done' : ''}`}
                            >
                              <span className="period-link__label">{label}</span>
                              <span className="period-link__status">
                                {reviewed ? (
                                  <>
                                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                                    Reviewed
                                  </>
                                ) : (
                                  'Not reviewed'
                                )}
                              </span>
                              <ChevronRight
                                className="period-link__chevron"
                                size={16}
                                aria-hidden="true"
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="reviews-page__side">
          <Section
            title="Open actions"
            icon={ListChecks}
            meta={
              open.status === 'ready' && open.data.length > 0 ? `${open.data.length}` : undefined
            }
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

          <Section title="Past reviews" icon={History}>
            <LiveView state={recent}>
              {(reviews) =>
                reviews.length === 0 ? (
                  <EmptyState
                    icon={NotebookPen}
                    title="Your story starts tonight"
                    description="Saved reviews gather here, newest first, with how each one felt."
                  />
                ) : (
                  <PastReviews reviews={reviews} />
                )
              }
            </LiveView>
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Today's review as a dusk card, with the last seven days as a strip of dots. */
function TonightCard({
  today,
  rhythm,
  ready,
  isDone,
}: {
  today: string;
  rhythm: readonly Period[];
  ready: boolean;
  isDone: (p: Period) => boolean;
}) {
  const todayPeriod = rhythm[rhythm.length - 1];
  const reviewedToday = todayPeriod !== undefined && isDone(todayPeriod);
  const count = rhythm.filter(isDone).length;
  return (
    <section className="review-tonight" aria-labelledby="review-tonight-title">
      <p className="review-tonight__eyebrow">
        <Moon size={14} aria-hidden="true" /> Today’s review
      </p>
      <h2 id="review-tonight-title" className="review-tonight__title">
        {reviewedToday ? (
          <>
            Today is <em>reflected on</em>.
          </>
        ) : (
          <>
            How did today <em>really</em> go?
          </>
        )}
      </h2>
      <p className="review-tonight__copy">
        {reviewedToday
          ? 'Revisit it anytime, or look back on the week.'
          : 'Rate each habit and task, note what helped, then set tomorrow’s focus.'}
      </p>

      <div className="review-rhythm">
        <p className="review-rhythm__label">
          Last {RHYTHM_DAYS} days
          {ready && (
            <span className="review-rhythm__count">
              {count} of {RHYTHM_DAYS} reviewed
            </span>
          )}
        </p>
        <ol className="review-rhythm__days">
          {rhythm.map((p) => {
            const reviewed = isDone(p);
            const isToday = p.start === today;
            const name = formatDateKey(p.start, undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            });
            return (
              <li key={p.start}>
                <Link
                  to={reviewPath(p)}
                  className={`review-rhythm__day${reviewed ? ' review-rhythm__day--done' : ''}${isToday ? ' review-rhythm__day--today' : ''}`}
                  aria-label={`${name}: ${reviewed ? 'reviewed' : 'not reviewed'}`}
                >
                  <span className="review-rhythm__weekday" aria-hidden="true">
                    {formatDateKey(p.start, undefined, { weekday: 'narrow' })}
                  </span>
                  <span className="review-rhythm__dot" aria-hidden="true">
                    {reviewed && <Check size={12} strokeWidth={3} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <Link to={`/review/daily/${today}`} className="button button--light review-tonight__cta">
        {reviewedToday ? 'Open today’s review' : 'Start today’s review'}
        <ArrowRight className="review-tonight__arrow" size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}

/** Saved reviews, newest first, with a filter by kind and a small chart of recent ratings. */
function PastReviews({ reviews }: { reviews: readonly PastReview[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const types = new Set(reviews.map((r) => r.period.type));
  const shown = filter === 'all' ? reviews : reviews.filter((r) => r.period.type === filter);
  const options = FILTERS.filter((f) => f.value === 'all' || types.has(f.value));

  return (
    <>
      <RatingTrend reviews={reviews} />
      {types.size > 1 && (
        <SegmentedControl label="Show" value={filter} options={options} onChange={setFilter} />
      )}
      <ul className="past-reviews">
        {shown.map(({ period, rating, reflections }) => {
          const Icon = PERIOD_ICON[period.type];
          return (
            <li key={key(period)}>
              <Link to={reviewPath(period)} className={`past-review past-review--${period.type}`}>
                <span className="past-review__badge" aria-hidden="true">
                  <Icon size={16} />
                  <span>{PERIOD_BADGE[period.type]}</span>
                </span>
                <span className="past-review__text">
                  <span className="past-review__label">{periodLabel(period)}</span>
                  <span className="past-review__meta">
                    {PERIOD_NOUN[period.type]}
                    {reflections > 0 ? ` · ${plural(reflections, 'reflection')}` : ''}
                    {rating !== undefined ? ` · ${formatRating(rating)}/5` : ''}
                  </span>
                </span>
                {rating !== undefined && <RatingPips rating={rating} showValue={false} />}
                <ChevronRight className="past-review__chevron" size={16} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Ratings of recent daily reviews as slim bars, oldest to newest, with their average. */
function RatingTrend({ reviews }: { reviews: readonly PastReview[] }) {
  const rated = reviews
    .filter((r) => r.period.type === 'daily' && r.rating !== undefined)
    .slice()
    .reverse();
  if (rated.length < 2) return null;
  const average = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length;
  return (
    <figure className="rating-trend">
      <figcaption className="rating-trend__caption">
        <span>How your days felt</span>
        <span className="rating-trend__avg">
          avg <strong>{formatRating(Math.round(average * 10) / 10)}</strong>/5
        </span>
      </figcaption>
      <div
        className="rating-trend__bars"
        role="img"
        aria-label={`Recent day ratings, oldest to newest: ${rated
          .map((r) => formatRating(r.rating ?? 0))
          .join(', ')}`}
      >
        {rated.map((r) => (
          <span
            key={r.period.start}
            className="rating-trend__bar"
            title={`${formatDateKey(r.period.start, undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${formatRating(r.rating ?? 0)}/5`}
          >
            <span style={{ blockSize: `${((r.rating ?? 0) / 5) * 100}%` }} />
          </span>
        ))}
      </div>
    </figure>
  );
}
