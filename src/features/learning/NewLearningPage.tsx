import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { createLearningEntry, searchLearning } from '@/db/repositories/learning';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useToday } from '@/hooks/useToday';
import { LearningForm } from './LearningForm';

export function NewLearningPage() {
  const navigate = useNavigate();
  const today = useToday();
  const { notify } = useAction();
  const topics = useLiveData(useCallback(() => searchLearning({}), []));

  return (
    <>
      <PageHeader title="New entry" />
      <LearningForm
        today={today}
        topics={topics.status === 'ready' ? topics.data.topics : []}
        submitLabel="Save entry"
        onCancel={() => {
          void navigate(-1);
        }}
        onSubmit={async (draft) => {
          const entry = await createLearningEntry(draft);
          notify({ kind: 'success', message: 'Saved to your journal' });
          void navigate(`/learn/${entry.id}`, { replace: true });
        }}
      />
    </>
  );
}
