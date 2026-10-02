/** Life areas DailyOS is organized around. Each habit belongs to one. */
export const HABIT_CATEGORIES = [
  'engineering',
  'dsa',
  'fitness',
  'reading',
  'career',
  'attention',
  'other',
] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<HabitCategory, string> = {
  engineering: 'Engineering',
  dsa: 'DSA',
  fitness: 'Fitness',
  reading: 'Reading',
  career: 'Career',
  attention: 'Attention',
  other: 'Other',
};

export const CATEGORY_HINTS: Record<HabitCategory, string> = {
  engineering: 'Backend work, building, deep understanding',
  dsa: 'Problems, patterns, interview prep',
  fitness: 'Gym, cardio, recovery',
  reading: 'Books and long-form learning',
  career: 'Applications, referrals, interviews',
  attention: 'Less scrolling, better focus',
  other: 'Anything else',
};
