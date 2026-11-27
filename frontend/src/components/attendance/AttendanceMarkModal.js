import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Building2, Check, Clock, Home, Umbrella, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { format, isToday, parseISO } from 'date-fns';
import { greetingForNow, MARK_OPTIONS, statusIconWrap } from './attendanceUtils';
const ICONS = {
    building: Building2,
    home: Home,
    umbrella: Umbrella,
    clock: Clock,
    users: Users,
};
function resolveDate(date) {
    if (!date)
        return new Date();
    if (date instanceof Date)
        return date;
    return parseISO(date);
}
export function AttendanceMarkModal({ open, loading, onSelect, onClose, success, date, currentStatus, isEdit, personName, }) {
    const [glow, setGlow] = useState(null);
    const [greeting] = useState(() => greetingForNow());
    const day = resolveDate(date);
    const today = isToday(day);
    useEffect(() => {
        if (!open)
            setGlow(null);
    }, [open]);
    if (!open)
        return null;
    const forPerson = personName?.trim() || null;
    const title = isEdit
        ? today
            ? forPerson
                ? `Update ${forPerson}'s attendance`
                : "Update today's attendance"
            : forPerson
                ? `Update ${forPerson} · ${format(day, 'MMM d')}`
                : `Update ${format(day, 'MMM d')}`
        : today
            ? forPerson
                ? `Mark ${forPerson}'s attendance`
                : "Mark today's attendance"
            : forPerson
                ? `Mark ${forPerson} · ${format(day, 'MMM d, yyyy')}`
                : `Mark ${format(day, 'MMM d, yyyy')}`;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto", role: "dialog", "aria-modal": "true", "aria-labelledby": "attendance-mark-title", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)]", onClick: onClose }), _jsxs("div", { className: clsx('relative w-[90%] max-w-md rounded-2xl border border-dark-border bg-dark-card modal-panel', 'my-auto animate-[fadeIn_0.2s_ease-out]'), children: [onClose && !success && (_jsx("button", { type: "button", onClick: onClose, className: "absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) })), _jsx("div", { className: "p-5 sm:p-6", children: success ? (_jsxs("div", { className: "flex flex-col items-center py-8 gap-3", "data-testid": "attendance-success", children: [_jsx("div", { className: "h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center animate-[scaleIn_0.35s_ease-out]", children: _jsx(Check, { className: "h-6 w-6 text-emerald-400", strokeWidth: 2.5 }) }), _jsx("p", { className: "text-base font-semibold text-text-primary", children: isEdit ? 'Attendance Updated' : 'Attendance Recorded' }), _jsx("p", { className: "text-sm text-text-muted", children: forPerson ? forPerson : today ? 'See you today' : format(day, 'EEEE, MMM d') })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-start gap-3 mb-5 pr-6", children: [_jsx("div", { className: "p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0", children: _jsx(Check, { className: "h-5 w-5" }) }), _jsxs("div", { className: "min-w-0", children: [today && !forPerson && (_jsx("p", { className: "text-xs text-text-muted mb-0.5", children: greeting })), _jsx("h2", { id: "attendance-mark-title", className: "text-base font-semibold text-text-primary", children: title }), _jsx("p", { className: "text-sm text-text-muted mt-0.5", children: isEdit ? 'Pick a new status — saves immediately.' : "One tap. That's it." })] })] }), _jsx("div", { className: "space-y-2 max-h-[min(60vh,420px)] overflow-y-auto", children: MARK_OPTIONS.map((opt) => {
                                        const Icon = ICONS[opt.iconKey];
                                        const selected = currentStatus === opt.status || glow === opt.status;
                                        return (_jsxs("button", { type: "button", disabled: loading, "data-testid": `mark-${opt.status}`, onClick: () => {
                                                setGlow(opt.status);
                                                onSelect(opt.status);
                                            }, className: clsx('w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 min-h-[52px]', 'text-left transition-all duration-hover active:scale-[0.98]', 'border-dark-border bg-surface-subtle hover:bg-dark-hover', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary', selected && 'border-accent-primary/40 bg-surface-highlight', loading && 'opacity-60 pointer-events-none'), children: [_jsx("span", { className: clsx('p-2 rounded-lg shrink-0', statusIconWrap(opt.status)), children: _jsx(Icon, { className: "h-4 w-4", "aria-hidden": true }) }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block text-sm font-medium text-text-primary", children: opt.label }), _jsx("span", { className: "block text-2xs text-text-muted mt-0.5", children: opt.hint })] })] }, opt.status));
                                    }) })] })) })] })] }));
}
