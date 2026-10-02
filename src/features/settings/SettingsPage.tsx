import { ArrowLeft, ChevronRight, HardDrive, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { listHabits } from '@/db/repositories/habits';
import { describeSchedule } from '@/domain/habit';
import { useLiveData } from '@/hooks/useLiveData';
import { DateTimeSettings } from './DateTimeSettings';

const listAllHabits = () => listHabits(true);

export function SettingsPage() {
  const habits = useLiveData(listAllHabits);
  const [showEnded, setShowEnded] = useState(false);

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <Link to="/" className="icon-button" aria-label="Back to Today">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />

      <Section
        title="Habits"
        meta={
          <Link to="/settings/habits/new" className="link-button">
            <Plus size={16} aria-hidden="true" /> New habit
          </Link>
        }
      >
        <LiveView state={habits}>
          {(all) => {
            const active = all.filter((h) => h.archivedOn === undefined);
            const ended = all.filter((h) => h.archivedOn !== undefined);
            const visible = showEnded ? [...active, ...ended] : active;
            return (
              <>
                {visible.length === 0 ? (
                  <EmptyState
                    icon={Repeat}
                    title="No habits yet"
                    description="Add a few small habits you want to keep. Skipping a day is fine; it doesn't count against you."
                  />
                ) : (
                  <ul className="nav-list">
                    {visible.map((habit) => (
                      <li key={habit.id}>
                        <Link to={`/settings/habits/${habit.id}`} className="nav-list__link">
                          <span>
                            <span className="nav-list__label">{habit.name}</span>
                            <span className="nav-list__meta">
                              {habit.archivedOn ? 'Ended' : describeSchedule(habit)}
                            </span>
                          </span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {ended.length > 0 && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setShowEnded((v) => !v);
                    }}
                  >
                    {showEnded ? 'Hide ended habits' : `Show ended habits (${ended.length})`}
                  </button>
                )}
              </>
            );
          }}
        </LiveView>
      </Section>

      <DateTimeSettings />

      <Section title="Your data">
        <EmptyState
          icon={HardDrive}
          title="Stored only on this device"
          description="DailyOS keeps everything in this browser’s local storage. Backup export and restore are not available yet in this build."
        />
      </Section>
    </>
  );
}
