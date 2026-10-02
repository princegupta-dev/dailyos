import { Info } from 'lucide-react';
import { EmptyState } from './EmptyState';

/**
 * Shown while a screen is layout-only so nobody mistakes it for working functionality.
 * Remove from a screen as soon as that screen persists real data.
 */
export function FoundationNotice() {
  return (
    <div className="foundation-notice">
      <EmptyState
        icon={Info}
        title="Preview build"
        description="This screen shows layout only. Saving data is not available yet."
      />
    </div>
  );
}
