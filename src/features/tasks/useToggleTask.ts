import { useCallback } from 'react';
import { completeTask, reopenTask } from '@/db/repositories/tasks';
import type { Task } from '@/domain/task';
import { useAction } from '@/hooks/useAction';

/** Checkbox behavior shared by task lists: complete an open task, reopen a done one. */
export function useToggleTask() {
  const { run, pending } = useAction();
  const toggle = useCallback(
    (task: Task) => {
      void (task.status === 'done'
        ? run(() => reopenTask(task.id), 'Task reopened')
        : run(() => completeTask(task.id), 'Task completed'));
    },
    [run],
  );
  return { toggle, pending };
}
