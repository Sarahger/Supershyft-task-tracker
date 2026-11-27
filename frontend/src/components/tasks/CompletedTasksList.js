import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { AvatarGroup } from '../ui/Avatar';
import { formatTimeTakenHours } from '../../lib/taskTiming';
function completionDate(task) {
    const raw = task.completed_at || task.deleted_at || task.updated_at;
    if (!raw)
        return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}
function groupTasksByMonth(tasks) {
    const map = new Map();
    for (const task of tasks) {
        const d = completionDate(task);
        const key = d ? format(d, 'yyyy-MM') : 'unknown';
        const label = d ? format(d, 'MMMM yyyy') : 'No date';
        const sortKey = d ? d.getFullYear() * 100 + (d.getMonth() + 1) : 0;
        const existing = map.get(key);
        if (existing) {
            existing.tasks.push(task);
        }
        else {
            map.set(key, { label, sortKey, tasks: [task] });
        }
    }
    return Array.from(map.entries())
        .sort((a, b) => b[1].sortKey - a[1].sortKey)
        .map(([key, group]) => ({
        key,
        label: group.label,
        tasks: group.tasks.sort((a, b) => {
            const da = completionDate(a)?.getTime() ?? 0;
            const db = completionDate(b)?.getTime() ?? 0;
            return db - da;
        }),
    }));
}
function DueDateCell({ date, status }) {
    if (!date)
        return _jsx("span", { className: "text-text-muted text-sm", children: "\u2014" });
    const d = new Date(date);
    const overdue = isPast(d) && !isToday(d) && !['completed', 'cancelled'].includes(status);
    return (_jsx("span", { className: clsx('text-sm tabular-nums', overdue ? 'priority-critical' : 'text-text-muted'), children: format(d, 'MMM d, yyyy') }));
}
function AssigneesCell({ task }) {
    const users = task.assignees?.map((a) => a.user).filter(Boolean) ?? [];
    if (!users.length) {
        return _jsx("span", { className: "text-sm text-text-muted", children: "\u2014" });
    }
    return (_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(AvatarGroup, { users: users, max: 3 }), _jsx("span", { className: "text-sm text-text-secondary truncate", children: users.map((u) => `${u.first_name} ${u.last_name}`).join(', ') })] }));
}
function CompletedRow({ task, onClick }) {
    const time = formatTimeTakenHours(task.estimated_hours);
    const users = task.assignees?.map((a) => a.user).filter(Boolean) ?? [];
    return (_jsxs("button", { type: "button", onClick: onClick, className: "w-full text-left px-4 py-3.5 rounded-lg border border-dark-border bg-dark-card hover:bg-dark-hover transition-colors", children: [_jsx("p", { className: "text-sm font-medium text-text-primary leading-snug", children: task.title }), _jsx("div", { className: "flex items-center gap-2 mt-2.5 min-w-0", children: users.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(AvatarGroup, { users: users, max: 3 }), _jsx("span", { className: "text-xs text-text-secondary truncate", children: users.map((u) => `${u.first_name} ${u.last_name}`).join(', ') })] })) : (_jsx("span", { className: "text-xs text-text-muted", children: "Unassigned" })) }), _jsxs("div", { className: "flex items-center gap-3 mt-2 text-xs text-text-muted", children: [_jsx("span", { className: "tabular-nums", children: time ?? '—' }), _jsx("span", { "aria-hidden": true, children: "\u00B7" }), _jsx(DueDateCell, { date: task.due_date, status: task.status })] })] }));
}
function MonthSection({ label, count, defaultOpen, children, }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("section", { className: "mb-8", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-2 mb-3 px-1 text-left group", "aria-expanded": open, children: [_jsx(ChevronDown, { className: clsx('h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200', !open && '-rotate-90') }), _jsxs("h2", { className: "text-xs font-medium uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors", children: [label, " \u00B7 ", count] })] }), open && children] }));
}
export function CompletedTasksList({ tasks, onTaskClick }) {
    const months = useMemo(() => groupTasksByMonth(tasks), [tasks]);
    if (!tasks.length) {
        return (_jsx("p", { className: "text-sm text-text-muted py-8 text-center", children: "No completed tasks yet." }));
    }
    return (_jsx("div", { children: months.map((month, index) => (_jsxs(MonthSection, { label: month.label, count: month.tasks.length, defaultOpen: index === 0, children: [_jsxs("div", { className: "hidden md:block rounded-xl border border-dark-border overflow-hidden", children: [_jsxs("div", { className: "task-table-header flex items-stretch text-xs font-medium uppercase tracking-wider text-text-muted", children: [_jsx("div", { className: "db-header-cell flex-[2] min-w-[220px]", children: "Task name" }), _jsx("div", { className: "db-header-cell flex-1 min-w-[180px]", children: "Assignees" }), _jsx("div", { className: "db-header-cell w-28 shrink-0", children: "Time" }), _jsx("div", { className: "db-header-cell w-36 shrink-0", children: "Due date" })] }), month.tasks.map((task) => (_jsxs("button", { type: "button", onClick: () => onTaskClick(task.id), className: "db-row w-full text-left", children: [_jsx("div", { className: "db-cell flex-[2] min-w-[220px]", children: _jsx("p", { className: "text-sm font-medium text-text-primary leading-snug line-clamp-2", children: task.title }) }), _jsx("div", { className: "db-cell flex-1 min-w-[180px]", children: _jsx(AssigneesCell, { task: task }) }), _jsx("div", { className: "db-cell w-28 shrink-0", children: _jsx("span", { className: "text-sm text-text-muted tabular-nums", children: formatTimeTakenHours(task.estimated_hours) ?? '—' }) }), _jsx("div", { className: "db-cell w-36 shrink-0", children: _jsx(DueDateCell, { date: task.due_date, status: task.status }) })] }, task.id)))] }), _jsx("div", { className: "md:hidden space-y-2", children: month.tasks.map((task) => (_jsx(CompletedRow, { task: task, onClick: () => onTaskClick(task.id) }, task.id))) })] }, month.key))) }));
}
