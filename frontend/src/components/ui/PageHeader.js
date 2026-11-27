import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowLeft } from 'lucide-react';
export function PageHeader({ title, subtitle, action, onMobileBack }) {
    return (_jsxs("div", { className: "mb-8", children: [onMobileBack && (_jsxs("button", { type: "button", onClick: onMobileBack, className: "md:hidden flex items-center gap-2 -ml-1 mb-3 text-sm text-text-secondary hover:text-text-primary transition-colors min-h-[44px]", "aria-label": "Go back", children: [_jsx(ArrowLeft, { className: "h-5 w-5 shrink-0" }), _jsx("span", { children: "Back" })] })), _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-[1.75rem] font-semibold text-text-primary tracking-tight leading-tight", children: title }), subtitle && _jsx("p", { className: "text-sm text-text-secondary mt-1", children: subtitle })] }), action && (_jsx("div", { className: "shrink-0 flex justify-end md:justify-start", children: action }))] })] }));
}
export function WorkspaceSection({ title, count, children, empty }) {
    const isEmpty = empty !== undefined;
    return (_jsxs("section", { className: "workspace-section", children: [_jsxs("h2", { className: "workspace-section-title", children: [title, count !== undefined ? ` · ${count}` : ''] }), isEmpty ? empty : children] }));
}
