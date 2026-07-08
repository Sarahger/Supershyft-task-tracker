import clsx from 'clsx';
import { STATUS_LABELS, PRIORITY_LABELS, HEALTH_LABELS } from '../../types';

export const statusStyles: Record<string, string> = {
  unassigned: 'chip badge-neutral',
  backlog: 'chip badge-neutral',
  to_do: 'chip badge-todo',
  in_progress: 'chip badge-progress',
  blocked: 'chip badge-blocked',
  ready_for_review: 'chip badge-review',
  in_review: 'chip badge-review',
  changes_requested: 'chip badge-changes',
  approved: 'chip badge-approved',
  testing: 'chip badge-testing',
  bugs_found: 'chip badge-bugs',
  completed: 'chip badge-neutral',
  cancelled: 'chip badge-neutral line-through',
};

export const priorityStyles: Record<string, string> = {
  low: 'text-text-muted',
  medium: 'text-text-secondary',
  high: 'priority-high',
  critical: 'priority-critical',
};

const priorityDots: Record<string, string> = {
  low: 'bg-text-muted',
  medium: 'bg-text-secondary',
  high: 'priority-dot-high',
  critical: 'priority-dot-critical',
};

const healthStyles: Record<string, string> = {
  healthy: 'health-healthy',
  at_risk: 'health-risk',
  delayed: 'health-delayed',
  completed: 'text-text-muted',
};

export function StatusBadge({ status }: { status: string; compact?: boolean }) {
  return (
    <span className={clsx(statusStyles[status] || 'chip badge-neutral')}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={clsx('chip bg-transparent px-0', priorityStyles[priority] || 'text-text-secondary')}>
      <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', priorityDots[priority] || 'bg-text-muted')} />
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}

export function HealthBadge({ health }: { health: string }) {
  return (
    <span className={clsx('chip badge-neutral', healthStyles[health] || 'text-text-secondary')}>
      {HEALTH_LABELS[health] || health}
    </span>
  );
}

export function TypeBadge({ name }: { name: string }) {
  return <span className="chip badge-neutral text-text-secondary">{name}</span>;
}

export function TagBadge({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="chip badge-neutral text-text-secondary"
      style={color ? { borderLeft: `2px solid ${color}`, paddingLeft: '6px' } : undefined}
    >
      {name}
    </span>
  );
}
