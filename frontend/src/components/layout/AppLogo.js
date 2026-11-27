import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
};
export function AppLogo({ size = 'sm', showName = true, className }) {
    return (_jsxs("div", { className: clsx('flex items-center gap-2 min-w-0', className), children: [_jsx("img", { src: "/supershyft-logo.png", alt: "SuperShyft", className: clsx('shrink-0 object-contain', sizeClasses[size]) }), showName && (_jsx("span", { className: "text-sm font-semibold text-text-primary truncate", children: "SuperShyft" }))] }));
}
