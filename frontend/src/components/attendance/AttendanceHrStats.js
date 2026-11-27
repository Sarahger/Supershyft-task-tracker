import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { Building2, Home, Umbrella, CircleDashed, Clock, Users } from 'lucide-react';
const CARDS = [
    {
        key: 'present_wfo',
        label: 'Present (WFO)',
        icon: Building2,
        color: 'metric-emerald',
        border: 'border-emerald-500/20 bg-emerald-500/5',
        iconWrap: 'bg-emerald-500/10 text-emerald-400',
    },
    {
        key: 'wfh',
        label: 'WFH',
        icon: Home,
        color: 'metric-sky',
        border: 'border-sky-500/20 bg-sky-500/5',
        iconWrap: 'bg-sky-500/10 text-sky-400',
    },
    {
        key: 'on_leave',
        label: 'On leave',
        icon: Umbrella,
        color: 'metric-amber',
        border: 'border-amber-500/20 bg-amber-500/5',
        iconWrap: 'bg-amber-500/10 text-amber-400',
    },
    {
        key: 'half_day',
        label: 'Half day',
        icon: Clock,
        color: 'metric-violet',
        border: 'border-violet-500/20 bg-violet-500/5',
        iconWrap: 'bg-violet-500/10 text-violet-400',
    },
    {
        key: 'camp',
        label: 'Camp/Meeting',
        icon: Users,
        color: 'metric-orange',
        border: 'border-orange-500/20 bg-orange-500/5',
        iconWrap: 'bg-orange-500/10 text-orange-400',
    },
    {
        key: 'not_marked',
        label: 'Not marked',
        icon: CircleDashed,
        color: 'text-text-muted',
        border: 'border-dark-border',
        iconWrap: 'bg-surface-muted text-text-muted',
    },
];
export function AttendanceHrStats({ stats, loading, activeKey, onSelect }) {
    return (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3", children: CARDS.map((c) => {
            const Icon = c.icon;
            const count = stats?.[c.key] ?? 0;
            const isActive = activeKey === c.key;
            return (_jsx("button", { type: "button", onClick: () => onSelect?.(c.key), disabled: loading || !stats, className: clsx('card p-4 border text-left transition-colors duration-hover', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary', 'disabled:cursor-default', c.border, onSelect && !loading && stats && 'hover:bg-dark-hover cursor-pointer', isActive && 'ring-2 ring-accent-primary/40'), "data-testid": `hr-stat-${c.key}`, "aria-pressed": isActive, "aria-label": `Show ${count} people — ${c.label}`, children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [loading || !stats ? (_jsx("div", { className: "h-7 w-10 bg-dark-muted rounded animate-pulse" })) : (_jsx("p", { className: clsx('text-2xl font-semibold tabular-nums', c.color), children: count })), _jsx("p", { className: "text-xs text-text-secondary mt-1 font-medium", children: c.label })] }), _jsx("div", { className: clsx('p-1.5 rounded-lg shrink-0', c.iconWrap), children: _jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": true }) })] }) }, c.key));
        }) }));
}
export const ATTENDANCE_HR_STAT_LABELS = {
    present_wfo: 'Present (WFO)',
    wfh: 'WFH',
    on_leave: 'On leave',
    half_day: 'Half day',
    camp: 'Camp/Meeting',
    not_marked: 'Not marked',
};
