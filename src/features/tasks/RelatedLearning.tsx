import { useCallback } from 'react';
import { Section } from '@/components/Section';
import { listLearningForTask } from '@/db/repositories/learning';
import { useLiveData } from '@/hooks/useLiveData';
import { LearningListItem } from '../learning/LearningListItem';

/** Learning entries that link to this task. Hidden when there are none. */
export function RelatedLearning({ taskId, today }: { taskId: string; today: string }) {
  const entries = useLiveData(useCallback(() => listLearningForTask(taskId), [taskId]));
  if (entries.status !== 'ready' || entries.data.length === 0) return null;
  return (
    <Section title="Related learning">
      <ul className="learning-list">
        {entries.data.map((entry) => (
          <LearningListItem key={entry.id} entry={entry} today={today} />
        ))}
      </ul>
    </Section>
  );
}
