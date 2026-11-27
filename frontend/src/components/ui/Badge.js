import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { STATUS_LABELS, PRIORITY_LABELS, HEALTH_LABELS } from '../../types';
export const statusStyles = {
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
export const priorityStyles = {
    low: 'text-text-muted',
    medium: 'text-text-secondary',
    high: 'priority-high',
    critical: 'priority-critical',
};
const priorityDots = {
    low: 'bg-text-muted',
    medium: 'bg-text-secondary',
    high: 'priority-dot-high',
    critical: 'priority-dot-critical',
};
const healthStyles = {
    healthy: 'health-healthy',
    at_risk: 'health-risk',
    delayed: 'health-delayed',
    completed: 'text-text-muted',
};
export function StatusBadge({ status }) {
    return (_jsx("span", { className: clsx(statusStyles[status] || 'chip badge-neutral'), children: STATUS_LABELS[status] || status }));
}
export function PriorityBadge({ priority }) {
    return (_jsxs("span", { className: clsx('chip bg-transparent px-0', priorityStyles[priority] || 'text-text-secondary'), children: [_jsx("span", { className: clsx('h-1.5 w-1.5 rounded-full shrink-0', priorityDots[priority] || 'bg-text-muted') }), PRIORITY_LABELS[priority] || priority] }));
}
export function HealthBadge({ health }) {
    return (_jsx("span", { className: clsx('chip badge-neutral', healthStyles[health] || 'text-text-secondary'), children: HEALTH_LABELS[health] || health }));
}
export function TypeBadge({ name }) {
    return _jsx("span", { className: "chip badge-neutral text-text-secondary", children: name });
}
export function TagBadge({ name, color }) {
    return (_jsx("span", { className: "chip badge-neutral text-text-secondary", style: color ? { borderLeft: `2px solid ${color}`, paddingLeft: '6px' } : undefined, children: name }));
}
