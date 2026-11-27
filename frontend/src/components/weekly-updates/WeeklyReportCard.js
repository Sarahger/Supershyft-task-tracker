import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';
import { formatHoursLabel, mondayOf, toDateInput } from '../../lib/weeklyPlanParse';
import { Avatar } from '../ui/Avatar';
function formatRange(start, end) {
    return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM yyyy')}`;
}
function weekKindLabel(report) {
    if (report.is_current)
        return 'Current week';
    try {
        const todayMonday = format(mondayOf(new Date()), 'yyyy-MM-dd');
        return report.period_start > todayMonday ? 'Upcoming week' : 'Earlier week';
    }
    catch {
        return 'Earlier week';
    }
}
function formatShortDate(value) {
    if (!value)
        return null;
    try {
        return format(parseISO(value), 'd MMM');
    }
    catch {
        return null;
    }
}
function leaveSummary(ctx) {
    if (!ctx)
        return [];
    const items = [
        ...ctx.leave_days.map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`),
        ...ctx.holidays
            .filter((h) => h.kind === 'holiday')
            .map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`),
    ];
    return items;
}
function hasRevisedDue(item) {
    if (item.deadline_revisions && item.deadline_revisions.length > 0)
        return true;
    if (!item.original_due_date || !item.due_date)
        return false;
    return toDateInput(item.original_due_date) !== toDateInput(item.due_date);
}
function MentionText({ text }) {
    return (_jsx(_Fragment, { children: splitCommentMentions(text).map((part, i) => isMentionPart(part) ? (_jsx("span", { className: "text-accent-primary font-medium", children: part }, i)) : (_jsx("span", { children: part }, i))) }));
}
function TaskTitle({ title, taskId, className, }) {
    const { openTask } = useTaskDrawer();
    const textClass = clsx('text-[15px] leading-relaxed text-left', className ?? 'text-text-primary');
    if (taskId) {
        return (_jsx("button", { type: "button", onClick: () => openTask(taskId), className: clsx(textClass, 'hover:underline'), children: _jsx(MentionText, { text: title }) }));
    }
    return (_jsx("p", { className: textClass, children: _jsx(MentionText, { text: title }) }));
}
function metaLine(timeLabel, dateLabel, datePrefix) {
    return [timeLabel, dateLabel ? `${datePrefix} ${dateLabel}` : null].filter(Boolean).join(' · ');
}
function CompletionRow({ item, index }) {
    const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
    const doneLabel = formatShortDate(item.completion_date || item.completed_at);
    const delayed = Boolean(item.is_delayed || item.is_carried_forward);
    const revised = hasRevisedDue(item);
    // Prefer the current (revised) due date; tag it when it differs from the original.
    const dueLabel = formatShortDate(item.due_date || item.original_due_date);
    const duePrefix = revised ? 'Revised due' : 'Due';
    return (_jsxs("li", { className: "flex items-start gap-2 py-1", children: [_jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [index, "."] }), _jsx("div", { className: "min-w-0 flex-1", children: _jsxs("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4", children: [_jsx(TaskTitle, { title: item.title, taskId: item.task_id, className: "text-text-primary" }), timeLabel || doneLabel || dueLabel ? (_jsxs("p", { className: "text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0", children: [timeLabel, timeLabel && (doneLabel || dueLabel) ? ' · ' : null, dueLabel ? _jsxs(_Fragment, { children: [duePrefix, " ", dueLabel, doneLabel ? ' · ' : null] }) : null, doneLabel ? (_jsxs(_Fragment, { children: [_jsx("span", { className: delayed ? 'text-amber-400' : undefined, children: "Completed" }), " ", doneLabel] })) : null] })) : null] }) })] }));
}
function CommitmentRow({ item, index, onRevise, freezeCarriedForward, }) {
    const revised = hasRevisedDue(item);
    const latestRevision = item.deadline_revisions?.[item.deadline_revisions.length - 1];
    // Always show the current (new) due date; "Revised due" indicates it changed from the original.
    const dueLabel = formatShortDate(latestRevision?.new_due_date || item.due_date);
    const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
    const latestReason = latestRevision?.reason;
    const carried = freezeCarriedForward
        ? item.commitment_type === 'carried_forward'
        : Boolean(item.is_carried_forward || item.commitment_type === 'carried_forward');
    const meta = metaLine(timeLabel, dueLabel, revised ? 'Revised due' : 'Due');
    return (_jsxs("li", { className: "flex items-start gap-2 py-1", children: [_jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [index, "."] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4", children: [_jsx(TaskTitle, { title: item.title, taskId: item.task_id, className: carried ? 'text-amber-400' : undefined }), meta ? (_jsx("p", { className: "text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0", children: meta })) : null] }), revised && latestReason && (_jsx("p", { className: "text-2xs text-text-muted mt-0.5", children: latestReason })), item.is_overdue && item.task_id && onRevise && (_jsx("button", { type: "button", onClick: () => onRevise(item), className: "text-xs text-accent-primary mt-1", children: "Add reason and revised deadline" }))] })] }));
}
function TaskSection({ title, emptyLabel, items, onRevise, freezeCarriedForward, }) {
    return (_jsxs("section", { className: "space-y-1", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: title }), items.length === 0 ? (_jsx("p", { className: "text-sm text-text-muted", children: emptyLabel })) : (_jsx("ol", { children: items.map((item, i) => (_jsx(CommitmentRow, { item: item, index: i + 1, onRevise: onRevise, freezeCarriedForward: freezeCarriedForward }, `${item.task_id ?? item.title}-${i}`))) }))] }));
}
export function WeeklyReportCard({ report, author, onRevise, onEdit, actionLabel = 'Edit', }) {
    const person = author ?? report.author;
    const personName = person ? `${person.first_name} ${person.last_name}`.trim() : 'Weekly update';
    const thisWeekLeave = leaveSummary(report.leave);
    const freezeCarriedForward = !report.editable;
    const currentWeekTasks = report.current_week_tasks ?? [];
    const hasDelayed = report.completions.some((item) => item.is_delayed || item.is_carried_forward) ||
        currentWeekTasks.some((item) => freezeCarriedForward
            ? item.commitment_type === 'carried_forward'
            : Boolean(item.is_carried_forward || item.commitment_type === 'carried_forward'));
    return (_jsxs("article", { id: `week-${report.period_start}`, className: "min-w-0 rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: [weekKindLabel(report), !report.editable ? ' · Locked' : null] }), _jsx("h3", { className: "text-base font-semibold text-text-primary mt-0.5", children: formatRange(report.period_start, report.period_end) })] }), _jsxs("div", { className: "flex flex-col items-end gap-1 shrink-0", children: [onEdit && (_jsx("button", { type: "button", onClick: onEdit, className: "rounded-lg border border-dark-border bg-dark-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-dark-hover transition-colors", children: actionLabel })), hasDelayed && (_jsxs("p", { className: "text-2xs text-text-muted", children: [_jsx("span", { className: "text-amber-400", children: "Yellow" }), " = delayed / carried forward"] }))] })] }), person && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Avatar, { name: personName, size: "sm", src: person.profile_picture ?? undefined }), _jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: personName })] })), _jsxs("section", { className: "space-y-1.5", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Completed Tasks" }), report.completions.length === 0 ? (_jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" })) : (_jsx("ol", { className: "space-y-1", children: report.completions.map((item, i) => (_jsx(CompletionRow, { item: item, index: i + 1 }, `${item.task_id ?? item.title}-${i}`))) }))] }), _jsx("div", { className: "border-t border-dark-border" }), _jsx(TaskSection, { title: "Weekly Tasks", emptyLabel: "No tasks yet", items: currentWeekTasks, onRevise: onRevise, freezeCarriedForward: freezeCarriedForward }), thisWeekLeave.length > 0 && (_jsx("footer", { className: "text-xs text-text-muted space-y-0.5", children: _jsx("p", { children: thisWeekLeave.join(' · ') }) }))] }));
}
