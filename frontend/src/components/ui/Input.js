import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { forwardRef } from 'react';
export const Input = forwardRef(({ label, error, className, ...props }, ref) => (_jsxs("div", { className: "space-y-1.5", children: [label && _jsx("label", { className: "block text-xs font-medium text-text-secondary", children: label }), _jsx("input", { ref: ref, className: clsx('input', error && 'border-red-400', className), ...props }), error && _jsx("p", { className: "text-xs text-red-400", children: error })] })));
Input.displayName = 'Input';
export function Textarea({ label, className, ...props }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [label && _jsx("label", { className: "block text-xs font-medium text-text-secondary", children: label }), _jsx("textarea", { className: clsx('input resize-none', className), ...props })] }));
}
export function Select({ label, options, className, ...props }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [label && _jsx("label", { className: "block text-xs font-medium text-text-secondary", children: label }), _jsx("select", { className: clsx('input', className), ...props, children: options.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) })] }));
}
