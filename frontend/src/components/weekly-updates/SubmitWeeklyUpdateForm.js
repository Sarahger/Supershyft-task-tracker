import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { DailyUpdateEditor } from '../daily-updates/DailyUpdateEditor';
import { tasksApi, usersApi, weeklyUpdatesApi } from '../../services/endpoints';
import { extractMentionedUserIds } from '../../lib/mentions';
import { formatDueNoonForApi, formatHoursLabel, parseWeeklyDoneList, parseWeeklyPlanList, toDateInput, } from '../../lib/weeklyPlanParse';
function newKey() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
const DUE_DATE_EDIT_MS = 24 * 60 * 60 * 1000;
function isDueDateLocked(item) {
    if (!item)
        return false;
    if (typeof item.due_date_locked === 'boolean')
        return item.due_date_locked;
    if (!item.created_at)
        return false;
    return Date.now() >= new Date(item.created_at).getTime() + DUE_DATE_EDIT_MS;
}
export function SubmitWeeklyUpdateForm({ periodStart, existing, onClose, }) {
    const qc = useQueryClient();
    const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
    const [doneText, setDoneText] = useState('1. ');
    const [currentPlanText, setCurrentPlanText] = useState('1. ');
    const [dueDates, setDueDates] = useState({});
    const [revisionReasons, setRevisionReasons] = useState({});
    const [initialized, setInitialized] = useState(false);
    const [completionDates, setCompletionDates] = useState({});
    const { data: suggestions } = useQuery({
        queryKey: ['weekly-updates', 'suggestions', periodStart],
        queryFn: () => weeklyUpdatesApi.suggestions(periodStart).then((r) => r.data.data),
    });
    const { data: carry } = useQuery({
        queryKey: ['weekly-updates', 'carry-forward', periodStart],
        queryFn: () => weeklyUpdatesApi.carryForward(periodStart).then((r) => r.data.data),
    });
    const { data: myTasks } = useQuery({
        queryKey: ['tasks', 'my'],
        queryFn: () => tasksApi.my().then((r) => r.data.data ?? []),
    });
    const { data: usersList } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const r = await usersApi.list({ page_size: 100 });
            const items = r.data?.data?.items;
            return Array.isArray(items) ? items : [];
        },
        staleTime: 5 * 60 * 1000,
    });
    const mentionUsers = (usersList ?? []).filter((u) => u.status !== 'inactive');
    const currentWeekTasks = carry?.current_week_tasks ?? [
        ...(carry?.items ?? []),
        ...((carry?.working_week_ended ? [] : carry?.due_this_week) ?? []),
    ];
    const carried = currentWeekTasks.filter((item) => item.is_carried_forward || item.commitment_type === 'carried_forward');
    const dueCurrentWeek = currentWeekTasks.filter((item) => !(item.is_carried_forward || item.commitment_type === 'carried_forward'));
    const structuredTaskIds = new Set(currentWeekTasks.map((item) => item.task_id).filter((id) => id != null));
    const structuredTitles = new Set(currentWeekTasks.map((item) => item.title.trim().toLowerCase()));
    useEffect(() => {
        if (initialized)
            return;
        if (suggestions === undefined || carry === undefined)
            return;
        const selected = new Set();
        const completedOn = {};
        const doneLines = [];
        (existing?.completions ?? []).forEach((item, i) => {
            if (item.task_id) {
                selected.add(item.task_id);
                if (item.completion_date)
                    completedOn[item.task_id] = item.completion_date;
            }
            else if (item.title) {
                doneLines.push(`${i + 1}. ${item.title}`);
            }
        });
        (suggestions.items ?? []).forEach((item) => {
            if (item.task_id && item.included !== false) {
                selected.add(item.task_id);
                if (item.completion_date)
                    completedOn[item.task_id] = item.completion_date;
            }
        });
        setSelectedTaskIds(selected);
        setCompletionDates(completedOn);
        setDoneText(doneLines.join('\n') || '1. ');
        // Restore typed current-week commitments that are not already in the live bucket.
        const planLines = [];
        const dates = {};
        const liveCurrent = carry?.current_week_tasks ?? [
            ...(carry?.items ?? []),
            ...((carry?.working_week_ended ? [] : carry?.due_this_week) ?? []),
        ];
        const skipIds = new Set(liveCurrent.map((item) => item.task_id).filter((id) => id != null));
        const skipTitles = new Set(liveCurrent.map((item) => item.title.trim().toLowerCase()));
        // Prefer current_week_tasks — on editable reports `commitments` still mirrors next-week rows.
        (existing?.current_week_tasks ?? [])
            .filter((c) => {
            if (c.commitment_type === 'carried_forward')
                return false;
            if (c.task_id && skipIds.has(c.task_id))
                return false;
            if (skipTitles.has(c.title.trim().toLowerCase()))
                return false;
            return true;
        })
            .forEach((item, i) => {
            const hours = item.estimated_hours != null ? ` (${formatHoursLabel(item.estimated_hours)})` : '';
            planLines.push(`${i + 1}. ${item.title}${hours}`);
            if (item.due_date)
                dates[`cw-new:${item.title.trim().toLowerCase()}`] = toDateInput(item.due_date);
        });
        setCurrentPlanText(planLines.join('\n') || '1. ');
        setDueDates(dates);
        setInitialized(true);
    }, [initialized, suggestions, carry, existing]);
    const completedTasks = useMemo(() => {
        const byId = new Map();
        for (const item of existing?.completions ?? []) {
            if (!item.task_id)
                continue;
            byId.set(item.task_id, {
                id: item.task_id,
                title: item.title,
                completion_date: item.completion_date,
                estimated_hours: item.estimated_hours,
                source: item.source === 'manual' ? 'manual' : 'suggested',
                is_delayed: item.is_delayed,
                is_carried_forward: item.is_carried_forward,
            });
        }
        for (const item of suggestions?.items ?? []) {
            if (!item.task_id || byId.has(item.task_id))
                continue;
            byId.set(item.task_id, {
                id: item.task_id,
                title: item.title,
                completion_date: item.completion_date,
                estimated_hours: item.estimated_hours,
                source: 'suggested',
                is_delayed: item.is_delayed,
                is_carried_forward: item.is_carried_forward,
            });
        }
        return [...byId.values()];
    }, [existing, suggestions]);
    const parsedDone = useMemo(() => parseWeeklyDoneList(doneText, { periodStart }), [doneText, periodStart]);
    const parsedCurrentPlan = useMemo(() => parseWeeklyPlanList(currentPlanText, { periodStart, weekScope: 'current' }), [currentPlanText, periodStart]);
    const togglePill = (taskId) => {
        setSelectedTaskIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId))
                next.delete(taskId);
            else
                next.add(taskId);
            return next;
        });
    };
    const mutation = useMutation({
        mutationFn: async () => {
            const completions = [];
            const seen = new Set();
            for (const task of completedTasks) {
                if (seen.has(task.id))
                    continue;
                seen.add(task.id);
                completions.push({
                    key: `done-${task.id}`,
                    task_id: task.id,
                    title: task.title,
                    completion_date: completionDates[task.id] || task.completion_date || format(new Date(), 'yyyy-MM-dd'),
                    source: task.source,
                    included: selectedTaskIds.has(task.id),
                });
            }
            for (const item of parsedDone) {
                if (!item.title.trim())
                    continue;
                const match = completedTasks.find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
                if (match && seen.has(match.id))
                    continue;
                if (!match) {
                    if (item.missingEffort || item.estimatedHours == null) {
                        throw new Error(`Add time taken for “${item.title}”, e.g. #3h`);
                    }
                    if (item.missingDate || !item.completionDate) {
                        throw new Error(`Add the completed day for “${item.title}”, e.g. /thursday`);
                    }
                }
                completions.push({
                    key: newKey(),
                    task_id: match?.id ?? null,
                    title: match && !seen.has(match.id) ? match.title : item.title,
                    description: item.description,
                    completion_date: item.completionDate || format(new Date(), 'yyyy-MM-dd'),
                    estimated_hours: item.estimatedHours,
                    source: match ? 'suggested' : 'manual',
                    included: true,
                });
                if (match)
                    seen.add(match.id);
            }
            const trackerDraft = (item, kind, prefix) => {
                const key = `${prefix}-${item.task_id}`;
                const currentDue = toDateInput(item.due_date);
                const nextDue = dueDates[key] || currentDue;
                return {
                    key,
                    task_id: item.task_id,
                    title: item.title,
                    description: item.description ?? '',
                    estimated_hours: item.estimated_hours != null ? String(item.estimated_hours) : '',
                    due_date: nextDue,
                    commitment_type: kind,
                    revision_reason: nextDue && currentDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
                    is_overdue: item.is_overdue,
                    original_due_date: item.original_due_date,
                };
            };
            const typedDraft = (item) => {
                const match = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
                if (match && structuredTaskIds.has(match.id))
                    return null;
                if (structuredTitles.has(item.title.trim().toLowerCase()))
                    return null;
                const key = `cw-new:${item.title.trim().toLowerCase()}`;
                const nextDue = dueDates[key] || item.dueDate || '';
                const currentDue = match ? toDateInput(match.due_date) : '';
                return {
                    key: `cw-new-${item.title}`,
                    task_id: match?.id ?? null,
                    title: item.title,
                    description: '',
                    estimated_hours: item.estimatedHours != null ? String(item.estimatedHours) : '',
                    due_date: nextDue,
                    commitment_type: (match ? 'existing' : 'new'),
                    revision_reason: match && currentDue && nextDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
                };
            };
            const plan = [
                ...carried.map((item) => trackerDraft(item, 'carried_forward', 'cf')),
                ...dueCurrentWeek.map((item) => trackerDraft(item, 'existing', 'cw')),
                ...parsedCurrentPlan.items
                    .map((item) => typedDraft(item))
                    .filter((item) => item != null),
            ];
            for (const item of plan) {
                if (!item.title.trim())
                    continue;
                if (!item.due_date)
                    throw new Error(`Add a due date for “${item.title}”`);
                const hours = Number(item.estimated_hours);
                if (!hours || hours <= 0)
                    throw new Error(`Add time required for “${item.title}”`);
                const source = item.commitment_type === 'carried_forward'
                    ? carried.find((c) => c.task_id === item.task_id)
                    : dueCurrentWeek.find((c) => c.task_id === item.task_id)
                        ?? (myTasks ?? []).find((t) => t.id === item.task_id)
                        ?? existing?.commitments.find((c) => c.task_id === item.task_id || c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
                const previousDue = item.commitment_type === 'carried_forward'
                    ? toDateInput(carried.find((c) => c.task_id === item.task_id)?.due_date)
                    : toDateInput(dueCurrentWeek.find((c) => c.task_id === item.task_id)?.due_date
                        ?? (myTasks ?? []).find((t) => t.id === item.task_id)?.due_date
                        ?? existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase())?.due_date);
                if (previousDue && item.due_date !== previousDue && isDueDateLocked(source) && !item.revision_reason.trim()) {
                    throw new Error(`Add a reason for changing the due date of “${item.title}”`);
                }
            }
            const mentionSource = [doneText, currentPlanText, ...completions.map((c) => c.title), ...plan.map((c) => c.title)].join('\n');
            return weeklyUpdatesApi.upsert({
                period_start: periodStart,
                mentioned_user_ids: extractMentionedUserIds(mentionSource, mentionUsers),
                completions: completions.map((c) => ({
                    task_id: c.task_id ?? null,
                    title: c.title.trim(),
                    completion_date: c.completion_date || null,
                    estimated_hours: c.estimated_hours ?? null,
                    source: c.source,
                    included: c.included,
                })),
                commitments: plan.filter((c) => c.title.trim()).map((c) => ({
                    task_id: c.task_id ?? null,
                    title: c.title.trim(),
                    description: c.description.trim() || null,
                    estimated_hours: Number(c.estimated_hours),
                    due_date: formatDueNoonForApi(c.due_date),
                    commitment_type: c.commitment_type,
                    revision_reason: c.revision_reason.trim() || null,
                })),
            });
        },
        onSuccess: (res) => {
            const errors = res.data.data?.create_errors ?? [];
            if (errors.length) {
                toast.error(`Saved, but ${errors.length} task${errors.length === 1 ? '' : 's'} failed to create. Retry to finish those only.`);
            }
            else {
                toast.success('Weekly update submitted');
            }
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            onClose();
        },
        onError: (err) => {
            const detail = err?.response?.data;
            toast.error((typeof detail?.detail === 'string' && detail.detail)
                || detail?.message
                || err.message
                || 'Could not submit weekly update');
        },
    });
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("header", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Write weekly update" }), _jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: ["Week of ", carry?.period_start && carry?.period_end
                                        ? `${format(parseISO(carry.period_start), 'd MMM')} – ${format(parseISO(carry.period_end), 'd MMM yyyy')}`
                                        : format(parseISO(periodStart), 'd MMM yyyy'), " \u00B7 Type @ to tag someone"] })] }), _jsx("button", { type: "button", onClick: onClose, className: "text-sm text-text-muted hover:text-text-secondary", children: "Cancel" })] }), _jsxs("section", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-primary", children: "Completed Tasks" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Tasks marked complete this week are already included. Uncheck anything to leave out, or add extra work below as New app screens #3hr /thursday. Press Enter for the next item \u2014 numbers are added for you." })] }), completedTasks.length > 0 ? (_jsx("ol", { className: "space-y-1", children: completedTasks.map((task, i) => {
                            const selected = selectedTaskIds.has(task.id);
                            const timeLabel = task.estimated_hours != null ? formatHoursLabel(task.estimated_hours) : null;
                            const doneLabel = task.completion_date
                                ? format(parseISO(task.completion_date), 'd MMM')
                                : null;
                            const delayed = Boolean(task.is_delayed || task.is_carried_forward);
                            return (_jsxs("li", { className: "flex items-start gap-2", children: [_jsx("input", { type: "checkbox", className: "mt-1.5 accent-accent-primary", checked: selected, onChange: () => togglePill(task.id), "aria-label": `Include ${task.title}` }), _jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5", children: [i + 1, "."] }), _jsxs("div", { className: "min-w-0 flex-1 flex items-start justify-between gap-4", children: [_jsx("p", { className: clsx('text-[15px] leading-relaxed', selected ? 'text-text-primary' : 'text-text-muted line-through'), children: task.title }), timeLabel || doneLabel ? (_jsxs("p", { className: "shrink-0 text-xs tabular-nums pt-1 text-right text-text-muted", children: [timeLabel, timeLabel && doneLabel ? ' · ' : null, doneLabel ? (_jsxs(_Fragment, { children: [_jsx("span", { className: delayed ? 'text-amber-400' : undefined, children: "Completed" }), " ", doneLabel] })) : null] })) : null] })] }, task.id));
                        }) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" })), _jsx(DailyUpdateEditor, { value: doneText, onChange: setDoneText, users: mentionUsers, showExtras: false, numberedList: true, placeholder: 'New app screens #3hr /thursday' }), parsedDone.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-xs font-medium text-text-secondary", children: [parsedDone.length, " extra item", parsedDone.length === 1 ? '' : 's', " will be added as completed tracker tasks."] }), parsedDone.map((item) => (_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: item.title }), item.missingEffort && (_jsx("p", { className: "text-2xs text-accent-danger", children: "Add time taken, e.g. #3h or #3hr" })), item.missingDate && (_jsx("p", { className: "text-2xs text-accent-danger", children: "Add the completed day, e.g. /thursday" }))] }), _jsx("p", { className: "shrink-0 text-xs tabular-nums text-text-muted pt-0.5", children: [item.timeLabel, item.completionDate ? format(parseISO(item.completionDate), 'd MMM') : null]
                                            .filter(Boolean)
                                            .join(' · ') })] }, item.rawLine)))] }))] }), _jsxs("section", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-primary", children: "Weekly Tasks" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Incomplete tasks due this working week, including carried-forward work. Add new ones below \u2014 they are saved in the Task Tracker. For later weeks, open that week and write there. Yellow means carried forward from an earlier week." })] }), _jsxs("div", { className: "rounded-xl border border-dark-border px-3 py-2 space-y-2", children: [carried.length === 0 && dueCurrentWeek.length === 0 ? (_jsx("p", { className: "text-sm text-text-muted", children: "No tasks yet" })) : null, carried.length > 0 && (_jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [_jsx("p", { className: "text-xs font-medium text-amber-400", children: "Carried forward" }), _jsxs("p", { className: "text-2xs text-text-muted", children: [_jsx("span", { className: "text-amber-400", children: "Yellow" }), " = carried forward"] })] })), carried.map((item) => {
                                const key = `cf-${item.task_id}`;
                                const currentDue = toDateInput(item.due_date);
                                const nextDue = dueDates[key] || currentDue;
                                const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
                                const locked = isDueDateLocked(item);
                                const needsRevision = dateChanged && locked;
                                return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid sm:grid-cols-[1fr_140px] gap-2 items-center", children: [_jsxs("p", { className: "text-sm text-amber-400", children: [item.title, item.is_overdue && _jsx("span", { className: "ml-2 text-2xs text-accent-danger", children: "Overdue" })] }), _jsx(Input, { label: needsRevision ? 'Revised due date' : undefined, type: "date", value: nextDue, onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })), error: !nextDue ? 'Required' : undefined })] }), needsRevision && (_jsx(Input, { label: "Reason for changing", value: revisionReasons[key] || '', onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })), placeholder: "Why is the due date changing?", error: !revisionReasons[key]?.trim() ? 'Required when changing the due date' : undefined }))] }, `cf-${item.task_id ?? item.title}`));
                            }), dueCurrentWeek.length > 0 && (_jsx("p", { className: "text-xs font-medium text-text-secondary pt-1", children: "Due this week" })), dueCurrentWeek.map((item) => {
                                const key = `cw-${item.task_id}`;
                                const currentDue = toDateInput(item.due_date);
                                const nextDue = dueDates[key] || currentDue;
                                const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
                                const locked = isDueDateLocked(item);
                                const needsRevision = dateChanged && locked;
                                return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid sm:grid-cols-[1fr_auto_140px] gap-2 items-center", children: [_jsx("p", { className: "text-sm text-text-primary", children: item.title }), _jsx("p", { className: "text-xs text-text-muted", children: item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : 'Add time required' }), _jsx(Input, { label: needsRevision ? 'Revised due date' : undefined, type: "date", value: nextDue, onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })), error: !nextDue ? 'Required' : undefined })] }), item.estimated_hours == null && (_jsx("p", { className: "text-2xs text-accent-danger", children: "Add time required on this task" })), needsRevision && (_jsx(Input, { label: "Reason for changing", value: revisionReasons[key] || '', onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })), placeholder: "Why is the due date changing?", error: !revisionReasons[key]?.trim() ? 'Required when changing the due date' : undefined }))] }, `cw-${item.task_id ?? item.title}`));
                            })] }), _jsx(DailyUpdateEditor, { value: currentPlanText, onChange: setCurrentPlanText, users: mentionUsers, showExtras: false, numberedList: true, placeholder: 'Finish onboarding flow /friday #3h\nReview with @Name /thursday #1h' }), parsedCurrentPlan.items.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-medium text-text-secondary", children: "Review due dates" }), parsedCurrentPlan.items.map((item) => {
                                const key = `cw-new:${item.title.trim().toLowerCase()}`;
                                const due = dueDates[key] || item.dueDate || '';
                                const match = (myTasks ?? []).find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
                                const existingItem = existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
                                const currentDue = toDateInput(match?.due_date || existingItem?.due_date);
                                const dateChanged = Boolean((match || existingItem) && currentDue && due && due !== currentDue);
                                const locked = isDueDateLocked(match ?? existingItem);
                                const needsRevision = dateChanged && locked;
                                return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid sm:grid-cols-[1fr_auto_140px] gap-2 items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: item.title }), item.missingEffort && (_jsx("p", { className: "text-2xs text-accent-danger", children: "Add time required in the list, e.g. #3h or (4hrs)" }))] }), _jsx("p", { className: "text-xs text-text-muted pt-2", children: item.timeLabel || formatHoursLabel(item.estimatedHours) }), _jsx(Input, { label: needsRevision ? 'Revised due date' : undefined, type: "date", value: due, onChange: (e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value })), error: !due ? 'Required' : undefined })] }), needsRevision && (_jsx(Input, { label: "Reason for changing", value: revisionReasons[key] || '', onChange: (e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value })), placeholder: "Why is the due date changing?", error: !revisionReasons[key]?.trim() ? 'Required when changing the due date' : undefined }))] }, key));
                            })] }))] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { type: "button", loading: mutation.isPending, onClick: () => mutation.mutate(), children: "Submit weekly update" })] })] }));
}
