import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';
const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl', xl: 'max-w-3xl', '2xl': 'max-w-5xl' };
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape')
            onClose(); };
        if (isOpen)
            document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)]", onClick: onClose }), _jsxs("div", { className: clsx('relative w-full rounded-2xl bg-dark-card border border-dark-border modal-panel', 'max-h-[min(90vh,calc(100dvh-2rem))] flex flex-col my-auto', sizes[size]), children: [title && (_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: title }), _jsx("button", { onClick: onClose, className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover", children: _jsx(X, { className: "h-4 w-4" }) })] })), _jsx("div", { className: "p-5 overflow-y-auto overscroll-contain min-h-0", children: children })] })] }));
}
export function Drawer({ isOpen, onClose, children }) {
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
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex justify-end", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)] transition-opacity duration-drawer", onClick: onClose }), _jsxs("div", { className: clsx('relative w-full max-w-[680px] sm:max-w-[720px] bg-dark-drawer flex flex-col h-full border-l border-dark-border drawer-panel', 'animate-slide-in max-sm:max-w-full'), children: [_jsx("button", { onClick: onClose, className: "absolute top-4 right-4 z-10 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) }), _jsx("div", { className: "flex-1 overflow-y-auto", children: children })] })] }));
}
export function DrawerSection({ title, children, defaultOpen = true }) {
    return (_jsxs("details", { open: defaultOpen, className: "drawer-section group", children: [_jsxs("summary", { className: "text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer list-none flex items-center justify-between select-none", children: [title, _jsx(Chevron, { className: "group-open:rotate-180 transition-transform duration-hover" })] }), _jsx("div", { className: "mt-3", children: children })] }));
}
function Chevron({ className }) {
    return (_jsx("svg", { className: clsx('h-3 w-3 text-text-muted', className), viewBox: "0 0 12 12", fill: "currentColor", children: _jsx("path", { d: "M2.5 4.5L6 8l3.5-3.5", stroke: "currentColor", strokeWidth: "1.5", fill: "none" }) }));
}
