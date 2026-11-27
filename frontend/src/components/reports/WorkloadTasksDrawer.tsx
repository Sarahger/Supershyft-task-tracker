import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { reportsApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { Drawer } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { STATUS_LABELS, type WorkloadBucket } from '../../types';

const BUCKET_LABELS: Record<WorkloadBucket, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  overdue: 'Overdue',
  blocked: 'Blocked',
  due_this_week: 'Due this week',
  completed: 'Done',
  in_review: 'In review',
  cancelled: 'Cancelled',
};

export interface WorkloadDrawerTarget {
  userId: number;
  personName: string;
  bucket: WorkloadBucket;
}

function formatDue(value?: string | null) {
  if (!value) return 'No due date';
  try {
    return format(parseISO(value), 'EEE, MMM d · h:mm a');
  } catch {
    return value;
  }
}

export function WorkloadTasksDrawer({
  target,
  departmentId,
  onClose,
}: {
  target: WorkloadDrawerTarget | null;
  departmentId?: number;
  onClose: () => void;
}) {
  const { openTask } = useTaskDrawer();
  const open = target != null;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'reports-workload-tasks',
      target?.userId,
      target?.bucket,
      departmentId ?? null,
    ],
    queryFn: () =>
      reportsApi
        .workloadTasks({
          user_id: target!.userId,
          bucket: target!.bucket,
          ...(departmentId ? { department_id: departmentId } : {}),
        })
        .then((r) => r.data.data),
    enabled: open,
  });

  const title = target
    ? `${BUCKET_LABELS[target.bucket]} · ${target.personName}`
    : '';

  return (
    <Drawer isOpen={open} onClose={onClose}>
      <div className="px-6 pt-14 pb-8 space-y-5" data-testid="workload-tasks-drawer">
        <header>
          <h2 className="text-base font-medium text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted mt-1">
            {data ? `${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'}` : 'Loading tasks…'}
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-text-muted py-8 text-center">Could not load tasks.</p>
        ) : !data?.tasks.length ? (
          <p className="text-sm text-text-muted py-8 text-center">No tasks in this group.</p>
        ) : (
          <ul className="rounded-lg border border-dark-border overflow-hidden divide-y divide-dark-border">
            {data.tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="w-full text-left px-4 py-3 hover:bg-dark-hover transition-colors"
                >
                  <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="chip bg-surface-muted text-text-secondary text-2xs">
                      {STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-2xs text-text-muted tabular-nums">
                      {formatDue(task.due_date)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
