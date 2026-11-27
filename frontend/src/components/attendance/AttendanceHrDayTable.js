import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, isAttendanceEditableDay, statusLabel } from './attendanceUtils';
import { EmptyState } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';
import { parseISO, startOfDay } from 'date-fns';
export function AttendanceHrDayTable({ rows, loading, selectedDay, onSelectUser, onMarkUser, }) {
    const dayEditable = isAttendanceEditableDay(selectedDay);
    if (loading) {
        return (_jsx("div", { className: "task-table animate-pulse", "data-testid": "hr-attendance-table", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-11 border-b border-dark-border bg-dark-muted/40" }, i))) }));
    }
    if (rows.length === 0) {
        return (_jsx("div", { className: "card py-4", "data-testid": "hr-attendance-table", children: _jsx(EmptyState, { title: "No employees found.", description: "Active employees will appear here." }) }));
    }
    return (_jsx("div", { className: "task-table", "data-testid": "hr-attendance-table", children: _jsx("div", { className: "overflow-x-auto scrollbar-none", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "task-table-header", children: _jsxs("tr", { className: "text-left text-2xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "px-4 py-2.5 font-medium", children: "Employee" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Attendance" }), _jsx("th", { className: "px-4 py-2.5 font-medium", children: "Time" })] }) }), _jsx("tbody", { children: rows.map((row) => {
                            const name = `${row.user.first_name} ${row.user.last_name}`.trim();
                            const day = row.attendance_date != null
                                ? startOfDay(parseISO(row.attendance_date))
                                : selectedDay;
                            return (_jsxs("tr", { className: "border-b border-dark-border/60 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0", onClick: () => onSelectUser?.(row.user.id), children: [_jsx("td", { className: "px-4 py-2.5", children: _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(Avatar, { name: name, src: row.user.profile_picture, size: "sm" }), _jsx("span", { className: "truncate text-text-primary text-xs font-medium", children: name })] }) }), _jsxs("td", { className: "px-4 py-2.5", onClick: (e) => {
                                            if (!dayEditable || !onMarkUser)
                                                return;
                                            e.stopPropagation();
                                            onMarkUser({
                                                userId: row.user.id,
                                                userName: name,
                                                day,
                                                status: row.status,
                                            });
                                        }, children: [_jsx("button", { type: "button", disabled: !dayEditable || !onMarkUser, className: clsx('inline-flex items-center gap-2 rounded-md text-left', dayEditable && onMarkUser
                                                    ? 'hover:bg-dark-muted/60 px-1.5 py-1 -mx-1.5 -my-1 cursor-pointer'
                                                    : 'cursor-default'), title: dayEditable
                                                    ? row.status
                                                        ? 'Click to edit attendance'
                                                        : 'Click to mark attendance'
                                                    : undefined, "data-testid": `hr-day-mark-${row.user.id}`, children: row.status ? (_jsx(AttendanceStatusDot, { status: row.status, showLabel: true, recordedAt: row.recorded_at })) : (_jsx("span", { className: "text-xs text-accent-primary font-medium", children: "Mark" })) }), _jsx("span", { className: "sr-only", children: statusLabel(row.status) })] }), _jsx("td", { className: "px-4 py-2.5 text-text-muted tabular-nums", children: row.recorded_at ? formatRecordedTime(row.recorded_at) : '—' })] }, row.user.id));
                        }) })] }) }) }));
}
