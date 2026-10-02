import { useState, type SyntheticEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { TextField } from '@/components/form';
import { createTask } from '@/db/repositories/tasks';
import { useAction } from '@/hooks/useAction';

interface QuickCaptureDialogProps {
  today: string;
  onClose: () => void;
}

/** Fastest path to get something out of your head: one field, saved to the inbox by default. */
export function QuickCaptureDialog({ today, onClose }: QuickCaptureDialogProps) {
  const { run, pending } = useAction();
  const [title, setTitle] = useState('');
  const [planToday, setPlanToday] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (title.trim() === '') return;
    const result = await run(
      () => createTask({ title }, planToday ? { planFor: today } : {}),
      planToday ? 'Task added to today' : 'Task added to inbox',
    );
    if (result.ok) onClose();
  };

  return (
    <Dialog open title="Quick capture" onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <TextField
          label="Task"
          value={title}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
        <label className="checkbox-field">
          <input
            type="checkbox"
            className="checkbox"
            checked={planToday}
            onChange={(e) => {
              setPlanToday(e.target.checked);
            }}
          />
          Plan for today
        </label>
        <div className="form__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={pending || title.trim() === ''}
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
