import { BookOpen } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LiveView } from '@/components/LiveView';
import { Section } from '@/components/Section';
import { listDueReviews, listRecentLearning } from '@/db/repositories/learning';
import { useLiveData } from '@/hooks/useLiveData';
import { LearningListItem } from './LearningListItem';

const RECENT_COUNT = 3;
const listRecent = () => listRecentLearning(RECENT_COUNT);

export function RecentLearning({ today }: { today: string }) {
  const recent = useLiveData(listRecent);
  const due = useLiveData(useCallback(() => listDueReviews(today), [today]));
  const dueCount = due.status === 'ready' ? due.data.length : 0;

  return (
    <Section
      title="Recent learning"
      meta={
        dueCount > 0 ? (
          <Link to="/learn">
            {dueCount} {dueCount === 1 ? 'review' : 'reviews'} due
          </Link>
        ) : undefined
      }
    >
      <LiveView state={recent}>
        {(entries) =>
          entries.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No captures yet"
              description="Use Quick capture to save something you learned. One sentence is enough."
            />
          ) : (
            <ul className="learning-list">
              {entries.map((entry) => (
                <LearningListItem key={entry.id} entry={entry} today={today} />
              ))}
            </ul>
          )
        }
      </LiveView>
    </Section>
  );
}
