import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { normalizeStatus, statusDotClass, statusLabel, formatRecordedTime } from './attendanceUtils';
export function AttendanceCalendar({ month, records, selected, onMonthChange, onSelect, loading, }) {
    const map = new Map(records.map((r) => [r.attendance_date, r]));
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    const weekCount = Math.ceil(days.length / 7);
    if (loading) {
        return (_jsxs("div", { className: "card h-full p-3 sm:p-4 animate-pulse flex flex-col", children: [_jsx("div", { className: "h-5 w-32 bg-dark-muted rounded mx-auto mb-3" }), _jsx("div", { className: "flex-1 grid grid-cols-7 gap-1.5", children: Array.from({ length: 35 }).map((_, i) => (_jsx("div", { className: "rounded-lg bg-dark-muted min-h-0" }, i))) })] }));
    }
    return (_jsxs("section", { className: "card h-full min-h-0 p-3 sm:p-4 flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between shrink-0 mb-2", children: [_jsx("button", { type: "button", onClick: () => onMonthChange(subMonths(month, 1)), className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors duration-hover", "aria-label": "Previous month", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: format(month, 'MMMM yyyy') }, format(month, 'yyyy-MM')), _jsx("button", { type: "button", onClick: () => onMonthChange(addMonths(month, 1)), className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors duration-hover", "aria-label": "Next month", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "grid grid-cols-7 gap-1 sm:gap-1.5 shrink-0 mb-1", children: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (_jsx("div", { className: "text-center text-2xs uppercase tracking-wider text-text-muted py-0.5", children: d }, d))) }), _jsx("div", { className: "flex-1 min-h-0 grid grid-cols-7 gap-1 sm:gap-1.5", style: { gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }, children: days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const record = map.get(key) ?? null;
                    const status = normalizeStatus(record?.status);
                    const selectedDay = selected ? isSameDay(day, selected) : false;
                    const inMonth = isSameMonth(day, month);
                    return (_jsxs("button", { type: "button", onClick: () => onSelect(day, record), title: record
                            ? `${statusLabel(status)} · ${formatRecordedTime(record.recorded_at)}`
                            : statusLabel(null), className: clsx('relative flex flex-col items-center justify-center gap-1 rounded-lg text-sm', 'transition-colors duration-hover min-h-0 py-1 px-0.5', selectedDay && 'bg-surface-active text-text-primary', !selectedDay && inMonth && 'text-text-primary hover:bg-dark-hover', !selectedDay && !inMonth && 'text-text-muted/40', !selectedDay && isToday(day) && 'calendar-today-pill'), "aria-label": `${format(day, 'MMMM d')}: ${statusLabel(status)}`, children: [_jsx("span", { className: "text-sm tabular-nums leading-none", children: format(day, 'd') }), _jsx("span", { className: clsx('h-1.5 w-1.5 rounded-full shrink-0', status ? statusDotClass(status) : 'bg-transparent', !inMonth && status && 'opacity-40'), "aria-hidden": true })] }, key));
                }) }, format(month, 'yyyy-MM'))] }));
}
