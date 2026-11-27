import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Clock, ListPlus, UserRound, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { tasksApi, usersApi } from '../../services/endpoints';
import { mentionDisplayName } from '../../lib/mentions';
import { formatDueEodForApi, formatHoursLabel, parseDailyTaskList, } from '../../lib/dailyTaskListParse';
import { format } from 'date-fns';
const PLACEHOLDER = `Yukti

1. Fix API error in Health Trends ( 45 minutes )
2. Complete Lifestyle parameters (1.5 hours)
3. Meeting with Rishi (30 minutes)

— or —

Harsh
1) Updating copy in all forms
2) Developing further flutter pages`;
export function PasteDailyTasksModal({ isOpen, onClose, onBackToQuick, initialText = '' }) {
    const { user: currentUser } = useAuth();
    const [text, setText] = useState(initialText);
    const textareaRef = useRef(null);
    const qc = useQueryClient();
    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
        enabled: isOpen,
    });
    const mentionUsers = users ?? [];
    const parsed = useMemo(() => parseDailyTaskList(text, mentionUsers), [text, mentionUsers]);
    const owner = parsed.owner ?? currentUser ?? null;
    useEffect(() => {
        if (!isOpen)
            return;
        setText(initialText);
        const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
        return () => window.clearTimeout(t);
    }, [isOpen, initialText]);
    const mutation = useMutation({
        mutationFn: async () => {
            if (!parsed.items.length) {
                throw new Error('No tasks found in the list');
            }
            const due = formatDueEodForApi(new Date());
            const ownerId = owner?.id ?? currentUser?.id;
            if (!ownerId)
                throw new Error('No assignee');
            const results = [];
            for (const item of parsed.items) {
                if (item.estimatedHours == null || item.estimatedHours <= 0) {
                    throw new Error('Every task needs time required (e.g. 30 minutes or 1.5 hours)');
                }
                const assigneeIds = [...new Set([ownerId, ...item.mentionedUserIds])];
                const res = await tasksApi.create({
                    title: item.title,
                    priority: 'medium',
                    status: 'to_do',
                    due_date: due,
                    assignee_ids: assigneeIds,
                    estimated_hours: item.estimatedHours,
                    review_required: false,
                    testing_required: false,
                });
                results.push(res.data.data);
            }
            return results;
        },
        onSuccess: (created) => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            toast.success(created.length === 1
                ? '1 task created for today'
                : `${created.length} tasks created for today`);
            onClose();
        },
        onError: (err) => {
            const msg = err instanceof Error
                ? err.message
                : err?.response?.data?.detail;
            toast.error(typeof msg === 'string' ? msg : 'Failed to create tasks');
        },
    });
    const missingTimeCount = useMemo(() => parsed.items.filter((i) => i.estimatedHours == null || i.estimatedHours <= 0).length, [parsed.items]);
    const ship = () => {
        if (!parsed.items.length) {
            toast.error('Paste a numbered task list first');
            return;
        }
        if (missingTimeCount > 0) {
            toast.error('Every task needs time required (e.g. 30 minutes or 1.5 hours)');
            return;
        }
        mutation.mutate();
    };
    const onKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!mutation.isPending)
                ship();
            return;
        }
        // Extra Enter on a trailing blank line after a parsed list → create
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            const el = e.currentTarget;
            const atEnd = el.selectionStart === text.length && el.selectionEnd === text.length;
            if (atEnd && parsed.items.length > 0 && /\n\s*$/.test(text)) {
                e.preventDefault();
                if (!mutation.isPending)
                    ship();
            }
        }
    };
    const todayLabel = format(new Date(), 'EEE, MMM d');
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, size: "lg", children: _jsxs("div", { className: "relative -m-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "absolute -top-1 right-0 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) }), _jsxs("div", { className: "pr-8 mb-4", children: [_jsx("h2", { className: "text-2xl font-semibold tracking-tight text-text-primary", children: "Paste today's tasks" }), _jsxs("p", { className: "text-sm text-text-muted mt-1.5", children: ["Paste your daily list. Tasks are created for ", _jsx("span", { className: "text-text-secondary", children: todayLabel }), " (due EOD). Each line needs a time (e.g. 30 minutes). Names in a task are added as assignees. Use", ' ', _jsx("span", { className: "text-text-secondary", children: "rest of the day" }), " to fill remaining time (10:30\u201318:00 workday)."] })] }), _jsx("div", { className: clsx('rounded-2xl border bg-surface-subtle overflow-hidden transition-colors', 'border-blue-500/40 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/25'), children: _jsx("textarea", { ref: textareaRef, value: text, onChange: (e) => setText(e.target.value), onKeyDown: onKeyDown, placeholder: PLACEHOLDER, rows: 10, className: "w-full resize-y min-h-[12rem] bg-transparent px-4 pt-4 pb-3 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none font-mono leading-relaxed" }) }), parsed.items.length > 0 && (_jsxs("div", { className: "mt-4 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("p", { className: "text-xs uppercase tracking-wider text-text-muted font-medium", children: ["Preview \u00B7 ", parsed.items.length, " task", parsed.items.length === 1 ? '' : 's'] }), owner && (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs text-text-secondary", children: [_jsx(UserRound, { className: "h-3.5 w-3.5 text-text-muted" }), "Owner: ", mentionDisplayName(owner)] }))] }), _jsx("ul", { className: "max-h-52 overflow-y-auto rounded-xl border border-dark-border divide-y divide-dark-border/60", children: parsed.items.map((item, idx) => (_jsxs("li", { className: "px-3 py-2.5 flex items-start gap-3", children: [_jsxs("span", { className: "text-xs text-text-muted tabular-nums pt-0.5 w-4 shrink-0", children: [idx + 1, "."] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm text-text-primary leading-snug", children: item.title }), _jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-2", children: [item.estimatedHours != null && item.estimatedHours > 0 ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-2xs text-text-muted", children: [_jsx(Clock, { className: "h-3 w-3" }), item.timeLabel ?? formatHoursLabel(item.estimatedHours), item.timeLabel && (_jsxs("span", { className: "text-text-secondary", children: ["(", formatHoursLabel(item.estimatedHours), ")"] }))] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-2xs text-amber-400/90", children: [_jsx(Clock, { className: "h-3 w-3" }), "Time required missing"] })), item.mentionedUsers.map((u) => (_jsxs("span", { className: "inline-flex items-center gap-1 text-2xs text-sky-400", children: [_jsx(Avatar, { name: mentionDisplayName(u), src: u.profile_picture, size: "sm" }), "+", u.first_name] }, u.id)))] })] })] }, `${idx}-${item.title}`))) })] })), _jsxs("div", { className: "mt-5 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [onBackToQuick && (_jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: onBackToQuick, children: "Quick create" })), _jsx("p", { className: "text-2xs text-text-muted hidden sm:block", children: "Ctrl/Cmd + Enter to create" })] }), _jsxs(Button, { type: "button", className: "gap-1.5", disabled: mutation.isPending || parsed.items.length === 0 || missingTimeCount > 0, onClick: ship, children: [_jsx(ListPlus, { className: "h-4 w-4" }), mutation.isPending
                                    ? 'Creating…'
                                    : parsed.items.length
                                        ? `Create ${parsed.items.length} task${parsed.items.length === 1 ? '' : 's'}`
                                        : 'Create tasks'] })] })] }) }));
}
