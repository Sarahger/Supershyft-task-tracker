import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
import { EmptyState } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';
export function AttendanceTable({ records, loading, showEmployee = false, onSelect, onSelectUser, }) {
    if (loading) {
        return (_jsx("div", { className: "task-table animate-pulse", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-11 border-b border-dark-border bg-dark-muted/40" }, i))) }));
    }
    if (records.length === 0) {
        return (_jsx("div", { className: "card py-4", children: _jsx(EmptyState, { title: "No attendance found for this month.", description: "Mark your attendance from the Attendance home page." }) }));
    }
    return (_jsx("div", { className: "task-table", "data-testid": "hr-attendance-table", children: _jsx("div", { className: "overflow-x-auto scrollbar-none", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "task-table-header", children: _jsxs("tr", { className: "text-left text-2xs uppercase tracking-wider text-text-muted", children: [showEmployee && _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Employee" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Date" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Day" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Time" })] }) }), _jsx("tbody", { children: records.map((r) => {
                            const d = parseISO(r.attendance_date);
                            const name = r.user
                                ? `${r.user.first_name} ${r.user.last_name}`.trim()
                                : null;
                            return (_jsxs("tr", { className: "border-b border-dark-border/60 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0", onClick: () => {
                                    if (onSelectUser && r.user_id)
                                        onSelectUser(r.user_id);
                                    else
                                        onSelect?.(r);
                                }, children: [showEmployee && (_jsx("td", { className: "px-4 py-2.5", children: name ? (_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(Avatar, { name: name, src: r.user?.profile_picture, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-text-primary text-xs font-medium", children: name }), _jsx("p", { className: "truncate text-2xs text-text-muted", children: (r.user?.departments || []).join(', ') || '—' })] })] })) : (_jsx("span", { className: "text-text-muted", children: "\u2014" })) })), _jsx("td", { className: "px-4 py-2.5 text-text-primary tabular-nums", children: format(d, 'MMM d, yyyy') }), _jsx("td", { className: "px-4 py-2.5 text-text-secondary", children: format(d, 'EEE') }), _jsxs("td", { className: "px-4 py-2.5", children: [_jsx(AttendanceStatusDot, { status: r.status, showLabel: true, recordedAt: r.recorded_at }), _jsx("span", { className: "sr-only", children: statusLabel(r.status) })] }), _jsx("td", { className: "px-4 py-2.5 text-text-muted tabular-nums", children: formatRecordedTime(r.recorded_at) })] }, r.id));
                        }) })] }) }) }));
}
