import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tasksApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { PriorityBadge } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { STATUS_LABELS } from '../../types';
const KANBAN_COLUMNS = ['to_do', 'in_progress', 'blocked', 'in_review', 'testing', 'completed'];
function SortableTask({ task, onClick }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    return (_jsxs("div", { ref: setNodeRef, style: { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }, ...attributes, ...listeners, onClick: onClick, className: "bg-dark-card rounded-md border border-dark-border p-3 cursor-grab active:cursor-grabbing hover:bg-dark-hover transition-colors duration-hover mb-2", children: [_jsx("p", { className: "text-sm font-medium text-text-primary line-clamp-2 leading-snug", children: task.title }), _jsxs("div", { className: "flex items-center justify-between mt-2.5", children: [_jsx(PriorityBadge, { priority: task.priority }), task.assignees?.length > 0 && _jsx(AvatarGroup, { users: task.assignees.map((a) => a.user).filter(Boolean), max: 2 })] })] }));
}
export function KanbanBoard({ tasks, queryKey = ['tasks-kanban'] }) {
    const { openTask } = useTaskDrawer();
    const [activeTask, setActiveTask] = useState(null);
    const qc = useQueryClient();
    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => tasksApi.updateStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey });
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            toast.success('Status updated');
        },
        onError: () => toast.error('Failed to update status'),
    });
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    const handleDragEnd = (event) => {
        setActiveTask(null);
        const { active, over } = event;
        if (!over)
            return;
        const taskId = active.id;
        const newStatus = String(over.id);
        const task = tasks.find((t) => t.id === taskId);
        if (task && KANBAN_COLUMNS.includes(newStatus) && task.status !== newStatus) {
            statusMutation.mutate({ id: taskId, status: newStatus });
        }
    };
    return (_jsxs(DndContext, { sensors: sensors, collisionDetection: closestCorners, onDragStart: (e) => setActiveTask(tasks.find((t) => t.id === e.active.id) || null), onDragEnd: handleDragEnd, children: [_jsx("div", { className: "flex gap-3 overflow-x-auto pb-4", children: KANBAN_COLUMNS.map((status) => {
                    const columnTasks = tasks.filter((t) => t.status === status);
                    return (_jsxs("div", { className: "flex-shrink-0 w-64", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2 px-1", children: [_jsx("h3", { className: "text-xs font-medium text-text-secondary", children: STATUS_LABELS[status] }), _jsx("span", { className: "text-2xs text-text-muted", children: columnTasks.length })] }), _jsx(SortableContext, { id: status, items: columnTasks.map((t) => t.id), strategy: verticalListSortingStrategy, children: _jsx("div", { id: status, className: "bg-surface-subtle rounded-md p-2 min-h-[120px]", children: columnTasks.map((task) => _jsx(SortableTask, { task: task, onClick: () => openTask(task.id) }, task.id)) }) })] }, status));
                }) }), _jsx(DragOverlay, { children: activeTask && (_jsx("div", { className: "bg-dark-card rounded-md border border-dark-border p-3 w-64 opacity-95 dropdown-panel", children: _jsx("p", { className: "text-sm font-medium text-text-primary", children: activeTask.title }) })) })] }));
}
