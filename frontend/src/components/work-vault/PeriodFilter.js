import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, addYears, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths, subYears, } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { periodLabel } from '../../lib/workVault';
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseSelected(mode, value) {
    if (mode === 'month' && /^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split('-').map(Number);
        return new Date(year, month - 1, 1);
    }
    const match = value.match(/^(\d{4})-W(\d{2})$/);
    if (mode === 'week' && match) {
        const year = Number(match[1]);
        const week = Number(match[2]);
        const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
        const day = simple.getUTCDay();
        const monday = new Date(simple);
        monday.setUTCDate(simple.getUTCDate() - (day <= 4 ? day - 1 : day - 8));
        return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
    }
    return new Date();
}
function weekValueFromDate(day) {
    const thursday = new Date(day);
    thursday.setDate(day.getDate() + 4 - (day.getDay() || 7));
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function sameWeek(a, b) {
    return weekValueFromDate(a) === weekValueFromDate(b);
}
export function PeriodFilter({ mode, value, onChange, }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(mode || 'week');
    const [cursor, setCursor] = useState(() => parseSelected(mode, value));
    const rootRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        setTab(mode || 'week');
        setCursor(parseSelected(mode, value));
    }, [open, mode, value]);
    useEffect(() => {
        if (!open)
            return;
        const onPointer = (event) => {
            if (!rootRef.current?.contains(event.target))
                setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [cursor]);
    const selected = mode ? parseSelected(mode, value) : null;
    const label = periodLabel(mode, value);
    const pickWeek = (day) => {
        onChange('week', weekValueFromDate(day));
        setOpen(false);
    };
    const pickMonth = (year, monthIndex) => {
        onChange('month', `${year}-${String(monthIndex + 1).padStart(2, '0')}`);
        setOpen(false);
    };
    return (_jsxs("div", { ref: rootRef, className: "relative", children: [_jsx("button", { type: "button", onClick: () => setOpen((prev) => !prev), className: clsx('p-2 rounded-md min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors', open || mode
                    ? 'text-accent-primary bg-dark-hover'
                    : 'text-text-muted hover:text-text-primary hover:bg-dark-hover'), "aria-label": "Choose week or month", "aria-expanded": open, children: _jsx(CalendarDays, { className: "h-4 w-4" }) }), open && (_jsxs("div", { className: "absolute right-0 top-full mt-1 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl dropdown-panel border border-dark-border p-3 shadow-lg", children: [_jsx("div", { className: "flex rounded-lg bg-dark-muted p-0.5 mb-3", children: ['week', 'month'].map((item) => (_jsx("button", { type: "button", onClick: () => setTab(item), className: clsx('flex-1 py-1.5 text-xs font-medium rounded-md capitalize', tab === item ? 'bg-dark-card text-text-primary' : 'text-text-muted hover:text-text-secondary'), children: item }, item))) }), tab === 'week' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("button", { type: "button", className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover", onClick: () => setCursor(subMonths(cursor, 1)), "aria-label": "Previous month", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: format(cursor, 'MMMM yyyy') }), _jsx("button", { type: "button", className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover", onClick: () => setCursor(addMonths(cursor, 1)), "aria-label": "Next month", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "grid grid-cols-7 gap-1 mb-1", children: WEEKDAYS.map((day) => (_jsx("div", { className: "text-center text-2xs uppercase tracking-wider text-text-muted py-0.5", children: day }, day))) }), _jsx("div", { className: "grid grid-cols-7 gap-1", children: days.map((day) => {
                                    const inMonth = isSameMonth(day, cursor);
                                    const selectedWeek = selected && mode === 'week' && sameWeek(day, selected);
                                    return (_jsx("button", { type: "button", onClick: () => pickWeek(day), className: clsx('h-8 rounded-md text-xs', !inMonth && 'text-text-muted/40', inMonth && !selectedWeek && 'text-text-secondary hover:bg-dark-hover', selectedWeek && 'bg-accent-primary/15 text-accent-primary font-medium', isToday(day) && !selectedWeek && 'ring-1 ring-dark-border'), children: format(day, 'd') }, day.toISOString()));
                                }) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("button", { type: "button", className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover", onClick: () => setCursor(subYears(cursor, 1)), "aria-label": "Previous year", children: _jsx(ChevronLeft, { className: "h-4 w-4" }) }), _jsx("p", { className: "text-sm font-medium text-text-primary", children: format(cursor, 'yyyy') }), _jsx("button", { type: "button", className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover", onClick: () => setCursor(addYears(cursor, 1)), "aria-label": "Next year", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "grid grid-cols-3 gap-1.5", children: MONTHS.map((name, index) => {
                                    const selectedMonth = mode === 'month' && selected
                                        && selected.getFullYear() === cursor.getFullYear()
                                        && selected.getMonth() === index;
                                    return (_jsx("button", { type: "button", onClick: () => pickMonth(cursor.getFullYear(), index), className: clsx('py-2 rounded-md text-xs', selectedMonth
                                            ? 'bg-accent-primary/15 text-accent-primary font-medium'
                                            : 'text-text-secondary hover:bg-dark-hover'), children: name }, name));
                                }) })] })), _jsxs("div", { className: "flex justify-between items-center mt-3 pt-2 border-t border-dark-border", children: [_jsx("p", { className: "text-2xs text-text-muted truncate pr-2", children: label }), mode ? (_jsxs("button", { type: "button", className: "text-2xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1", onClick: () => {
                                    onChange('', '');
                                    setOpen(false);
                                }, children: [_jsx(X, { className: "h-3 w-3" }), " All time"] })) : (_jsx("span", { className: "text-2xs text-text-muted", children: "All time" }))] })] }))] }));
}
