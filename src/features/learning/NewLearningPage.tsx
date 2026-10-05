import { ArrowLeft } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
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
    <div className="learn-form-page">
      <PageHeader
        title="New entry"
        description="Something you learned, in your own words."
        leading={
          <Link to="/learn" className="icon-button" aria-label="Back to Learn">
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />
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
    </div>
  );
}
