import { ArrowLeft, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
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
import { STRUCTURED_FIELDS, STRUCTURED_LABELS } from '@/domain/learning';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useTimeZone, useToday } from '@/hooks/useToday';
import { formatTimestamp, relativeDayLabel } from '@/lib/format';
import { LearningForm } from './LearningForm';

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

  if (editing) {
    return (
      <>
        <PageHeader title="Edit entry" />
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
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          [entry.topic, archived ? 'Archived' : undefined].filter(Boolean).join(' · ') || 'Learning'
        }
        title={entry.title}
        description={`Captured ${formatTimestamp(entry.capturedAt, timeZone)}`}
        actions={
          <Link to="/learn" className="icon-button" aria-label="Back to Learn">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      <div className="action-bar">
        <button
          type="button"
          className="button button--secondary button--compact"
          onClick={() => {
            setEditing(true);
          }}
        >
          <Pencil size={16} aria-hidden="true" /> Edit
        </button>
      </div>

      {entry.content.trim() !== '' && entry.content.trim() !== entry.title && (
        <div className="prose preserve-lines">{entry.content}</div>
      )}

      {STRUCTURED_FIELDS.filter((f) => entry[f] !== undefined).map((field) => (
        <Section key={field} title={STRUCTURED_LABELS[field]}>
          <div className="prose preserve-lines">{entry[field]}</div>
        </Section>
      ))}

      {relatedTasks.length > 0 && (
        <Section title="Related tasks">
          <ul className="nav-list">
            {relatedTasks.map((task) => (
              <li key={task.id}>
                <Link to={`/tasks/${task.id}`} className="nav-list__link">
                  <span className="nav-list__label">{task.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {entry.reviewDates.length > 0 && (
        <Section title="Review schedule">
          <ul className="picker-list">
            {entry.reviewDates.map((review) => {
              const label = relativeDayLabel(review.date, today);
              const overdue = review.completedAt === undefined && review.date < today;
              return (
                <li key={review.date} className="picker-list__item">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={review.completedAt !== undefined}
                      disabled={
                        pending || (review.date > today && review.completedAt === undefined)
                      }
                      onChange={(e) => {
                        const done = e.target.checked;
                        void run(
                          () => setReviewDone(entry.id, review.date, done),
                          done ? 'Marked as reviewed' : undefined,
                        );
                      }}
                    />
                    <span>
                      {label}
                      {overdue && <span className="muted small"> · overdue</span>}
                      {review.date > today && <span className="muted small"> · upcoming</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Manage">
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
            {archived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            Delete
          </button>
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
    </>
  );
}
