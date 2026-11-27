import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, isPast, isToday, isThisWeek } from 'date-fns';
import { MessageSquare, Paperclip, AlertTriangle, Eye, FlaskConical } from 'lucide-react';
import { StatusBadge, PriorityBadge, TagBadge } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';
/** Overdue only after the due calendar day has ended (not during the due day). */
export function isOverdueTask(task) {
    if (!task.due_date || ['completed', 'cancelled'].includes(task.status))
        return false;
    const d = new Date(task.due_date);
    return isPast(d) && !isToday(d);
}
export function TaskCard({ task, onClick, compact }) {
    const isOverdue = isOverdueTask(task);
    return (_jsxs("div", { onClick: onClick, className: "card p-4 cursor-pointer hover:bg-dark-hover transition-colors duration-hover border-l-2 border-l-transparent", style: { borderLeftColor: task.priority === 'critical' ? '#f87171' : task.priority === 'high' ? '#fb923c' : undefined }, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5 flex-wrap", children: [_jsx(StatusBadge, { status: task.status }), _jsx(PriorityBadge, { priority: task.priority }), task.is_blocked && (_jsxs("span", { className: "chip badge-blocked flex items-center gap-1", children: [_jsx(AlertTriangle, { className: "h-3 w-3" }), " Blocked"] })), task.review_required && (task.status === 'in_review' || task.status === 'ready_for_review') && (_jsxs("span", { className: "chip badge-review flex items-center gap-1", children: [_jsx(Eye, { className: "h-3 w-3" }), " Review"] })), task.testing_required && (_jsxs("span", { className: "chip badge-testing flex items-center gap-1", children: [_jsx(FlaskConical, { className: "h-3 w-3" }), " Testing"] }))] }), _jsx("h3", { className: `font-medium text-text-primary ${compact ? 'text-sm' : ''} truncate`, children: task.title })] }), task.assignees?.length > 0 && (_jsx(AvatarGroup, { users: task.assignees.map((a) => a.user).filter(Boolean) }))] }), !compact && (_jsxs("div", { className: "flex items-center justify-between mt-3", children: [_jsx("div", { className: "flex items-center gap-2 flex-wrap", children: task.tags?.slice(0, 3).map((t) => _jsx(TagBadge, { name: t.name, color: t.color }, t.id)) }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-text-muted", children: [task.comment_count ? (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(MessageSquare, { className: "h-3.5 w-3.5" }), task.comment_count] })) : null, task.attachment_count ? (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Paperclip, { className: "h-3.5 w-3.5" }), task.attachment_count] })) : null, task.due_date && (_jsx("span", { className: isOverdue ? 'priority-critical font-medium' : '', children: format(new Date(task.due_date), 'MMM d') }))] })] }))] }));
}
export function isClosedOrBlockedStatus(status) {
    return ['completed', 'cancelled', 'blocked'].includes(status);
}
/** Overdue + in progress — carry into Today's list until status changes. */
export function isOverdueInProgressTask(task) {
    return task.status === 'in_progress' && isOverdueTask(task);
}
export function isDueTodayTask(task) {
    return !!task.due_date && isToday(new Date(task.due_date));
}
/** Today filter: due today, or overdue and still in progress. */
export function isVisibleInTodayList(task) {
    if (!task.due_date)
        return false;
    if (isDueTodayTask(task) && !isClosedOrBlockedStatus(task.status))
        return true;
    return isOverdueInProgressTask(task);
}
export function groupTasksByDue(tasks) {
    const overdue = [];
    const todayOverdue = [];
    const todayDue = [];
    const thisWeek = [];
    const later = [];
    const completed = [];
    const cancelled = [];
    const blocked = [];
    const review = [];
    for (const task of tasks) {
        if (task.status === 'completed') {
            completed.push(task);
            continue;
        }
        if (task.status === 'cancelled') {
            cancelled.push(task);
            continue;
        }
        if (task.status === 'blocked') {
            blocked.push(task);
            continue;
        }
        // Only overdue + in_progress stays on Today's list
        if (isOverdueInProgressTask(task)) {
            todayOverdue.push(task);
            continue;
        }
        if (['ready_for_review', 'in_review'].includes(task.status)) {
            review.push(task);
            continue;
        }
        if (task.due_date) {
            const d = new Date(task.due_date);
            if (isOverdueTask(task))
                overdue.push(task);
            else if (isToday(d))
                todayDue.push(task);
            else if (isThisWeek(d))
                thisWeek.push(task);
            else
                later.push(task);
        }
        else {
            later.push(task);
        }
    }
    return {
        overdue,
        today: [...todayOverdue, ...todayDue],
        thisWeek,
        later,
        completed,
        cancelled,
        blocked,
        review,
    };
}
/** Sections: today (incl. overdue in progress) → this week → overdue → … */
export function groupTasksByDueSections(tasks) {
    const g = groupTasksByDue(tasks);
    return [
        { label: "Today's tasks", tasks: g.today },
        { label: 'This week', tasks: g.thisWeek },
        { label: 'Overdue', tasks: g.overdue },
        { label: 'Blocked', tasks: g.blocked },
        { label: 'Waiting for review', tasks: g.review },
        { label: 'Upcoming', tasks: g.later },
        { label: 'Completed', tasks: g.completed },
        { label: 'Cancelled', tasks: g.cancelled },
    ].filter((s) => s.tasks.length > 0);
}
