import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon className="empty-state__icon" size={20} aria-hidden="true" />
      <div>
        <p className="empty-state__title">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  );
}
