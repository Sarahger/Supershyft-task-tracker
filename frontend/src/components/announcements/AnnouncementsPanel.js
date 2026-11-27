import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementsApi } from '../../services/endpoints';
import { mondayOf } from '../../lib/weeklyPlanParse';
import { EmptyState, Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementComposer } from './AnnouncementComposer';
function isoMonday(day = new Date()) {
    return format(mondayOf(day), 'yyyy-MM-dd');
}
export function AnnouncementsPanel() {
    const qc = useQueryClient();
    const [weekStart, setWeekStart] = useState(isoMonday());
    const [authorId, setAuthorId] = useState('');
    const [onDate, setOnDate] = useState('');
    const currentMonday = isoMonday();
    const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
    const weekLabel = weekStart === currentMonday
        ? 'This week'
        : `${format(parseISO(weekStart), 'MMM d')} – ${format(parseISO(weekEnd), 'MMM d')}`;
    const params = {
        week_start: weekStart,
        ...(authorId !== '' ? { author_id: Number(authorId) } : {}),
        ...(onDate ? { on_date: onDate } : {}),
    };
    const { data, isLoading } = useQuery({
        queryKey: ['announcements', params],
        queryFn: () => announcementsApi.list(params).then((r) => r.data.data),
    });
    useEffect(() => {
        announcementsApi.markSeen().then(() => {
            qc.setQueryData(['announcements', 'unread'], 0);
        }).catch(() => undefined);
    }, [qc]);
    const authors = data?.authors ?? [];
    const items = data?.items ?? [];
    const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd')), [weekStart]);
    const reactMutation = useMutation({
        mutationFn: (id) => announcementsApi.toggleReaction(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
        onError: () => toast.error('Could not save reaction'),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => announcementsApi.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['announcements'] });
            toast.success('Announcement deleted');
        },
        onError: () => toast.error('Could not delete announcement'),
    });
    const shiftWeek = (days) => {
        const next = addDays(parseISO(weekStart), days);
        setWeekStart(isoMonday(next));
        setOnDate('');
    };
    return (_jsxs("div", { className: "max-w-3xl mx-auto space-y-5 pb-10", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-semibold text-text-primary", children: "Announcements" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "This week\u2019s posts. Older announcements stay saved but stay in their own week." })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => shiftWeek(-7), className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary", "aria-label": "Previous week", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("p", { className: "text-sm text-text-secondary min-w-[7.5rem] text-center", children: weekLabel }), _jsx("button", { type: "button", onClick: () => shiftWeek(7), disabled: weekStart >= currentMonday, className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary disabled:opacity-40", "aria-label": "Next week", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-xs font-medium text-text-secondary mb-1.5", children: "Filter by person" }), _jsxs("select", { value: authorId, onChange: (e) => setAuthorId(e.target.value ? Number(e.target.value) : ''), className: "input w-full text-sm", children: [_jsx("option", { value: "", children: "Everyone" }), authors.map((author) => (_jsxs("option", { value: author.id, children: [author.first_name, " ", author.last_name] }, author.id)))] })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-xs font-medium text-text-secondary mb-1.5", children: "Filter by date" }), _jsxs("select", { value: onDate, onChange: (e) => setOnDate(e.target.value), className: "input w-full text-sm", children: [_jsx("option", { value: "", children: "Whole week" }), weekDates.map((day) => (_jsx("option", { value: day, children: format(parseISO(day), 'EEEE, MMM d') }, day)))] })] })] }), weekStart === currentMonday && _jsx(AnnouncementComposer, {}), isLoading ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-28" }), _jsx(Skeleton, { className: "h-28" })] })) : items.length === 0 ? (_jsx(EmptyState, { title: weekStart === currentMonday ? 'No announcements this week' : 'No announcements this week', description: "Posts from other weeks stay in the database and can be opened with the week arrows." })) : (_jsx("div", { className: "space-y-3", children: items.map((item) => (_jsx(AnnouncementCard, { item: item, onReact: (id) => reactMutation.mutate(id), onDelete: (id) => deleteMutation.mutate(id) }, item.id))) }))] }));
}
