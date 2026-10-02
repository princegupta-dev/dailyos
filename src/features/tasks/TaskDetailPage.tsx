import {
  ArrowLeft,
  CalendarClock,
  CalendarMinus,
  CalendarPlus,
  Check,
  Pencil,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmDialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { planTask, unplanTask } from '@/db/repositories/plans';
import {
  cancelTask,
  completeTask,
  getTaskDetail,
  latestPlannedDates,
  reopenTask,
  setTaskArchived,
  startTask,
  updateTask,
  type TaskDetail,
} from '@/db/repositories/tasks';
import { derivePlanItemOutcome, OUTCOME_LABELS } from '@/domain/plan';
import { canTransition, isOpen, PRIORITY_LABELS, STATUS_LABELS } from '@/domain/task';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useTimeZone, useToday } from '@/hooks/useToday';
import { formatMinutes, formatTimestamp, relativeDayLabel } from '@/lib/format';
import { describeEvent } from './eventLabels';
import { RelatedLearning } from './RelatedLearning';
import { RescheduleDialog } from './RescheduleDialog';
import { TaskForm } from './TaskForm';

export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const detail = useLiveData(useCallback(() => getTaskDetail(taskId), [taskId]));

  return (
    <LiveView state={detail}>
      {(data) =>
        data ? (
          <TaskDetailView detail={data} />
        ) : (
          <>
            <PageHeader
              title="Task not found"
              description="It may have been removed or restored from a backup."
            />
            <Link to="/tasks">Back to tasks</Link>
          </>
        )
      }
    </LiveView>
  );
}

type PendingConfirm = 'cancel' | 'archive' | null;

function TaskDetailView({ detail }: { detail: TaskDetail }) {
  const { task, events, planItems } = detail;
  const today = useToday();
  const timeZone = useTimeZone();
  const { run, pending, notify } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const open = isOpen(task);
  const archived = task.archivedAt !== undefined;
  const plannedFor = latestPlannedDates(planItems).get(task.id);
  const plannedToday = plannedFor === today;

  return (
    <>
      <PageHeader
        eyebrow={archived ? `${STATUS_LABELS[task.status]} · Archived` : STATUS_LABELS[task.status]}
        title={task.title}
        leading={
          <Link to="/tasks" className="icon-button" aria-label="Back to tasks">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      {!archived && (
        <div className="action-bar" role="group" aria-label="Task actions">
          {open && (
            <button
              type="button"
              className="button button--primary button--compact"
              disabled={pending}
              onClick={() => void run(() => completeTask(task.id), 'Task completed')}
            >
              <Check size={18} aria-hidden="true" /> Complete
            </button>
          )}
          {canTransition(task.status, 'start') && (
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() => void run(() => startTask(task.id), 'Marked in progress')}
            >
              <Play size={18} aria-hidden="true" /> Start
            </button>
          )}
          {canTransition(task.status, 'reopen') && (
            <button
              type="button"
              className="button button--primary button--compact"
              disabled={pending}
              onClick={() => void run(() => reopenTask(task.id), 'Task reopened')}
            >
              <RotateCcw size={18} aria-hidden="true" /> Reopen
            </button>
          )}
          {open && !plannedToday && (
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() => void run(() => planTask(task.id, today), 'Added to today')}
            >
              <CalendarPlus size={18} aria-hidden="true" /> Plan for today
            </button>
          )}
          {open && plannedToday && (
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() => void run(() => unplanTask(task.id, today), 'Removed from today')}
            >
              <CalendarMinus size={18} aria-hidden="true" /> Remove from today
            </button>
          )}
          {open && plannedFor !== undefined && (
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setRescheduling(true);
              }}
            >
              <CalendarClock size={18} aria-hidden="true" /> Reschedule
            </button>
          )}
        </div>
      )}

      <Section
        title="Details"
        meta={
          !editing && !archived ? (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil size={16} aria-hidden="true" /> Edit
            </button>
          ) : undefined
        }
      >
        {editing ? (
          <TaskForm
            initial={task}
            submitLabel="Save changes"
            onCancel={() => {
              setEditing(false);
            }}
            onSubmit={async (draft) => {
              await updateTask(task.id, draft);
              notify({ kind: 'success', message: 'Task saved' });
              setEditing(false);
            }}
          />
        ) : (
          <dl className="detail-list">
            {task.description && (
              <div className="detail-list__row detail-list__row--wide">
                <dt>Notes</dt>
                <dd className="preserve-lines">{task.description}</dd>
              </div>
            )}
            <div className="detail-list__row">
              <dt>Priority</dt>
              <dd>{PRIORITY_LABELS[task.priority]}</dd>
            </div>
            <div className="detail-list__row">
              <dt>Due</dt>
              <dd>{task.dueDate ? relativeDayLabel(task.dueDate, today) : 'No due date'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>Estimate</dt>
              <dd>{task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : 'None'}</dd>
            </div>
            {plannedFor && (
              <div className="detail-list__row">
                <dt>Planned</dt>
                <dd>{relativeDayLabel(plannedFor, today)}</dd>
              </div>
            )}
            {task.completedAt && (
              <div className="detail-list__row">
                <dt>Completed</dt>
                <dd>{formatTimestamp(task.completedAt, timeZone)}</dd>
              </div>
            )}
          </dl>
        )}
      </Section>

      <RelatedLearning taskId={task.id} today={today} />

      <Section title="Plan history">
        {planItems.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Never planned"
            description="Plan this task for a day to track it here."
          />
        ) : (
          <ul className="history-list">
            {planItems.map((item) => {
              const outcome = item.removedAt
                ? 'Removed from plan'
                : OUTCOME_LABELS[derivePlanItemOutcome(item, events, today)];
              return (
                <li key={item.id} className="history-list__item">
                  <span className="history-list__primary">
                    {relativeDayLabel(item.date, today)}
                  </span>
                  <span className="history-list__secondary">
                    {outcome}
                    {item.rescheduledTo ? ` to ${relativeDayLabel(item.rescheduledTo, today)}` : ''}
                    {item.titleSnapshot !== task.title
                      ? ` · planned as “${item.titleSnapshot}”`
                      : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="History">
        <ol className="history-list">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="history-list__item">
              <span className="history-list__primary">{describeEvent(event, today)}</span>
              <span className="history-list__secondary">
                {formatTimestamp(event.occurredAt, timeZone)}
                {event.note ? ` — ${event.note}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Manage">
        <div className="action-bar">
          {open && !archived && (
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setConfirm('cancel');
              }}
            >
              Cancel task
            </button>
          )}
          {archived ? (
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() => void run(() => setTaskArchived(task.id, false), 'Task restored')}
            >
              Restore from archive
            </button>
          ) : (
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setConfirm('archive');
              }}
            >
              Archive
            </button>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirm === 'cancel'}
        title="Cancel this task?"
        message="It stays in your history and past plans. You can reopen it later."
        confirmLabel="Cancel task"
        pending={pending}
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={() => {
          void run(() => cancelTask(task.id), 'Task cancelled').then(() => {
            setConfirm(null);
          });
        }}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        title="Archive this task?"
        message="Archived tasks are hidden from lists but kept with their history. You can restore them anytime."
        confirmLabel="Archive"
        pending={pending}
        onCancel={() => {
          setConfirm(null);
        }}
        onConfirm={() => {
          void run(() => setTaskArchived(task.id, true), 'Task archived').then(() => {
            setConfirm(null);
          });
        }}
      />
      {rescheduling && plannedFor && (
        <RescheduleDialog
          open
          taskId={task.id}
          taskTitle={task.title}
          fromDate={plannedFor}
          today={today}
          onClose={() => {
            setRescheduling(false);
          }}
        />
      )}
    </>
  );
}
