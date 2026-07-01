import clsx from 'clsx';
import { STATUS_LABELS, PRIORITY_LABELS, HEALTH_LABELS } from '../../types';

export const statusStyles: Record<string, string> = {
  unassigned: 'bg-white/5 text-text-muted',
  backlog: 'bg-white/5 text-text-muted',
  to_do: 'bg-blue-500/15 text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  blocked: 'bg-red-500/15 text-red-300',
  ready_for_review: 'bg-purple-500/15 text-purple-300',
  in_review: 'bg-purple-500/15 text-purple-300',
  changes_requested: 'bg-orange-500/15 text-orange-300',
  approved: 'bg-emerald-500/15 text-emerald-300',
  testing: 'bg-cyan-500/15 text-cyan-300',
  bugs_found: 'bg-rose-500/15 text-rose-300',
  completed: 'bg-white/5 text-text-muted',
  cancelled: 'bg-white/5 text-text-muted line-through',
};

export const priorityStyles: Record<string, string> = {
  low: 'text-text-muted',
  medium: 'text-text-secondary',
  high: 'text-amber-400',
  critical: 'text-red-400',
};

const priorityDots: Record<string, string> = {
  low: 'bg-text-muted',
  medium: 'bg-text-secondary',
  high: 'bg-amber-400',
  critical: 'bg-red-400',
};

const healthStyles: Record<string, string> = {
  healthy: 'text-emerald-400',
  at_risk: 'text-amber-400',
  delayed: 'text-red-400',
  completed: 'text-text-muted',
};

export function StatusBadge({ status }: { status: string; compact?: boolean }) {
  return (
    <span className={clsx('chip', statusStyles[status] || 'bg-white/5 text-text-secondary')}>
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
    <span className={clsx('chip bg-white/5', healthStyles[health] || 'text-text-secondary')}>
      {HEALTH_LABELS[health] || health}
    </span>
  );
}

export function TypeBadge({ name }: { name: string }) {
  return <span className="chip bg-white/5 text-text-secondary">{name}</span>;
}

export function TagBadge({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="chip bg-white/5 text-text-secondary"
      style={color ? { borderLeft: `2px solid ${color}`, paddingLeft: '6px' } : undefined}
    >
      {name}
    </span>
  );
}
