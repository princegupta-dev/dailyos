import { HABIT_TONES, type HabitTone } from '@/domain/appearance';
import { titleFromContent, type LearningEntry } from '@/domain/learning';
import { addDays, startOfWeek } from '@/lib/dates';

/** A stable tone for a topic, so the same topic always wears the same color. */
export function topicTone(topic: string | undefined): HabitTone {
  if (!topic) return 'sage';
  let hash = 0;
  for (const char of topic.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return HABIT_TONES[hash % HABIT_TONES.length] ?? 'sage';
}

/** The note's text without a first line that only repeats its (derived) title. */
export function bodyWithoutTitle(entry: Pick<LearningEntry, 'content' | 'title'>): string {
  const body = entry.content.trim();
  const [firstLine = '', ...rest] = body.split('\n');
  // A derived title equals the full first line unless it was shortened with "…".
  if (titleFromContent(body) === entry.title && firstLine.trim() === entry.title) {
    return rest.join('\n').trim();
  }
  return body;
}

/** Completed and total review dates for an entry. */
export function reviewProgress(entry: Pick<LearningEntry, 'reviewDates'>) {
  const done = entry.reviewDates.filter((r) => r.completedAt !== undefined).length;
  return { done, total: entry.reviewDates.length };
}

export interface TopicCount {
  topic: string;
  count: number;
}

/** Topics by how many entries carry them, most first, then alphabetically. */
export function topicCounts(entries: readonly LearningEntry[]): TopicCount[] {
  const counts = new Map<string, number>();
  for (const e of entries) if (e.topic) counts.set(e.topic, (counts.get(e.topic) ?? 0) + 1);
  return [...counts]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export interface WeekCount {
  start: string;
  count: number;
}

/** Entries captured in each of the last `weeks` weeks, oldest first, ending with this week. */
export function capturesByWeek(
  entries: readonly Pick<LearningEntry, 'capturedDate'>[],
  today: string,
  weekStartsOn: number,
  weeks: number,
): WeekCount[] {
  const thisWeek = startOfWeek(today, weekStartsOn);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, (i - weeks + 1) * 7));
  return starts.map((start) => {
    const end = addDays(start, 6);
    return {
      start,
      count: entries.filter((e) => e.capturedDate >= start && e.capturedDate <= end).length,
    };
  });
}
