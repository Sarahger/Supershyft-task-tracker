import { format } from 'date-fns';
import type { Task } from '../../types';

interface DeletedTasksListProps {
  tasks: Task[];
  onTaskClick: (id: number) => void;
}

function archivedByLabel(task: Task): string {
  if (task.deleted_by) {
    return `${task.deleted_by.first_name} ${task.deleted_by.last_name}`;
  }
  if (task.deletion_reason?.toLowerCase().startsWith('auto-archived')) {
    return 'System';
  }
  return 'Unknown';
}

function DeletedRow({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 rounded-lg border border-dark-border bg-dark-card hover:bg-dark-hover transition-colors"
    >
      <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
      <p className="text-sm text-text-secondary mt-1 line-clamp-2">
        {task.deletion_reason || 'No reason provided'}
      </p>
      <p className="text-xs text-text-muted mt-2">
        Archived by {archivedByLabel(task)}
        {task.deleted_at ? ` · ${format(new Date(task.deleted_at), 'MMM d, yyyy')}` : ''}
      </p>
    </button>
  );
}

export function DeletedTasksList({ tasks, onTaskClick }: DeletedTasksListProps) {
  if (!tasks.length) {
    return (
      <p className="text-sm text-text-muted py-8 text-center">
        No archived tasks yet. Completed tasks remain visible for 1 month, then stay archived here for 6 months.
      </p>
    );
  }

  return (
    <>
      <div className="hidden md:block rounded-xl border border-dark-border overflow-hidden">
        <div className="task-table-header flex items-stretch text-xs font-medium uppercase tracking-wider text-text-muted">
          <div className="db-header-cell flex-1 min-w-[200px]">Task name</div>
          <div className="db-header-cell flex-[2] min-w-[240px]">Reason</div>
          <div className="db-header-cell w-44 shrink-0">Archived by</div>
          <div className="db-header-cell w-36 shrink-0">Archived on</div>
        </div>
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onTaskClick(task.id)}
            className="db-row w-full text-left"
          >
            <div className="db-cell flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
            </div>
            <div className="db-cell flex-[2] min-w-[240px]">
              <p className="text-sm text-text-secondary line-clamp-2">
                {task.deletion_reason || 'No reason provided'}
              </p>
            </div>
            <div className="db-cell w-44 shrink-0">
              <p className="text-sm text-text-secondary truncate">{archivedByLabel(task)}</p>
            </div>
            <div className="db-cell w-36 shrink-0">
              <p className="text-sm text-text-muted tabular-nums">
                {task.deleted_at ? format(new Date(task.deleted_at), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        {tasks.map((task) => (
          <DeletedRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
        ))}
      </div>
    </>
  );
}
