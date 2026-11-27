import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, format, isToday, isPast, parseISO, } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { STATUS_LABELS } from '../../types';
import { isNextWeekDate } from './TaskCard';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const priorityAccent = {
    critical: 'border-l-2 calendar-accent-critical',
    high: 'border-l-2 calendar-accent-high',
    medium: 'border-l-2 calendar-accent-medium',
    low: 'border-l-2 calendar-accent-low',
};
function parseTaskDueDate(task) {
    if (!task.due_date)
        return null;
    const parsed = parseISO(task.due_date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function WeekTaskCard({ task, onClick, }) {
    const due = parseTaskDueDate(task);
    const overdue = due && isPast(due) && !isToday(due) && !['completed', 'cancelled'].includes(task.status);
    return (_jsxs("button", { type: "button", onClick: onClick, className: clsx('w-full text-left rounded-md px-2 py-1.5 text-xs border-l-2 transition-colors hover:bg-dark-hover', overdue ? 'border-l-2 calendar-overdue' : priorityAccent[task.priority] || priorityAccent.low), children: [_jsx("p", { className: "font-medium truncate text-text-primary", children: task.title }), _jsx("p", { className: "text-2xs text-text-muted mt-0.5 truncate", children: STATUS_LABELS[task.status] || task.status })] }));
}
export function TaskWeekView({ tasks, undatedTasks = [], currentWeek, onWeekChange, onTaskClick, }) {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    // Undated tasks are treated as next week's work until a due date is set.
    const nextWeekUndated = isNextWeekDate(weekStart) ? undatedTasks : [];
    const tasksByDay = useMemo(() => {
        const map = new Map();
        for (const day of days) {
            map.set(format(day, 'yyyy-MM-dd'), []);
        }
        for (const task of tasks) {
            const due = parseTaskDueDate(task);
            if (!due)
                continue;
            const key = format(due, 'yyyy-MM-dd');
            if (map.has(key))
                map.get(key).push(task);
        }
        return map;
    }, [tasks, days]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-center gap-1 sm:gap-2 min-w-0", children: [_jsx("button", { type: "button", onClick: () => onWeekChange(subWeeks(currentWeek, 1)), className: "toolbar-btn shrink-0", "aria-label": "Previous week", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsxs("h2", { className: "text-sm font-medium text-text-primary text-center truncate min-w-0", children: [format(weekStart, 'MMM d'), " \u2013 ", format(weekEnd, 'MMM d, yyyy')] }), _jsx("button", { type: "button", onClick: () => onWeekChange(addWeeks(currentWeek, 1)), className: "toolbar-btn shrink-0", "aria-label": "Next week", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "button", onClick: () => onWeekChange(new Date()), className: "toolbar-btn text-xs", children: "This week" }) })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3", children: days.map((day, i) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayTasks = tasksByDay.get(key) ?? [];
                    const today = isToday(day);
                    return (_jsxs("div", { className: clsx('rounded-lg border min-h-[10rem] flex flex-col', today ? 'border-accent-primary/30 bg-accent-primary/5' : 'border-dark-border bg-dark-card'), children: [_jsxs("div", { className: clsx('px-3 py-2 border-b border-dark-border', today && 'bg-accent-primary/8'), children: [_jsx("p", { className: "text-2xs uppercase tracking-wider text-text-muted", children: WEEKDAYS[i] }), _jsx("p", { className: clsx('text-sm font-medium tabular-nums', today ? 'text-accent-primary' : 'text-text-primary'), children: format(day, 'MMM d') })] }), _jsx("div", { className: "flex-1 p-2 space-y-1.5 overflow-y-auto max-h-64", children: dayTasks.length ? (dayTasks.map((task) => (_jsx(WeekTaskCard, { task: task, onClick: () => onTaskClick(task.id) }, task.id)))) : (_jsx("p", { className: "text-2xs text-text-muted px-1 py-2", children: "No tasks" })) })] }, key));
                }) }), nextWeekUndated.length > 0 && (_jsxs("div", { className: "rounded-lg border border-dark-border bg-dark-card p-4", children: [_jsxs("h3", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-3", children: ["Next week \u00B7 no due date yet (", nextWeekUndated.length, ")"] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: nextWeekUndated.map((task) => (_jsx(WeekTaskCard, { task: task, onClick: () => onTaskClick(task.id) }, task.id))) })] }))] }));
}
export function TaskWeekViewSkeleton() {
    return (_jsx("div", { className: "grid grid-cols-7 gap-3", children: Array.from({ length: 7 }).map((_, i) => (_jsx("div", { className: "h-48 rounded-lg bg-surface-subtle animate-pulse border border-dark-border" }, i))) }));
}
