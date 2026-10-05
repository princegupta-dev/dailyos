import { BookOpen, CalendarClock, Lightbulb } from 'lucide-react';
import { Link } from 'react-router';
import type { LearningEntry } from '@/domain/learning';
import { relativeDayLabel } from '@/lib/format';
import { bodyWithoutTitle, reviewProgress, topicTone } from './learningInsights';

const SNIPPET_LENGTH = 140;

/** Preview text that doesn't repeat a title derived from the content's first line. */
function snippetFor(entry: LearningEntry): string {
  const body = bodyWithoutTitle(entry);
  return body.length > SNIPPET_LENGTH ? `${body.slice(0, SNIPPET_LENGTH).trimEnd()}…` : body;
}

/**
 * One entry as a card: a tile in its topic's color (a lightbulb for a quick note, a book for a
 * detailed one), the title, a preview, and how far along its review schedule it is.
 */
export function LearningListItem({
  entry,
  today,
  note,
}: {
  entry: LearningEntry;
  today: string;
  note?: string;
}) {
  const snippet = snippetFor(entry);
  const tone = topicTone(entry.topic);
  const detailed = entry.format === 'structured';
  const Icon = detailed ? BookOpen : Lightbulb;
  const reviews = reviewProgress(entry);
  return (
    <li className={`learning-item learning-item--${tone}${note ? ' learning-item--due' : ''}`}>
      <Link to={`/learn/${entry.id}`} className="learning-item__link">
        <span className={`learning-item__icon tone--${tone}`} aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="learning-item__body">
          <span className="learning-item__title">{entry.title}</span>
          {snippet && <span className="learning-item__snippet">{snippet}</span>}
          <span className="learning-item__meta">
            {entry.topic && <span className={`tag tone--${tone}`}>{entry.topic}</span>}
            <span className={note ? 'learning-item__due' : undefined}>
              {note && <CalendarClock size={12} aria-hidden="true" />}
              {note ?? relativeDayLabel(entry.capturedDate, today)}
            </span>
            {detailed && <span>Detailed</span>}
            {reviews.total > 0 && (
              <span
                className="learning-item__reviews"
                role="img"
                aria-label={`${reviews.done} of ${reviews.total} reviews done`}
              >
                {entry.reviewDates.map((r) => (
                  <span
                    key={r.date}
                    className={`learning-item__pip${r.completedAt ? ' learning-item__pip--done' : ''}`}
                  />
                ))}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
