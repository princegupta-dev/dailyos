import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { createHabit } from '@/db/repositories/habits';
import { useAction } from '@/hooks/useAction';
import { HabitForm } from './HabitForm';

export function NewHabitPage() {
  const navigate = useNavigate();
  const { notify } = useAction();
  return (
    <>
      <PageHeader title="New habit" description="It starts counting today." />
      <HabitForm
        submitLabel="Create habit"
        onCancel={() => {
          void navigate(-1);
        }}
        onSubmit={async (draft) => {
          await createHabit(draft);
          notify({ kind: 'success', message: 'Habit created' });
          void navigate('/settings', { replace: true });
        }}
      />
    </>
  );
}
