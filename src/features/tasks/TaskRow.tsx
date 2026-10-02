import { Link } from 'react-router';
import { PRIORITY_LABELS, type Task } from '@/domain/task';
import { formatMinutes, inlineDayLabel } from '@/lib/format';

interface TaskRowProps {
  task: Task;
  today: string;
  plannedFor?: string | undefined;
  /** Title override, e.g. the snapshot shown in a historical plan. */
  label?: string;
  onToggle?: ((task: Task) => void) | undefined;
  disabled?: boolean;
}

export function TaskRow({
  task,
  today,
  plannedFor,
  label,
  onToggle,
  disabled = false,
}: TaskRowProps) {
  const done = task.status === 'done';
  const cancelled = task.status === 'cancelled';
  const title = label ?? task.title;
  const meta: string[] = [];
  if (task.priority === 'high') meta.push(`${PRIORITY_LABELS.high} priority`);
  if (plannedFor) meta.push(`Planned ${inlineDayLabel(plannedFor, today)}`);
  if (task.dueDate) meta.push(`Due ${inlineDayLabel(task.dueDate, today)}`);
  if (task.estimatedMinutes) meta.push(formatMinutes(task.estimatedMinutes));
  if (task.status === 'in_progress') meta.push('In progress');

  return (
    <li
      className={`task-row${done ? ' task-row--done' : ''}${cancelled ? ' task-row--cancelled' : ''}`}
    >
      {onToggle && !cancelled && (
        <input
          type="checkbox"
          className="checkbox"
          checked={done}
          disabled={disabled}
          aria-label={done ? `Reopen “${title}”` : `Complete “${title}”`}
          onChange={() => {
            onToggle(task);
          }}
        />
      )}
      <div className="task-row__body">
        <Link to={`/tasks/${task.id}`} className="task-row__title">
          {title}
        </Link>
        {meta.length > 0 && <p className="task-row__meta">{meta.join(' · ')}</p>}
      </div>
    </li>
  );
}
