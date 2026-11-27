import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import clsx from 'clsx';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
export function AttendanceWeekStrip({ week, weekStart, loading }) {
    const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
    const [active, setActive] = useState(null);
    if (loading) {
        return (_jsxs("div", { className: "card h-full p-3", children: [_jsx("div", { className: "h-3 w-28 bg-dark-muted rounded mb-2 animate-pulse" }), _jsx("div", { className: "flex gap-2", children: Array.from({ length: 7 }).map((_, i) => (_jsx("div", { className: "flex-1 rounded-lg bg-dark-muted animate-pulse h-14" }, i))) })] }));
    }
    return (_jsxs("section", { className: "card h-full min-h-0 p-3 flex flex-col gap-2", children: [_jsx("h2", { className: "workspace-section-title !mb-0 !px-0 shrink-0", children: "This week" }), _jsx("div", { className: "flex gap-1.5 sm:gap-2", children: Array.from({ length: 7 }).map((_, i) => {
                    const day = addDays(start, i);
                    const record = week[i] ?? null;
                    const isActive = active === i;
                    return (_jsxs("button", { type: "button", onClick: () => setActive(isActive ? null : i), onMouseEnter: () => setActive(i), onMouseLeave: () => setActive(null), className: clsx('relative flex-1 min-w-0 rounded-lg border border-dark-border', 'flex flex-col items-center justify-center gap-1 py-2', 'transition-colors duration-hover hover:bg-dark-hover', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary', isActive && 'bg-surface-highlight border-accent-primary/30'), "aria-label": `${format(day, 'EEEE')} ${statusLabel(record?.status)}`, children: [_jsx("span", { className: "text-2xs uppercase tracking-wide text-text-muted", children: format(day, 'EEE') }), _jsx(AttendanceStatusDot, { status: record?.status ?? null, recordedAt: record?.recorded_at, size: "md" }), isActive && (_jsxs("span", { className: "absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-10 rounded-lg dropdown-panel px-2.5 py-1.5 text-2xs text-text-secondary whitespace-nowrap pointer-events-none", children: [format(day, 'MMM d'), " \u00B7 ", statusLabel(record?.status), record?.recorded_at ? ` · ${formatRecordedTime(record.recorded_at)}` : ''] }))] }, format(day, 'yyyy-MM-dd')));
                }) })] }));
}
