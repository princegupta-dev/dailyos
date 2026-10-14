import {
  ChartNoAxesColumn,
  Compass,
  Lightbulb,
  ListChecks,
  ListTodo,
  NotebookPen,
  Sparkles,
  Target,
} from 'lucide-react';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';
import { SettingsCard, SettingsLinkRow } from './SettingsRow';

/**
 * The Settings hub: everything for looking back and steering — insights, reviews, tasks
 * and the actions reviews create, learnings, and intentions. Each row opens its own screen.
 * App preferences and data live under Profile.
 */
export function SettingsPage() {
  const today = useToday();
  return (
    <div className="settings-page">
      <PageHero
        eyebrow={formatDateKey(today, undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        title="Settings"
        subtitle={
          <>
            Insights, reflection, and <em>everything else</em>.
          </>
        }
      />

      <Section title="Insights & reviews" icon={ChartNoAxesColumn} className="settings-group">
        <SettingsCard>
          <SettingsLinkRow
            to="/insights"
            icon={ChartNoAxesColumn}
            tone="ocean"
            title="Insights"
            description="Habit and money patterns, trends, and weekly or monthly analysis"
          />
          <SettingsLinkRow
            to="/review"
            icon={NotebookPen}
            tone="indigo"
            title="Reviews"
            description="Daily, weekly, and monthly reviews, past reviews, and reflections"
          />
        </SettingsCard>
      </Section>

      <Section title="Tasks & actions" icon={ListChecks} className="settings-group">
        <SettingsCard>
          <SettingsLinkRow
            to="/tasks"
            icon={ListTodo}
            tone="teal"
            title="Tasks"
            description="Inbox, active, and done, with each task’s history"
          />
          <SettingsLinkRow
            to="/settings/actions"
            icon={Sparkles}
            tone="violet"
            title="Open actions"
            description="Next actions your reviews set, until they’re done"
          />
        </SettingsCard>
      </Section>

      <Section title="Self-awareness & focus" icon={Compass} className="settings-group">
        <SettingsCard>
          <SettingsLinkRow
            to="/learn"
            icon={Lightbulb}
            tone="amber"
            title="Learnings"
            description="Notes, lessons, observations, and reflections"
          />
          <SettingsLinkRow
            to="/settings/focus"
            icon={Target}
            tone="rose"
            title="Intentions & priorities"
            description="Today’s focus, what’s next, and earlier days"
          />
        </SettingsCard>
      </Section>
    </div>
  );
}
