import { Pencil, ShieldCheck, Sprout } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { TextField } from '@/components/form';
import { updateSettings } from '@/db/repositories/settings';
import { useAction } from '@/hooks/useAction';
import { useSettings } from '@/hooks/useToday';

/**
 * Who this space belongs to. There are no accounts: the only profile detail is an optional
 * name, used to greet you on Today, and it stays on this device like everything else.
 */
export function ProfileCard() {
  const settings = useSettings();
  const { run, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!settings) return null;
  const name = settings.displayName;

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const result = await run(
      () => updateSettings({ displayName: draft }),
      draft.trim() === '' ? 'Name removed' : 'Name saved',
    );
    if (result.ok) setEditing(false);
  };

  return (
    <section className="profile-card" aria-labelledby="profile-title">
      <div className="profile-card__main">
        <span className="profile-card__avatar" aria-hidden="true">
          {name ? name.charAt(0).toUpperCase() : <Sprout size={26} />}
        </span>
        <div className="profile-card__text">
          <h2 id="profile-title" className="profile-card__name">
            {name ?? 'Your space'}
          </h2>
          <p className="profile-card__meta">
            <ShieldCheck size={14} aria-hidden="true" /> Private to this device · no account
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            className="profile-card__edit"
            onClick={() => {
              setDraft(name ?? '');
              setEditing(true);
            }}
          >
            <Pencil size={14} aria-hidden="true" />
            {name ? 'Edit name' : 'Add your name'}
          </button>
        )}
      </div>

      {editing && (
        <form className="form profile-card__form" onSubmit={(e) => void save(e)} noValidate>
          <TextField
            label="Your name"
            hint="Used to greet you on Today. Leave blank for no name."
            value={draft}
            maxLength={40}
            autoComplete="given-name"
            // The field appears because the person asked to edit it.
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e) => {
              setDraft(e.target.value);
            }}
          />
          <div className="form__actions">
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => {
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button--primary button--compact settings-save"
              disabled={pending}
            >
              Save
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
