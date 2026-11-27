import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { format } from 'date-fns';
import { CalendarCheck, CheckCircle2, ClipboardList, Clock, Pencil, Trash2 } from 'lucide-react';
import { attendanceApi, departmentsApi, usersApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { canDeleteUser, canEditUser } from '../../lib/roles';
import { resolveUserDepartmentIds } from '../../lib/userForm';
import { formatTimeTakenHours } from '../../lib/taskTiming';
import { Drawer } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { UserFormModal, emptyUserForm, userToForm } from './UserFormModal';
import { STATUS_LABELS, USER_STATUS_LABELS } from '../../types';
function StatCard({ label, value, hint, icon: Icon, color, }) {
    return (_jsx("div", { className: "rounded-lg border border-dark-border bg-surface-subtle p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("p", { className: clsx('text-2xl font-semibold tabular-nums', color), children: value }), _jsx("p", { className: "text-xs text-text-primary mt-1 font-medium", children: label }), hint && _jsx("p", { className: "text-2xs text-text-muted mt-0.5", children: hint })] }), _jsx(Icon, { className: clsx('h-4 w-4 shrink-0 opacity-70', color) })] }) }));
}
function UserAttendanceSection({ userId }) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { data, isLoading, isError } = useQuery({
        queryKey: ['attendance', 'user', userId, year, month],
        queryFn: () => attendanceApi.userDetail(userId, { year, month }).then((r) => r.data.data),
    });
    const summary = data?.summary;
    const cards = summary
        ? [
            { key: 'wfo', label: 'WFO', value: summary.wfo_count, color: 'metric-emerald' },
            { key: 'wfh', label: 'WFH', value: summary.wfh_count, color: 'metric-sky' },
            { key: 'leave', label: 'Leave', value: summary.leave_count, color: 'metric-amber' },
            { key: 'half', label: 'Half day', value: summary.half_day_count ?? 0, color: 'metric-violet' },
            { key: 'camp', label: 'Camp/Meeting', value: summary.camp_count ?? 0, color: 'metric-orange' },
            {
                key: 'pct',
                label: 'Attendance %',
                value: `${summary.attendance_percent}%`,
                color: 'metric-emerald',
                hint: `${summary.present_count}/${summary.working_days} working days`,
            },
        ]
        : [];
    return (_jsxs("section", { className: "rounded-lg border border-dark-border p-4", "data-testid": "user-attendance-section", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Attendance" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: format(now, 'MMMM yyyy') })] }), _jsx(CalendarCheck, { className: "h-4 w-4 text-text-muted shrink-0" })] }), isLoading ? (_jsx("div", { className: "grid grid-cols-2 gap-3 animate-pulse", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-md bg-dark-muted" }, i))) })) : isError || !summary ? (_jsx("p", { className: "text-sm text-text-muted", children: "Could not load attendance for this user." })) : (_jsx("div", { className: "grid grid-cols-2 gap-3", children: cards.map((c) => (_jsxs("div", { className: "rounded-md border border-dark-border bg-surface-subtle p-3", children: [_jsx("p", { className: "text-2xs uppercase tracking-wider text-text-muted", children: c.label }), _jsx("p", { className: clsx('text-lg font-semibold mt-0.5 tabular-nums', c.color), children: c.value }), 'hint' in c && c.hint ? (_jsx("p", { className: "text-2xs text-text-muted mt-0.5", children: c.hint })) : null] }, c.key))) }))] }));
}
function UserProfileContent({ profile, canEdit, canDelete, onEdit, onDelete, isDeleting, }) {
    const { openTask } = useTaskDrawer();
    const stats = profile.task_stats;
    return (_jsxs("div", { className: "px-6 pt-14 pb-8 space-y-6", children: [_jsxs("header", { children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx(Avatar, { name: `${profile.first_name} ${profile.last_name}`, src: profile.profile_picture, size: "lg" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("h1", { className: "text-lg font-semibold text-text-primary tracking-tight", children: [profile.first_name, " ", profile.last_name] }), _jsx("p", { className: "text-sm text-text-muted mt-0.5 truncate", children: profile.email }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-2", children: [_jsx("span", { className: "chip bg-surface-muted text-text-secondary capitalize", children: profile.role }), _jsx("span", { className: "chip bg-surface-muted text-text-secondary capitalize", children: USER_STATUS_LABELS[profile.status] || profile.status.replace(/_/g, ' ') })] }), profile.job_title && (_jsx("p", { className: "text-sm text-text-secondary mt-2", children: profile.job_title })), profile.departments?.length > 0 && (_jsx("p", { className: "text-xs text-text-muted mt-1", children: profile.departments.map((d) => d.name).join(' · ') }))] })] }), (canEdit || canDelete) && (_jsxs("div", { className: "flex flex-wrap gap-2 mt-4", children: [canEdit && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: onEdit, className: "gap-1.5", children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), " Edit user"] })), canDelete && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: onDelete, disabled: isDeleting, className: "gap-1.5 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20", children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), " Delete user"] }))] }))] }), _jsxs("section", { children: [_jsx("h2", { className: "text-2xs font-medium uppercase tracking-wider text-text-muted mb-2", children: "Task overview" }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsx(StatCard, { label: "Assigned", value: stats.assigned_count, icon: ClipboardList, color: "metric-sky" }), _jsx(StatCard, { label: "Pending", value: stats.pending_count, icon: Clock, color: "metric-amber" }), _jsx(StatCard, { label: "Completed", value: stats.completed_count, hint: `${stats.cancelled_count} cancelled`, icon: CheckCircle2, color: "metric-emerald" })] })] }), _jsx(UserAttendanceSection, { userId: profile.id }), profile.pending_reviews_count > 0 && (_jsxs("p", { className: "text-xs text-text-secondary -mt-3", children: ["Reviewing ", profile.pending_reviews_count, " task", profile.pending_reviews_count === 1 ? '' : 's', " now"] })), _jsxs("section", { children: [_jsxs("h2", { className: "text-2xs font-medium uppercase tracking-wider text-text-muted mb-2", children: ["Assigned tasks \u00B7 ", profile.assigned_tasks.length] }), !profile.assigned_tasks.length ? (_jsx(EmptyState, { title: "No assigned tasks", description: "No active assignments." })) : (_jsx("div", { className: "rounded-lg border border-dark-border overflow-hidden divide-y divide-dark-border", children: profile.assigned_tasks.map((task) => {
                            const dueLabel = task.due_date
                                ? format(new Date(task.due_date), 'MMM d')
                                : null;
                            return (_jsx("button", { type: "button", onClick: () => openTask(task.id), className: "w-full text-left px-4 py-3 hover:bg-dark-hover transition-colors", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: task.title }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-1", children: [_jsx("span", { className: "chip bg-surface-muted text-text-secondary text-2xs capitalize", children: STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ') }), dueLabel && (_jsxs("span", { className: "text-2xs text-text-muted tabular-nums", children: ["Due ", dueLabel] }))] })] }), _jsx("div", { className: "text-right shrink-0 text-2xs tabular-nums", children: _jsx("p", { className: "text-text-secondary", children: formatTimeTakenHours(task.estimated_hours) ?? '—' }) })] }) }, task.id));
                        }) }))] })] }));
}
export function UserDrawer({ userId, onClose }) {
    const { user: currentUser } = useAuth();
    const queryClient = useQueryClient();
    const isAdmin = currentUser?.role === 'administrator';
    const [showEdit, setShowEdit] = useState(false);
    const [editForm, setEditForm] = useState(emptyUserForm());
    const [newDeptInput, setNewDeptInput] = useState('');
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
    useEffect(() => {
        setShowEdit(false);
        setEditForm(emptyUserForm());
        setNewDeptInput('');
    }, [userId]);
    const { data: profile, isLoading, isError } = useQuery({
        queryKey: ['user', userId],
        queryFn: () => usersApi.get(userId).then((r) => r.data.data),
        enabled: !!userId,
    });
    const { data: departments } = useQuery({
        queryKey: ['departments'],
        queryFn: () => departmentsApi.list().then((r) => r.data.data),
        enabled: showEdit,
    });
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!profile)
                return;
            const department_ids = await resolveUserDepartmentIds(editForm, departments);
            return usersApi.update(profile.id, {
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
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-list'] });
            queryClient.invalidateQueries({ queryKey: ['users-meetings-invite'] });
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            if (profile)
                queryClient.invalidateQueries({ queryKey: ['user', profile.id] });
            setShowEdit(false);
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
        mutationFn: (targetUserId) => usersApi.remove(targetUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['users-list'] });
            queryClient.invalidateQueries({ queryKey: ['users-meetings-invite'] });
            toast.success('User deleted permanently');
            onClose();
        },
        onError: (err) => {
            const axiosErr = err;
            toast.error(axiosErr.response?.data?.detail || 'Could not delete user');
        },
    });
    const openEdit = () => {
        if (!profile)
            return;
        setEditForm(userToForm(profile));
        setNewDeptInput('');
        setShowEdit(true);
    };
    const closeEdit = () => {
        setShowEdit(false);
        setEditForm(emptyUserForm());
        setNewDeptInput('');
    };
    const handleDelete = () => {
        if (!profile)
            return;
        const message = `Permanently delete ${profile.first_name} ${profile.last_name}?\n\n` +
            'This removes their account from the database. ' +
            'If they created tasks or comments, deletion may be blocked — use status "inactive" instead.';
        if (!window.confirm(message))
            return;
        deleteMutation.mutate(profile.id);
    };
    const canEdit = profile ? canEditUser(currentUser, profile) : false;
    const canDelete = profile ? canDeleteUser(currentUser, profile) : false;
    return (_jsxs(_Fragment, { children: [_jsxs(Drawer, { isOpen: !!userId, onClose: onClose, children: [isLoading && (_jsxs("div", { className: "px-6 pt-14 pb-8 space-y-4", children: [_jsx(Skeleton, { className: "h-16 w-full" }), _jsx(Skeleton, { className: "h-24 w-full" }), _jsx(Skeleton, { className: "h-40 w-full" })] })), isError && !isLoading && (_jsx("div", { className: "px-6 pt-14 pb-8", children: _jsx(EmptyState, { title: "User not found", description: "This person may have been removed." }) })), profile && !isLoading && (_jsx(UserProfileContent, { profile: profile, canEdit: canEdit, canDelete: canDelete, onEdit: openEdit, onDelete: handleDelete, isDeleting: deleteMutation.isPending }))] }), _jsx(UserFormModal, { isOpen: showEdit, title: profile ? `Edit ${profile.first_name} ${profile.last_name}` : 'Edit user', submitLabel: "Save changes", form: editForm, setForm: setEditForm, roleOptions: roleOptions, departments: departments, newDeptInput: newDeptInput, setNewDeptInput: setNewDeptInput, onClose: closeEdit, onSubmit: () => updateMutation.mutate(), isSubmitting: updateMutation.isPending, showStatus: true })] }));
}
