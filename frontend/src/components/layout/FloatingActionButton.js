import { jsx as _jsx } from "react/jsx-runtime";
import { Plus } from 'lucide-react';
import clsx from 'clsx';
export function FloatingActionButton({ onClick, label = 'Create task', className }) {
    return (_jsx("button", { type: "button", onClick: onClick, "aria-label": label, className: clsx('mobile-fab fixed z-30 md:hidden flex items-center justify-center', 'h-14 w-14 rounded-full bg-accent-primary text-white shadow-lg', 'hover:opacity-90 active:scale-95 transition-all duration-200', 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2', className), children: _jsx(Plus, { className: "h-6 w-6 stroke-[2.5]" }) }));
}
