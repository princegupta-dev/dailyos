import { ListPlus } from 'lucide-react';
import { Link } from 'react-router';
import { convertActionToTask, setActionStatus, type OpenAction } from '@/db/repositories/reviews';
import { periodLabel } from '@/domain/review';
import { useAction } from '@/hooks/useAction';
import { inlineDayLabel } from '@/lib/format';

/** Carried-forward actions with quick ways to finish them or turn them into tasks. */
export function OpenActionsList({ items, today }: { items: readonly OpenAction[]; today: string }) {
  const { run, pending } = useAction();
  return (
    <ul className="picker-list">
      {items.map(({ action, review }) => (
        <li key={action.id} className="picker-list__item">
          <div className="checkbox-field action-item">
            <input
              type="checkbox"
              className="checkbox"
              checked={false}
              disabled={pending}
              aria-label={`Mark “${action.title}” done`}
              onChange={() => void run(() => setActionStatus(action.id, 'done'), 'Action done')}
            />
            <span>
              <span className="action-item__title">{action.title}</span>
              <span className="action-item__meta">
                From{' '}
                {periodLabel({
                  type: review.periodType,
                  start: review.periodStart,
                  end: review.periodEnd,
                })}
                {action.targetDate ? ` · by ${inlineDayLabel(action.targetDate, today)}` : ''}
              </span>
            </span>
          </div>
          {action.taskId ? (
            <Link to={`/tasks/${action.taskId}`} className="link-button">
              View task
            </Link>
          ) : (
            <button
              type="button"
              className="icon-button"
              aria-label={`Make “${action.title}” a task`}
              disabled={pending}
              onClick={() =>
                void run(() => convertActionToTask(action.id), 'Added to your task inbox')
              }
            >
              <ListPlus size={18} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
