import { format, isPast, isToday, isThisWeek } from 'date-fns';
import { MessageSquare, Paperclip, AlertTriangle, Eye, FlaskConical } from 'lucide-react';
import type { Task } from '../../types';
import { StatusBadge, PriorityBadge, TagBadge } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  compact?: boolean;
}

export function TaskCard({ task, onClick, compact }: TaskCardProps) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !['completed', 'cancelled'].includes(task.status);

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:bg-dark-hover transition-colors duration-hover border-l-2 border-l-transparent"
      style={{ borderLeftColor: task.priority === 'critical' ? '#f87171' : task.priority === 'high' ? '#fb923c' : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.is_blocked && (
              <span className="chip badge-blocked flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Blocked
              </span>
            )}
            {task.review_required && task.status === 'in_review' && (
              <span className="chip badge-review flex items-center gap-1">
                <Eye className="h-3 w-3" /> Review
              </span>
            )}
            {task.testing_required && (
              <span className="chip badge-testing flex items-center gap-1">
                <FlaskConical className="h-3 w-3" /> Testing
              </span>
            )}
          </div>
          <h3 className={`font-medium text-text-primary ${compact ? 'text-sm' : ''} truncate`}>{task.title}</h3>
          {!compact && task.project_name && (
            <p className="text-xs text-text-muted mt-0.5">{task.project_name}</p>
          )}
        </div>
        {task.assignees?.length > 0 && (
          <AvatarGroup users={task.assignees.map((a) => a.user!).filter(Boolean)} />
        )}
      </div>

      {!compact && (
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {task.tags?.slice(0, 3).map((t) => <TagBadge key={t.id} name={t.name} color={t.color} />)}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            {task.comment_count ? (
              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{task.comment_count}</span>
            ) : null}
            {task.attachment_count ? (
              <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{task.attachment_count}</span>
            ) : null}
            {task.due_date && (
              <span className={isOverdue ? 'priority-critical font-medium' : ''}>
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function groupTasksByDue(tasks: Task[]) {
  const overdue: Task[] = [];
  const today: Task[] = [];
  const thisWeek: Task[] = [];
  const later: Task[] = [];
  const completed: Task[] = [];
  const blocked: Task[] = [];
  const review: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') { completed.push(task); continue; }
    if (task.status === 'blocked') { blocked.push(task); continue; }
    if (['ready_for_review', 'in_review'].includes(task.status)) { review.push(task); continue; }
    if (task.due_date) {
      const d = new Date(task.due_date);
      if (isPast(d) && !isToday(d)) overdue.push(task);
      else if (isToday(d)) today.push(task);
      else if (isThisWeek(d)) thisWeek.push(task);
      else later.push(task);
    } else {
      later.push(task);
    }
  }
  return { overdue, today, thisWeek, later, completed, blocked, review };
}
