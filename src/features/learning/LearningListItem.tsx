import { Link } from 'react-router';
import { titleFromContent, type LearningEntry } from '@/domain/learning';
import { relativeDayLabel } from '@/lib/format';

const SNIPPET_LENGTH = 140;

/** Preview text that doesn't repeat a title derived from the content's first line. */
function snippetFor(entry: LearningEntry): string {
  let body = entry.content.trim();
  const [firstLine = '', ...rest] = body.split('\n');
  // A derived title equals the full first line unless it was shortened with "…".
  if (titleFromContent(body) === entry.title && firstLine.trim() === entry.title) {
    body = rest.join('\n').trim();
  }
  return body.length > SNIPPET_LENGTH ? `${body.slice(0, SNIPPET_LENGTH).trimEnd()}…` : body;
}

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
  return (
    <li className="learning-item">
      <Link to={`/learn/${entry.id}`} className="learning-item__link">
        <span className="learning-item__title">{entry.title}</span>
        {snippet && <span className="learning-item__snippet">{snippet}</span>}
        <span className="learning-item__meta">
          {entry.topic && <span className="tag">{entry.topic}</span>}
          <span>{note ?? relativeDayLabel(entry.capturedDate, today)}</span>
          {entry.format === 'structured' && <span>Detailed</span>}
        </span>
      </Link>
    </li>
  );
}
