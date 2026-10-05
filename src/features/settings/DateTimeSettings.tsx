import { CalendarRange, Globe, type LucideIcon } from 'lucide-react';
import { SelectField } from '@/components/form';
import { Section } from '@/components/Section';
import { updateSettings } from '@/db/repositories/settings';
import { useAction } from '@/hooks/useAction';
import { useSettings, useToday } from '@/hooks/useToday';
import { formatDateKey, getDeviceTimeZone } from '@/lib/dates';
import { SettingsCard, SettingsRow } from './SettingsRow';

const DEVICE = '__device__';

function timeZoneOptions(current: string | undefined): string[] {
  const zones = 'supportedValuesOf' in Intl ? Intl.supportedValuesOf('timeZone') : [];
  // Keep the saved zone selectable even if this browser doesn't list it.
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}

export function DateTimeSettings({ icon }: { icon?: LucideIcon | undefined }) {
  const settings = useSettings();
  const today = useToday();
  const { run, pending } = useAction();
  const device = getDeviceTimeZone();

  if (!settings) return null;

  const zoneOptions = [
    { value: DEVICE, label: `Follow this device (${device})` },
    ...timeZoneOptions(settings.timeZone).map((zone) => ({
      value: zone,
      label: zone.replaceAll('_', ' '),
    })),
  ];

  return (
    <Section
      title="Date and time"
      icon={icon}
      description="When your days and weeks begin."
      className="settings-group"
    >
      <SettingsCard>
        <SettingsRow icon={Globe} tone="ocean">
          <SelectField
            label="Time zone"
            hint="Decides which calendar day “today” is. Past records keep the date they were saved with."
            value={settings.timeZone ?? DEVICE}
            options={zoneOptions}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.value;
              void run(
                () => updateSettings({ timeZone: value === DEVICE ? null : value }),
                'Time zone updated',
              );
            }}
          />
          <p className="settings-row__note">
            Today here is <strong>{formatDateKey(today)}</strong>
          </p>
        </SettingsRow>
        <SettingsRow icon={CalendarRange} tone="violet">
          <SelectField
            label="Week starts on"
            hint="Used for weekly habits and weekly reviews."
            value={String(settings.weekStartsOn)}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.value === '0' ? 0 : 1;
              void run(() => updateSettings({ weekStartsOn: value }), 'Week start updated');
            }}
          />
        </SettingsRow>
      </SettingsCard>
    </Section>
  );
}
