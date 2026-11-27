import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Calendar, ChevronDown, Clock, Flag, CornerDownLeft, ListPlus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { tasksApi, usersApi } from '../../services/endpoints';
import { matchMentionUsers, mentionDisplayName, mentionToken, } from '../../lib/mentions';
import { formatDueForApi, getActiveDateQuery, getActiveTimeQuery, matchDateSuggestions, matchTimeSuggestions, nextPriority, parseQuickTask, PRIORITY_SHORT, } from '../../lib/quickTaskParse';
import { format } from 'date-fns';
import { PasteDailyTasksModal } from './PasteDailyTasksModal';
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function CreateTaskModal({ isOpen, onClose }) {
    const { user: currentUser } = useAuth();
    const [mode, setMode] = useState('quick');
    const [pasteSeed, setPasteSeed] = useState('');
    const [text, setText] = useState('');
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [priority, setPriority] = useState('medium');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [description, setDescription] = useState('');
    const [reviewRequired, setReviewRequired] = useState(false);
    const [testingRequired, setTestingRequired] = useState(false);
    const [menuHighlight, setMenuHighlight] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const textareaRef = useRef(null);
    const qc = useQueryClient();
    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
        enabled: isOpen && mode === 'quick',
    });
    const mentionUsers = users ?? [];
    const parsed = useMemo(() => parseQuickTask(text, mentionUsers), [text, mentionUsers]);
    const assigneeUsers = useMemo(() => {
        const byId = new Map(mentionUsers.map((u) => [u.id, u]));
        if (currentUser && !byId.has(currentUser.id)) {
            byId.set(currentUser.id, currentUser);
        }
        return assigneeIds
            .map((id) => byId.get(id))
            .filter((u) => Boolean(u));
    }, [assigneeIds, mentionUsers, currentUser]);
    const mentionQuery = useMemo(() => {
        const match = text.match(/@([\w\s]*)$/);
        return match ? match[1] : null;
    }, [text]);
    const dateQuery = useMemo(() => getActiveDateQuery(text), [text]);
    const timeQuery = useMemo(() => getActiveTimeQuery(text), [text]);
    const mentionSuggestions = useMemo(() => {
        if (mentionQuery === null)
            return [];
        const selected = new Set(assigneeIds);
        return matchMentionUsers(mentionUsers, mentionQuery)
            .filter((u) => !selected.has(u.id))
            .slice(0, 8);
    }, [mentionUsers, mentionQuery, assigneeIds]);
    const dateSuggestions = useMemo(() => {
        if (dateQuery === null)
            return [];
        return matchDateSuggestions(dateQuery).slice(0, 8);
    }, [dateQuery]);
    const timeSuggestions = useMemo(() => {
        if (timeQuery === null)
            return [];
        return matchTimeSuggestions(timeQuery).slice(0, 8);
    }, [timeQuery]);
    const showingMentions = menuOpen && mentionQuery !== null && mentionSuggestions.length > 0;
    const showingDates = menuOpen && dateQuery !== null && !showingMentions && dateSuggestions.length > 0;
    const showingTimes = menuOpen && timeQuery !== null && !showingMentions && !showingDates && timeSuggestions.length > 0;
    const suggestionCount = showingMentions
        ? mentionSuggestions.length
        : showingDates
            ? dateSuggestions.length
            : showingTimes
                ? timeSuggestions.length
                : 0;
    useEffect(() => {
        if (!isOpen) {
            setMode('quick');
            setPasteSeed('');
            return;
        }
        setText('');
        setAssigneeIds(currentUser?.id ? [currentUser.id] : []);
        setPriority('medium');
        setShowAdvanced(false);
        setDescription('');
        setReviewRequired(false);
        setTestingRequired(false);
        setMenuHighlight(0);
        setMenuOpen(false);
        if (mode === 'quick') {
            const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
            return () => window.clearTimeout(t);
        }
        return undefined;
        // intentionally omit mode — switching to paste should not wipe quick fields mid-flight
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentUser?.id]);
    const openPasteMode = (seed = '') => {
        setPasteSeed(seed);
        setMode('paste');
    };
    useEffect(() => {
        setMenuHighlight(0);
    }, [mentionQuery, dateQuery, timeQuery]);
    // Sync @mentions from the quick-input into assignee pills (additive only).
    useEffect(() => {
        if (!parsed.assigneeIds.length)
            return;
        setAssigneeIds((prev) => {
            let changed = false;
            const next = [...prev];
            for (const id of parsed.assigneeIds) {
                if (!next.includes(id)) {
                    next.push(id);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [parsed.assigneeIds]);
    const resetAndClose = () => {
        setMode('quick');
        onClose();
    };
    const mutation = useMutation({
        mutationFn: (data) => tasksApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            toast.success('Task created');
            resetAndClose();
        },
        onError: () => toast.error('Failed to create task'),
    });
    const pickUser = (user) => {
        const token = mentionToken(user);
        setText((prev) => prev.replace(/@[\w\s]*$/, `${token} `));
        setAssigneeIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
        setMenuOpen(false);
        setMenuHighlight(0);
        textareaRef.current?.focus();
    };
    const removeAssignee = (userId) => {
        setAssigneeIds((prev) => prev.filter((id) => id !== userId));
        const user = mentionUsers.find((u) => u.id === userId)
            ?? (currentUser?.id === userId ? currentUser : undefined);
        if (!user)
            return;
        const token = mentionToken(user);
        setText((prev) => prev
            .replace(new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'g'), ' ')
            .replace(/\s+/g, ' ')
            .trim());
    };
    const pickDate = (token) => {
        setText((prev) => prev.replace(/\/[a-zA-Z0-9._-]*$/, `/${token} `));
        setMenuOpen(false);
        setMenuHighlight(0);
        textareaRef.current?.focus();
    };
    const pickTime = (token) => {
        setText((prev) => prev.replace(/#\s*[0-9]*\.?[0-9]*[a-zA-Z]*$/, `#${token} `));
        setMenuOpen(false);
        setMenuHighlight(0);
        textareaRef.current?.focus();
    };
    const ship = () => {
        const title = parsed.title.trim();
        if (!title) {
            toast.error('Add a task title');
            return;
        }
        if (parsed.estimatedHours == null || parsed.estimatedHours <= 0) {
            toast.error('Add time required with # (e.g. #1h or #30m)');
            return;
        }
        mutation.mutate({
            title,
            description: description.trim() || undefined,
            priority,
            status: 'to_do',
            due_date: parsed.dueDate ? formatDueForApi(parsed.dueDate) : undefined,
            estimated_hours: parsed.estimatedHours,
            assignee_ids: assigneeIds,
            review_required: reviewRequired,
            testing_required: testingRequired,
        });
    };
    const onKeyDown = (e) => {
        if (showingMentions || showingDates || showingTimes) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMenuHighlight((i) => Math.min(i + 1, suggestionCount - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMenuHighlight((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (showingMentions)
                    pickUser(mentionSuggestions[menuHighlight]);
                else if (showingDates)
                    pickDate(dateSuggestions[menuHighlight].token);
                else
                    pickTime(timeSuggestions[menuHighlight].token);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMenuOpen(false);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!mutation.isPending)
                ship();
        }
    };
    const dueSummary = parsed.dueLabel ?? 'no due date';
    const timeSummary = parsed.timeLabel ? `${parsed.timeLabel} required` : null;
    if (mode === 'paste') {
        return (_jsx(PasteDailyTasksModal, { isOpen: isOpen, initialText: pasteSeed, onClose: resetAndClose, onBackToQuick: () => {
                setPasteSeed('');
                setMode('quick');
            } }));
    }
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, size: "lg", children: _jsxs("div", { className: "relative -m-1", children: [_jsx("button", { type: "button", onClick: onClose, className: "absolute -top-1 right-0 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) }), _jsxs("div", { className: "pr-8 mb-5", children: [_jsx("h2", { className: "text-2xl font-semibold tracking-tight text-text-primary", children: "What's the move?" }), _jsx("p", { className: "text-sm text-text-muted mt-1.5", children: "You're assigned by default. Use @ for people, / for dates, and # for time required (required)." }), _jsxs("button", { type: "button", onClick: () => openPasteMode(), className: "mt-2 inline-flex items-center gap-1.5 text-sm text-accent-primary hover:underline", children: [_jsx(ListPlus, { className: "h-3.5 w-3.5" }), "Paste today's task list instead"] })] }), _jsxs("div", { className: clsx('rounded-2xl border bg-surface-subtle overflow-hidden transition-colors', 'border-blue-500/40 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/25'), children: [_jsxs("div", { className: "relative", children: [_jsx("textarea", { ref: textareaRef, value: text, onChange: (e) => {
                                        setText(e.target.value);
                                        setMenuOpen(true);
                                    }, onPaste: (e) => {
                                        const pasted = e.clipboardData.getData('text');
                                        const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                                        const looksLikeList = lines.length >= 2
                                            && lines.some((l) => /^\d+[.)]\s+/.test(l));
                                        if (looksLikeList) {
                                            e.preventDefault();
                                            openPasteMode(pasted);
                                        }
                                    }, onFocus: () => setMenuOpen(true), onBlur: () => window.setTimeout(() => setMenuOpen(false), 150), onKeyDown: onKeyDown, placeholder: "ship the landing page @name /friday #2h", rows: 3, className: "w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base text-text-primary placeholder:text-text-muted focus:outline-none" }), showingMentions && (_jsx("ul", { className: "absolute z-20 left-3 right-3 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg", children: mentionSuggestions.map((u, idx) => {
                                        const name = mentionDisplayName(u);
                                        return (_jsx("li", { children: _jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => pickUser(u), className: clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors', idx === menuHighlight
                                                    ? 'bg-dark-hover text-text-primary'
                                                    : 'text-text-secondary hover:bg-dark-hover'), children: [_jsx(Avatar, { name: name, src: u.profile_picture, size: "sm" }), _jsx("span", { className: "truncate", children: name })] }) }, u.id));
                                    }) })), showingDates && (_jsx("ul", { className: "absolute z-20 left-3 right-3 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg", children: dateSuggestions.map((s, idx) => (_jsx("li", { children: _jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => pickDate(s.token), className: clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors', idx === menuHighlight
                                                ? 'bg-dark-hover text-text-primary'
                                                : 'text-text-secondary hover:bg-dark-hover'), children: [_jsx(Calendar, { className: "h-3.5 w-3.5 text-text-muted shrink-0" }), _jsxs("span", { children: ["/", s.token] }), _jsx("span", { className: "text-text-muted ml-auto text-xs", children: s.label })] }) }, s.token))) })), showingTimes && (_jsx("ul", { className: "absolute z-20 left-3 right-3 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg", children: timeSuggestions.map((s, idx) => (_jsx("li", { children: _jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => pickTime(s.token), className: clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors', idx === menuHighlight
                                                ? 'bg-dark-hover text-text-primary'
                                                : 'text-text-secondary hover:bg-dark-hover'), children: [_jsx(Clock, { className: "h-3.5 w-3.5 text-text-muted shrink-0" }), _jsxs("span", { children: ["#", s.token] }), _jsx("span", { className: "text-text-muted ml-auto text-xs", children: s.label })] }) }, s.token))) }))] }), _jsxs("div", { className: "flex flex-col gap-2 px-4 pb-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => setPriority((p) => nextPriority(p)), className: clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors', priority === 'low' && 'border-sky-500/30 bg-sky-500/10 text-sky-300', priority === 'medium' && 'border-amber-500/35 bg-amber-500/10 text-amber-300', priority === 'high' && 'border-orange-500/35 bg-orange-500/10 text-orange-300', priority === 'critical' && 'border-red-500/35 bg-red-500/10 text-red-300'), title: "Click to change priority", children: [_jsx(Flag, { className: "h-3 w-3" }), PRIORITY_SHORT[priority]] }), _jsx("span", { className: "text-xs text-text-muted truncate", children: dueSummary }), timeSummary ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-text-secondary", children: [_jsx(Clock, { className: "h-3 w-3 text-text-muted" }), timeSummary] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-amber-400/90", children: [_jsx(Clock, { className: "h-3 w-3" }), "Time required \u2014 add #1h or #30m"] }))] }), _jsx("div", { className: "flex flex-wrap items-center gap-1.5 min-h-[1.75rem]", children: assigneeUsers.length ? (assigneeUsers.map((u) => {
                                        const name = mentionDisplayName(u);
                                        return (_jsxs("span", { className: "chip badge-todo inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 border border-dark-border", children: [_jsx(Avatar, { name: name, src: u.profile_picture, size: "sm" }), _jsx("span", { className: "text-xs text-text-primary max-w-[7rem] truncate", children: name }), _jsx("button", { type: "button", onClick: () => removeAssignee(u.id), className: "rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors", "aria-label": `Remove ${name}`, children: _jsx(X, { className: "h-3 w-3" }) })] }, u.id));
                                    })) : (_jsx("span", { className: "text-xs text-text-muted", children: "No assignees \u2014 type @ to add" })) })] }), _jsxs("div", { className: "flex items-center justify-between gap-3 px-4 py-3 border-t border-dark-border/80", children: [_jsx("p", { className: "text-2xs text-text-muted", children: "tips: @ to assign \u00B7 / for date \u00B7 # for time (required)" }), _jsxs(Button, { type: "button", onClick: ship, loading: mutation.isPending, disabled: !parsed.title.trim() || parsed.estimatedHours == null || parsed.estimatedHours <= 0, className: "gap-2 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 border-transparent text-white", children: ["Ship it", _jsx(CornerDownLeft, { className: "h-3.5 w-3.5 opacity-80" })] })] })] }), parsed.title && (_jsxs("div", { className: "mt-4 rounded-xl border border-dark-border bg-dark-card px-4 py-3", children: [_jsx("p", { className: "text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Preview" }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: parsed.title }), _jsxs("div", { className: "flex flex-wrap items-center gap-3 mt-2 text-xs text-text-muted", children: [assigneeUsers[0] && (_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Avatar, { name: mentionDisplayName(assigneeUsers[0]), src: assigneeUsers[0].profile_picture, size: "sm" }), assigneeUsers.map((u) => u.first_name).join(', ')] })), parsed.dueLabel && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Calendar, { className: "h-3.5 w-3.5" }), parsed.dueLabel] })), parsed.timeLabel ? (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), parsed.timeLabel] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-amber-400/90", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), "Time required"] })), _jsxs("span", { className: "inline-flex items-center gap-1 text-amber-300/90", children: [_jsx(Flag, { className: "h-3.5 w-3.5" }), PRIORITY_SHORT[priority]] })] })] })), _jsxs("button", { type: "button", onClick: () => setShowAdvanced((v) => !v), className: "mt-4 flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary", children: [_jsx(ChevronDown, { className: clsx('h-4 w-4 transition-transform', showAdvanced && 'rotate-180') }), "More options"] }), showAdvanced && (_jsxs("div", { className: "mt-3 space-y-3 pl-3 border-l-2 border-dark-border", children: [_jsx(Textarea, { label: "Description", value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Add details\u2026", rows: 2 }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary", children: [_jsx("input", { type: "checkbox", checked: reviewRequired, onChange: (e) => setReviewRequired(e.target.checked), className: "rounded border-dark-border" }), "Review required"] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-text-secondary", children: [_jsx("input", { type: "checkbox", checked: testingRequired, onChange: (e) => setTestingRequired(e.target.checked), className: "rounded border-dark-border" }), "Testing required"] }), _jsx(Input, { label: "Override due date", type: "date", value: parsed.dueDate ? format(parsed.dueDate, 'yyyy-MM-dd') : '', onChange: (e) => {
                                const v = e.target.value;
                                if (!v) {
                                    setText((prev) => prev.replace(/(?:^|\s)\/[a-zA-Z0-9._-]+/g, ' ').replace(/\s+/g, ' ').trim());
                                    return;
                                }
                                setText((prev) => {
                                    const without = prev.replace(/(?:^|\s)\/[a-zA-Z0-9._-]+/g, ' ').replace(/\s+/g, ' ').trim();
                                    return `${without} /${v}`.trim();
                                });
                            } })] }))] }) }));
}
