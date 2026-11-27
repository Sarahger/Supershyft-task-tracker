import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { Link2, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { dailyUpdatesApi, tasksApi, usersApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { extractMentionedUserIds } from '../../lib/mentions';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { toast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';
import { DailyUpdateCalendar } from './DailyUpdateCalendar';
import { DailyUpdateContent } from './DailyUpdateContent';
import { DailyUpdateEditor } from './DailyUpdateEditor';
import { CommentMentionText } from '../tasks/CommentMentionText';
function parseDateParam(value) {
    if (!value)
        return new Date();
    const d = parseISO(value);
    return isValid(d) ? d : new Date();
}
export function DailyUpdatesPanel({ hideIntro = false }) {
    const { user } = useAuth();
    const { openTask } = useTaskDrawer();
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const [calendarMonth, setCalendarMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const [filterUserId, setFilterUserId] = useState('');
    const [draft, setDraft] = useState('');
    const [taskIds, setTaskIds] = useState([]);
    const [editing, setEditing] = useState(false);
    useEffect(() => {
        setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }, [selectedDate]);
    const setSelectedDate = (day) => {
        const next = new URLSearchParams(searchParams);
        next.set('date', format(day, 'yyyy-MM-dd'));
        setSearchParams(next, { replace: true });
        setEditing(false);
    };
    const { data: dayData, isLoading } = useQuery({
        queryKey: ['daily-updates', 'day', dateKey, filterUserId || 'all'],
        queryFn: () => dailyUpdatesApi
            .getDay(dateKey, filterUserId === '' ? undefined : filterUserId)
            .then((r) => r.data.data),
    });
    const { data: calendar } = useQuery({
        queryKey: ['daily-updates', 'calendar', calendarMonth.getFullYear(), calendarMonth.getMonth() + 1],
        queryFn: () => dailyUpdatesApi
            .getCalendar(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1)
            .then((r) => r.data.data),
    });
    const { data: usersList, isLoading: usersLoading, isError: usersError } = useQuery({
        queryKey: ['users-list'],
        queryFn: async () => {
            const r = await usersApi.list({ page_size: 100 });
            const items = r.data?.data?.items;
            return Array.isArray(items) ? items : [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: 'always',
    });
    const users = useMemo(() => (usersList ?? [])
        .filter((u) => u.status !== 'inactive')
        .slice()
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)), [usersList]);
    const filterPeople = useMemo(() => users.filter((u) => u.id !== user?.id), [users, user?.id]);
    const { data: myTasks = [] } = useQuery({
        queryKey: ['my-tasks'],
        queryFn: () => tasksApi.my().then((r) => r.data.data),
    });
    useEffect(() => {
        if (!dayData)
            return;
        setDraft(dayData.own_update?.content ?? '');
        setTaskIds(dayData.own_update?.tasks.map((t) => t.id) ?? []);
        setEditing(!dayData.own_update && dayData.editable);
    }, [dayData]);
    const saveMutation = useMutation({
        mutationFn: () => dailyUpdatesApi.upsert({
            update_date: dateKey,
            content: draft,
            task_ids: taskIds,
            mentioned_user_ids: extractMentionedUserIds(draft, users),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['daily-updates'] });
            toast.success('Daily update saved');
            setEditing(false);
        },
        onError: (err) => {
            const detail = err
                ?.response?.data;
            const msg = typeof detail?.detail === 'string'
                ? detail.detail
                : Array.isArray(detail?.detail)
                    ? detail.detail.map((d) => (typeof d === 'string' ? d : d.msg)).filter(Boolean).join(', ')
                    : detail?.message;
            toast.error(msg || 'Could not save update');
        },
    });
    const editable = !!dayData?.editable;
    const ownUpdate = dayData?.own_update;
    const showEditor = editable && (editing || !ownUpdate);
    const toggleTask = (id) => {
        setTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };
    const untilLabel = dayData?.editable_until
        ? format(parseISO(dayData.editable_until), "MMM d · h:mm a")
        : null;
    return (_jsxs("section", { className: hideIntro ? undefined : 'mb-10', children: [!hideIntro && (_jsxs("div", { className: "mb-3 px-1", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: "Daily update" }), _jsx("h2", { className: "text-lg font-semibold text-text-primary mt-0.5", children: "What got done" }), _jsxs("p", { className: "text-sm text-text-muted mt-0.5", children: ["Point-wise notes for the day. Editable until 10:30 AM the next morning.", untilLabel && editable ? ` Open until ${untilLabel}.` : ''] })] })), hideIntro && untilLabel && editable && (_jsxs("p", { className: "text-sm text-text-muted mb-3 px-1", children: ["Open until ", untilLabel, "."] })), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] min-w-0", children: [_jsxs("div", { className: "space-y-3 min-w-0", children: [_jsx(DailyUpdateCalendar, { month: calendarMonth, selected: selectedDate, markers: calendar?.days ?? [], onMonthChange: setCalendarMonth, onSelect: setSelectedDate }), _jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-3", children: [_jsx("label", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Filter by person" }), _jsxs("select", { className: "input text-sm", value: filterUserId === '' ? '' : String(filterUserId), onChange: (e) => setFilterUserId(e.target.value ? Number(e.target.value) : ''), disabled: usersLoading, children: [_jsx("option", { value: "", children: "All teammates" }), filterPeople.map((u) => (_jsxs("option", { value: String(u.id), children: [u.first_name, " ", u.last_name] }, u.id)))] }), usersLoading && (_jsx("p", { className: "text-2xs text-text-muted mt-1.5", children: "Loading people\u2026" })), usersError && (_jsx("p", { className: "text-2xs text-accent-danger mt-1.5", children: "Could not load people list." })), !usersLoading && !usersError && filterPeople.length === 0 && (_jsx("p", { className: "text-2xs text-text-muted mt-1.5", children: "No other users found." }))] })] }), _jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 min-h-[280px] min-w-0 overflow-hidden", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted", children: format(selectedDate, 'EEEE') }), _jsx("h3", { className: "text-base font-semibold text-text-primary mt-0.5", children: format(selectedDate, 'MMMM d, yyyy') })] }), editable && ownUpdate && !editing && (_jsx("button", { type: "button", onClick: () => setEditing(true), className: "text-sm text-accent-primary hover:underline", children: "Edit" }))] }), isLoading ? (_jsx("p", { className: "text-sm text-text-muted", children: "Loading\u2026" })) : (_jsxs(_Fragment, { children: [showEditor ? (_jsxs("div", { className: "space-y-4", children: [_jsx(DailyUpdateEditor, { value: draft, onChange: setDraft, users: users, usersLoading: usersLoading }), _jsxs("div", { children: [_jsxs("p", { className: "text-2xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5", children: [_jsx(Link2, { className: "h-3 w-3" }), " Related tasks (optional)"] }), _jsxs("div", { className: "flex flex-wrap gap-1.5 max-h-28 overflow-y-auto min-w-0", children: [myTasks.slice(0, 40).map((t) => {
                                                                const on = taskIds.includes(t.id);
                                                                return (_jsx("button", { type: "button", onClick: () => toggleTask(t.id), title: t.title, className: on
                                                                        ? 'chip border border-accent-primary/40 bg-accent-primary/10 text-accent-primary max-w-full min-w-0 truncate'
                                                                        : 'chip border border-dark-border text-text-muted hover:text-text-secondary max-w-full min-w-0 truncate', children: t.title }, t.id));
                                                            }), !myTasks.length && (_jsx("span", { className: "text-xs text-text-muted", children: "No tasks assigned to link." }))] })] }), _jsxs("div", { className: "flex items-center gap-2 pt-1", children: [_jsxs("button", { type: "button", disabled: saveMutation.isPending || !draft.trim(), onClick: () => saveMutation.mutate(), className: "btn-primary inline-flex items-center gap-1.5 text-sm px-3 py-2", children: [_jsx(Save, { className: "h-3.5 w-3.5" }), saveMutation.isPending ? 'Saving…' : 'Save update'] }), ownUpdate && (_jsx("button", { type: "button", onClick: () => {
                                                            setDraft(ownUpdate.content);
                                                            setTaskIds(ownUpdate.tasks.map((t) => t.id));
                                                            setEditing(false);
                                                        }, className: "text-sm text-text-muted hover:text-text-secondary", children: "Cancel" }))] })] })) : ownUpdate ? (_jsxs("div", { className: "space-y-4", children: [_jsx(DailyUpdateContent, { content: ownUpdate.content }), ownUpdate.tasks.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5 pt-1 min-w-0", children: ownUpdate.tasks.map((t) => (_jsx("button", { type: "button", onClick: () => openTask(t.id), title: t.title, className: "chip border border-dark-border text-text-secondary hover:text-text-primary max-w-full min-w-0 truncate", children: t.title }, t.id))) }))] })) : (_jsx("p", { className: "text-sm text-text-muted", children: editable
                                            ? 'No update yet — start writing above.'
                                            : 'No update for this day. Updates can only be written during that day until 10:30 AM the next morning.' })), (dayData?.mentioned_lines.length ?? 0) > 0 && (_jsxs("div", { className: "mt-8 pt-5 border-t border-dark-border", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted mb-3", children: "Mentions in your notes" }), _jsx("ul", { className: "space-y-3", children: dayData.mentioned_lines.map((line) => (_jsxs("li", { className: "rounded-xl bg-surface-subtle/60 px-3 py-2.5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx(Avatar, { name: `${line.author.first_name} ${line.author.last_name}`, size: "sm", src: line.author.profile_picture ?? undefined }), _jsxs("span", { className: "text-xs text-text-muted", children: ["From ", line.author.first_name, " ", line.author.last_name] })] }), _jsx(CommentMentionText, { content: line.line_text })] }, line.id))) })] })), _jsxs("div", { className: "mt-8 pt-5 border-t border-dark-border", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-[0.14em] text-text-muted mb-3", children: filterUserId
                                                    ? `Update from ${dayData?.filtered_user?.first_name ?? 'teammate'} ${dayData?.filtered_user?.last_name ?? ''}`.trim()
                                                    : 'Team updates' }), (dayData?.team_updates.length ?? 0) > 0 ? (_jsx("div", { className: "space-y-5", children: dayData.team_updates.map((u) => (_jsxs("article", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Avatar, { name: `${u.author.first_name} ${u.author.last_name}`, size: "sm", src: u.author.profile_picture ?? undefined }), _jsxs("p", { className: "text-sm font-medium text-text-primary truncate", children: [u.author.first_name, " ", u.author.last_name] })] }), _jsx(DailyUpdateContent, { content: u.content }), u.tasks.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5 mt-2 min-w-0", children: u.tasks.map((t) => (_jsx("button", { type: "button", onClick: () => openTask(t.id), title: t.title, className: "chip border border-dark-border text-text-secondary max-w-full min-w-0 truncate", children: t.title }, t.id))) }))] }, u.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: filterUserId
                                                    ? 'No update from this person for this day yet.'
                                                    : 'No teammate updates for this day yet.' }))] })] }))] })] })] }));
}
