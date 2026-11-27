import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import clsx from 'clsx';
import { Building2, CalendarCheck, Clock, Home, Pencil, Umbrella, Users } from 'lucide-react';
import { formatRecordedTime, statusAccentBorder, statusBadgeClass, statusIconWrap, statusShort, } from './attendanceUtils';
import { AttendanceMarkModal } from './AttendanceMarkModal';
import { Button } from '../ui/Button';
function StatusIcon({ status }) {
    if (status === 'WFO')
        return _jsx(Building2, { className: "h-4 w-4" });
    if (status === 'WFH')
        return _jsx(Home, { className: "h-4 w-4" });
    if (status === 'HALF_DAY')
        return _jsx(Clock, { className: "h-4 w-4" });
    if (status === 'CAMP')
        return _jsx(Users, { className: "h-4 w-4" });
    return _jsx(Umbrella, { className: "h-4 w-4" });
}
export function AttendanceTodayHero({ todayRecord, showMarkModal, markSuccess, marking, onMark, onOpenMark, onCloseMark, loading, }) {
    if (loading) {
        return (_jsxs("div", { className: "card h-full p-3 animate-pulse", children: [_jsx("div", { className: "h-4 w-32 bg-dark-muted rounded mb-2" }), _jsx("div", { className: "h-6 w-24 bg-dark-muted rounded" })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: clsx('card h-full min-h-0 p-3 flex flex-col gap-2', todayRecord ? statusAccentBorder(todayRecord.status) : 'border-sky-500/20 bg-sky-500/5'), children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("div", { className: clsx('p-1.5 rounded-lg shrink-0', todayRecord ? statusIconWrap(todayRecord.status) : 'bg-sky-500/10 text-sky-400'), children: todayRecord ? _jsx(StatusIcon, { status: todayRecord.status }) : _jsx(CalendarCheck, { className: "h-4 w-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary leading-tight", children: "Attendance Today" }), !todayRecord && (_jsx("p", { className: "text-xs text-text-muted mt-0.5 line-clamp-1", children: "Mark today \u2014 or tap yesterday on the calendar to edit." }))] }), todayRecord && onOpenMark && (_jsxs(Button, { size: "sm", variant: "secondary", className: "gap-1.5 shrink-0", onClick: onOpenMark, "data-testid": "edit-today-attendance", children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), "Edit"] }))] }), todayRecord ? (_jsxs("div", { "data-testid": "attendance-submitted", className: "min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1", children: [_jsx("span", { className: clsx('chip inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-sm font-semibold', statusBadgeClass(todayRecord.status)), children: statusShort(todayRecord.status) }), _jsxs("p", { className: "text-xs text-text-secondary", children: ["Recorded at ", formatRecordedTime(todayRecord.recorded_at)] })] })) : (_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-2", children: [_jsx("p", { className: "text-xs text-text-secondary flex-1 line-clamp-1", children: "You haven't marked attendance yet." }), onOpenMark && (_jsxs(Button, { size: "sm", className: "gap-1.5 shrink-0", onClick: onOpenMark, children: [_jsx(CalendarCheck, { className: "h-3.5 w-3.5" }), "Mark attendance"] }))] }))] }), _jsx(AttendanceMarkModal, { open: showMarkModal || markSuccess, loading: marking, success: markSuccess, isEdit: !!todayRecord, currentStatus: todayRecord?.status, onSelect: onMark, onClose: onCloseMark })] }));
}
