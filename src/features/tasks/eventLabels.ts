import { STATUS_LABELS, type TaskEvent } from '@/domain/task';
import { inlineDayLabel } from '@/lib/format';

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'notes',
  priority: 'priority',
  dueDate: 'due date',
  estimatedMinutes: 'estimate',
};

/** Human-readable description of a task history entry. */
export function describeEvent(event: TaskEvent, today: string): string {
  switch (event.type) {
    case 'created':
      return event.toStatus ? `Created in ${STATUS_LABELS[event.toStatus]}` : 'Created';
    case 'edited':
      return `Edited ${(event.changedFields ?? []).map((f) => FIELD_LABELS[f] ?? f).join(', ')}`;
    case 'planned':
      return event.toDate ? `Planned for ${inlineDayLabel(event.toDate, today)}` : 'Planned';
    case 'unplanned':
      return event.fromDate
        ? `Removed from the plan for ${inlineDayLabel(event.fromDate, today)}`
        : 'Unplanned';
    case 'rescheduled':
      return event.fromDate && event.toDate
        ? `Rescheduled from ${inlineDayLabel(event.fromDate, today)} to ${inlineDayLabel(event.toDate, today)}`
        : 'Rescheduled';
    case 'started':
      return 'Started';
    case 'completed':
      return 'Completed';
    case 'reopened':
      return 'Reopened';
    case 'cancelled':
      return 'Cancelled';
    case 'archived':
      return 'Archived';
    case 'restored':
      return 'Restored from archive';
  }
}
