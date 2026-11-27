import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Video, Phone, Clock, LogOut, ExternalLink, Shield, PhoneOff, Search, } from 'lucide-react';
import clsx from 'clsx';
import { meetingsApi, usersApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { endInstantCall, joinMorningCall, openBlankMeetWindow, openMeetUrl, startInstantCall, statusBadgeClass, todayIsoDate, MORNING_MEET_URL, } from '../lib/meetings';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
function userName(user) {
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown';
}
function LogRow({ log, onLeave }) {
    const meetUrl = log.meet_url ?? MORNING_MEET_URL;
    const joined = format(new Date(log.click_time), 'h:mm a');
    const left = log.left_at ? format(new Date(log.left_at), 'h:mm a') : null;
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm", children: [_jsxs("div", { className: "flex-1 min-w-[200px]", children: [_jsx("p", { className: "text-text-primary font-medium", children: log.log_type }), log.task_title && _jsx("p", { className: "text-text-muted text-xs mt-0.5", children: log.task_title }), log.status && (_jsx("span", { className: clsx('inline-block mt-1 text-xs px-1.5 py-0.5 rounded', statusBadgeClass(log.status)), children: log.status }))] }), _jsxs("div", { className: "text-text-secondary tabular-nums", children: [_jsxs("span", { children: ["Joined ", joined] }), left ? _jsxs("span", { className: "text-text-muted", children: [" \u00B7 Left ", left] }) : _jsx("span", { className: "text-text-muted", children: " \u00B7 Still in call" })] }), _jsxs("div", { className: "flex gap-1.5 shrink-0", children: [log.meet_url && (_jsxs(Button, { variant: "secondary", size: "sm", className: "gap-1", onClick: () => openMeetUrl(meetUrl), children: [_jsx(ExternalLink, { className: "h-3.5 w-3.5" }), " Join"] })), !left && onLeave && (_jsxs(Button, { variant: "secondary", size: "sm", className: "gap-1", onClick: () => onLeave(log.id), children: [_jsx(LogOut, { className: "h-3.5 w-3.5" }), " Left call"] }))] })] }));
}
function UserInvitePicker({ users, selected, onChange, }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q)
            return users;
        return users.filter((u) => u.first_name.toLowerCase().includes(q)
            || u.last_name.toLowerCase().includes(q)
            || u.email.toLowerCase().includes(q));
    }, [users, search]);
    const toggle = (id) => {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" }), _jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search team members\u2026", className: "pl-8 text-sm" })] }), _jsxs("div", { className: "max-h-40 overflow-y-auto rounded-lg border border-dark-border divide-y divide-dark-border", children: [filtered.map((u) => (_jsxs("label", { className: "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-dark-muted", children: [_jsx("input", { type: "checkbox", checked: selected.includes(u.id), onChange: () => toggle(u.id), className: "rounded border-dark-border" }), _jsxs("span", { className: "text-text-primary", children: [u.first_name, " ", u.last_name] })] }, u.id))), !filtered.length && (_jsx("p", { className: "px-3 py-2 text-sm text-text-muted", children: "No matching users" }))] }), selected.length > 0 && (_jsxs("p", { className: "text-xs text-text-muted", children: [selected.length, " member(s) selected"] }))] }));
}
export default function MeetingsPage() {
    const { user } = useAuth();
    const isManager = canAccessManagerFeatures(user);
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(todayIsoDate());
    const [inviteUserIds, setInviteUserIds] = useState([]);
    const isTodaySelected = selectedDate === todayIsoDate();
    const { data: teamUsers } = useQuery({
        queryKey: ['users-meetings-invite'],
        queryFn: () => usersApi.list({ page_size: 100, status: 'active' }).then((r) => r.data.data.items),
    });
    const { data, isLoading } = useQuery({
        queryKey: ['meetings-day', selectedDate],
        queryFn: () => meetingsApi.getDay(selectedDate).then((r) => r.data.data),
        refetchInterval: isTodaySelected ? 15000 : false,
    });
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meetings-day', selectedDate] });
    const morningMutation = useMutation({
        mutationFn: (pendingWindow) => joinMorningCall(pendingWindow),
        onSuccess: () => { invalidate(); toast.success('Opening morning call…'); },
    });
    const instantMutation = useMutation({
        mutationFn: (pendingWindow) => startInstantCall(inviteUserIds, pendingWindow),
        onSuccess: () => {
            invalidate();
            setInviteUserIds([]);
            toast.success('Instant call started — invites sent');
        },
    });
    const endCallMutation = useMutation({
        mutationFn: (poolId) => endInstantCall(poolId),
        onSuccess: () => { invalidate(); toast.success('Call ended — link returned to pool'); },
    });
    const leaveMutation = useMutation({
        mutationFn: (logId) => meetingsApi.leave(logId),
        onSuccess: () => { invalidate(); toast.success('Departure recorded'); },
        onError: () => toast.error('Could not record departure'),
    });
    const isToday = isTodaySelected;
    const canJoinMorning = isToday;
    const activeInstant = data?.active_instant_call ?? null;
    const invitedCalls = data?.invited_active_instant_calls ?? [];
    const displayDate = (() => {
        try {
            return format(parseISO(selectedDate), 'EEEE, MMM d, yyyy');
        }
        catch {
            return selectedDate;
        }
    })();
    return (_jsxs("div", { className: "max-w-workspace mx-auto pb-12", children: [_jsx(PageHeader, { title: "Meetings", subtitle: "Daily standup, instant syncs, and task calls", action: _jsx("input", { type: "date", value: selectedDate, onChange: (e) => setSelectedDate(e.target.value), className: "input py-1.5 text-sm w-auto" }) }), _jsx("p", { className: "text-sm text-text-muted mb-2", children: displayDate }), isToday && (_jsxs("p", { className: "text-xs text-text-muted mb-4", children: [data?.pool_available_count ?? '—', " of 8 Meet links available in pool"] })), _jsxs("div", { className: "space-y-4 mb-8", children: [_jsxs("section", { className: "rounded-xl border border-sky-500/20 bg-dark-card p-5", children: [_jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: "p-2 rounded-lg bg-sky-500/10 text-sky-400", children: _jsx(Video, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: "Daily Morning Call" }), _jsx("p", { className: "text-sm text-text-muted mt-0.5", children: "Always available \u00B7 Click \"Left call\" when you leave" })] })] }), _jsxs(Button, { className: "w-full gap-2", disabled: !canJoinMorning || morningMutation.isPending, onClick: () => morningMutation.mutate(openBlankMeetWindow()), children: [_jsx(Video, { className: "h-4 w-4" }), " Join Morning Call"] })] }), _jsxs("section", { className: "rounded-xl border border-dark-border bg-dark-card p-5", children: [_jsxs("div", { className: "flex items-start gap-3 mb-4", children: [_jsx("div", { className: "p-2 rounded-lg bg-violet-500/10 text-violet-400", children: _jsx(Phone, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: "Instant General Call" }), _jsx("p", { className: "text-sm text-text-muted mt-0.5", children: "Assigns a free link from the pool. Select teammates to notify before launching." })] })] }), invitedCalls.length > 0 && (_jsxs("div", { className: "mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-wider text-emerald-400/90 px-0.5", children: "Invites for you" }), _jsx("ul", { className: "space-y-2", children: invitedCalls.map((invite) => {
                                            const name = invite.starter
                                                ? `${invite.starter.first_name} ${invite.starter.last_name}`
                                                : 'Teammate';
                                            return (_jsxs("li", { className: "flex items-center gap-3 rounded-lg bg-dark-card/80 border border-dark-border px-3 py-2.5", children: [_jsx(Avatar, { name: name, size: "sm", src: invite.starter?.profile_picture ?? undefined }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: name }), _jsx("p", { className: "text-2xs text-text-muted", children: "wants you to join their call" })] }), _jsxs(Button, { size: "sm", className: "gap-1.5 shrink-0", onClick: () => openMeetUrl(invite.meet_url), children: [_jsx(Video, { className: "h-3.5 w-3.5" }), " Join"] })] }, invite.id));
                                        }) })] })), !activeInstant ? (_jsxs(_Fragment, { children: [_jsx(UserInvitePicker, { users: (teamUsers ?? []).filter((u) => u.id !== user?.id), selected: inviteUserIds, onChange: setInviteUserIds }), _jsxs(Button, { className: "w-full gap-2 mt-4", disabled: instantMutation.isPending, onClick: () => instantMutation.mutate(openBlankMeetWindow()), children: [_jsx(Phone, { className: "h-4 w-4" }), " Start Instant General Call"] })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-emerald-400", children: "You have an active instant call running." }), _jsxs(Button, { variant: "secondary", className: "w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10", disabled: endCallMutation.isPending, onClick: () => endCallMutation.mutate(activeInstant.id), children: [_jsx(PhoneOff, { className: "h-4 w-4" }), " End Call & Release Link"] }), _jsxs(Button, { variant: "secondary", className: "w-full gap-2", onClick: () => openMeetUrl(activeInstant.meet_url), children: [_jsx(ExternalLink, { className: "h-4 w-4" }), " Rejoin Meet"] })] }))] })] }), _jsxs("div", { className: "space-y-6", children: [isManager && (_jsxs("section", { className: "rounded-xl border border-dark-border bg-dark-card p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Shield, { className: "h-4 w-4 text-sky-400" }), _jsx("h3", { className: "text-sm font-semibold text-text-primary", children: "Morning call attendance" })] }), _jsx("p", { className: "text-xs text-text-muted mb-4", children: "Full join/leave log for manual review \u2014 no automatic late marking." }), !data?.morning_attendance?.length ? (_jsx("p", { className: "text-sm text-text-muted", children: "No morning call attendance recorded for this day." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-text-muted border-b border-dark-border", children: [_jsx("th", { className: "pb-2 pr-4 font-medium", children: "Member" }), _jsx("th", { className: "pb-2 pr-4 font-medium", children: "Joined" }), _jsx("th", { className: "pb-2 font-medium", children: "Left" })] }) }), _jsx("tbody", { children: data.morning_attendance.map((log) => (_jsxs("tr", { className: "border-b border-dark-border last:border-0", children: [_jsx("td", { className: "py-2.5 pr-4 text-text-primary", children: userName(log.user) }), _jsx("td", { className: "py-2.5 pr-4 tabular-nums text-text-secondary", children: format(new Date(log.click_time), 'h:mm a') }), _jsx("td", { className: "py-2.5 tabular-nums text-text-secondary", children: log.left_at ? format(new Date(log.left_at), 'h:mm a') : (_jsx("span", { className: "text-text-muted", children: "\u2014" })) })] }, log.id))) })] }) }))] })), isLoading ? (_jsx("div", { className: "h-32 rounded-xl bg-dark-muted animate-pulse" })) : (_jsxs("section", { className: "rounded-xl border border-dark-border bg-dark-card p-5", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx(Clock, { className: "h-4 w-4 text-text-muted" }), _jsx("h3", { className: "text-sm font-semibold text-text-primary uppercase tracking-wider", children: "Your activity" })] }), !data?.my_logs.length ? (_jsx("p", { className: "text-sm text-text-muted", children: "No meeting activity recorded for this day." })) : (data.my_logs.map((log) => (_jsx(LogRow, { log: log, onLeave: (id) => leaveMutation.mutate(id) }, log.id))))] }))] })] }));
}
