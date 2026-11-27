import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
export function EmployeeProfileStrip({ employees, selectedId, onSelect, className, }) {
    if (!employees.length) {
        return (_jsx("p", { className: "text-sm text-text-muted py-3", children: "No employees in this department." }));
    }
    return (_jsx("div", { className: clsx('min-h-0 overflow-y-auto', className), children: _jsx("div", { className: "flex flex-wrap gap-2", children: employees.map((emp) => {
                const name = `${emp.first_name} ${emp.last_name}`.trim();
                const selected = emp.id === selectedId;
                return (_jsxs("button", { type: "button", onClick: () => onSelect(emp.id), className: clsx('inline-flex items-center gap-2 w-fit shrink-0 rounded-full border px-2.5 py-1.5 text-left transition-colors', selected
                        ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                        : 'border-dark-border bg-dark-card text-text-secondary hover:border-text-muted hover:text-text-primary'), "aria-pressed": selected, children: [_jsxs("span", { className: "relative", children: [_jsx(Avatar, { name: name, src: emp.profile_picture ?? undefined, size: "sm" }), _jsx("span", { className: clsx('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-dark-card', emp.has_overdue ? 'bg-accent-danger' : emp.has_submitted ? 'bg-accent-success' : 'bg-text-muted'), title: emp.has_overdue ? 'Has overdue tasks' : emp.has_submitted ? 'Submitted' : 'Pending' })] }), _jsx("span", { className: "text-sm font-medium whitespace-nowrap pr-0.5", children: emp.first_name })] }, emp.id));
            }) }) }));
}
