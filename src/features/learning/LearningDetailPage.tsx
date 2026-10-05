import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CircleHelp,
  Clock,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Link2,
  MessageSquareText,
  Pencil,
  Rocket,
  SquareCheckBig,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { ProgressRing } from '@/components/ProgressRing';
import { Section } from '@/components/Section';
import {
  deleteLearningEntry,
  getLearningDetail,
  searchLearning,
  setLearningArchived,
  setReviewDone,
  updateLearningEntry,
  type LearningDetail,
} from '@/db/repositories/learning';
import { STRUCTURED_FIELDS, STRUCTURED_LABELS, type StructuredField } from '@/domain/learning';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useTimeZone, useToday } from '@/hooks/useToday';
import { formatTimestamp, relativeDayLabel } from '@/lib/format';
import { bodyWithoutTitle, reviewProgress, topicTone } from './learningInsights';
import { LearningForm } from './LearningForm';

const FIELD_ICONS: Record<StructuredField, LucideIcon> = {
  explanation: MessageSquareText,
  example: FlaskConical,
  questions: CircleHelp,
  application: Rocket,
  source: Link2,
};

const WORDS_PER_MINUTE = 200;

export function LearningDetailPage() {
  const { entryId = '' } = useParams();
  const detail = useLiveData(useCallback(() => getLearningDetail(entryId), [entryId]));
  return (
    <LiveView state={detail}>
      {(data) =>
        data ? (
          <LearningDetailView detail={data} />
        ) : (
          <>
            <PageHeader title="Entry not found" description="It may have been deleted." />
            <Link to="/learn">Back to Learn</Link>
          </>
        )
      }
    </LiveView>
  );
}

/** A source that is a web address becomes a link; anything else (a book, a person) stays text. */
function SourceText({ text }: { text: string }) {
  const trimmed = text.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return (
      <a href={trimmed} target="_blank" rel="noopener noreferrer" className="learn-source">
        {trimmed.replace(/^https?:\/\//i, '')}
        <ExternalLink size={14} aria-hidden="true" />
        <span className="visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  }
  return <>{text}</>;
}

function LearningDetailView({ detail }: { detail: LearningDetail }) {
  const { entry, relatedTasks } = detail;
  const today = useToday();
  const timeZone = useTimeZone();
  const navigate = useNavigate();
  const { run, pending, notify } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const topics = useLiveData(useCallback(() => searchLearning({}), []));
  const archived = entry.archivedAt !== undefined;
  const tone = topicTone(entry.topic);
  const detailed = entry.format === 'structured';
  const body = bodyWithoutTitle(entry);
  const words = [entry.content, ...STRUCTURED_FIELDS.map((f) => entry[f] ?? '')]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const reviews = reviewProgress(entry);

  if (editing) {
    return (
      <div className="learn-form-page">
        <PageHeader
          title="Edit entry"
          leading={
            <button
              type="button"
              className="icon-button"
              aria-label="Stop editing"
              onClick={() => {
                setEditing(false);
              }}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          }
        />
        <LearningForm
          initial={entry}
          initialRelatedTasks={relatedTasks}
          today={today}
          topics={topics.status === 'ready' ? topics.data.topics : []}
          submitLabel="Save changes"
          onCancel={() => {
            setEditing(false);
          }}
          onSubmit={async (draft) => {
            await updateLearningEntry(entry.id, draft);
            notify({ kind: 'success', message: 'Entry saved' });
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <article className="learn-detail">
      <header className={`learn-hero tone-wash--${tone}`}>
        <div className="learn-hero__bar">
          <Link to="/learn" className="icon-button learn-hero__back" aria-label="Back to Learn">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="learn-hero__edit"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil size={15} aria-hidden="true" /> Edit
          </button>
        </div>
        <div className="learn-hero__identity">
          <span className={`learn-hero__icon tone--${tone}`} aria-hidden="true">
            {detailed ? <BookOpen size={24} /> : <Lightbulb size={24} />}
          </span>
          <p className="learn-hero__eyebrow">
            {[entry.topic, archived ? 'Archived' : undefined].filter(Boolean).join(' · ') ||
              'Learning'}
          </p>
        </div>
        <h1 className="learn-hero__title">{entry.title}</h1>
        <ul className="learn-hero__chips" aria-label="About this entry">
          <li className="hero-chip">
            <CalendarCheck size={13} aria-hidden="true" /> Captured{' '}
            {formatTimestamp(entry.capturedAt, timeZone)}
          </li>
          <li className="hero-chip">
            <Clock size={13} aria-hidden="true" /> {minutes} min read
          </li>
          <li className="hero-chip">{detailed ? 'Detailed note' : 'Quick note'}</li>
        </ul>
      </header>

      {body !== '' && (
        <div className="learn-reading">
          <div className="prose preserve-lines">{body}</div>
        </div>
      )}

      {STRUCTURED_FIELDS.filter((f) => entry[f] !== undefined).map((field) => (
        <Section
          key={field}
          title={STRUCTURED_LABELS[field]}
          icon={FIELD_ICONS[field]}
          className={`learn-field learn-field--${field}`}
        >
          <div className="prose preserve-lines learn-field__body">
            {field === 'source' ? <SourceText text={entry[field] ?? ''} /> : entry[field]}
          </div>
        </Section>
      ))}

      {entry.reviewDates.length > 0 && (
        <Section
          title="Review schedule"
          icon={CalendarCheck}
          description="Spaced reviews help it stick."
          meta={`${reviews.done} of ${reviews.total}`}
          className="learn-schedule"
        >
          <div className="learn-schedule__card">
            <ProgressRing
              value={reviews.done}
              max={reviews.total}
              size={64}
              stroke={7}
              tone="gradient"
              label={`${reviews.done} of ${reviews.total} reviews done`}
            >
              <span className="learn-schedule__fraction">
                {reviews.done}
                <span>/{reviews.total}</span>
              </span>
            </ProgressRing>
            <ul className="learn-schedule__list">
              {entry.reviewDates.map((review) => {
                const label = relativeDayLabel(review.date, today);
                const done = review.completedAt !== undefined;
                const overdue = !done && review.date < today;
                const upcoming = review.date > today;
                const state = done ? 'done' : overdue ? 'overdue' : upcoming ? 'upcoming' : 'due';
                return (
                  <li
                    key={review.date}
                    className={`learn-schedule__item learn-schedule__item--${state}`}
                  >
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={done}
                        disabled={pending || (upcoming && !done)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          void run(
                            () => setReviewDone(entry.id, review.date, checked),
                            checked ? 'Marked as reviewed' : undefined,
                          );
                        }}
                      />
                      <span>
                        {label}
                        {overdue && <span className="learn-schedule__state"> · overdue</span>}
                        {upcoming && <span className="learn-schedule__state"> · upcoming</span>}
                        {state === 'due' && (
                          <span className="learn-schedule__state"> · due today</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      )}

      {relatedTasks.length > 0 && (
        <Section title="Related tasks" icon={SquareCheckBig} className="learn-related">
          <ul className="learn-related__list">
            {relatedTasks.map((task) => (
              <li key={task.id}>
                <Link to={`/tasks/${task.id}`} className="learn-related__link">
                  <SquareCheckBig size={16} aria-hidden="true" />
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Manage" className="learn-manage">
        <div className="learn-manage__card">
          <p className="learn-manage__text">
            {archived
              ? 'Archived entries stay searchable under Filters. Restore it to bring it back.'
              : 'Archive to tidy it away and keep it, or delete it for good.'}
          </p>
          <div className="action-bar">
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() =>
                void run(
                  () => setLearningArchived(entry.id, !archived),
                  archived ? 'Entry restored' : 'Entry archived',
                )
              }
            >
              {archived ? (
                <ArchiveRestore size={16} aria-hidden="true" />
              ) : (
                <Archive size={16} aria-hidden="true" />
              )}
              {archived ? 'Restore' : 'Archive'}
            </button>
            <button
              type="button"
              className="button button--secondary button--compact learn-manage__delete"
              onClick={() => {
                setConfirmDelete(true);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this entry?"
        message="This permanently removes it from this device. Archive it instead if you might want it later."
        confirmLabel="Delete permanently"
        destructive
        pending={pending}
        onCancel={() => {
          setConfirmDelete(false);
        }}
        onConfirm={() => {
          void run(() => deleteLearningEntry(entry.id), 'Entry deleted').then((result) => {
            setConfirmDelete(false);
            if (result.ok) void navigate('/learn', { replace: true });
          });
        }}
      />
    </article>
  );
}
