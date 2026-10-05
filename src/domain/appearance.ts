/**
 * How a habit looks and when it usually happens. All optional: a habit without its own icon
 * or tone uses its category's, and one without a time of day fits anytime.
 */

/** Color pairs for habit tiles. Each has a soft background and a readable foreground. */
export const HABIT_TONES = [
  'sage',
  'teal',
  'ocean',
  'indigo',
  'violet',
  'rose',
  'coral',
  'amber',
  'slate',
] as const;
export type HabitTone = (typeof HABIT_TONES)[number];

export const TONE_LABELS: Record<HabitTone, string> = {
  sage: 'Sage',
  teal: 'Teal',
  ocean: 'Ocean',
  indigo: 'Indigo',
  violet: 'Violet',
  rose: 'Rose',
  coral: 'Coral',
  amber: 'Amber',
  slate: 'Slate',
};

/** Icons a habit can wear, by stable key (the stored value). */
export const HABIT_ICONS = [
  'sprout',
  'flame',
  'target',
  'dumbbell',
  'footprints',
  'bike',
  'heart-pulse',
  'droplet',
  'salad',
  'moon',
  'sun',
  'coffee',
  'flower',
  'brain',
  'book-open',
  'graduation-cap',
  'languages',
  'pen-line',
  'palette',
  'music',
  'code',
  'puzzle',
  'briefcase',
  'wallet',
  'users',
  'house',
  'smartphone',
  'leaf',
] as const;
export type HabitIconKey = (typeof HABIT_ICONS)[number];

export const ICON_LABELS: Record<HabitIconKey, string> = {
  sprout: 'Sprout',
  flame: 'Flame',
  target: 'Target',
  dumbbell: 'Dumbbell',
  footprints: 'Footprints',
  bike: 'Bike',
  'heart-pulse': 'Heartbeat',
  droplet: 'Water drop',
  salad: 'Salad',
  moon: 'Moon',
  sun: 'Sun',
  coffee: 'Coffee',
  flower: 'Flower',
  brain: 'Brain',
  'book-open': 'Book',
  'graduation-cap': 'Graduation cap',
  languages: 'Languages',
  'pen-line': 'Pen',
  palette: 'Palette',
  music: 'Music',
  code: 'Code',
  puzzle: 'Puzzle',
  briefcase: 'Briefcase',
  wallet: 'Wallet',
  users: 'People',
  house: 'House',
  smartphone: 'Phone',
  leaf: 'Leaf',
};

/** When in the day a habit usually happens. Absent means anytime. */
export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

/** "Morning · after coffee", "After coffee", or undefined when neither is set. */
export function describeWhen(habit: {
  timeOfDay?: TimeOfDay | undefined;
  cue?: string | undefined;
}): string | undefined {
  const parts = [
    habit.timeOfDay ? TIME_OF_DAY_LABELS[habit.timeOfDay] : undefined,
    habit.cue,
  ].filter((p): p is string => p !== undefined && p !== '');
  if (parts.length === 0) return undefined;
  const [first = '', ...rest] = parts;
  return [first, ...rest.map((p) => p.charAt(0).toLowerCase() + p.slice(1))].join(' · ');
}
