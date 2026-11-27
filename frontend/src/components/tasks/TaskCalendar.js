import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, isPast, isSameDay, parseISO, } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { STATUS_LABELS } from '../../types';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_TASKS = 3;
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
function dateKey(date) {
    return format(date, 'yyyy-MM-dd');
}
function taskDueKey(task) {
    const due = parseTaskDueDate(task);
    return due ? dateKey(due) : null;
}
function CalendarTaskChip({ task, onClick, }) {
    const overdue = (() => {
        const due = parseTaskDueDate(task);
        if (!due)
            return false;
        return isPast(due) && !isToday(due) && !['completed', 'cancelled'].includes(task.status);
    })();
    return (_jsx("button", { type: "button", onClick: (e) => {
            e.stopPropagation();
            onClick();
        }, className: clsx('w-full text-left rounded px-1.5 py-1 text-xs leading-snug truncate border-l-2 transition-colors hover:bg-dark-hover', overdue ? 'border-l-2 calendar-overdue' : priorityAccent[task.priority] || priorityAccent.low, 'text-text-primary'), title: `${task.title} · ${STATUS_LABELS[task.status] || task.status}`, children: task.title }));
}
export function TaskCalendar({ tasks, undatedTasks = [], currentMonth, onMonthChange, onTaskClick, }) {
    const [selectedDay, setSelectedDay] = useState(null);
    const tasksByDate = useMemo(() => {
        const map = new Map();
        for (const task of tasks) {
            const key = taskDueKey(task);
            if (!key)
                continue;
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(task);
        }
        for (const [, dayTasks] of map) {
            dayTasks.sort((a, b) => a.title.localeCompare(b.title));
        }
        return map;
    }, [tasks]);
    const undated = undatedTasks.length ? undatedTasks : tasks.filter((t) => !taskDueKey(t));
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const datedCount = tasks.length;
    const selectedDayTasks = selectedDay ? tasksByDate.get(dateKey(selectedDay)) ?? [] : [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => onMonthChange(subMonths(currentMonth, 1)), className: "toolbar-btn p-1.5", "aria-label": "Previous month", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("h2", { className: "text-base font-semibold text-text-primary min-w-[10rem] text-center", children: format(currentMonth, 'MMMM yyyy') }), _jsx("button", { type: "button", onClick: () => onMonthChange(addMonths(currentMonth, 1)), className: "toolbar-btn p-1.5", "aria-label": "Next month", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => {
                                    const today = new Date();
                                    onMonthChange(startOfMonth(today));
                                    setSelectedDay(today);
                                }, className: "toolbar-btn text-sm", children: "Today" }), _jsxs("span", { className: "text-2xs text-text-muted", children: [datedCount, " scheduled this view", undated.length > 0 ? ` · ${undated.length} unscheduled` : ''] })] })] }), _jsxs("div", { className: "rounded-lg border border-dark-border bg-dark-card overflow-hidden", children: [_jsx("div", { className: "grid grid-cols-7 border-b border-dark-border bg-dark-muted", children: WEEKDAYS.map((day) => (_jsx("div", { className: "px-2 py-2 text-center text-2xs font-medium uppercase tracking-wider text-text-muted", children: day }, day))) }), _jsx("div", { className: "grid grid-cols-7 auto-rows-fr min-h-[480px]", children: days.map((day) => {
                            const key = dateKey(day);
                            const dayTasks = tasksByDate.get(key) ?? [];
                            const inMonth = isSameMonth(day, currentMonth);
                            const today = isToday(day);
                            const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                            const visible = dayTasks.slice(0, MAX_VISIBLE_TASKS);
                            const hiddenCount = dayTasks.length - visible.length;
                            return (_jsxs("div", { role: "button", tabIndex: 0, onClick: () => setSelectedDay(day), onKeyDown: (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedDay(day);
                                    }
                                }, className: clsx('min-h-[88px] border-b border-r border-dark-border p-1.5 flex flex-col gap-1 transition-colors cursor-pointer', !inMonth && 'bg-surface-subtle', inMonth && 'bg-dark-card', today && 'ring-1 ring-inset ring-accent-primary/30 bg-accent-primary/5', selected && 'bg-surface-highlight', 'hover:bg-dark-hover'), children: [_jsxs("div", { className: "flex items-center justify-between gap-1", children: [_jsx("span", { className: clsx('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums', today && 'calendar-today-pill font-semibold', !today && inMonth && 'text-text-primary', !today && !inMonth && 'text-text-muted'), children: format(day, 'd') }), dayTasks.length > 0 && (_jsx("span", { className: "text-2xs text-text-muted tabular-nums", children: dayTasks.length }))] }), _jsxs("div", { className: "flex flex-col gap-0.5 flex-1 overflow-y-auto max-h-28", children: [visible.map((task) => (_jsx(CalendarTaskChip, { task: task, onClick: () => onTaskClick(task.id) }, task.id))), hiddenCount > 0 && (_jsxs("span", { className: "text-2xs text-text-muted px-1", children: ["+", hiddenCount, " more"] }))] })] }, key));
                        }) })] }), tasks.length === 0 && (_jsx("p", { className: "text-sm text-text-muted px-1", children: "No tasks with due dates in this month. Try another month, clear filters, or add due dates to your tasks." })), (selectedDay || undated.length > 0) && (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [selectedDay && (_jsxs("div", { className: "rounded-lg border border-dark-border bg-dark-card p-4", children: [_jsxs("h3", { className: "text-sm font-medium text-text-primary mb-3", children: [format(selectedDay, 'EEEE, MMMM d, yyyy'), _jsxs("span", { className: "text-text-muted font-normal ml-2", children: ["(", selectedDayTasks.length, ")"] })] }), selectedDayTasks.length ? (_jsx("ul", { className: "space-y-2", children: selectedDayTasks.map((task) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onTaskClick(task.id), className: "w-full text-left rounded-md border border-dark-border bg-surface-subtle px-3 py-2 hover:bg-dark-hover transition-colors", children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: task.title }), _jsx("p", { className: "text-2xs text-text-muted mt-0.5 capitalize", children: STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ') })] }) }, task.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "No tasks due on this day." }))] })), undated.length > 0 && (_jsxs("div", { className: "rounded-lg border border-dark-border bg-dark-card p-4", children: [_jsxs("h3", { className: "text-sm font-medium text-text-primary mb-3", children: ["No due date", _jsxs("span", { className: "text-text-muted font-normal ml-2", children: ["(", undated.length, ")"] })] }), _jsx("ul", { className: "space-y-2 max-h-64 overflow-y-auto", children: undated.map((task) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onTaskClick(task.id), className: "w-full text-left rounded-md border border-dark-border bg-dark-muted/30 px-3 py-2 hover:bg-dark-hover transition-colors", children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: task.title }), _jsx("p", { className: "text-2xs text-text-muted mt-0.5 capitalize", children: STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ') })] }) }, task.id))) })] }))] }))] }));
}
export function TaskCalendarSkeleton() {
    return (_jsxs("div", { className: "rounded-lg border border-dark-border bg-dark-card overflow-hidden animate-pulse", children: [_jsx("div", { className: "h-10 bg-dark-muted border-b border-dark-border" }), _jsx("div", { className: "grid grid-cols-7 min-h-[480px]", children: Array.from({ length: 35 }).map((_, i) => (_jsx("div", { className: "min-h-[88px] border-b border-r border-dark-border bg-surface-subtle" }, i))) })] }));
}
