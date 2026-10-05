import type { HabitIconKey, HabitTone } from './appearance';

/**
 * Life areas DailyOS is organized around. Each habit belongs to one. Values are stored, so
 * existing ones never change; new areas are only ever added.
 */
export const HABIT_CATEGORIES = [
  'fitness',
  'health',
  'sleep',
  'mindfulness',
  'reading',
  'learning',
  'creativity',
  'engineering',
  'dsa',
  'career',
  'finance',
  'relationships',
  'home',
  'attention',
  'other',
] as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<HabitCategory, string> = {
  fitness: 'Fitness',
  health: 'Health',
  sleep: 'Sleep',
  mindfulness: 'Mindfulness',
  reading: 'Reading',
  learning: 'Learning',
  creativity: 'Creativity',
  engineering: 'Engineering',
  dsa: 'DSA',
  career: 'Career',
  finance: 'Finance',
  relationships: 'Relationships',
  home: 'Home',
  attention: 'Attention',
  other: 'Other',
};

export const CATEGORY_HINTS: Record<HabitCategory, string> = {
  fitness: 'Gym, cardio, recovery',
  health: 'Water, food, steps, check-ups',
  sleep: 'Bedtime, wind-down, rest',
  mindfulness: 'Meditation, breathing, journaling',
  reading: 'Books and long-form learning',
  learning: 'Courses, languages, new skills',
  creativity: 'Writing, music, art, making',
  engineering: 'Backend work, building, deep understanding',
  dsa: 'Problems, patterns, interview prep',
  career: 'Applications, referrals, interviews',
  finance: 'Budgeting, saving, tracking spend',
  relationships: 'Family, friends, staying in touch',
  home: 'Chores, tidying, plants, errands',
  attention: 'Less scrolling, better focus',
  other: 'Anything else',
};

/** Groups for the category picker, so fifteen choices stay easy to scan. */
export const CATEGORY_GROUPS: readonly { label: string; categories: readonly HabitCategory[] }[] = [
  { label: 'Body & mind', categories: ['fitness', 'health', 'sleep', 'mindfulness'] },
  { label: 'Growth', categories: ['reading', 'learning', 'creativity'] },
  { label: 'Work & money', categories: ['engineering', 'dsa', 'career', 'finance'] },
  { label: 'Life', categories: ['relationships', 'home', 'attention', 'other'] },
];

/** The icon and tone a habit wears unless it picks its own. */
export const CATEGORY_APPEARANCE: Record<HabitCategory, { icon: HabitIconKey; tone: HabitTone }> = {
  fitness: { icon: 'dumbbell', tone: 'coral' },
  health: { icon: 'heart-pulse', tone: 'teal' },
  sleep: { icon: 'moon', tone: 'indigo' },
  mindfulness: { icon: 'flower', tone: 'violet' },
  reading: { icon: 'book-open', tone: 'amber' },
  learning: { icon: 'graduation-cap', tone: 'ocean' },
  creativity: { icon: 'palette', tone: 'rose' },
  engineering: { icon: 'code', tone: 'ocean' },
  dsa: { icon: 'puzzle', tone: 'violet' },
  career: { icon: 'briefcase', tone: 'sage' },
  finance: { icon: 'wallet', tone: 'sage' },
  relationships: { icon: 'users', tone: 'rose' },
  home: { icon: 'house', tone: 'amber' },
  attention: { icon: 'smartphone', tone: 'rose' },
  other: { icon: 'leaf', tone: 'slate' },
};

/** A few starting points per area, offered as one-tap names when creating a habit. */
export const CATEGORY_IDEAS: Record<HabitCategory, readonly string[]> = {
  fitness: ['Gym workout', 'Morning run', '10-minute stretch'],
  health: ['Drink 8 glasses of water', '8,000 steps', 'Cook at home'],
  sleep: ['In bed by 11', 'No screens after 10', 'Wind-down routine'],
  mindfulness: ['Meditate', 'Journal', 'Gratitude note'],
  reading: ['Read 20 pages', 'Read before bed', 'One long article'],
  learning: ['Language practice', 'Course lesson', 'Learn one new thing'],
  creativity: ['Write 300 words', 'Practice guitar', 'Sketch'],
  engineering: ['Deep work block', 'Read source code', 'Ship something small'],
  dsa: ['Solve one problem', 'Review a pattern', 'Mock interview'],
  career: ['Send one application', 'Reach out to someone', 'Update portfolio'],
  finance: ['Log spending', 'Weekly budget check', 'No-spend day'],
  relationships: ['Call family', 'Message a friend', 'Phone-free dinner'],
  home: ['Tidy for 10 minutes', 'Water the plants', 'Inbox zero'],
  attention: ['No phone first hour', 'Screen time under 2 h', 'Single-task block'],
  other: ['Something small, every day'],
};

/** Units that suit each area, offered as quick picks for the target. */
export const CATEGORY_UNITS: Record<HabitCategory, readonly string[]> = {
  fitness: ['min', 'km', 'reps'],
  health: ['glasses', 'steps', 'min'],
  sleep: ['hours', 'min'],
  mindfulness: ['min', 'pages'],
  reading: ['pages', 'min', 'chapters'],
  learning: ['min', 'lessons'],
  creativity: ['words', 'min', 'pages'],
  engineering: ['min', 'hours'],
  dsa: ['problems', 'min'],
  career: ['applications', 'messages'],
  finance: ['entries', 'min'],
  relationships: ['calls', 'messages'],
  home: ['min', 'tasks'],
  attention: ['min', 'hours'],
  other: ['min', 'times'],
};
