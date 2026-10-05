import {
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  CodeXml,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  GraduationCap,
  HeartPulse,
  House,
  Languages,
  Leaf,
  Moon,
  Music,
  Palette,
  PenLine,
  Puzzle,
  Salad,
  Smartphone,
  Sprout,
  Sun,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { HabitIconKey, HabitTone } from '@/domain/appearance';
import { CATEGORY_APPEARANCE, type HabitCategory } from '@/domain/categories';

/** The drawing for each stored icon key. */
export const HABIT_ICON_COMPONENTS: Record<HabitIconKey, LucideIcon> = {
  sprout: Sprout,
  flame: Flame,
  target: Target,
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  'heart-pulse': HeartPulse,
  droplet: Droplet,
  salad: Salad,
  moon: Moon,
  sun: Sun,
  coffee: Coffee,
  flower: Flower2,
  brain: Brain,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  languages: Languages,
  'pen-line': PenLine,
  palette: Palette,
  music: Music,
  code: CodeXml,
  puzzle: Puzzle,
  briefcase: Briefcase,
  wallet: Wallet,
  users: Users,
  house: House,
  smartphone: Smartphone,
  leaf: Leaf,
};

interface CategoryIconProps {
  category?: HabitCategory | undefined;
  /** The habit's own icon; defaults to the category's. */
  icon?: HabitIconKey | undefined;
  /** The habit's own tone; defaults to the category's. */
  tone?: HabitTone | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const ICON_SIZE = { sm: 16, md: 20, lg: 26 } as const;

/**
 * Soft colored tile identifying a habit: its own icon and tone if it has them, otherwise its
 * category's. Decorative; the name carries meaning.
 */
export function CategoryIcon({ category = 'other', icon, tone, size = 'md' }: CategoryIconProps) {
  // Looked up loosely: data from a newer app version may hold values this one doesn't know,
  // and those fall back rather than crash.
  const appearance: Partial<Record<string, (typeof CATEGORY_APPEARANCE)[HabitCategory]>> =
    CATEGORY_APPEARANCE;
  const icons: Partial<Record<string, LucideIcon>> = HABIT_ICON_COMPONENTS;
  const defaults = appearance[category] ?? CATEGORY_APPEARANCE.other;
  const Icon = icons[icon ?? defaults.icon] ?? Leaf;
  return (
    <span
      className={`category-icon tone--${tone ?? defaults.tone} category-icon--${size}`}
      aria-hidden="true"
    >
      <Icon size={ICON_SIZE[size]} strokeWidth={1.9} />
    </span>
  );
}
