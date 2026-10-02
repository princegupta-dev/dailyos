import { Lightbulb, Plus, SearchX } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { listDueReviews, searchLearning } from '@/db/repositories/learning';
import { LEARNING_FORMATS, type LearningFilter, type LearningFormat } from '@/domain/learning';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday } from '@/hooks/useToday';
import { inlineDayLabel } from '@/lib/format';
import { LearningListItem } from './LearningListItem';

const FILTER_KEYS = ['q', 'topic', 'format', 'from', 'to'] as const;

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
  const due = useLiveData(useCallback(() => listDueReviews(today), [today]));

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
    <>
      <PageHeader
        title="Learn"
        actions={
          <Link to="/learn/new" className="button button--primary button--compact">
            <Plus size={18} aria-hidden="true" />
            New entry
          </Link>
        }
      />

      {due.status === 'ready' && due.data.length > 0 && !archived && (
        <Section title="Due for review" meta={`${due.data.length}`}>
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
        <label className="visually-hidden" htmlFor="learn-search">
          Search learning
        </label>
        <input
          id="learn-search"
          type="search"
          className="input"
          placeholder="Search notes…"
          value={q}
          onChange={(e) => {
            setParam('q', e.target.value);
          }}
        />
      </div>

      <LiveView state={results}>
        {({ entries, topics, total }) => (
          <>
            <details className="disclosure filters" open={filtering && q === ''}>
              <summary className="disclosure__summary">Filters</summary>
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
                    {topics.map((t) => (
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
                title="No learning captured yet"
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
                <p className="muted small results-count" aria-live="polite">
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
    </>
  );
}
