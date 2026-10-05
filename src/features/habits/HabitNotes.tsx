import { Feather, NotebookPen, PenLine, Quote, Shuffle } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { logFieldLabel, logFieldUnit } from '@/domain/activityLog';
import type { HabitEntry } from '@/domain/habit';
import { formatDateKey } from '@/lib/dates';
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
        title="Your journal for this habit"
        description={
          onOpen
            ? 'Add a note when you log a day: how it felt, what helped. Tap any day in the calendar to begin.'
            : 'Notes and details added when logging this habit show up here.'
        }
      />
    );
  }

  const notes = withDetails.filter((e) => e.note !== undefined).length;
  const months = groupByMonth(withDetails);

  return (
    <div className="journal">
      <p className="journal__summary">
        <Quote size={14} aria-hidden="true" />
        <span>
          {withDetails.length} {withDetails.length === 1 ? 'entry' : 'entries'}
          {notes > 0 && (
            <>
              {' · '}
              <em>
                {notes} {notes === 1 ? 'note' : 'notes'} in your words
              </em>
            </>
          )}
        </span>
      </p>
      {months.map(({ month, items }) => (
        <div key={month} className="journal__month">
          <h3 className="journal__month-title">{monthLabel(month)}</h3>
          <ul className="journal__list">
            {items.map((entry) => {
              const body = (
                <>
                  <span className="journal__date" aria-hidden="true">
                    <span className="journal__day">{Number(entry.date.slice(8))}</span>
                    <span className="journal__weekday">
                      {formatDateKey(entry.date, undefined, { weekday: 'short' })}
                    </span>
                  </span>
                  <span className="journal__card">
                    <span className="journal__head">
                      <span className="journal__when">{relativeDayLabel(entry.date, today)}</span>
                      <span
                        className={`journal__status journal__status--${entry.minimum ? 'minimum' : entry.status}`}
                      >
                        {entry.minimum ? 'Minimum' : STATUS_TEXT[entry.status]}
                        {entry.alternative ? ` · ${entry.alternative}` : ''}
                        {entry.amount !== undefined ? ` · ${entry.amount}` : ''}
                      </span>
                    </span>
                    {entry.note && <span className="journal__note">{entry.note}</span>}
                    {(entry.minimum || entry.alternative) && !entry.note && (
                      <span className="journal__aside">
                        {entry.minimum ? (
                          <>
                            <Feather size={13} aria-hidden="true" /> The hard-day version counted
                          </>
                        ) : (
                          <>
                            <Shuffle size={13} aria-hidden="true" /> An alternative counted
                          </>
                        )}
                      </span>
                    )}
                    {entry.log && (
                      <span className="journal__log">
                        {Object.entries(entry.log).map(([key, value]) => (
                          <span key={key} className="journal__field">
                            <span className="journal__field-label">{logFieldLabel(key)}</span>
                            <span className="journal__field-value">
                              {value}
                              {typeof value === 'number' && logFieldUnit(key)
                                ? ` ${logFieldUnit(key) ?? ''}`
                                : ''}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                    {entry.tags.length > 0 && (
                      <span className="journal__tags">
                        {entry.tags.map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                    {onOpen && (
                      <span className="journal__edit" aria-hidden="true">
                        <PenLine size={13} /> Edit
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={entry.id} className="journal__entry">
                  {onOpen ? (
                    <button
                      type="button"
                      className="journal__item"
                      onClick={() => {
                        onOpen(entry.date);
                      }}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="journal__item">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Entries grouped by month ("2026-10"), keeping their newest-first order. */
function groupByMonth(entries: readonly HabitEntry[]) {
  const months: { month: string; items: HabitEntry[] }[] = [];
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = months.at(-1);
    if (last?.month === month) last.items.push(entry);
    else months.push({ month, items: [entry] });
  }
  return months;
}

function monthLabel(month: string): string {
  return formatDateKey(`${month}-01`, undefined, { month: 'long', year: 'numeric' });
}
