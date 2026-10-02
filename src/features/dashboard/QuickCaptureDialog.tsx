import { useState, type SyntheticEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { TextAreaField, TextField } from '@/components/form';
import { SegmentedControl } from '@/components/SegmentedControl';
import { createLearningEntry } from '@/db/repositories/learning';
import { createTask } from '@/db/repositories/tasks';
import { useAction } from '@/hooks/useAction';

type Mode = 'note' | 'task';

const MODES: readonly { value: Mode; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'task', label: 'Task' },
];

interface QuickCaptureDialogProps {
  today: string;
  onClose: () => void;
}

/**
 * Fastest path to get something out of your head. Learning needs only one sentence; details
 * can be added later from the Learn tab. Tasks go to the inbox unless planned for today.
 */
export function QuickCaptureDialog({ today, onClose }: QuickCaptureDialogProps) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState<Mode>('note');
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [planToday, setPlanToday] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (text.trim() === '') return;
    const result =
      mode === 'note'
        ? await run(() => createLearningEntry({ content: text, topic }), 'Saved to your journal')
        : await run(
            () => createTask({ title: text }, planToday ? { planFor: today } : {}),
            planToday ? 'Task added to today' : 'Task added to inbox',
          );
    if (result.ok) onClose();
  };

  return (
    <Dialog open title="Quick capture" onClose={onClose}>
      <SegmentedControl label="Capture type" value={mode} options={MODES} onChange={setMode} />
      <form className="form" onSubmit={(e) => void submit(e)}>
        {mode === 'note' ? (
          <>
            <TextAreaField
              label="What did you do or learn?"
              rows={4}
              value={text}
              maxLength={20_000}
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
            <TextField
              label="Topic"
              hint="Optional"
              value={topic}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => {
                setTopic(e.target.value);
              }}
            />
          </>
        ) : (
          <>
            <TextField
              label="Task"
              value={text}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
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
          </>
        )}
        <div className="form__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={pending || text.trim() === ''}
          >
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
