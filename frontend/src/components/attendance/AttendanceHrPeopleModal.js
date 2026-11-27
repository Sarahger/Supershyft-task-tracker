import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Avatar } from '../ui/Avatar';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';
export function AttendanceHrPeopleModal({ open, title, people, onClose, onSelectUser }) {
    useEffect(() => {
        if (!open)
            return;
        const handler = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', handler);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)]", onClick: onClose }), _jsxs("div", { className: clsx('relative w-full sm:max-w-md bg-dark-card border border-dark-border modal-panel', 'flex flex-col', 'max-h-[min(85dvh,calc(100dvh-1rem))] sm:max-h-[min(80vh,560px)]', 'rounded-t-2xl sm:rounded-2xl', 'pb-[env(safe-area-inset-bottom,0px)]'), role: "dialog", "aria-modal": "true", "aria-label": title, children: [_jsxs("div", { className: "flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-dark-border shrink-0", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary truncate min-w-0", children: title }), _jsx("button", { type: "button", onClick: onClose, className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover shrink-0", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "overflow-y-auto overscroll-contain min-h-0 flex-1 px-4 sm:px-5 py-3", children: people.length === 0 ? (_jsxs("div", { className: "py-8 text-center", children: [_jsx("p", { className: "text-sm font-medium text-text-secondary", children: "No one in this group." }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "Counts update as people mark attendance." })] })) : (_jsx("ul", { className: "divide-y divide-dark-border", "data-testid": "hr-stat-people-list", children: people.map((user) => {
                                const name = `${user.first_name} ${user.last_name}`.trim();
                                const dept = (user.departments || []).join(', ') || '—';
                                return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => {
                                            onSelectUser(user.id);
                                            onClose();
                                        }, className: "w-full flex items-center gap-3 py-2.5 text-left hover:bg-dark-hover transition-colors duration-hover rounded-lg", children: [_jsx(Avatar, { name: name, src: user.profile_picture, size: "md" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: name }), _jsx("p", { className: "text-xs text-text-muted truncate", children: user.job_title ? `${user.job_title} · ${dept}` : dept })] })] }) }, user.id));
                            }) })) })] })] }));
}
