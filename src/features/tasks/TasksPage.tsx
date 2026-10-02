import { Archive, CheckCheck, Inbox, ListTodo, Plus, XCircle, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { listTasks, type TaskFilter } from '@/db/repositories/tasks';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday } from '@/hooks/useToday';
import { TaskRow } from './TaskRow';
import { useToggleTask } from './useToggleTask';

const FILTERS: readonly { value: TaskFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
];

const EMPTY: Record<TaskFilter, { icon: LucideIcon; title: string; description: string }> = {
  active: {
    icon: ListTodo,
    title: 'No active tasks',
    description: 'Tasks you plan for a day, or move out of the inbox, show up here.',
  },
  inbox: {
    icon: Inbox,
    title: 'Your inbox is empty',
    description: 'New tasks land here until you plan them.',
  },
  done: {
    icon: CheckCheck,
    title: 'Nothing completed yet',
    description: 'Completed tasks are listed here, newest first.',
  },
  cancelled: {
    icon: XCircle,
    title: 'No cancelled tasks',
    description: 'Cancelled tasks keep their history here.',
  },
  archived: {
    icon: Archive,
    title: 'No archived tasks',
    description: 'Archived tasks are hidden from other lists but kept.',
  },
};

function isFilter(value: string | null): value is TaskFilter {
  return FILTERS.some((f) => f.value === value);
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: TaskFilter = isFilter(raw) ? raw : 'active';
  const today = useToday();
  const tasks = useLiveData(useCallback(() => listTasks(view), [view]));
  const { toggle, pending } = useToggleTask();
  const empty = EMPTY[view];

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <Link to="/tasks/new" className="button button--primary button--compact">
            <Plus size={18} aria-hidden="true" />
            New task
          </Link>
        }
      />
      <SegmentedControl
        label="Show tasks"
        value={view}
        options={FILTERS}
        onChange={(next) => {
          setParams(next === 'active' ? {} : { view: next }, { replace: true });
        }}
      />
      <LiveView state={tasks}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
          ) : (
            <ul
              className="task-list"
              aria-label={`${FILTERS.find((f) => f.value === view)?.label ?? ''} tasks`}
            >
              {items.map(({ task, plannedFor }) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  plannedFor={view === 'active' || view === 'inbox' ? plannedFor : undefined}
                  onToggle={view === 'archived' ? undefined : toggle}
                  disabled={pending}
                />
              ))}
            </ul>
          )
        }
      </LiveView>
    </>
  );
}
