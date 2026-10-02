import { NotebookPen } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { logFieldLabel, logFieldUnit } from '@/domain/activityLog';
import type { HabitEntry } from '@/domain/habit';
import { relativeDayLabel } from '@/lib/format';

const STATUS_TEXT = { completed: 'Done', skipped: 'Skipped', missed: 'Missed' } as const;

/** Entries that carry notes, logs, or tags, newest first. */
export function HabitNotes({
  entries,
  today,
  onOpen,
}: {
  entries: readonly HabitEntry[];
  today: string;
  onOpen?: ((date: string) => void) | undefined;
}) {
  const withDetails = entries
    .filter(
      (e) =>
        e.note !== undefined || e.log !== undefined || e.tags.length > 0 || e.amount !== undefined,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  if (withDetails.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        description="Details you add when logging this habit show up here."
      />
    );
  }

  return (
    <ul className="note-list">
      {withDetails.map((entry) => {
        const body = (
          <>
            <span className="note-list__head">
              <span className="note-list__date">{relativeDayLabel(entry.date, today)}</span>
              <span className={`status-text status-text--${entry.status}`}>
                {entry.minimum ? 'Minimum' : STATUS_TEXT[entry.status]}
                {entry.alternative ? ` · ${entry.alternative}` : ''}
                {entry.amount !== undefined ? ` · ${entry.amount}` : ''}
              </span>
            </span>
            {entry.note && <span className="note-list__note">{entry.note}</span>}
            {entry.log && (
              <span className="note-list__log">
                {Object.entries(entry.log).map(([key, value]) => (
                  <span key={key} className="note-list__field">
                    <span className="muted">{logFieldLabel(key)}:</span> {value}
                    {typeof value === 'number' && logFieldUnit(key)
                      ? ` ${logFieldUnit(key) ?? ''}`
                      : ''}
                  </span>
                ))}
              </span>
            )}
            {entry.tags.length > 0 && (
              <span className="note-list__tags">
                {entry.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
            )}
          </>
        );
        return (
          <li key={entry.id}>
            {onOpen ? (
              <button
                type="button"
                className="note-list__item"
                onClick={() => {
                  onOpen(entry.date);
                }}
              >
                {body}
              </button>
            ) : (
              <div className="note-list__item">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
