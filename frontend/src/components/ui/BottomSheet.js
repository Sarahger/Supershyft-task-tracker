import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
export function BottomSheet({ isOpen, onClose, title, children, className }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape')
            onClose(); };
        if (isOpen) {
            document.addEventListener('keydown', handler);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handler);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex flex-col justify-end md:hidden pointer-events-none", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)] animate-in fade-in duration-200 pointer-events-auto", onClick: onClose, "aria-hidden": true }), _jsxs("div", { role: "dialog", "aria-modal": true, onClick: (e) => e.stopPropagation(), className: clsx('relative w-full max-h-[85vh] rounded-t-2xl bg-dark-card border-t border-dark-border pointer-events-auto', 'dropdown-panel animate-in slide-in-from-bottom duration-300 flex flex-col', className), style: { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }, children: [_jsx("div", { className: "flex items-center justify-center pt-2 pb-1 shrink-0", children: _jsx("div", { className: "h-1 w-10 rounded-full bg-dark-border" }) }), title && (_jsxs("div", { className: "flex items-center justify-between px-4 pb-3 shrink-0", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: title }), _jsx("button", { type: "button", onClick: onClose, className: "p-2 -mr-1 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) })] })), _jsx("div", { className: "flex-1 overflow-y-auto overscroll-contain px-4 pb-4", children: children })] })] }));
}
