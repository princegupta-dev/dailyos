import { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { TextField } from '@/components/form';
import { rescheduleTask } from '@/db/repositories/plans';
import { useAction } from '@/hooks/useAction';
import { addDays } from '@/lib/dates';
import { inlineDayLabel, relativeDayLabel } from '@/lib/format';

interface RescheduleDialogProps {
  open: boolean;
  taskId: string;
  taskTitle: string;
  fromDate: string;
  today: string;
  onClose: () => void;
}

export function RescheduleDialog({
  open,
  taskId,
  taskTitle,
  fromDate,
  today,
  onClose,
}: RescheduleDialogProps) {
  const { run, pending } = useAction();
  const [toDate, setToDate] = useState(() => addDays(fromDate < today ? today : fromDate, 1));
  const [note, setNote] = useState('');
  const valid = toDate >= today && toDate !== fromDate;

  const submit = async () => {
    const result = await run(
      () => rescheduleTask(taskId, fromDate, toDate, note),
      `Moved to ${inlineDayLabel(toDate, today)}`,
    );
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      title="Reschedule"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!valid || pending}
            onClick={() => void submit()}
          >
            Reschedule
          </button>
        </>
      }
    >
      <p className="dialog__message">
        “{taskTitle}” stays in the plan for {inlineDayLabel(fromDate, today)}, marked as
        rescheduled, so your history remains accurate.
      </p>
      <div className="quick-dates">
        {[today, addDays(today, 1)]
          .filter((d) => d !== fromDate)
          .map((d) => (
            <button
              key={d}
              type="button"
              className="chip"
              aria-pressed={toDate === d}
              onClick={() => {
                setToDate(d);
              }}
            >
              {relativeDayLabel(d, today)}
            </button>
          ))}
      </div>
      <TextField
        label="New date"
        type="date"
        min={today}
        value={toDate}
        onChange={(e) => {
          setToDate(e.target.value);
        }}
      />
      <TextField
        label="Reason"
        hint="Optional — helps spot recurring blockers in reviews"
        value={note}
        maxLength={1000}
        onChange={(e) => {
          setNote(e.target.value);
        }}
      />
    </Dialog>
  );
}
