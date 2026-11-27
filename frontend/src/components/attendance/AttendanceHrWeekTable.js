import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO, startOfDay } from 'date-fns';
import clsx from 'clsx';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { isAttendanceEditableDay, statusLabel } from './attendanceUtils';
import { Avatar } from '../ui/Avatar';
/** Monday–Saturday only (indices 0–5 of Mon-based week). */
const WORK_DAY_COUNT = 6;
export function AttendanceHrWeekTable({ week, loading, onSelectUser, onMarkCell }) {
    if (loading || !week) {
        return (_jsx("div", { className: "task-table p-4 animate-pulse space-y-2", "data-testid": "hr-week-table", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-10 bg-dark-muted rounded" }, i))) }));
    }
    const sampleDays = (week.rows[0]?.days ?? []).slice(0, WORK_DAY_COUNT);
    const dayHeaders = sampleDays.length > 0
        ? sampleDays.map((d) => ({
            key: d.date,
            label: format(parseISO(d.date), 'EEE'),
            dateLabel: format(parseISO(d.date), 'd'),
        }))
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => ({
            key: String(i),
            label,
            dateLabel: '',
        }));
    return (_jsx("div", { className: "task-table", "data-testid": "hr-week-table", children: _jsx("div", { className: "overflow-x-auto scrollbar-none", children: _jsxs("table", { className: "w-full text-sm border-collapse", children: [_jsx("thead", { className: "task-table-header", children: _jsxs("tr", { className: "text-2xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "sticky left-0 z-10 task-table-header px-3 py-2.5 text-left font-medium min-w-[140px]", children: "Employee" }), dayHeaders.map((d) => (_jsxs("th", { className: "px-1.5 py-2.5 text-center font-medium min-w-[44px]", children: [_jsx("span", { className: "block", children: d.label }), d.dateLabel ? (_jsx("span", { className: "block text-text-muted font-normal normal-case tracking-normal", children: d.dateLabel })) : null] }, d.key)))] }) }), _jsxs("tbody", { children: [week.rows.map((row) => {
                                const name = `${row.user.first_name} ${row.user.last_name}`.trim();
                                const days = row.days.slice(0, WORK_DAY_COUNT);
                                return (_jsxs("tr", { className: "border-b border-dark-border/50 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0", onClick: () => onSelectUser(row.user.id), children: [_jsx("td", { className: "sticky left-0 z-10 bg-dark-card px-3 py-2", children: _jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(Avatar, { name: name, src: row.user.profile_picture, size: "sm" }), _jsx("span", { className: "truncate text-text-primary text-xs font-medium", children: name })] }) }), days.map((cell) => {
                                            const day = startOfDay(parseISO(cell.date));
                                            const editable = isAttendanceEditableDay(day);
                                            return (_jsx("td", { className: "px-1.5 py-2 text-center", children: _jsx("button", { type: "button", disabled: !editable || !onMarkCell, "data-testid": `hr-week-mark-${row.user.id}-${cell.date}`, title: editable
                                                        ? cell.status
                                                            ? `${statusLabel(cell.status)} — click to edit`
                                                            : 'Click to mark'
                                                        : cell.status
                                                            ? statusLabel(cell.status)
                                                            : 'Not marked', onClick: (e) => {
                                                        if (!editable || !onMarkCell)
                                                            return;
                                                        e.stopPropagation();
                                                        onMarkCell({
                                                            userId: row.user.id,
                                                            userName: name,
                                                            day,
                                                            status: cell.status,
                                                        });
                                                    }, className: clsx('inline-flex justify-center items-center min-h-[32px] min-w-[32px] rounded-md mx-auto', editable && onMarkCell
                                                        ? 'hover:bg-dark-muted/70 cursor-pointer'
                                                        : 'cursor-default'), children: cell.status ? (_jsx(AttendanceStatusDot, { status: cell.status, recordedAt: cell.recorded_at, size: "md" })) : editable ? (_jsx("span", { className: "text-2xs text-accent-primary font-medium", children: "+" })) : (_jsx(AttendanceStatusDot, { status: null, size: "md" })) }) }, cell.date));
                                        })] }, row.user.id));
                            }), week.rows.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 1 + WORK_DAY_COUNT, className: "px-4 py-8 text-center text-sm text-text-muted", children: "No employees found." }) }))] })] }) }) }));
}
