import { Check, Minus, X } from 'lucide-react';
import { setHabitStatus } from '@/db/repositories/habits';
import type { HabitStatus } from '@/domain/habit';
import { useAction } from '@/hooks/useAction';

const OPTIONS: readonly { status: HabitStatus; label: string; icon: typeof Check }[] = [
  { status: 'completed', label: 'Done', icon: Check },
  { status: 'skipped', label: 'Skip', icon: Minus },
  { status: 'missed', label: 'Missed', icon: X },
];

interface HabitStatusButtonsProps {
  habitId: string;
  habitName: string;
  date: string;
  current: HabitStatus | undefined;
  /** Hide "Missed" where it adds noise (e.g. today, where pending is the default). */
  showMissed?: boolean;
}

/** Toggle buttons for one habit on one date. Pressing the active status clears it. */
export function HabitStatusButtons({
  habitId,
  habitName,
  date,
  current,
  showMissed = false,
}: HabitStatusButtonsProps) {
  const { run, pending } = useAction();
  return (
    <div className="status-buttons" role="group" aria-label={`${habitName} status`}>
      {OPTIONS.filter((o) => showMissed || o.status !== 'missed').map(
        ({ status, label, icon: Icon }) => {
          const active = current === status;
          return (
            <button
              key={status}
              type="button"
              className={`status-button status-button--${status}`}
              aria-pressed={active}
              disabled={pending}
              onClick={() => void run(() => setHabitStatus(habitId, date, active ? null : status))}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          );
        },
      )}
    </div>
  );
}
