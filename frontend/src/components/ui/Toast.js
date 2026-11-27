import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
let toastId = 0;
const listeners = [];
let toasts = [];
function notify(message, type = 'info') {
    const toast = { id: ++toastId, message, type };
    toasts = [...toasts, toast];
    listeners.forEach((l) => l(toasts));
    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== toast.id);
        listeners.forEach((l) => l(toasts));
    }, 4000);
}
export const toast = {
    success: (msg) => notify(msg, 'success'),
    error: (msg) => notify(msg, 'error'),
    info: (msg) => notify(msg, 'info'),
};
export function ToastContainer() {
    const [items, setItems] = useState([]);
    useEffect(() => {
        listeners.push(setItems);
        return () => { listeners.splice(listeners.indexOf(setItems), 1); };
    }, []);
    const colors = {
        success: 'dropdown-panel border-accent-success/30 badge-approved',
        error: 'dropdown-panel border-accent-danger/30 badge-blocked',
        info: 'dropdown-panel border-dark-border text-text-primary',
    };
    return (_jsx("div", { className: "fixed bottom-4 right-4 z-[100] space-y-2", children: items.map((t) => (_jsxs("div", { className: clsx('flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[280px] text-sm transition-all duration-status', colors[t.type]), children: [_jsx("span", { className: "flex-1", children: t.message }), _jsx("button", { onClick: () => setItems((prev) => prev.filter((x) => x.id !== t.id)), className: "text-text-muted hover:text-text-primary", children: _jsx(X, { className: "h-4 w-4 opacity-60" }) })] }, t.id))) }));
}
