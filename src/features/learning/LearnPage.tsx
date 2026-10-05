import {
  BookMarked,
  CalendarClock,
  Lightbulb,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHero } from '@/components/PageHero';
import { ProgressRing } from '@/components/ProgressRing';
import { Section } from '@/components/Section';
import { listDueReviews, searchLearning } from '@/db/repositories/learning';
import {
  LEARNING_FORMATS,
  type LearningEntry,
  type LearningFilter,
  type LearningFormat,
} from '@/domain/learning';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday, useWeekStartsOn } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { inlineDayLabel } from '@/lib/format';
import { capturesByWeek, topicCounts, topicTone } from './learningInsights';
import { LearningListItem } from './LearningListItem';

const FILTER_KEYS = ['q', 'topic', 'format', 'from', 'to'] as const;
const CHART_WEEKS = 12;
const TOPICS_SHOWN = 8;
const listAllLearning = () => searchLearning({});

function isFormat(value: string | null): value is LearningFormat {
  return LEARNING_FORMATS.some((f) => f === value);
}

export function LearnPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const topic = params.get('topic') ?? '';
  const rawFormat = params.get('format');
  const format = isFormat(rawFormat) ? rawFormat : undefined;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const archived = params.get('archived') === '1';
  const filtering = FILTER_KEYS.some((k) => params.get(k));
  const advanced = ['format', 'from', 'to'].filter((k) => params.get(k)).length;

  const results = useLiveData(
    useCallback(() => {
      const filter: LearningFilter = {
        text: q || undefined,
        topic: topic || undefined,
        format,
        from: from || undefined,
        to: to || undefined,
      };
      return searchLearning(filter, archived);
    }, [q, topic, format, from, to, archived]),
  );
  const all = useLiveData(listAllLearning);
  const due = useLiveData(useCallback(() => listDueReviews(today), [today]));
  const allEntries = all.status === 'ready' ? all.data.entries : [];
  const topics = topicCounts(allEntries);

  const setParam = (key: string, value: string) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === '') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="learn-page">
      <PageHero
        eyebrow="Your knowledge journal"
        title="Learn"
        subtitle={
          <>
            Capture it once, <em>remember it</em> for good.
          </>
        }
        actions={
          <Link to="/learn/new" className="hero-cta" aria-label="New entry">
            <Plus size={20} aria-hidden="true" />
            <span className="hero-cta__label">New entry</span>
          </Link>
        }
      />

      <div className="learn-page__layout">
        {allEntries.length > 0 && (
          <aside className="learn-page__side" aria-label="Your learning at a glance">
            <LearningMomentum
              entries={allEntries}
              today={today}
              dueCount={due.status === 'ready' ? due.data.length : 0}
            />
          </aside>
        )}

        <div className="learn-page__main">
          {due.status === 'ready' && due.data.length > 0 && !archived && (
            <Section
              title="Due for review"
              icon={CalendarClock}
              description="A quick look back helps it stick."
              meta={`${due.data.length}`}
              className="learn-due"
            >
              <ul className="learning-list">
                {due.data.map(({ entry, due: date }) => (
                  <LearningListItem
                    key={entry.id}
                    entry={entry}
                    today={today}
                    note={`Review due ${inlineDayLabel(date, today)}`}
                  />
                ))}
              </ul>
            </Section>
          )}

          <div className="search-bar" role="search">
            <Search className="search-bar__icon" size={18} aria-hidden="true" />
            <label className="visually-hidden" htmlFor="learn-search">
              Search learning
            </label>
            <input
              id="learn-search"
              type="search"
              className="input search-bar__input"
              placeholder="Search your notes…"
              value={q}
              onChange={(e) => {
                setParam('q', e.target.value);
              }}
            />
            {q && (
              <button
                type="button"
                className="search-bar__clear"
                aria-label="Clear search"
                onClick={() => {
                  setParam('q', '');
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          {topics.length > 0 && !archived && (
            <div className="topic-chips" role="group" aria-label="Filter by topic">
              <button
                type="button"
                className="topic-chip"
                aria-pressed={topic === ''}
                onClick={() => {
                  setParam('topic', '');
                }}
              >
                All
              </button>
              {topics.slice(0, TOPICS_SHOWN).map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  className={`topic-chip topic-chip--${topicTone(t.topic)}`}
                  aria-pressed={topic === t.topic}
                  onClick={() => {
                    setParam('topic', topic === t.topic ? '' : t.topic);
                  }}
                >
                  {t.topic}
                  <span className="topic-chip__count">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          <LiveView state={results}>
            {({ entries, topics: topicNames, total }) => (
              <>
                <details className="disclosure filters" open={filtering && q === ''}>
                  <summary className="disclosure__summary">
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    Filters
                    {advanced > 0 && (
                      <span className="filters__badge">
                        {advanced}
                        <span className="visually-hidden"> active</span>
                      </span>
                    )}
                  </summary>
                  <div className="filters__grid">
                    <div className="field">
                      <label className="field__label" htmlFor="filter-topic">
                        Topic
                      </label>
                      <select
                        id="filter-topic"
                        className="input input--select"
                        value={topic}
                        onChange={(e) => {
                          setParam('topic', e.target.value);
                        }}
                      >
                        <option value="">All topics</option>
                        {topicNames.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="filter-format">
                        Format
                      </label>
                      <select
                        id="filter-format"
                        className="input input--select"
                        value={format ?? ''}
                        onChange={(e) => {
                          setParam('format', e.target.value);
                        }}
                      >
                        <option value="">Any</option>
                        <option value="quick">Quick notes</option>
                        <option value="structured">Detailed notes</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="filter-from">
                        From
                      </label>
                      <input
                        id="filter-from"
                        type="date"
                        className="input"
                        value={from}
                        onChange={(e) => {
                          setParam('from', e.target.value);
                        }}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="filter-to">
                        To
                      </label>
                      <input
                        id="filter-to"
                        type="date"
                        className="input"
                        value={to}
                        onChange={(e) => {
                          setParam('to', e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={archived}
                      onChange={(e) => {
                        setParam('archived', e.target.checked ? '1' : '');
                      }}
                    />
                    Show archived entries instead
                  </label>
                  {filtering && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setParams({}, { replace: true });
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </details>

                {total === 0 && !archived ? (
                  <EmptyState
                    icon={Lightbulb}
                    title="Start your knowledge journal"
                    description="Use Quick capture on Today or New entry here. A sentence is enough."
                  />
                ) : entries.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No matches"
                    description="Try fewer words or clear the filters."
                  />
                ) : (
                  <>
                    <p className="results-count" aria-live="polite">
                      {filtering
                        ? `${entries.length} of ${total} entries`
                        : `${total} ${total === 1 ? 'entry' : 'entries'}`}
                    </p>
                    <ul className="learning-list" aria-label="Learning entries">
                      {entries.map((entry) => (
                        <LearningListItem key={entry.id} entry={entry} today={today} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </LiveView>
        </div>
      </div>
    </div>
  );
}

/** Totals, how well reviews are kept up, and captures per week for the last twelve weeks. */
function LearningMomentum({
  entries,
  today,
  dueCount,
}: {
  entries: readonly LearningEntry[];
  today: string;
  dueCount: number;
}) {
  const weekStartsOn = useWeekStartsOn();
  const weeks = capturesByWeek(entries, today, weekStartsOn, CHART_WEEKS);
  const peak = Math.max(...weeks.map((w) => w.count), 1);
  const thisWeek = weeks.at(-1)?.count ?? 0;
  const reviewsTotal = entries.reduce((sum, e) => sum + e.reviewDates.length, 0);
  const reviewsDone = entries.reduce(
    (sum, e) => sum + e.reviewDates.filter((r) => r.completedAt !== undefined).length,
    0,
  );
  const topics = new Set(entries.map((e) => e.topic).filter(Boolean)).size;

  return (
    <section className="learn-momentum" aria-labelledby="learn-momentum-title">
      <h2 id="learn-momentum-title" className="learn-momentum__title">
        <Sparkles size={15} aria-hidden="true" /> Your learning
      </h2>
      <dl className="learn-momentum__stats">
        <div>
          <dt>Entries</dt>
          <dd>{entries.length}</dd>
        </div>
        <div>
          <dt>Topics</dt>
          <dd>{topics}</dd>
        </div>
        <div>
          <dt>This week</dt>
          <dd>{thisWeek}</dd>
        </div>
      </dl>

      <figure className="learn-chart">
        <figcaption className="learn-chart__caption">Captures, last {CHART_WEEKS} weeks</figcaption>
        <div
          className="learn-chart__bars"
          role="img"
          aria-label={`Entries per week, oldest to newest: ${weeks.map((w) => w.count).join(', ')}`}
        >
          {weeks.map((w, i) => (
            <span
              key={w.start}
              className={`learn-chart__bar${i === weeks.length - 1 ? ' learn-chart__bar--now' : ''}${w.count === 0 ? ' learn-chart__bar--empty' : ''}`}
              title={`Week of ${formatDateKey(w.start, undefined, { month: 'short', day: 'numeric' })}: ${w.count}`}
            >
              <span
                style={{
                  blockSize: `${w.count === 0 ? 6 : Math.max((w.count / peak) * 100, 12)}%`,
                }}
              />
            </span>
          ))}
        </div>
      </figure>

      {reviewsTotal > 0 && (
        <div className="learn-momentum__reviews">
          <ProgressRing
            value={reviewsDone}
            max={reviewsTotal}
            size={52}
            stroke={6}
            tone="gradient"
            label={`${reviewsDone} of ${reviewsTotal} scheduled reviews done`}
          >
            <BookMarked size={16} aria-hidden="true" />
          </ProgressRing>
          <p>
            <strong>
              {reviewsDone} of {reviewsTotal}
            </strong>{' '}
            reviews done
            <span className="learn-momentum__due">
              {dueCount > 0 ? `${dueCount} due now` : 'Nothing due. Nicely kept.'}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
