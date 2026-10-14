import { Database } from 'lucide-react';
import { DataSettings } from '../settings/DataSettings';
import { MoneyDataSettings } from '../settings/MoneyDataSettings';
import { SubpageHero } from '../settings/SubpageHero';

/** Privacy, backup and restore, and clearing data. */
export function DataPrivacyPage() {
  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="Everything stays on this device"
        title="Data & privacy"
        parent={{ to: '/profile', label: 'Profile' }}
      />
      <DataSettings icon={Database} />
      <MoneyDataSettings />
    </div>
  );
}
