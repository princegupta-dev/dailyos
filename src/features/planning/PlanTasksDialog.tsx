import { Plus } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { LiveView } from '@/components/LiveView';
import { planTask } from '@/db/repositories/plans';
import { createTask, listOpenTasks } from '@/db/repositories/tasks';
import { PRIORITY_LABELS } from '@/domain/task';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';

interface PlanTasksDialogProps {
  date: string;
  /** Task ids already on the plan for `date`. */
  plannedTaskIds: ReadonlySet<string>;
  onClose: () => void;
}

export function PlanTasksDialog({ date, plannedTaskIds, onClose }: PlanTasksDialogProps) {
  const openTasks = useLiveData(listOpenTasks);
  const { run, pending } = useAction();
  const [title, setTitle] = useState('');

  const addNew = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (title.trim() === '') return;
    const result = await run(() => createTask({ title }, { planFor: date }), 'Task added');
    if (result.ok) setTitle('');
  };

  return (
    <Dialog open title="Plan tasks" onClose={onClose}>
      <form className="inline-form" onSubmit={(e) => void addNew(e)}>
        <label className="visually-hidden" htmlFor="plan-new-task">
          New task
        </label>
        <input
          id="plan-new-task"
          className="input"
          placeholder="New task…"
          value={title}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
        <button
          type="submit"
          className="button button--primary button--compact"
          disabled={pending || title.trim() === ''}
        >
          Add
        </button>
      </form>
      <h3 className="dialog__subheading">From your open tasks</h3>
      <LiveView state={openTasks}>
        {(tasks) => {
          const candidates = tasks.filter((t) => !plannedTaskIds.has(t.id));
          return candidates.length === 0 ? (
            <p className="muted">No other open tasks. Add one above.</p>
          ) : (
            <ul className="picker-list">
              {candidates.map((task) => (
                <li key={task.id} className="picker-list__item">
                  <span className="picker-list__label">
                    {task.title}
                    {task.priority === 'high' && (
                      <span className="muted"> · {PRIORITY_LABELS.high}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Plan “${task.title}”`}
                    disabled={pending}
                    onClick={() => void run(() => planTask(task.id, date), 'Added to plan')}
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          );
        }}
      </LiveView>
    </Dialog>
  );
}
