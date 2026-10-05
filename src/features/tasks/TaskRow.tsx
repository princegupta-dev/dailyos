import { CalendarDays, CalendarCheck, Clock, Flag, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
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

interface MetaChip {
  key: string;
  icon: ReactNode;
  text: string;
  tone?: 'high' | 'overdue' | 'today' | 'progress' | undefined;
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
  const open = !done && !cancelled;
  const title = label ?? task.title;
  const high = task.priority === 'high';

  const meta: MetaChip[] = [];
  if (high) {
    meta.push({
      key: 'priority',
      icon: <Flag size={12} aria-hidden="true" />,
      text: `${PRIORITY_LABELS.high} priority`,
      tone: 'high',
    });
  }
  if (plannedFor) {
    meta.push({
      key: 'planned',
      icon: <CalendarCheck size={12} aria-hidden="true" />,
      text: `Planned ${inlineDayLabel(plannedFor, today)}`,
    });
  }
  if (task.dueDate) {
    const overdue = open && task.dueDate < today;
    const dueToday = open && task.dueDate === today;
    meta.push({
      key: 'due',
      icon: <CalendarDays size={12} aria-hidden="true" />,
      text: `Due ${inlineDayLabel(task.dueDate, today)}`,
      tone: overdue ? 'overdue' : dueToday ? 'today' : undefined,
    });
  }
  if (task.estimatedMinutes) {
    meta.push({
      key: 'estimate',
      icon: <Clock size={12} aria-hidden="true" />,
      text: formatMinutes(task.estimatedMinutes),
    });
  }
  if (task.status === 'in_progress') {
    meta.push({
      key: 'progress',
      icon: <LoaderCircle size={12} aria-hidden="true" />,
      text: 'In progress',
      tone: 'progress',
    });
  }

  return (
    <li
      className={`task-row${done ? ' task-row--done' : ''}${cancelled ? ' task-row--cancelled' : ''}${high && open ? ' task-row--high' : ''}`}
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
        {meta.length > 0 && (
          <p className="task-row__meta">
            {meta.map((chip, index) => (
              <span
                key={chip.key}
                className={`task-chip${chip.tone ? ` task-chip--${chip.tone}` : ''}`}
              >
                {chip.icon}
                {chip.text}
                {/* Keeps the details readable as one sentence when styles are unavailable. */}
                {index < meta.length - 1 && <span className="visually-hidden"> · </span>}
              </span>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}
