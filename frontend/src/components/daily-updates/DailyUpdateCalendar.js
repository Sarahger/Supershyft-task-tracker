import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
export function DailyUpdateCalendar({ month, selected, markers, onMonthChange, onSelect }) {
    const markerMap = new Map(markers.map((m) => [m.date, m]));
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });
    return (_jsxs("div", { className: "rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("button", { type: "button", onClick: () => onMonthChange(subMonths(month, 1)), className: "p-1.5 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary", "aria-label": "Previous month", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: format(month, 'MMMM yyyy') }), _jsx("button", { type: "button", onClick: () => onMonthChange(addMonths(month, 1)), className: "p-1.5 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary", "aria-label": "Next month", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "grid grid-cols-7 gap-1 mb-1", children: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (_jsx("div", { className: "text-center text-2xs uppercase tracking-wide text-text-muted py-1", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7 gap-1", children: days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const marker = markerMap.get(key);
                    const selectedDay = isSameDay(day, selected);
                    const inMonth = isSameMonth(day, month);
                    return (_jsxs("button", { type: "button", onClick: () => onSelect(day), className: clsx('relative flex flex-col items-center justify-center rounded-lg py-1.5 min-h-[36px] text-sm transition-colors', selectedDay && 'bg-accent-primary text-white', !selectedDay && inMonth && 'text-text-primary hover:bg-dark-hover', !selectedDay && !inMonth && 'text-text-muted/50', !selectedDay && isToday(day) && 'ring-1 ring-accent-primary/40'), children: [format(day, 'd'), (marker?.has_own || (marker?.mention_count ?? 0) > 0 || (marker?.team_count ?? 0) > 0) && (_jsxs("span", { className: "absolute bottom-0.5 flex gap-0.5", children: [marker?.has_own && (_jsx("span", { className: clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white' : 'bg-accent-primary') })), (marker?.mention_count ?? 0) > 0 && (_jsx("span", { className: clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white/80' : 'bg-emerald-400') })), (marker?.team_count ?? 0) > 0 && !marker?.has_own && (_jsx("span", { className: clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white/60' : 'bg-sky-400') }))] }))] }, key));
                }) })] }));
}
