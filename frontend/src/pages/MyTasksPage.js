import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { tasksApi } from '../services/endpoints';
import { useTaskDrawer } from '../contexts/TaskDrawerContext';
import { useAuth } from '../contexts/AuthContext';
import { canDeleteTasks } from '../lib/roles';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDeleteTaskMutation } from '../hooks/useDeleteTaskMutation';
import { TaskDatabase, TaskDatabaseSkeleton } from '../components/tasks/TaskDatabase';
import { MobileTaskCard } from '../components/tasks/MobileTaskCard';
import { DeleteTaskModal } from '../components/tasks/DeleteTaskModal';
import { CompletedTasksList } from '../components/tasks/CompletedTasksList';
import { FloatingActionButton } from '../components/layout/FloatingActionButton';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { groupTasksByDue } from '../components/tasks/TaskCard';
import { SELECTABLE_STATUS_OPTIONS } from '../types';
function TaskList({ tasks, onTaskClick, onDeleteTask, onStatusChange, selectedIds, onSelectionChange, }) {
    const isMobile = useIsMobile();
    if (isMobile) {
        return (_jsx("div", { className: "space-y-2 md:hidden", children: tasks.map((task) => (_jsx(MobileTaskCard, { task: task, onClick: () => onTaskClick(task.id) }, task.id))) }));
    }
    return (_jsx(TaskDatabase, { tasks: tasks, onTaskClick: onTaskClick, onDeleteTask: onDeleteTask, onStatusChange: onStatusChange, editable: !!onStatusChange, selectedIds: selectedIds, onSelectionChange: onSelectionChange }));
}
function Section({ title, count, children }) {
    return (_jsxs("section", { className: "mb-10", children: [_jsxs("h2", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-3 px-1", children: [title, count !== undefined ? ` · ${count}` : ''] }), children] }));
}
function CollapsibleSection({ title, count, defaultOpen = false, children, }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("section", { className: "mb-10", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-2 mb-3 px-1 text-left group", "aria-expanded": open, children: [_jsx(ChevronDown, { className: clsx('h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200', !open && '-rotate-90') }), _jsxs("h2", { className: "text-xs font-medium uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors", children: [title, count !== undefined ? ` · ${count}` : ''] })] }), open && children] }));
}
export default function MyTasksPage() {
    const { openTask, closeTask, selectedTaskId, openCreate } = useTaskDrawer();
    const { user } = useAuth();
    const qc = useQueryClient();
    const isMobile = useIsMobile();
    const allowDelete = canDeleteTasks(user);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const deleteMutation = useDeleteTaskMutation((taskId) => {
        setDeleteTarget(null);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
        });
        if (selectedTaskId === taskId)
            closeTask();
    });
    const requestDeleteTask = (task) => {
        setDeleteTarget({ id: task.id, title: task.title });
    };
    const { data: tasks, isLoading } = useQuery({
        queryKey: ['my-tasks'],
        queryFn: () => tasksApi.my().then((r) => r.data.data),
        enabled: !showCompleted,
    });
    const { data: completedTasks, isLoading: completedLoading } = useQuery({
        queryKey: ['my-tasks', 'completed', user?.id],
        enabled: showCompleted && !!user?.id,
        queryFn: async () => {
            const filters = {
                archived: true,
                assignee_id: user.id,
                page: 1,
                page_size: 500,
                sort_by: 'deleted_at',
                sort_order: 'desc',
            };
            const first = (await tasksApi.list(filters)).data.data;
            if (!first.total_pages || first.total_pages <= 1)
                return first.items;
            const items = [...first.items];
            for (let p = 2; p <= first.total_pages; p += 1) {
                const next = await tasksApi.list({ ...filters, page: p });
                items.push(...next.data.data.items);
            }
            return items;
        },
    });
    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => tasksApi.updateStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            toast.success('Status updated');
        },
        onError: () => toast.error('Failed to update status'),
    });
    const bulkMutation = useMutation({
        mutationFn: async ({ ids, status }) => {
            await Promise.all(ids.map((id) => tasksApi.updateStatus(id, status)));
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            setSelectedIds(new Set());
            toast.success('Tasks updated');
        },
        onError: () => toast.error('Could not update selected tasks'),
    });
    const groups = useMemo(() => groupTasksByDue(tasks || []), [tasks]);
    if ((!showCompleted && isLoading) || (showCompleted && completedLoading)) {
        return _jsx(TaskDatabaseSkeleton, {});
    }
    const openCount = (tasks || []).filter((t) => !['completed', 'cancelled'].includes(t.status)).length;
    const listProps = {
        onTaskClick: openTask,
        onDeleteTask: allowDelete ? requestDeleteTask : undefined,
        onStatusChange: (id, status) => statusMutation.mutate({ id, status }),
        selectedIds,
        onSelectionChange: setSelectedIds,
    };
    return (_jsxs("div", { className: "w-full pb-12", children: [_jsxs("header", { className: "mb-8 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary", children: "My Tasks" }), _jsx("p", { className: "text-sm text-text-muted mt-0.5", children: showCompleted
                                    ? `${completedTasks?.length ?? 0} completed`
                                    : `${openCount} open` })] }), !showCompleted && (_jsxs(Button, { onClick: () => openCreate(), size: "sm", className: "h-9 px-2.5 py-0 shrink-0 gap-1.5", "aria-label": "New task", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "New task" })] }))] }), _jsx("div", { className: "flex items-center gap-1.5 mb-5 overflow-x-auto flex-nowrap pb-0.5 -mx-1 px-1", children: [
                    { id: 'active', label: 'Active' },
                    { id: 'completed', label: 'Completed' },
                ].map((opt) => {
                    const active = showCompleted ? opt.id === 'completed' : opt.id === 'active';
                    return (_jsx("button", { type: "button", onClick: () => {
                            setShowCompleted(opt.id === 'completed');
                            setSelectedIds(new Set());
                        }, className: clsx('shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors', active
                            ? 'bg-accent-primary text-white'
                            : 'bg-dark-card border border-dark-border text-text-secondary hover:bg-dark-hover'), children: opt.label }, opt.id));
                }) }), showCompleted ? (_jsx(CompletedTasksList, { tasks: completedTasks || [], onTaskClick: openTask })) : (_jsxs(_Fragment, { children: [selectedIds.size > 0 && (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 mb-4 rounded-md bg-surface-subtle border border-dark-border max-md:hidden", children: [_jsxs("span", { className: "text-sm text-text-secondary", children: [selectedIds.size, " selected"] }), _jsxs("select", { className: "input py-1 text-xs w-auto", defaultValue: "", onChange: (e) => {
                                    if (!e.target.value)
                                        return;
                                    bulkMutation.mutate({ ids: Array.from(selectedIds), status: e.target.value });
                                    e.target.value = '';
                                }, children: [_jsx("option", { value: "", disabled: true, children: "Change status" }), SELECTABLE_STATUS_OPTIONS.map(({ value, label }) => (_jsx("option", { value: value, children: label }, value)))] }), _jsxs("button", { type: "button", onClick: () => setSelectedIds(new Set()), className: "toolbar-btn ml-auto text-text-muted", children: [_jsx(X, { className: "h-3.5 w-3.5" }), " Clear"] })] })), !tasks?.length ? (_jsx(EmptyState, { title: "Nothing assigned yet", description: "Create a task or wait for one to be assigned to you.", action: _jsxs(Button, { onClick: () => openCreate(), className: "mt-2 gap-1.5", children: [_jsx(Plus, { className: "h-4 w-4" }), "New task"] }) })) : (_jsxs(_Fragment, { children: [groups.today.length > 0 && _jsx(Section, { title: "Today's tasks", count: groups.today.length, children: _jsx(TaskList, { tasks: groups.today, ...listProps }) }), groups.thisWeek.length > 0 && _jsx(Section, { title: "This week", count: groups.thisWeek.length, children: _jsx(TaskList, { tasks: groups.thisWeek, ...listProps }) }), groups.nextWeek.length > 0 && _jsx(Section, { title: "Next week", count: groups.nextWeek.length, children: _jsx(TaskList, { tasks: groups.nextWeek, ...listProps }) }), groups.overdue.length > 0 && _jsx(Section, { title: "Overdue", count: groups.overdue.length, children: _jsx(TaskList, { tasks: groups.overdue, ...listProps }) }), groups.blocked.length > 0 && _jsx(Section, { title: "Blocked", count: groups.blocked.length, children: _jsx(TaskList, { tasks: groups.blocked, ...listProps }) }), groups.review.length > 0 && _jsx(Section, { title: "Waiting for review", count: groups.review.length, children: _jsx(TaskList, { tasks: groups.review, ...listProps }) }), groups.later.length > 0 && _jsx(Section, { title: "Upcoming", count: groups.later.length, children: _jsx(TaskList, { tasks: groups.later, ...listProps }) }), groups.completed.length > 0 && (_jsx(CollapsibleSection, { title: "Completed", count: groups.completed.length, defaultOpen: false, children: _jsx(TaskList, { tasks: groups.completed, ...listProps }) })), groups.cancelled.length > 0 && (_jsx(CollapsibleSection, { title: "Cancelled", count: groups.cancelled.length, defaultOpen: false, children: _jsx(TaskList, { tasks: groups.cancelled, ...listProps }) }))] }))] })), isMobile && !showCompleted && _jsx(FloatingActionButton, { onClick: () => openCreate() }), allowDelete && (_jsx(DeleteTaskModal, { isOpen: deleteTarget != null, taskTitle: deleteTarget?.title, onClose: () => setDeleteTarget(null), onConfirm: (reason) => {
                    if (deleteTarget)
                        deleteMutation.mutate({ id: deleteTarget.id, reason });
                }, isPending: deleteMutation.isPending }))] }));
}
