import { Zap } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
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

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const SAVE_SHORTCUT = IS_MAC ? '⌘ Enter' : 'Ctrl Enter';

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
  const formRef = useRef<HTMLFormElement>(null);
  const empty = text.trim() === '';

  // Put the cursor in the main field on open and whenever the capture type changes, so
  // capturing is: open, type, save.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('textarea, input:not([type="checkbox"])')?.focus();
  }, [mode]);

  const submit = async (event?: SyntheticEvent) => {
    event?.preventDefault();
    if (text.trim() === '' || pending) return;
    const result =
      mode === 'note'
        ? await run(() => createLearningEntry({ content: text, topic }), 'Saved to your journal')
        : await run(
            () => createTask({ title: text }, planToday ? { planFor: today } : {}),
            planToday ? 'Task added to today' : 'Task added to inbox',
          );
    if (result.ok) onClose();
  };

  // Cmd/Ctrl + Enter saves from any text field, including the multi-line note.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog
      open
      title="Quick capture"
      description="Get it out of your head. Tidy it up later."
      icon={Zap}
      onClose={onClose}
    >
      <SegmentedControl label="Capture type" value={mode} options={MODES} onChange={setMode} />
      <form ref={formRef} className="form quick-capture" onSubmit={(e) => void submit(e)}>
        {mode === 'note' ? (
          <>
            <TextAreaField
              label="What did you do or learn?"
              rows={4}
              value={text}
              maxLength={20_000}
              onKeyDown={onKeyDown}
              placeholder="A sentence is enough…"
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
            <TextField
              label="Topic"
              hint="Optional"
              value={topic}
              maxLength={60}
              onKeyDown={onKeyDown}
              autoComplete="off"
              placeholder="e.g. Databases"
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
              onKeyDown={onKeyDown}
              autoComplete="off"
              placeholder="What needs doing?"
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
        <div className="quick-capture__footer">
          <p className="quick-capture__hint" aria-live="polite">
            {empty ? (
              mode === 'note' ? (
                'Write something to save it.'
              ) : (
                'Name the task to save it.'
              )
            ) : (
              <>
                <kbd className="kbd">{SAVE_SHORTCUT}</kbd> to save
              </>
            )}
          </p>
          <div className="quick-capture__buttons">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={pending || empty}>
              Save
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
