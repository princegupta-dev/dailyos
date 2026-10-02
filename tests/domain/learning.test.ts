import { describe, expect, it } from 'vitest';
import {
  distinctTopics,
  filterLearning,
  groupTopics,
  learningDraftSchema,
  nextDueReview,
  suggestReviewDates,
  titleFromContent,
  type LearningEntry,
} from '@/domain/learning';

let n = 0;
function entry(overrides: Partial<LearningEntry>): LearningEntry {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title: 'Untitled',
    format: 'quick',
    content: '',
    relatedTaskIds: [],
    capturedAt: `2026-10-0${Math.min(n, 9)}T10:00:00.000Z`,
    capturedDate: `2026-10-0${Math.min(n, 9)}`,
    updatedAt: '2026-10-01T10:00:00.000Z',
    reviewDates: [],
    ...overrides,
  };
}

describe('learning drafts', () => {
  it('accepts a quick capture with only content and derives the title', () => {
    const draft = learningDraftSchema.parse({
      content: '\n  IndexedDB transactions auto-commit when idle\nmore detail',
    });
    expect(draft).toMatchObject({
      title: 'IndexedDB transactions auto-commit when idle',
      format: 'quick',
    });
  });

  it('rejects an empty capture', () => {
    const result = learningDraftSchema.safeParse({ content: '   ' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['content']);
  });

  it('becomes structured when any structured field is filled, and normalizes topics', () => {
    const draft = learningDraftSchema.parse({
      title: 'Closures',
      content: 'Functions capture variables',
      topic: '  JavaScript   basics ',
      example: 'counter()',
      explanation: '   ',
      reviewDates: ['2026-10-09', '2026-10-03'],
    });
    expect(draft.format).toBe('structured');
    expect(draft.topic).toBe('JavaScript basics');
    expect(draft.explanation).toBeUndefined();
    expect(draft.reviewDates).toEqual(['2026-10-03', '2026-10-09']);
  });

  it('shortens long first lines for derived titles', () => {
    const title = titleFromContent('x'.repeat(200));
    expect(title).toHaveLength(80);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('search and filters', () => {
  const entries = [
    entry({
      title: 'Café culture',
      content: 'Notes on espresso',
      topic: 'Travel',
      capturedDate: '2026-09-20',
    }),
    entry({
      title: 'Dexie live queries',
      content: 'liveQuery re-runs on change',
      topic: 'IndexedDB',
      format: 'structured',
      example: 'useLiveData',
      capturedDate: '2026-10-01',
    }),
    entry({
      title: 'Transactions',
      content: 'Auto-commit when the event loop is idle',
      topic: 'indexeddb',
      capturedDate: '2026-10-02',
    }),
  ];

  it('matches every term across fields, ignoring case and accents', () => {
    expect(filterLearning(entries, { text: 'cafe ESPRESSO' }).map((e) => e.title)).toEqual([
      'Café culture',
    ]);
    expect(filterLearning(entries, { text: 'useLiveData' }).map((e) => e.title)).toEqual([
      'Dexie live queries',
    ]);
    expect(filterLearning(entries, { text: 'espresso dexie' })).toEqual([]);
  });

  it('filters by topic case-insensitively, format, and date range; newest first', () => {
    expect(filterLearning(entries, { topic: 'IndexedDB' }).map((e) => e.title)).toEqual([
      'Transactions',
      'Dexie live queries',
    ]);
    expect(filterLearning(entries, { format: 'structured' }).map((e) => e.title)).toEqual([
      'Dexie live queries',
    ]);
    expect(
      filterLearning(entries, { from: '2026-09-25', to: '2026-10-01' }).map((e) => e.title),
    ).toEqual(['Dexie live queries']);
  });

  it('lists distinct topics merged case-insensitively', () => {
    expect(distinctTopics(entries)).toEqual(['indexeddb', 'Travel']);
  });

  it('picks the same display spelling regardless of input order', () => {
    const tie = '2026-10-05T10:00:00.000Z';
    const a = entry({ topic: 'TypeScript', capturedAt: tie });
    const b = entry({ topic: 'typescript', capturedAt: tie });
    expect(groupTopics([a, b])).toEqual(groupTopics([b, a]));
    expect(groupTopics([a, b])[0]?.count).toBe(2);
  });
});

describe('review dates', () => {
  it('suggests 1, 7 and 30 days out using calendar arithmetic', () => {
    expect(suggestReviewDates('2026-10-28')).toEqual(['2026-10-29', '2026-11-04', '2026-11-27']);
  });

  it('finds the earliest incomplete due review', () => {
    const e = entry({
      reviewDates: [
        { date: '2026-10-01', completedAt: '2026-10-01T09:00:00.000Z' },
        { date: '2026-10-03' },
        { date: '2026-10-10' },
      ],
    });
    expect(nextDueReview(e, '2026-10-02')).toBeUndefined();
    expect(nextDueReview(e, '2026-10-05')).toBe('2026-10-03');
  });
});
