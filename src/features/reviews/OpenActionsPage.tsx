import { ListChecks } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { listOpenActions } from '@/db/repositories/reviews';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday } from '@/hooks/useToday';
import { SubpageHero } from '../settings/SubpageHero';
import { OpenActionsList } from './OpenActionsList';

const listAllOpenActions = () => listOpenActions();

/** Every next action your reviews set that isn't done yet, with ways to finish or plan it. */
export function OpenActionsPage() {
  const today = useToday();
  const open = useLiveData(listAllOpenActions);

  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="From your reviews"
        title="Open actions"
        parent={{ to: '/settings', label: 'Settings' }}
      />
      <Section
        title="Still to do"
        icon={ListChecks}
        className="settings-group"
        meta={open.status === 'ready' && open.data.length > 0 ? `${open.data.length}` : undefined}
      >
        <LiveView state={open}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No open actions"
                description="Next actions from your reviews stay here until you mark them done."
              />
            ) : (
              <OpenActionsList items={items} today={today} />
            )
          }
        </LiveView>
      </Section>
    </div>
  );
}
