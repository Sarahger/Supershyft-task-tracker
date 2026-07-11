import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { STATUS_LABELS } from '../../types';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';

interface MobileTaskCardProps {
  task: Task;
  onClick: () => void;
}

function formatDueDate(dueDate: string) {
  const d = new Date(dueDate);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

function statusAccentClass(status: string) {
  const map: Record<string, string> = {
    backlog: 'mobile-card-accent-neutral',
    to_do: 'mobile-card-accent-todo',
    in_progress: 'mobile-card-accent-progress',
    blocked: 'mobile-card-accent-blocked',
    ready_for_review: 'mobile-card-accent-review',
    in_review: 'mobile-card-accent-review',
    changes_requested: 'mobile-card-accent-changes',
    approved: 'mobile-card-accent-approved',
    testing: 'mobile-card-accent-testing',
    completed: 'mobile-card-accent-approved',
    cancelled: 'mobile-card-accent-neutral',
  };
  return map[status] || 'mobile-card-accent-neutral';
}

export function MobileTaskCard({ task, onClick }: MobileTaskCardProps) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !['completed', 'cancelled'].includes(task.status);
  const primaryAssignee = task.assignees?.[0]?.user;
  const accent = statusAccentClass(task.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'mobile-task-card w-full text-left rounded-xl border border-dark-border bg-dark-card p-3.5',
        'hover:bg-dark-hover active:bg-dark-hover transition-colors duration-hover',
        'min-h-[72px] flex items-center gap-3',
        accent,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate leading-snug">{task.title}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
          {task.due_date && (
            <span className={clsx(isOverdue && 'priority-critical font-medium')}>
              {isOverdue ? 'Overdue · ' : ''}{formatDueDate(task.due_date)}
            </span>
          )}
          {!task.due_date && (
            <span>{STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {primaryAssignee ? (
          <Avatar name={`${primaryAssignee.first_name} ${primaryAssignee.last_name}`} size="sm" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-dark-muted shrink-0" />
        )}
        <ChevronRight className="h-4 w-4 text-text-muted" />
      </div>
    </button>
  );
}
