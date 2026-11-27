import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Skeleton({ className = '' }) {
    return _jsx("div", { className: `animate-pulse rounded-md bg-dark-muted ${className}` });
}
export function TaskListSkeleton() {
    return (_jsx("div", { className: "space-y-1", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-11 rounded-md bg-dark-muted animate-pulse" }, i))) }));
}
export function DashboardSkeleton() {
    return (_jsxs("div", { className: "space-y-8", children: [_jsx(Skeleton, { className: "h-8 w-64" }), _jsx("div", { className: "space-y-1", children: Array.from({ length: 5 }).map((_, i) => _jsx(Skeleton, { className: "h-11" }, i)) })] }));
}
export function EmptyState({ title, description, action }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 text-center px-4", children: [_jsx("p", { className: "text-sm font-medium text-text-secondary", children: title }), description && _jsx("p", { className: "text-xs text-text-muted mt-1 max-w-xs", children: description }), action && _jsx("div", { className: "mt-4", children: action })] }));
}
