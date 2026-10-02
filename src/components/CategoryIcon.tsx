import {
  Briefcase,
  BookOpen,
  CodeXml,
  Dumbbell,
  Leaf,
  Puzzle,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import type { HabitCategory } from '@/domain/categories';

const ICONS: Record<HabitCategory, LucideIcon> = {
  engineering: CodeXml,
  dsa: Puzzle,
  fitness: Dumbbell,
  reading: BookOpen,
  career: Briefcase,
  attention: Smartphone,
  other: Leaf,
};

/** Soft colored tile identifying a habit's category. Decorative; the name carries meaning. */
export function CategoryIcon({
  category = 'other',
  size = 'md',
}: {
  category?: HabitCategory | undefined;
  size?: 'sm' | 'md';
}) {
  const Icon = ICONS[category];
  return (
    <span
      className={`category-icon category-icon--${category} category-icon--${size}`}
      aria-hidden="true"
    >
      <Icon size={size === 'sm' ? 16 : 20} strokeWidth={1.9} />
    </span>
  );
}
