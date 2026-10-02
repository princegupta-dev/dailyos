import { CalendarClock, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { getDayPlan, listUnfinishedFromEarlier, rescheduleTask } from '@/db/repositories/plans';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { inlineDayLabel } from '@/lib/format';
import { TaskRow } from '../tasks/TaskRow';
import { useToggleTask } from '../tasks/useToggleTask';
import { PlanTasksDialog } from './PlanTasksDialog';

export function TodayTasks({ today }: { today: string }) {
  const dayPlan = useLiveData(useCallback(() => getDayPlan(today, today), [today]));
  const { toggle, pending } = useToggleTask();
  const [picking, setPicking] = useState(false);

  const counted =
    dayPlan.status === 'ready'
      ? dayPlan.data.entries.filter((e) => e.outcome !== 'rescheduled' && e.outcome !== 'cancelled')
      : [];
  const doneCount = counted.filter((e) => e.outcome === 'done').length;

  return (
    <Section
      title="Tasks"
      meta={counted.length > 0 ? `${doneCount} of ${counted.length} done` : undefined}
    >
      <LiveView state={dayPlan}>
        {({ entries }) => {
          const current = entries.filter((e) => e.outcome !== 'rescheduled');
          const moved = entries.filter((e) => e.outcome === 'rescheduled');
          return (
            <>
              {counted.length > 0 && (
                <progress
                  className="progress"
                  max={counted.length}
                  value={doneCount}
                  aria-label={`${doneCount} of ${counted.length} planned tasks done`}
                />
              )}
              {current.length === 0 ? (
                <p className="muted small">
                  Nothing planned yet. Pick one or two tasks that matter today.
                </p>
              ) : (
                <ul className="task-list" aria-label="Today’s tasks">
                  {current.map(({ item, task }) => (
                    <TaskRow
                      key={item.id}
                      task={task}
                      today={today}
                      onToggle={toggle}
                      disabled={pending}
                    />
                  ))}
                </ul>
              )}
              {moved.length > 0 && (
                <p className="muted small">
                  Moved:{' '}
                  {moved
                    .map(
                      (e) =>
                        `${e.item.titleSnapshot} → ${e.item.rescheduledTo ? inlineDayLabel(e.item.rescheduledTo, today) : ''}`,
                    )
                    .join('; ')}
                </p>
              )}
              <div className="section__footer">
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={() => {
                    setPicking(true);
                  }}
                >
                  <Plus size={18} aria-hidden="true" /> Plan tasks
                </button>
                <Link to="/tasks" className="link-button">
                  All tasks
                </Link>
              </div>
              {picking && (
                <PlanTasksDialog
                  date={today}
                  plannedTaskIds={new Set(current.map((e) => e.task.id))}
                  onClose={() => {
                    setPicking(false);
                  }}
                />
              )}
            </>
          );
        }}
      </LiveView>
      <UnfinishedTasks today={today} />
    </Section>
  );
}

function UnfinishedTasks({ today }: { today: string }) {
  const unfinished = useLiveData(useCallback(() => listUnfinishedFromEarlier(today), [today]));
  const { run, pending } = useAction();

  if (unfinished.status !== 'ready' || unfinished.data.length === 0) return null;

  return (
    <div className="subsection">
      <h3 className="subsection__title">
        <CalendarClock size={18} aria-hidden="true" /> Unfinished from earlier
      </h3>
      <ul className="picker-list">
        {unfinished.data.map(({ task, lastPlannedFor }) => (
          <li key={task.id} className="picker-list__item">
            <span className="picker-list__label">
              <Link to={`/tasks/${task.id}`}>{task.title}</Link>
              <span className="muted small">
                {' '}
                · planned {inlineDayLabel(lastPlannedFor, today)}
              </span>
            </span>
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={pending}
              onClick={() =>
                void run(() => rescheduleTask(task.id, lastPlannedFor, today), 'Moved to today')
              }
            >
              Move to today
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
