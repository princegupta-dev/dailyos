import { BellOff, Clock, Repeat, Smile, Wallet } from 'lucide-react';
import { Section } from '@/components/Section';
import { DateTimeSettings } from '../settings/DateTimeSettings';
import { GreetingSettings } from '../settings/GreetingSettings';
import { MoneySettings } from '../settings/MoneySettings';
import { SettingsCard, SettingsRow } from '../settings/SettingsRow';
import { SubpageHero } from '../settings/SubpageHero';

/** App-wide preferences: greeting, date and time, money defaults, and habit reminders. */
export function PreferencesPage() {
  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="Make DailyOS yours"
        title="App preferences"
        parent={{ to: '/profile', label: 'Profile' }}
      />

      <GreetingSettings icon={Smile} />

      <DateTimeSettings icon={Clock} />

      <MoneySettings icon={Wallet} />

      <Section
        title="Habit reminders"
        icon={Repeat}
        description="How habits show up through the day."
        className="settings-group"
      >
        <SettingsCard>
          <SettingsRow
            icon={BellOff}
            tone="amber"
            title="Reminders"
            description={
              <>
                A habit’s time of day and cue show on the Dashboard as a gentle anchor. DailyOS
                never sends notifications, so it <em>never nags</em>.
              </>
            }
          />
        </SettingsCard>
      </Section>
    </div>
  );
}
