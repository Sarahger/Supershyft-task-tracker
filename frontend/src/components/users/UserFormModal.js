import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { USER_STATUSES, USER_STATUS_LABELS } from '../../types';
export const emptyUserForm = () => ({
    first_name: '',
    last_name: '',
    email: '',
    role: 'employee',
    status: 'active',
    job_title: '',
    phone: '',
    department_ids: [],
    new_department_names: [],
});
export function userToForm(user) {
    return {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        job_title: user.job_title || '',
        phone: user.phone || '',
        department_ids: user.departments?.map((d) => d.id) ?? [],
        new_department_names: [],
    };
}
export function UserFormModal({ isOpen, title, submitLabel, form, setForm, roleOptions, departments, newDeptInput, setNewDeptInput, onClose, onSubmit, isSubmitting, showStatus = false, }) {
    const selectedDepartments = form.department_ids
        .map((id) => departments?.find((d) => d.id === id))
        .filter(Boolean);
    const availableDepartments = (departments ?? []).filter((d) => !form.department_ids.includes(d.id));
    const addExistingDepartment = (deptId) => {
        if (!deptId || form.department_ids.includes(deptId))
            return;
        setForm((prev) => ({ ...prev, department_ids: [...prev.department_ids, deptId] }));
    };
    const removeDepartment = (deptId) => {
        setForm((prev) => ({
            ...prev,
            department_ids: prev.department_ids.filter((id) => id !== deptId),
        }));
    };
    const addNewDepartmentName = () => {
        const name = newDeptInput.trim();
        if (!name)
            return;
        const existing = departments?.find((d) => d.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            addExistingDepartment(existing.id);
        }
        else if (!form.new_department_names.some((n) => n.toLowerCase() === name.toLowerCase())) {
            setForm((prev) => ({
                ...prev,
                new_department_names: [...prev.new_department_names, name],
            }));
        }
        setNewDeptInput('');
    };
    const removeNewDepartmentName = (name) => {
        setForm((prev) => ({
            ...prev,
            new_department_names: prev.new_department_names.filter((n) => n !== name),
        }));
    };
    const canSubmit = form.first_name.trim() && form.last_name.trim() && form.email.trim();
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, title: title, children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsx(Input, { label: "First name", value: form.first_name, onChange: (e) => setForm({ ...form, first_name: e.target.value }) }), _jsx(Input, { label: "Last name", value: form.last_name, onChange: (e) => setForm({ ...form, last_name: e.target.value }) })] }), _jsx(Input, { label: "Email", type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }), !showStatus && (_jsx("p", { className: "text-xs text-text-muted -mt-2", children: "Users sign in with a one-time email code \u2014 no password needed." })), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsx(Select, { label: "Role", value: form.role, onChange: (e) => setForm({ ...form, role: e.target.value }), options: roleOptions }), showStatus && (_jsx(Select, { label: "Status", value: form.status, onChange: (e) => setForm({ ...form, status: e.target.value }), options: USER_STATUSES.map((status) => ({
                                value: status,
                                label: USER_STATUS_LABELS[status],
                            })) }))] }), _jsx(Input, { label: "Job title", value: form.job_title, onChange: (e) => setForm({ ...form, job_title: e.target.value }) }), _jsx(Input, { label: "Phone", value: form.phone, onChange: (e) => setForm({ ...form, phone: e.target.value }) }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-text-secondary mb-2", children: "Departments" }), _jsxs("div", { className: "flex flex-wrap gap-2 min-h-[2rem] mb-2", children: [selectedDepartments.map((d) => (_jsxs("span", { className: "dept-chip-existing", children: [_jsx("span", { className: "text-sm text-text-primary", children: d.name }), _jsx("button", { type: "button", onClick: () => removeDepartment(d.id), className: "rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors", "aria-label": `Remove ${d.name}`, children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }, `existing-${d.id}`))), form.new_department_names.map((name) => (_jsxs("span", { className: "dept-chip-new", children: [_jsx("span", { className: "text-sm text-text-primary", children: name }), _jsx("span", { className: "dept-chip-new-label", children: "new" }), _jsx("button", { type: "button", onClick: () => removeNewDepartmentName(name), className: "rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors", "aria-label": `Remove ${name}`, children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }, `new-${name}`))), !selectedDepartments.length && !form.new_department_names.length && (_jsx("p", { className: "text-sm text-text-muted py-1", children: "No departments selected" }))] }), availableDepartments.length > 0 && (_jsxs("select", { value: "", onChange: (e) => addExistingDepartment(Number(e.target.value)), className: "input text-sm mb-2", "aria-label": "Add existing department", children: [_jsx("option", { value: "", children: "Add existing department\u2026" }), availableDepartments.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: newDeptInput, onChange: (e) => setNewDeptInput(e.target.value), placeholder: "Or type a new department name", onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addNewDepartmentName();
                                        }
                                    } }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: addNewDepartmentName, disabled: !newDeptInput.trim(), className: "shrink-0 mt-auto", children: "Add" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(Button, { variant: "secondary", onClick: onClose, children: "Cancel" }), _jsx(Button, { onClick: onSubmit, loading: isSubmitting, disabled: !canSubmit, children: submitLabel })] })] }) }));
}
