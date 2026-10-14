import { Hand, type LucideIcon } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { TextField } from '@/components/form';
import { Section } from '@/components/Section';
import { updateSettings } from '@/db/repositories/settings';
import { useAction } from '@/hooks/useAction';
import { useSettings } from '@/hooks/useToday';
import { SettingsCard, SettingsRow } from './SettingsRow';

/** The name the Dashboard greets you with. Stays on this device like everything else. */
export function GreetingSettings({ icon }: { icon?: LucideIcon | undefined }) {
  const settings = useSettings();
  const { run, pending } = useAction();
  const [draft, setDraft] = useState<string>();
  if (!settings) return null;
  const saved = settings.displayName ?? '';
  const value = draft ?? saved;

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    const result = await run(
      () => updateSettings({ displayName: value }),
      value.trim() === '' ? 'Name removed' : 'Name saved',
    );
    if (result.ok) setDraft(undefined);
  };

  return (
    <Section
      title="Greeting"
      icon={icon}
      description="How the Dashboard says hello."
      className="settings-group"
    >
      <SettingsCard>
        <SettingsRow icon={Hand} tone="sage">
          <form className="form" onSubmit={(e) => void save(e)} noValidate>
            <TextField
              label="Your name"
              hint="Used to greet you on the Dashboard. Leave blank for no name."
              value={value}
              maxLength={40}
              autoComplete="given-name"
              onChange={(e) => {
                setDraft(e.target.value);
              }}
            />
            <div className="form__actions">
              <button
                type="submit"
                className="button button--primary button--compact settings-save"
                disabled={pending || value === saved}
              >
                Save
              </button>
            </div>
          </form>
        </SettingsRow>
      </SettingsCard>
    </Section>
  );
}
