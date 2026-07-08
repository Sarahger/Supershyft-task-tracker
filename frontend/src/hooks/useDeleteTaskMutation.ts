import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../services/endpoints';
import { toast } from '../components/ui/Toast';

export function useDeleteTaskMutation(onDeleted?: (taskId: number) => void) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => tasksApi.delete(id, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks-picker'] });
      qc.removeQueries({ queryKey: ['task', id] });
      toast.success('Task deleted');
      onDeleted?.(id);
    },
    onError: () => toast.error('Failed to delete task'),
  });
}
