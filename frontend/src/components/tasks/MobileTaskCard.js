import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { format, isToday, isTomorrow } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { STATUS_LABELS } from '../../types';
import { formatTimeTakenHours } from '../../lib/taskTiming';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { isOverdueTask } from './TaskCard';
function formatDueDate(dueDate) {
    const d = new Date(dueDate);
    if (isToday(d))
        return 'Today';
    if (isTomorrow(d))
        return 'Tomorrow';
    return format(d, 'MMM d');
}
function statusAccentClass(status) {
    const map = {
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
export function MobileTaskCard({ task, onClick }) {
    const isOverdue = isOverdueTask(task);
    const primaryAssignee = task.assignees?.[0]?.user;
    const accent = statusAccentClass(task.status);
    const timeRequired = formatTimeTakenHours(task.estimated_hours);
    return (_jsxs("button", { type: "button", onClick: onClick, className: clsx('mobile-task-card w-full text-left rounded-xl border border-dark-border bg-dark-card p-3.5', 'hover:bg-dark-hover active:bg-dark-hover transition-colors duration-hover', 'min-h-[72px] flex items-center gap-3', accent), children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-text-primary truncate leading-snug", children: task.title }), _jsxs("div", { className: "flex items-center gap-2 mt-2 flex-wrap", children: [_jsx(StatusBadge, { status: task.status }), _jsx(PriorityBadge, { priority: task.priority })] }), _jsxs("div", { className: "flex items-center gap-2 mt-2 text-xs text-text-muted flex-wrap", children: [task.due_date && (_jsxs("span", { className: clsx(isOverdue && 'priority-critical font-medium'), children: [isOverdue ? 'Overdue · ' : '', formatDueDate(task.due_date)] })), !task.due_date && (_jsx("span", { children: STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ') })), timeRequired && (_jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": true, children: "\u00B7" }), _jsx("span", { className: "tabular-nums", children: timeRequired })] }))] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [primaryAssignee ? (_jsx(Avatar, { name: `${primaryAssignee.first_name} ${primaryAssignee.last_name}`, size: "sm" })) : (_jsx("div", { className: "h-7 w-7 rounded-full bg-dark-muted shrink-0" })), _jsx(ChevronRight, { className: "h-4 w-4 text-text-muted" })] })] }));
}
