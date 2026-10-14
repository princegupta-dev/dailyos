import { Info, WifiOff } from 'lucide-react';
import { Section } from '@/components/Section';
import { SettingsCard, SettingsRow } from '../settings/SettingsRow';
import { SubpageHero } from '../settings/SubpageHero';

export function AboutPage() {
  return (
    <div className="settings-page">
      <SubpageHero eyebrow="DailyOS" title="About" parent={{ to: '/profile', label: 'Profile' }} />
      <Section title="About" icon={Info} className="settings-group">
        <SettingsCard>
          <SettingsRow
            icon={WifiOff}
            tone="slate"
            title="Works offline"
            description="Install DailyOS from your browser to use it like an app, with or without a connection."
          />
        </SettingsCard>
        <p className="settings-footer">
          DailyOS · <em>small steps, kept kindly</em>
        </p>
      </Section>
    </div>
  );
}
