import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { createTask } from '@/db/repositories/tasks';
import { useAction } from '@/hooks/useAction';
import { useToday } from '@/hooks/useToday';
import { TaskForm } from './TaskForm';

export function NewTaskPage() {
  const navigate = useNavigate();
  const today = useToday();
  const { notify } = useAction();
  const [planToday, setPlanToday] = useState(false);

  return (
    <>
      <PageHeader title="New task" />
      <TaskForm
        submitLabel="Create task"
        onCancel={() => {
          void navigate(-1);
        }}
        onSubmit={async (draft) => {
          const task = await createTask(draft, planToday ? { planFor: today } : {});
          notify({
            kind: 'success',
            message: planToday ? 'Task added to today' : 'Task added to inbox',
          });
          void navigate(`/tasks/${task.id}`, { replace: true });
        }}
      >
        <label className="checkbox-field">
          <input
            type="checkbox"
            className="checkbox"
            checked={planToday}
            onChange={(e) => {
              setPlanToday(e.target.checked);
            }}
          />
          Plan for today
        </label>
      </TaskForm>
    </>
  );
}
