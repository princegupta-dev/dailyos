import { BookOpen, Moon, Plus, Repeat, Settings, Target } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { TodayTasks } from '../planning/TodayTasks';
import { QuickCaptureDialog } from './QuickCaptureDialog';

const OUTCOME_SLOTS = [1, 2, 3] as const;

export function TodayPage() {
  const today = useToday();
  const [capturing, setCapturing] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={formatDateKey(today)}
        actions={
          <Link to="/settings" className="icon-button" aria-label="Settings">
            <Settings size={20} aria-hidden="true" />
          </Link>
        }
      />

      <div className="today-capture">
        <button
          type="button"
          className="button button--primary button--block"
          onClick={() => {
            setCapturing(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Quick capture
        </button>
      </div>

      <Section title="Intention">
        <EmptyState
          icon={Target}
          title="No intention yet"
          description="Setting a daily intention is not available yet in this build."
        />
      </Section>

      <Section title="Top outcomes">
        <ol className="outcome-list">
          {OUTCOME_SLOTS.map((n) => (
            <li key={n} className="outcome-list__item">
              <span className="outcome-list__number" aria-hidden="true">
                {n}
              </span>
              <span>
                <span className="visually-hidden">Outcome {n}: </span>Not set
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <TodayTasks today={today} />

      <Section title="Habits">
        <EmptyState
          icon={Repeat}
          title="No habits configured"
          description="Habit tracking is not available yet in this build."
        />
      </Section>

      <Section title="Recent learning">
        <EmptyState
          icon={BookOpen}
          title="No captures yet"
          description="Learning capture is not available yet in this build."
        />
      </Section>

      <Section title="Evening review">
        <EmptyState
          icon={Moon}
          title="Reflect at the end of the day"
          description="Daily reviews are not available yet in this build."
        />
      </Section>

      {capturing && (
        <QuickCaptureDialog
          today={today}
          onClose={() => {
            setCapturing(false);
          }}
        />
      )}
    </>
  );
}
