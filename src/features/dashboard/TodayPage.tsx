import { BookOpen, CheckCircle2, Moon, Plus, Repeat, Settings, Target } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { FoundationNotice } from '@/components/FoundationNotice';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { useLocalDateKey } from '@/hooks/useLocalDateKey';
import { formatDateKey, getDeviceTimeZone } from '@/lib/dates';

const OUTCOME_SLOTS = [1, 2, 3] as const;

export function TodayPage() {
  const dateKey = useLocalDateKey(getDeviceTimeZone());

  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={formatDateKey(dateKey)}
        actions={
          <Link to="/settings" className="icon-button" aria-label="Settings">
            <Settings size={20} aria-hidden="true" />
          </Link>
        }
      />

      <FoundationNotice />

      <div className="today-capture">
        <button type="button" className="button button--primary button--block" disabled>
          <Plus size={20} aria-hidden="true" />
          Quick capture
        </button>
      </div>

      <Section title="Intention">
        <EmptyState
          icon={Target}
          title="No intention yet"
          description="A single sentence about how you want today to go."
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

      <Section title="Tasks">
        <EmptyState
          icon={CheckCircle2}
          title="Nothing planned for today"
          description="Tasks you plan for today and their progress will appear here."
        />
      </Section>

      <Section title="Habits">
        <EmptyState
          icon={Repeat}
          title="No habits configured"
          description="Habits scheduled for today will appear here once you set them up in Settings."
        />
      </Section>

      <Section title="Recent learning">
        <EmptyState
          icon={BookOpen}
          title="No captures yet"
          description="Your latest learning notes will appear here."
        />
      </Section>

      <Section title="Evening review">
        <EmptyState
          icon={Moon}
          title="Reflect at the end of the day"
          description="Compare what you planned with what happened, and choose what to carry forward."
        />
      </Section>
    </>
  );
}
