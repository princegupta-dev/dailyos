import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {/* The icon in a tile with soft rings behind it. Decorative. */}
      <span className="empty-state__art" aria-hidden="true">
        <Icon className="empty-state__icon" size={20} />
      </span>
      <div>
        <p className="empty-state__title">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  );
}
