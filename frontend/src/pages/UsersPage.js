import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { usersApi, departmentsApi } from '../services/endpoints';
import { useUserDrawer } from '../contexts/UserDrawerContext';
import { UserFormModal, emptyUserForm, userToForm } from '../components/users/UserFormModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures, canDeleteUser, canEditUser, canManageUsers, } from '../lib/roles';
import { USER_STATUSES, USER_STATUS_LABELS } from '../types';
import { resolveUserDepartmentIds } from '../lib/userForm';
const STATUS_CHIP = {
    active: 'status-chip-active',
    on_leave: 'status-chip-leave',
    inactive: 'status-chip-inactive',
};
function UserStatusControl({ user, canEdit, onChange, isPending, }) {
    const chipClass = STATUS_CHIP[user.status] || 'bg-dark-muted text-text-muted border-dark-border';
    if (!canEdit) {
        return (_jsx("span", { className: clsx(chipClass), children: USER_STATUS_LABELS[user.status] || user.status.replace(/_/g, ' ') }));
    }
    return (_jsx("select", { value: user.status, disabled: isPending, onChange: (e) => onChange(user.id, e.target.value), className: clsx('chip border cursor-pointer appearance-none pr-7 max-w-full truncate', 'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]', 'disabled:opacity-50 disabled:cursor-not-allowed', chipClass), "aria-label": `Status for ${user.first_name} ${user.last_name}`, children: USER_STATUSES.map((status) => (_jsx("option", { value: status, children: USER_STATUS_LABELS[status] }, status))) }));
}
function UsersTable({ users, canManageStatus, canAddOrRemoveUsers, currentUser, onOpenUser, onStatusChange, onEdit, onDelete, statusPendingUserId, deletePending, rowClassName, }) {
    return (_jsx("div", { className: "card overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-dark-border", children: [_jsx("th", { className: "text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "User" }), _jsx("th", { className: "text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Role" }), _jsx("th", { className: "text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Departments" }), _jsx("th", { className: "text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Job Title" }), canAddOrRemoveUsers && (_jsx("th", { className: "text-right px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Actions" }))] }) }), _jsx("tbody", { children: users.map((u) => (_jsxs("tr", { onClick: () => onOpenUser(u.id), className: clsx('border-b border-dark-border hover:bg-dark-hover transition-colors duration-hover cursor-pointer', rowClassName), children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { name: `${u.first_name} ${u.last_name}`, src: u.profile_picture, size: "sm" }), _jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium text-text-primary", children: [u.first_name, " ", u.last_name] }), _jsx("p", { className: "text-xs text-text-muted", children: u.email })] })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: "chip bg-dark-muted text-text-secondary capitalize", children: u.role }) }), _jsx("td", { className: "px-4 py-3 text-sm text-text-secondary", children: u.departments?.map((d) => d.name).join(', ') || '—' }), _jsx("td", { className: "px-4 py-3", onClick: (e) => e.stopPropagation(), children: _jsx(UserStatusControl, { user: u, canEdit: canManageStatus, onChange: onStatusChange, isPending: statusPendingUserId === u.id }) }), _jsx("td", { className: "px-4 py-3 text-sm text-text-secondary", children: u.job_title || '—' }), canAddOrRemoveUsers && (_jsx("td", { className: "px-4 py-3 text-right", onClick: (e) => e.stopPropagation(), children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [canEditUser(currentUser, u) && (_jsx("button", { type: "button", onClick: () => onEdit(u), className: "toolbar-btn text-text-muted hover:text-text-primary", title: "Edit user", children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) })), canDeleteUser(currentUser, u) && (_jsx("button", { type: "button", onClick: () => onDelete(u), disabled: deletePending, className: "toolbar-btn text-text-muted hover:text-red-400", title: "Delete user permanently", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }))] }) }))] }, u.id))) })] }) }));
}
export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const { openUser } = useUserDrawer();
    const queryClient = useQueryClient();
    const isAdmin = currentUser?.role === 'administrator';
    const canManageStatus = canAccessManagerFeatures(currentUser);
    const canAddOrRemoveUsers = canManageUsers(currentUser);
    const roleOptions = isAdmin
        ? [
            { value: 'employee', label: 'Employee' },
            { value: 'manager', label: 'Manager' },
            { value: 'administrator', label: 'Administrator' },
        ]
        : [
            { value: 'employee', label: 'Employee' },
            { value: 'manager', label: 'Manager' },
        ];
    const [showCreate, setShowCreate] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [createForm, setCreateForm] = useState(emptyUserForm);
    const [editForm, setEditForm] = useState(emptyUserForm);
    const [newDeptInput, setNewDeptInput] = useState('');
    const { data, isLoading } = useQuery({
        queryKey: ['users', { include_inactive: true }],
        queryFn: () => usersApi.list({ page_size: 100, include_inactive: true }).then((r) => r.data.data.items),
    });
    const activeUsers = useMemo(() => (data ?? []).filter((u) => u.status !== 'inactive'), [data]);
    const inactiveUsers = useMemo(() => (data ?? []).filter((u) => u.status === 'inactive'), [data]);
    const { data: departments } = useQuery({
        queryKey: ['departments'],
        queryFn: () => departmentsApi.list().then((r) => r.data.data),
        enabled: showCreate || !!editingUser,
    });
    const invalidateUserLists = () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['users-list'] });
        queryClient.invalidateQueries({ queryKey: ['users-meetings-invite'] });
    };
    const statusMutation = useMutation({
        mutationFn: ({ userId, status }) => usersApi.update(userId, { status }),
        onSuccess: (_res, { status }) => {
            invalidateUserLists();
            toast.success(`Status updated to ${USER_STATUS_LABELS[status] || status}`);
        },
        onError: () => toast.error('Could not update user status'),
    });
    const createMutation = useMutation({
        mutationFn: async () => {
            const department_ids = await resolveUserDepartmentIds(createForm, departments);
            return usersApi.create({
                first_name: createForm.first_name.trim(),
                last_name: createForm.last_name.trim(),
                email: createForm.email.trim(),
                role: createForm.role,
                job_title: createForm.job_title.trim() || undefined,
                department_ids: department_ids.length ? department_ids : undefined,
            });
        },
        onSuccess: () => {
            invalidateUserLists();
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setShowCreate(false);
            setCreateForm(emptyUserForm());
            setNewDeptInput('');
            toast.success('User created');
        },
        onError: () => toast.error('Could not create user'),
    });
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editingUser)
                return;
            const department_ids = await resolveUserDepartmentIds(editForm, departments);
            return usersApi.update(editingUser.id, {
                first_name: editForm.first_name.trim(),
                last_name: editForm.last_name.trim(),
                email: editForm.email.trim(),
                role: editForm.role,
                status: editForm.status,
                job_title: editForm.job_title.trim() || undefined,
                phone: editForm.phone.trim() || undefined,
                department_ids,
            });
        },
        onSuccess: () => {
            invalidateUserLists();
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            if (editingUser)
                queryClient.invalidateQueries({ queryKey: ['user', editingUser.id] });
            setEditingUser(null);
            setEditForm(emptyUserForm());
            setNewDeptInput('');
            toast.success('User updated');
        },
        onError: (err) => {
            const axiosErr = err;
            toast.error(axiosErr.response?.data?.detail || 'Could not update user');
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (userId) => usersApi.remove(userId),
        onSuccess: () => {
            invalidateUserLists();
            toast.success('User deleted permanently');
        },
        onError: (err) => {
            const axiosErr = err;
            toast.error(axiosErr.response?.data?.detail || 'Could not delete user');
        },
    });
    const handleStatusChange = (userId, status) => {
        const target = data?.find((u) => u.id === userId);
        if (!target || target.status === status)
            return;
        statusMutation.mutate({ userId, status });
    };
    const openEdit = (user) => {
        setEditingUser(user);
        setEditForm(userToForm(user));
        setNewDeptInput('');
    };
    const handleDelete = (user) => {
        const message = `Permanently delete ${user.first_name} ${user.last_name}?\n\n` +
            'This removes their account from the database. ' +
            'If they created tasks or comments, deletion may be blocked — use status "inactive" instead.';
        if (!window.confirm(message))
            return;
        deleteMutation.mutate(user.id);
    };
    const closeCreateModal = () => {
        setShowCreate(false);
        setCreateForm(emptyUserForm());
        setNewDeptInput('');
    };
    const closeEditModal = () => {
        setEditingUser(null);
        setEditForm(emptyUserForm());
        setNewDeptInput('');
    };
    const tableProps = {
        canManageStatus,
        canAddOrRemoveUsers,
        currentUser,
        onOpenUser: openUser,
        onStatusChange: handleStatusChange,
        onEdit: openEdit,
        onDelete: handleDelete,
        statusPendingUserId: statusMutation.isPending ? statusMutation.variables?.userId : undefined,
        deletePending: deleteMutation.isPending,
    };
    if (isLoading)
        return _jsx("div", { className: "animate-pulse h-64 bg-dark-muted rounded-lg" });
    return (_jsxs("div", { className: "max-w-workspace mx-auto pb-12", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 mb-6", children: [_jsx(PageHeader, { title: "Users", subtitle: `${activeUsers.length} people · click a row for details` }), canAddOrRemoveUsers && (_jsxs(Button, { size: "sm", onClick: () => setShowCreate(true), className: "gap-1.5 shrink-0", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Add user"] }))] }), !activeUsers.length && !inactiveUsers.length ? (_jsx(EmptyState, { title: "No users found" })) : (_jsxs("div", { className: "space-y-8", children: [activeUsers.length ? (_jsx(UsersTable, { users: activeUsers, ...tableProps })) : (_jsx(EmptyState, { title: "No active users" })), inactiveUsers.length > 0 && (_jsxs("section", { children: [_jsxs("div", { className: "mb-3", children: [_jsx("h2", { className: "text-sm font-medium text-text-secondary", children: "Inactive" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Hidden from tasks, updates, attendance, and invites until reactivated" })] }), _jsx(UsersTable, { users: inactiveUsers, ...tableProps, rowClassName: "opacity-70" })] }))] })), _jsx(UserFormModal, { isOpen: showCreate, title: "Add user", submitLabel: "Create user", form: createForm, setForm: setCreateForm, roleOptions: roleOptions, departments: departments, newDeptInput: newDeptInput, setNewDeptInput: setNewDeptInput, onClose: closeCreateModal, onSubmit: () => createMutation.mutate(), isSubmitting: createMutation.isPending }), _jsx(UserFormModal, { isOpen: !!editingUser, title: editingUser ? `Edit ${editingUser.first_name} ${editingUser.last_name}` : 'Edit user', submitLabel: "Save changes", form: editForm, setForm: setEditForm, roleOptions: roleOptions, departments: departments, newDeptInput: newDeptInput, setNewDeptInput: setNewDeptInput, onClose: closeEditModal, onSubmit: () => updateMutation.mutate(), isSubmitting: updateMutation.isPending, showStatus: true })] }));
}
